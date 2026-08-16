import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

const API = '/flashcards/api'
const EMPTY_CARD = { front: '', back: '' }
const BULK_PROMPT = 'Create flashcards as valid JSON only. Return an array where every item has exactly two string fields: "front" and "back". Example: [{"front":"Hello","back":"שלום"}]. Do not use Markdown or add any explanation.'
const DECK_COLORS = ['#ffffff', '#f2c7cf', '#f1c5ad', '#efd69a', '#cde3ad', '#bde0d7', '#acdfe9', '#bfd5f5', '#d6c4eb']
const DARK_DECK_COLORS = {
  '#ffffff': '#343b47',
  '#f2c7cf': '#633743',
  '#f1c5ad': '#6a402d',
  '#efd69a': '#625126',
  '#cde3ad': '#40582f',
  '#bde0d7': '#2d5951',
  '#acdfe9': '#276071',
  '#bfd5f5': '#314f7c',
  '#d6c4eb': '#4f3b6d',
}

let audioContext

function tone(context, { at = 0, duration = .1, from, to = from, gain = .07, type = 'sine' }) {
  const oscillator = context.createOscillator()
  const volume = context.createGain()
  const start = context.currentTime + at
  oscillator.type = type
  oscillator.frequency.setValueAtTime(from, start)
  oscillator.frequency.exponentialRampToValueAtTime(to, start + duration)
  volume.gain.setValueAtTime(.0001, start)
  volume.gain.exponentialRampToValueAtTime(gain, start + .008)
  volume.gain.exponentialRampToValueAtTime(.0001, start + duration)
  oscillator.connect(volume).connect(context.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + .02)
}

function noise(context, { duration = .1, gain = .035, frequency = 900 }) {
  const length = Math.ceil(context.sampleRate * duration)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const volume = context.createGain()
  filter.type = 'bandpass'
  filter.frequency.value = frequency
  filter.Q.value = .8
  volume.gain.setValueAtTime(gain, context.currentTime)
  volume.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration)
  source.buffer = buffer
  source.connect(filter).connect(volume).connect(context.destination)
  source.start()
}

function playSound(id) {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return
  audioContext ??= new AudioContext()
  audioContext.resume()
  const sounds = {
    'deck-soft': () => tone(audioContext, { from: 360, to: 290, duration: .09, type: 'triangle' }),
    'known-rise': () => [523, 659, 784].forEach((from, index) => tone(audioContext, { at: index * .055, from, duration: .15, gain: .045, type: 'triangle' })),
    'missed-fall-high': () => { tone(audioContext, { from: 660, to: 587, duration: .12, gain: .062, type: 'sine' }); tone(audioContext, { at: .07, from: 523, to: 440, duration: .16, gain: .055, type: 'sine' }) },
    'flip-pop': () => { tone(audioContext, { from: 460, to: 920, duration: .075, gain: .082, type: 'sine' }); noise(audioContext, { duration: .035, gain: .014, frequency: 1400 }) },
  }
  sounds[id]?.()
}

async function request(url, options) {
  const response = await fetch(url, options)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || 'Something went wrong')
  }
  return response.status === 204 ? null : response.json()
}

function jsonOptions(method, body) {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

function shuffled(items) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

function ArrowIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
}

function CheckIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>
}

function CrossIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17" /></svg>
}

function PlusIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
}

function ImportIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v12m-4-4 4 4 4-4M5 18v3h14v-3" /></svg>
}

function ChevronIcon({ direction }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 6 6 6-6 6'} /></svg>
}

function TrashIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>
}

function ThemeIcon({ dark }) {
  return dark ? <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /><circle cx="12" cy="12" r="4" /></svg> : <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 15.3A8.5 8.5 0 0 1 8.7 4a8.5 8.5 0 1 0 11.3 11.3Z" /></svg>
}

function CardFilters({ value, onChange, counts, actions = null }) {
  return <nav className="card-filters" aria-label="Card controls"><div className="card-filter-options"><button className={value === 'all' ? 'active' : ''} aria-pressed={value === 'all'} onClick={() => onChange('all')}>All <small>{counts.all}</small></button><button className={value === 'known' ? 'active' : ''} aria-pressed={value === 'known'} onClick={() => onChange('known')}>Known <small>{counts.known}</small></button><button className={value === 'unknown' ? 'active' : ''} aria-pressed={value === 'unknown'} onClick={() => onChange('unknown')}>Don't know <small>{counts.unknown}</small></button></div>{actions}</nav>
}

function CardForm({ initial = EMPTY_CARD, submitLabel, onSubmit, onCancel }) {
  const [front, setFront] = useState(initial.front)
  const [back, setBack] = useState(initial.back)

  function submit(event) {
    event.preventDefault()
    if (front.trim() && back.trim()) onSubmit({ front: front.trim(), back: back.trim() })
  }

  function resize(event) {
    const textarea = event.currentTarget
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) event.currentTarget.form.requestSubmit()
  }

  return (
    <form className="card-form" onSubmit={submit}>
      <h3>{initial.id ? 'Edit card' : 'New card'}</h3>
      <div className="card-sides">
        <label><span>Front</span><textarea autoFocus dir="auto" maxLength="2000" value={front} onInput={resize} onKeyDown={handleKeyDown} onChange={(event) => setFront(event.target.value)} placeholder="Hello" /></label>
        <span className="card-direction" aria-hidden="true"><ArrowIcon /></span>
        <label><span>Back</span><textarea dir="auto" maxLength="2000" value={back} onInput={resize} onKeyDown={handleKeyDown} onChange={(event) => setBack(event.target.value)} placeholder="שלום" /></label>
      </div>
      <div className="form-actions">
        {onCancel && <button type="button" className="quiet-button" onClick={onCancel}>Cancel</button>}
        <button disabled={!front.trim() || !back.trim()}>{submitLabel}</button>
      </div>
    </form>
  )
}

function BulkCardForm({ onSubmit, onCancel }) {
  const [value, setValue] = useState('')
  const [message, setMessage] = useState('')

  function submit(event) {
    event.preventDefault()
    try {
      const cards = JSON.parse(value)
      if (!Array.isArray(cards) || cards.length === 0) throw new Error('Enter a non-empty JSON array.')
      if (cards.length > 200) throw new Error('Import at most 200 cards at once.')
      const normalized = cards.map((card, index) => {
        if (!card || typeof card !== 'object' || Array.isArray(card) || typeof card.front !== 'string' || typeof card.back !== 'string' || !card.front.trim() || !card.back.trim()) {
          throw new Error(`Card ${index + 1} must contain non-empty front and back strings.`)
        }
        return { front: card.front.trim(), back: card.back.trim() }
      })
      setMessage('')
      onSubmit(normalized)
    } catch (error) {
      setMessage(error instanceof SyntaxError ? 'The JSON is not valid.' : error.message)
    }
  }

  async function copyPrompt() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(BULK_PROMPT)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = BULK_PROMPT
        textarea.readOnly = true
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        const copied = document.execCommand('copy')
        textarea.remove()
        if (!copied) throw new Error('Copy failed')
      }
      setMessage('Prompt copied.')
    } catch {
      setMessage('Could not access the clipboard.')
    }
  }

  return <form className="bulk-card-form" onSubmit={submit}>
    <div className="bulk-form-heading"><div><h3>Import cards</h3><p>Paste a JSON array of front/back pairs.</p></div><button type="button" className="copy-prompt" onClick={copyPrompt}>Copy GPT prompt</button></div>
    <textarea autoFocus spellCheck="false" value={value} onChange={(event) => setValue(event.target.value)} placeholder={'[{"front":"Hello","back":"שלום"}]'} />
    {message && <p className="bulk-message" role="status">{message}</p>}
    <div className="form-actions"><button type="button" className="quiet-button" onClick={onCancel}>Cancel</button><button disabled={!value.trim()}>Add cards</button></div>
  </form>
}

function StudyView({ cards, groupName, mode, onClose, onReview }) {
  const swipeStart = useRef(null)
  const suppressFlip = useRef(false)
  const [session] = useState(() => shuffled(cards))
  const [index, setIndex] = useState(0)
  const [batchStart, setBatchStart] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [exitDirection, setExitDirection] = useState(null)
  const [results, setResults] = useState({ known: 0, missed: 0 })
  const batchEnd = Math.min(batchStart + 10, session.length)
  const batchSize = batchEnd - batchStart
  const batchFinished = index >= batchEnd
  const allFinished = index >= session.length

  if (batchFinished) {
    return (
      <section className="study study-results">
        <div className="study-progress" role="progressbar" aria-label="Batch progress" aria-valuemin="0" aria-valuemax={batchSize} aria-valuenow={batchSize}><span style={{ width: '100%' }} /></div>
        <p className="eyebrow">{allFinished ? 'SESSION COMPLETE' : 'BATCH COMPLETE'}</p>
        <h1>{groupName}</h1>
        <div className="result-counts"><strong>{results.known} knew</strong><strong>{results.missed} missed</strong></div>
        {allFinished ? <button onClick={onClose}>Back to cards <ArrowIcon /></button> : <div className="result-actions"><button className="quiet-button" onClick={onClose}>Back to cards</button><button onClick={() => { setBatchStart(batchEnd); setResults({ known: 0, missed: 0 }) }}>Continue with {session.length - batchEnd} remaining <ArrowIcon /></button></div>}
      </section>
    )
  }

  const card = session[index]
  const reversed = mode === 'back' || (mode === 'alternating' && index % 2 === 1)
  const prompt = reversed ? card.back : card.front
  const answer = reversed ? card.front : card.back
  const nextCard = index + 1 < batchEnd ? session[index + 1] : null
  const nextReversed = mode === 'back' || (mode === 'alternating' && (index + 1) % 2 === 1)
  const nextPrompt = nextCard ? (nextReversed ? nextCard.back : nextCard.front) : ''

  function answerCard(known) {
    if (exitDirection) return
    playSound(known ? 'known-rise' : 'missed-fall-high')
    onReview(card.id, known)
    setExitDirection(known ? 'right' : 'left')
    window.setTimeout(() => {
      setResults((current) => ({
        known: current.known + (known ? 1 : 0),
        missed: current.missed + (known ? 0 : 1),
      }))
      setIndex((current) => current + 1)
      setRevealed(false)
      setExitDirection(null)
    }, 380)
  }

  function startSwipe(event) {
    swipeStart.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function finishSwipe(event) {
    if (!swipeStart.current) return
    const deltaX = event.clientX - swipeStart.current.x
    const deltaY = event.clientY - swipeStart.current.y
    swipeStart.current = null
    if (Math.abs(deltaX) < 70 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return
    suppressFlip.current = true
    window.setTimeout(() => { suppressFlip.current = false }, 0)
    answerCard(deltaX > 0)
  }

  function flipCard() {
    if (suppressFlip.current) {
      suppressFlip.current = false
      return
    }
    playSound('flip-pop')
    setRevealed((current) => !current)
  }

  return (
    <section className="study">
      <div className="study-progress" role="progressbar" aria-label="Batch progress" aria-valuemin="0" aria-valuemax={batchSize} aria-valuenow={index - batchStart}><span style={{ width: `${((index - batchStart) / batchSize) * 100}%` }} /></div>
      <div className="study-header"><span>{index + 1} / {session.length} · {groupName}</span><button className="secondary" onClick={onClose}>Close</button></div>
      <div className={`study-card-stack ${exitDirection ? 'advancing' : ''}`}>
        {nextCard && <div className="study-card-under" aria-hidden="true"><span className="study-face"><span className="side-label">{nextReversed ? 'BACK' : 'FRONT'}</span><strong>{nextPrompt}</strong></span></div>}
        <button key={card.id} className={`study-card-scene ${exitDirection ? `exiting-${exitDirection}` : ''}`} aria-label={revealed ? 'Show question' : 'Reveal answer'} onPointerDown={startSwipe} onPointerUp={finishSwipe} onPointerCancel={() => { swipeStart.current = null }} onClick={flipCard}>
          <span className={`study-card ${revealed ? 'revealed' : ''}`}>
            <span className="study-face study-front">
              <span className="side-label">{reversed ? 'BACK' : 'FRONT'}</span>
              <strong>{prompt}</strong>
            </span>
            <span className="study-face study-back">
              <span className="side-label">{reversed ? 'FRONT' : 'BACK'}</span>
              <strong>{answer}</strong>
            </span>
          </span>
        </button>
      </div>
      <div className="study-controls">
        <button className="missed" disabled={Boolean(exitDirection)} onClick={() => answerCard(false)}><CrossIcon /> Didn't know</button>
        <button className="known" disabled={Boolean(exitDirection)} onClick={() => answerCard(true)}><CheckIcon /> Knew it</button>
      </div>
    </section>
  )
}

export default function App() {
  const cardListRegionRef = useRef(null)
  const [tabs, setTabs] = useState([])
  const [groups, setGroups] = useState([])
  const [cards, setCards] = useState([])
  const [selectedTabId, setSelectedTabId] = useState(null)
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [allDecksSelected, setAllDecksSelected] = useState(false)
  const [editingTabId, setEditingTabId] = useState(null)
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [editingStructure, setEditingStructure] = useState(false)
  const [colorGroupId, setColorGroupId] = useState(null)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('pi-flashcards-theme') === 'dark')
  const [editingId, setEditingId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [addingBulk, setAddingBulk] = useState(false)
  const [studyMode, setStudyMode] = useState('alternating')
  const [studyModeContext, setStudyModeContext] = useState(null)
  const [cardFilter, setCardFilter] = useState('all')
  const [reservedBottomSpace, setReservedBottomSpace] = useState(0)
  const [studying, setStudying] = useState(() => window.history.state?.flashcardsScreen === 'study')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const tabGroups = useMemo(() => groups.filter((group) => group.tab_id === selectedTabId), [groups, selectedTabId])
  const selectedTab = tabs.find((tab) => tab.id === selectedTabId) ?? null
  const selectedGroup = groups.find((group) => group.id === selectedGroupId && group.tab_id === selectedTabId) ?? null
  const effectiveGroupId = selectedGroup?.id ?? null
  const groupCards = useMemo(() => cards.filter((card) => card.group_id === effectiveGroupId), [cards, effectiveGroupId])
  const tabGroupIds = useMemo(() => new Set(tabGroups.map((group) => group.id)), [tabGroups])
  const scopeCards = useMemo(() => selectedGroup ? groupCards : cards.filter((card) => tabGroupIds.has(card.group_id)), [cards, groupCards, selectedGroup, tabGroupIds])
  const filterCounts = useMemo(() => ({ all: scopeCards.length, known: scopeCards.filter((card) => card.is_known).length, unknown: scopeCards.filter((card) => !card.is_known).length }), [scopeCards])
  const matchesFilter = (card) => cardFilter === 'all' || (cardFilter === 'known' ? card.is_known : !card.is_known)
  const visibleCards = scopeCards.filter(matchesFilter)
  const studyCards = useMemo(() => {
    return scopeCards.filter((card) => cardFilter === 'all' || (cardFilter === 'known' ? card.is_known : !card.is_known))
  }, [cardFilter, scopeCards])
  const studyTitle = selectedGroup?.name ?? selectedTab?.name ?? ''
  const currentStudyContext = `${selectedTabId}:${selectedGroupId ?? 'all'}:${cardFilter}`

  useEffect(() => {
    if (selectedGroupId !== null) playSound('deck-soft')
  }, [selectedGroupId])

  useEffect(() => {
    Promise.all([request(`${API}/tabs`), request(`${API}/groups`), request(`${API}/cards`)])
      .then(([loadedTabs, loadedGroups, loadedCards]) => {
        setTabs(loadedTabs)
        setGroups(loadedGroups)
        setCards(loadedCards)
        if (loadedTabs.length) {
          setSelectedTabId(loadedTabs[0].id)
          setSelectedGroupId(null)
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem('pi-flashcards-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  function toggleTheme() {
    if (!document.startViewTransition) {
      setDarkMode((current) => !current)
      return
    }
    document.startViewTransition(() => {
      flushSync(() => setDarkMode((current) => !current))
    })
  }

  useEffect(() => {
    function handleHistoryChange() {
      const nextStudying = window.history.state?.flashcardsScreen === 'study'
      setStudying(nextStudying)
      if (!nextStudying) setStudyModeContext(null)
    }
    window.addEventListener('popstate', handleHistoryChange)
    return () => window.removeEventListener('popstate', handleHistoryChange)
  }, [])

  useEffect(() => {
    if (colorGroupId === null) return undefined
    function closePalette(event) {
      if (!event.target.closest('.deck-palette, .deck-color-button')) setColorGroupId(null)
    }
    document.addEventListener('pointerdown', closePalette)
    return () => document.removeEventListener('pointerdown', closePalette)
  }, [colorGroupId])

  function selectTab(tabId) {
    setStudyModeContext(null)
    setReservedBottomSpace(0)
    if (tabId === selectedTabId) {
      if (selectedGroupId !== null || !allDecksSelected) playSound('deck-soft')
      setAllDecksSelected(selectedGroupId !== null ? true : !allDecksSelected)
      setSelectedGroupId(null)
      setAdding(false)
      setAddingBulk(false)
      setEditingId(null)
      return
    }
    setAllDecksSelected(false)
    setSelectedTabId(tabId)
    setSelectedGroupId(null)
    setEditingGroupId(null)
    setAdding(false)
    setAddingBulk(false)
    setEditingId(null)
  }

  async function createTab() {
    try {
      const tab = await request(`${API}/tabs`, jsonOptions('POST', { name: 'Untitled' }))
      setTabs((current) => [...current, tab])
      setSelectedTabId(tab.id)
      setSelectedGroupId(null)
      setAllDecksSelected(false)
      setEditingTabId(tab.id)
      setError('')
    } catch (err) { setError(err.message) }
  }

  async function renameTab(tab, name) {
    const trimmed = name.trim()
    if (!trimmed || trimmed === tab.name) {
      setEditingTabId(null)
      return
    }
    try {
      const updated = await request(`${API}/tabs/${tab.id}`, jsonOptions('PUT', { name: trimmed }))
      setTabs((current) => current.map((item) => item.id === tab.id ? updated : item))
      setEditingTabId(null)
      setError('')
    } catch (err) { setError(err.message) }
  }

  async function deleteTab(tab) {
    if (!window.confirm(`Delete “${tab.name}”, all its groups, and all their cards?`)) return
    try {
      await request(`${API}/tabs/${tab.id}`, { method: 'DELETE' })
      const removedGroupIds = new Set(groups.filter((group) => group.tab_id === tab.id).map((group) => group.id))
      const remainingTabs = tabs.filter((item) => item.id !== tab.id)
      const remainingGroups = groups.filter((group) => group.tab_id !== tab.id)
      setTabs(remainingTabs)
      setGroups(remainingGroups)
      setCards((current) => current.filter((card) => !removedGroupIds.has(card.group_id)))
      const nextTabId = remainingTabs[0]?.id ?? null
      setSelectedTabId(nextTabId)
      setSelectedGroupId(null)
      setAllDecksSelected(false)
    } catch (err) { setError(err.message) }
  }

  async function moveTab(tabId, direction) {
    const oldTabs = tabs
    const index = oldTabs.findIndex((tab) => tab.id === tabId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= oldTabs.length) return
    const reordered = [...oldTabs]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved)
    setTabs(reordered)
    try {
      await request(`${API}/tabs-order`, jsonOptions('PUT', { tab_ids: reordered.map((tab) => tab.id) }))
      setError('')
    } catch (err) {
      setTabs(oldTabs)
      setError(err.message)
    }
  }

  async function createGroup() {
    try {
      const group = await request(`${API}/groups`, jsonOptions('POST', { name: 'Untitled', tab_id: selectedTabId, color: '#ffffff' }))
      setGroups((current) => [...current, group])
      setTabs((current) => current.map((tab) => tab.id === selectedTabId ? { ...tab, group_count: tab.group_count + 1 } : tab))
      setSelectedGroupId(group.id)
      setEditingGroupId(group.id)
      setError('')
    } catch (err) { setError(err.message) }
  }

  async function renameGroup(group, name) {
    const trimmed = name.trim()
    if (!trimmed || trimmed === group.name) {
      setEditingGroupId(null)
      return
    }
    try {
      const updated = await request(`${API}/groups/${group.id}`, jsonOptions('PUT', { name: trimmed, tab_id: group.tab_id, color: group.color }))
      setGroups((current) => current.map((item) => item.id === group.id ? updated : item))
      setEditingGroupId(null)
      setError('')
    } catch (err) { setError(err.message) }
  }

  async function changeGroupColor(group, color) {
    try {
      const updated = await request(`${API}/groups/${group.id}`, jsonOptions('PUT', { name: group.name, tab_id: group.tab_id, color }))
      setGroups((current) => current.map((item) => item.id === group.id ? updated : item))
      setColorGroupId(null)
      setError('')
    } catch (err) { setError(err.message) }
  }

  async function deleteGroup(group) {
    if (!window.confirm(`Delete “${group.name}” and all its cards?`)) return
    try {
      await request(`${API}/groups/${group.id}`, { method: 'DELETE' })
      const remaining = groups.filter((item) => item.id !== group.id)
      setGroups(remaining)
      setCards((current) => current.filter((card) => card.group_id !== group.id))
      setTabs((current) => current.map((tab) => tab.id === group.tab_id ? { ...tab, group_count: tab.group_count - 1, card_count: tab.card_count - group.card_count } : tab))
      if (selectedGroupId === group.id) setSelectedGroupId(null)
      setError('')
    } catch (err) { setError(err.message) }
  }

  async function moveGroup(groupId, direction) {
    const oldGroups = groups
    const currentTabGroups = oldGroups.filter((group) => group.tab_id === selectedTabId)
    const index = currentTabGroups.findIndex((group) => group.id === groupId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= currentTabGroups.length) return
    const reordered = [...currentTabGroups]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved)
    let position = 0
    setGroups(oldGroups.map((group) => group.tab_id === selectedTabId ? reordered[position++] : group))
    try {
      await request(`${API}/groups-order`, jsonOptions('PUT', {
        tab_id: selectedTabId,
        group_ids: reordered.map((group) => group.id),
      }))
      setError('')
    } catch (err) {
      setGroups(oldGroups)
      setError(err.message)
    }
  }

  async function createCard(fields) {
    try {
      const card = await request(`${API}/cards`, jsonOptions('POST', { ...fields, group_id: effectiveGroupId }))
      setCards((current) => [card, ...current])
      setGroups((current) => current.map((group) => group.id === effectiveGroupId ? { ...group, card_count: group.card_count + 1 } : group))
      setTabs((current) => current.map((tab) => tab.id === selectedTabId ? { ...tab, card_count: tab.card_count + 1 } : tab))
      setAdding(false)
      setError('')
    } catch (err) { setError(err.message) }
  }

  async function createCardsBulk(fields) {
    try {
      const created = await request(`${API}/cards/bulk`, jsonOptions('POST', fields.map((card) => ({ ...card, group_id: effectiveGroupId }))))
      setCards((current) => [...created, ...current])
      setGroups((current) => current.map((group) => group.id === effectiveGroupId ? { ...group, card_count: group.card_count + created.length } : group))
      setTabs((current) => current.map((tab) => tab.id === selectedTabId ? { ...tab, card_count: tab.card_count + created.length } : tab))
      setAddingBulk(false)
      setError('')
    } catch (err) { setError(err.message) }
  }

  async function updateCard(id, fields, groupId = effectiveGroupId) {
    try {
      const card = await request(`${API}/cards/${id}`, jsonOptions('PUT', { ...fields, group_id: groupId }))
      setCards((current) => current.map((item) => item.id === id ? card : item))
      setEditingId(null)
    } catch (err) { setError(err.message) }
  }

  async function deleteCard(id) {
    if (!window.confirm('Delete this card?')) return
    try {
      const deletedCard = cards.find((card) => card.id === id)
      await request(`${API}/cards/${id}`, { method: 'DELETE' })
      setCards((current) => current.filter((card) => card.id !== id))
      setGroups((current) => current.map((group) => group.id === deletedCard?.group_id ? { ...group, card_count: group.card_count - 1 } : group))
      setTabs((current) => current.map((tab) => tab.id === selectedTabId ? { ...tab, card_count: tab.card_count - 1 } : tab))
    } catch (err) { setError(err.message) }
  }

  async function reviewCard(id, known) {
    try {
      const reviewed = await request(`${API}/cards/${id}/review`, jsonOptions('POST', { known }))
      setCards((current) => current.map((card) => card.id === id ? reviewed : card))
      setError('')
    } catch (err) { setError(err.message) }
  }

  function chooseCardFilter(filter) {
    setStudyModeContext(null)
    const region = cardListRegionRef.current
    if (region && window.scrollY > 0) {
      const regionTop = window.scrollY + region.getBoundingClientRect().top
      const requiredHeight = window.scrollY + window.innerHeight - regionTop - 60
      setReservedBottomSpace(Math.max(0, requiredHeight))
    } else setReservedBottomSpace(0)
    setCardFilter(filter)
    setAdding(false)
    setAddingBulk(false)
    setEditingId(null)
  }

  function startStudying(mode) {
    setStudyMode(mode)
    window.history.pushState({ ...window.history.state, flashcardsScreen: 'study' }, '')
    setStudying(true)
  }

  function closeStudying() {
    setStudyModeContext(null)
    if (window.history.state?.flashcardsScreen === 'study') window.history.back()
    else setStudying(false)
  }

  if (studying && selectedTab) return <main className="app"><StudyView cards={studyCards} groupName={studyTitle} mode={studyMode} onClose={closeStudying} onReview={reviewCard} /></main>

  return (
    <main className="app">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <div className="brand-copy"><p className="eyebrow">PI FLASHCARDS</p><h1>Make it stick.</h1><p className="summary">Your private space for active recall.</p></div>
        <div className="header-actions"><button className="theme-toggle" aria-label={darkMode ? 'Use light mode' : 'Use dark mode'} title={darkMode ? 'Light mode' : 'Dark mode'} onClick={toggleTheme}><ThemeIcon dark={darkMode} /></button><button className={`edit-structure ${editingStructure ? 'active' : ''}`} onClick={() => { setEditingStructure((current) => !current); setEditingTabId(null); setEditingGroupId(null); setColorGroupId(null) }}>{editingStructure ? 'Done' : 'Edit'}</button></div>
      </header>
      {error && <p className="error" role="alert">{error}</p>}

      {loading ? <p className="empty">Opening your decks…</p> : tabs.length === 0 ? <section className="empty empty-first"><div className="empty-deck" aria-hidden="true"><span /><span /><span /></div><h2>No workspaces yet</h2><p>Enter edit mode to create your first workspace.</p>{editingStructure && <button onClick={createTab}><PlusIcon /> Create your first workspace</button>}</section> : <div className="workspace">
        <nav className="tab-bar" aria-label="Workspaces">{tabs.map((tab, index) => <div className={`tab-item ${tab.id === selectedTabId ? 'active' : ''}`} key={tab.id}>{editingTabId === tab.id ? <input className="tab-name-input" autoFocus defaultValue={tab.name} maxLength="100" aria-label="Workspace name" onFocus={(event) => event.target.select()} onBlur={(event) => renameTab(tab, event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') setEditingTabId(null) }} /> : <button className="tab-select" onClick={() => selectTab(tab.id)} onDoubleClick={() => editingStructure && setEditingTabId(tab.id)}><span>{tab.name}</span><small>{tab.card_count}</small></button>}{editingStructure && <><div className="tab-order"><button disabled={index === 0} aria-label={`Move ${tab.name} left`} onClick={() => moveTab(tab.id, -1)}><ChevronIcon direction="left" /></button><button disabled={index === tabs.length - 1} aria-label={`Move ${tab.name} right`} onClick={() => moveTab(tab.id, 1)}><ChevronIcon direction="right" /></button></div><button className="tab-delete" aria-label={`Delete ${tab.name}`} onClick={() => deleteTab(tab)}><TrashIcon /></button></>}</div>)}{editingStructure && <button className="tab-add" aria-label="New workspace" onClick={createTab}><PlusIcon /></button>}</nav>
        <section className={`workspace-content ${allDecksSelected ? 'all-decks-selected' : ''}`} onClickCapture={(event) => { if (event.target.closest('.deck-select')) { setStudyModeContext(null); setReservedBottomSpace(0); setCardFilter('all'); setAllDecksSelected(false) } }}>
          {tabGroups.length === 0 && !editingStructure ? <section className="empty"><h3>This workspace is empty</h3><p>Enter edit mode to create a deck.</p></section> : <>
            <nav className="deck-grid" aria-label="Card decks">{tabGroups.map((group, index) => <div key={group.id} style={{ '--deck-index': index, '--deck-color': group.color, '--deck-dark-color': DARK_DECK_COLORS[group.color] ?? DARK_DECK_COLORS['#ffffff'] }} className={`deck-tile ${group.id === selectedGroupId ? 'active' : ''} ${editingGroupId === group.id ? 'deck-editing' : ''}`}>{editingGroupId === group.id ? <input autoFocus defaultValue={group.name} maxLength="100" aria-label="Deck name" onFocus={(event) => event.target.select()} onBlur={(event) => renameGroup(group, event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') setEditingGroupId(null) }} /> : <button className="deck-select" onClick={() => { setSelectedGroupId((current) => current === group.id ? null : group.id); setAdding(false); setAddingBulk(false); setEditingId(null) }} onDoubleClick={() => editingStructure && setEditingGroupId(group.id)}><span className="deck-name">{group.name}</span><small>{group.card_count} {group.card_count === 1 ? 'card' : 'cards'}</small></button>}{editingStructure && <><button className="deck-delete" aria-label={`Delete ${group.name}`} onClick={() => deleteGroup(group)}><TrashIcon /></button><div className="deck-order"><button disabled={index === 0} aria-label={`Move ${group.name} left`} onClick={() => moveGroup(group.id, -1)}><ChevronIcon direction="left" /></button><button disabled={index === tabGroups.length - 1} aria-label={`Move ${group.name} right`} onClick={() => moveGroup(group.id, 1)}><ChevronIcon direction="right" /></button></div><button className="deck-color-button" aria-label={`Change ${group.name} color`} title="Deck color" onClick={() => setColorGroupId((current) => current === group.id ? null : group.id)}><span style={{ background: group.color }} /></button>{colorGroupId === group.id && <div className="deck-palette" role="group" aria-label={`Choose ${group.name} color`}><strong>Deck color</strong>{DECK_COLORS.map((color) => <button key={color} aria-label={`Use ${color}`} className={group.color === color ? 'active' : ''} style={{ background: color }} onClick={() => changeGroupColor(group, color)} />)}</div>}</>}</div>)}{editingStructure && <button className="deck-add" aria-label="Create deck" onClick={createGroup}><PlusIcon /></button>}</nav>

            {tabGroups.length > 0 && (selectedGroup || allDecksSelected) && <section className="active-deck">
              <div className="study-launcher">
                {studyModeContext === currentStudyContext ? <div className="mode-picker"><div className="mode-chips"><button type="button" onClick={() => startStudying('alternating')}>Alternate ↔</button><button type="button" onClick={() => startStudying('front')}>Front → Back</button><button type="button" onClick={() => startStudying('back')}>Back → Front</button></div></div> : <button disabled={!studyCards.length} onClick={() => setStudyModeContext(currentStudyContext)}>{selectedGroup ? 'Start study' : 'Study all decks'} <ArrowIcon /></button>}
              </div>
              {!selectedGroup && <CardFilters value={cardFilter} onChange={chooseCardFilter} counts={filterCounts} />}
              <div className="card-list-region" ref={cardListRegionRef}>
              {selectedGroup && <><CardFilters value={cardFilter} onChange={chooseCardFilter} counts={filterCounts} actions={<div className="add-card-actions"><button className="add-card" disabled={cardFilter !== 'all'} aria-label="Add card" title="Add card" onClick={() => { setAdding(true); setAddingBulk(false) }}><PlusIcon /></button><button className="add-card" disabled={cardFilter !== 'all'} aria-label="Import cards from JSON" title="Import cards from JSON" onClick={() => { setAdding(false); setAddingBulk(true) }}><ImportIcon /></button></div>} />
              {adding ? <CardForm submitLabel="Add card" onSubmit={createCard} onCancel={() => setAdding(false)} /> : addingBulk ? <BulkCardForm onSubmit={createCardsBulk} onCancel={() => setAddingBulk(false)} /> : null}</>}
              {visibleCards.length === 0 ? <p className="empty deck-empty">No cards in this view.</p> : <ul className="card-list">{visibleCards.map((card, index) => <li key={card.id} className="card-row">{editingId === card.id ? <CardForm initial={card} submitLabel="Save" onSubmit={(fields) => updateCard(card.id, fields, card.group_id)} onCancel={() => setEditingId(null)} /> : <><span className="card-number">{String(visibleCards.length - index).padStart(2, '0')}</span><button className="card-copy" onClick={() => setEditingId(card.id)}><strong>{card.front}</strong><span>{card.back}</span></button><button className="icon-danger card-delete" aria-label="Delete card" onClick={() => deleteCard(card.id)}><TrashIcon /></button></>}</li>)}</ul>}
              </div>
            </section>}
          </>}
        </section>
      </div>}
      <div className="bottom-space" style={{ height: `${44 + reservedBottomSpace}px` }} aria-hidden="true" />
    </main>
  )
}
