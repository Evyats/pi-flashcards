import { useEffect, useMemo, useState } from 'react'

const API = '/flashcards/api'
const EMPTY_CARD = { front: '', back: '' }
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

function TrashIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>
}

function ThemeIcon({ dark }) {
  return dark ? <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /><circle cx="12" cy="12" r="4" /></svg> : <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 15.3A8.5 8.5 0 0 1 8.7 4a8.5 8.5 0 1 0 11.3 11.3Z" /></svg>
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

function StudyView({ cards, groupName, mode, onClose }) {
  const [session] = useState(() => shuffled(cards))
  const [index, setIndex] = useState(0)
  const [batchStart, setBatchStart] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [results, setResults] = useState({ known: 0, missed: 0 })
  const batchEnd = Math.min(batchStart + 10, session.length)
  const batchSize = batchEnd - batchStart
  const batchFinished = index >= batchEnd
  const allFinished = index >= session.length

  if (batchFinished) {
    return (
      <section className="study study-results">
        <p className="eyebrow">{allFinished ? 'SESSION COMPLETE' : 'BATCH COMPLETE'}</p>
        <h1>{groupName}</h1>
        <div className="result-counts"><strong>{results.known} knew</strong><strong>{results.missed} missed</strong></div>
        {allFinished ? <button onClick={onClose}>Back to cards <ArrowIcon /></button> : <div className="result-actions"><button className="quiet-button" onClick={onClose}>Back to cards</button><button onClick={() => { setBatchStart(batchEnd); setResults({ known: 0, missed: 0 }) }}>Continue with {session.length - batchEnd} remaining <ArrowIcon /></button></div>}
      </section>
    )
  }

  const card = session[index]
  const reversed = mode === 'alternating' && index % 2 === 1
  const prompt = reversed ? card.back : card.front
  const answer = reversed ? card.front : card.back
  const nextCard = index + 1 < batchEnd ? session[index + 1] : null
  const nextReversed = mode === 'alternating' && (index + 1) % 2 === 1
  const nextPrompt = nextCard ? (nextReversed ? nextCard.back : nextCard.front) : ''

  function answerCard(known) {
    if (exiting) return
    setExiting(true)
    window.setTimeout(() => {
      setResults((current) => ({
        known: current.known + (known ? 1 : 0),
        missed: current.missed + (known ? 0 : 1),
      }))
      setIndex((current) => current + 1)
      setRevealed(false)
      setExiting(false)
    }, 300)
  }

  return (
    <section className="study">
      <div className="study-progress" role="progressbar" aria-label="Batch progress" aria-valuemin="1" aria-valuemax={batchSize} aria-valuenow={index - batchStart + 1}><span style={{ width: `${((index - batchStart + 1) / batchSize) * 100}%` }} /></div>
      <div className="study-header"><span>{index + 1} / {session.length} · {groupName}</span><button className="secondary" onClick={onClose}>Close</button></div>
      <div className={`study-card-stack ${exiting ? 'advancing' : ''}`}>
        {nextCard && <div className="study-card-under" aria-hidden="true"><span className="study-face"><span className="side-label">{nextReversed ? 'BACK' : 'FRONT'}</span><strong>{nextPrompt}</strong></span></div>}
        <button key={card.id} className={`study-card-scene ${exiting ? 'exiting' : ''}`} aria-label={revealed ? 'Show question' : 'Reveal answer'} onClick={() => setRevealed((current) => !current)}>
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
        <button className="missed" disabled={exiting} onClick={() => answerCard(false)}><CrossIcon /> Didn't know</button>
        <button className="known" disabled={exiting} onClick={() => answerCard(true)}><CheckIcon /> Knew it</button>
      </div>
    </section>
  )
}

export default function App() {
  const [tabs, setTabs] = useState([])
  const [groups, setGroups] = useState([])
  const [cards, setCards] = useState([])
  const [selectedTabId, setSelectedTabId] = useState(null)
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [editingTabId, setEditingTabId] = useState(null)
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [editingStructure, setEditingStructure] = useState(false)
  const [colorGroupId, setColorGroupId] = useState(null)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('pi-flashcards-theme') === 'dark')
  const [editingId, setEditingId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [studyMode, setStudyMode] = useState('front')
  const [studying, setStudying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const tabGroups = useMemo(() => groups.filter((group) => group.tab_id === selectedTabId), [groups, selectedTabId])
  const selectedTab = tabs.find((tab) => tab.id === selectedTabId) ?? null
  const selectedGroup = groups.find((group) => group.id === selectedGroupId && group.tab_id === selectedTabId) ?? null
  const effectiveGroupId = selectedGroup?.id ?? null
  const groupCards = useMemo(() => cards.filter((card) => card.group_id === effectiveGroupId), [cards, effectiveGroupId])
  const tabGroupIds = useMemo(() => new Set(tabGroups.map((group) => group.id)), [tabGroups])
  const studyCards = useMemo(() => selectedGroup ? groupCards : cards.filter((card) => tabGroupIds.has(card.group_id)), [cards, groupCards, selectedGroup, tabGroupIds])
  const studyTitle = selectedGroup?.name ?? selectedTab?.name ?? ''

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

  useEffect(() => {
    if (colorGroupId === null) return undefined
    function closePalette(event) {
      if (!event.target.closest('.deck-palette, .deck-color-button')) setColorGroupId(null)
    }
    document.addEventListener('pointerdown', closePalette)
    return () => document.removeEventListener('pointerdown', closePalette)
  }, [colorGroupId])

  function selectTab(tabId) {
    setSelectedTabId(tabId)
    setSelectedGroupId(null)
    setEditingGroupId(null)
    setAdding(false)
    setEditingId(null)
  }

  async function createTab() {
    try {
      const tab = await request(`${API}/tabs`, jsonOptions('POST', { name: 'Untitled' }))
      setTabs((current) => [...current, tab])
      setSelectedTabId(tab.id)
      setSelectedGroupId(null)
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
    } catch (err) { setError(err.message) }
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
      setTabs((current) => current.map((tab) => tab.id === group.tab_id ? { ...tab, group_count: tab.group_count - 1 } : tab))
      if (selectedGroupId === group.id) setSelectedGroupId(null)
      setError('')
    } catch (err) { setError(err.message) }
  }

  async function createCard(fields) {
    try {
      const card = await request(`${API}/cards`, jsonOptions('POST', { ...fields, group_id: effectiveGroupId }))
      setCards((current) => [card, ...current])
      setGroups((current) => current.map((group) => group.id === effectiveGroupId ? { ...group, card_count: group.card_count + 1 } : group))
      setAdding(false)
      setError('')
    } catch (err) { setError(err.message) }
  }

  async function updateCard(id, fields) {
    try {
      const card = await request(`${API}/cards/${id}`, jsonOptions('PUT', { ...fields, group_id: effectiveGroupId }))
      setCards((current) => current.map((item) => item.id === id ? card : item))
      setEditingId(null)
    } catch (err) { setError(err.message) }
  }

  async function deleteCard(id) {
    if (!window.confirm('Delete this card?')) return
    try {
      await request(`${API}/cards/${id}`, { method: 'DELETE' })
      setCards((current) => current.filter((card) => card.id !== id))
      setGroups((current) => current.map((group) => group.id === effectiveGroupId ? { ...group, card_count: group.card_count - 1 } : group))
    } catch (err) { setError(err.message) }
  }

  if (studying && selectedTab) return <main className="app"><StudyView cards={studyCards} groupName={studyTitle} mode={studyMode} onClose={() => setStudying(false)} /></main>

  return (
    <main className="app">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <div className="brand-copy"><p className="eyebrow">PI FLASHCARDS</p><h1>Make it stick.</h1><p className="summary">Your private space for active recall.</p></div>
        <div className="header-actions"><button className="theme-toggle" aria-label={darkMode ? 'Use light mode' : 'Use dark mode'} title={darkMode ? 'Light mode' : 'Dark mode'} onClick={() => setDarkMode((current) => !current)}><ThemeIcon dark={darkMode} /></button><button className={`edit-structure ${editingStructure ? 'active' : ''}`} onClick={() => { setEditingStructure((current) => !current); setEditingTabId(null); setEditingGroupId(null); setColorGroupId(null) }}>{editingStructure ? 'Done' : 'Edit'}</button></div>
      </header>
      {error && <p className="error" role="alert">{error}</p>}

      {loading ? <p className="empty">Opening your decks…</p> : tabs.length === 0 ? <section className="empty empty-first"><div className="empty-deck" aria-hidden="true"><span /><span /><span /></div><h2>No workspaces yet</h2><p>Enter edit mode to create your first workspace.</p>{editingStructure && <button onClick={createTab}><PlusIcon /> Create your first workspace</button>}</section> : <div className="workspace">
        <nav className="tab-bar" aria-label="Workspaces">{tabs.map((tab) => <div className={`tab-item ${tab.id === selectedTabId ? 'active' : ''}`} key={tab.id}>{editingTabId === tab.id ? <input className="tab-name-input" autoFocus defaultValue={tab.name} maxLength="100" aria-label="Workspace name" onFocus={(event) => event.target.select()} onBlur={(event) => renameTab(tab, event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') setEditingTabId(null) }} /> : <button className="tab-select" onClick={() => selectTab(tab.id)} onDoubleClick={() => editingStructure && setEditingTabId(tab.id)}><span>{tab.name}</span></button>}{editingStructure && <button className="tab-delete" aria-label={`Delete ${tab.name}`} onClick={() => deleteTab(tab)}><TrashIcon /></button>}</div>)}{editingStructure && <button className="tab-add" aria-label="New workspace" onClick={createTab}><PlusIcon /></button>}</nav>
        <section className="workspace-content">
          {tabGroups.length === 0 && !editingStructure ? <section className="empty"><h3>This workspace is empty</h3><p>Enter edit mode to create a deck.</p></section> : <>
            <nav className="deck-grid" aria-label="Card decks">{tabGroups.map((group, index) => <div key={group.id} style={{ '--deck-index': index, '--deck-color': group.color, '--deck-dark-color': DARK_DECK_COLORS[group.color] ?? DARK_DECK_COLORS['#ffffff'] }} className={`deck-tile ${group.id === selectedGroupId ? 'active' : ''} ${editingGroupId === group.id ? 'deck-editing' : ''}`}>{editingGroupId === group.id ? <input autoFocus defaultValue={group.name} maxLength="100" aria-label="Deck name" onFocus={(event) => event.target.select()} onBlur={(event) => renameGroup(group, event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') setEditingGroupId(null) }} /> : <button className="deck-select" onClick={() => { setSelectedGroupId((current) => current === group.id ? null : group.id); setAdding(false); setEditingId(null) }} onDoubleClick={() => editingStructure && setEditingGroupId(group.id)}><span className="deck-name">{group.name}</span><small>{group.card_count} {group.card_count === 1 ? 'card' : 'cards'}</small></button>}{editingStructure && <><button className="deck-delete" aria-label={`Delete ${group.name}`} onClick={() => deleteGroup(group)}><TrashIcon /></button><button className="deck-color-button" aria-label={`Change ${group.name} color`} title="Deck color" onClick={() => setColorGroupId((current) => current === group.id ? null : group.id)}><span style={{ background: group.color }} /></button>{colorGroupId === group.id && <div className="deck-palette" role="group" aria-label={`Choose ${group.name} color`}><strong>Deck color</strong>{DECK_COLORS.map((color) => <button key={color} aria-label={`Use ${color}`} className={group.color === color ? 'active' : ''} style={{ background: color }} onClick={() => changeGroupColor(group, color)} />)}</div>}</>}</div>)}{editingStructure && <button className="deck-add" aria-label="Create deck" onClick={createGroup}><PlusIcon /></button>}</nav>

            {tabGroups.length > 0 && <section className="active-deck">
              <div className="study-launcher">
                <div className="mode-picker"><div className="mode-chips"><button type="button" className={studyMode === 'front' ? 'active' : ''} aria-pressed={studyMode === 'front'} onClick={() => setStudyMode('front')}>Front → Back</button><button type="button" className={studyMode === 'alternating' ? 'active' : ''} aria-pressed={studyMode === 'alternating'} onClick={() => setStudyMode('alternating')}>Alternate ↔</button></div></div>
                <button disabled={!studyCards.length} onClick={() => setStudying(true)}>{selectedGroup ? 'Start study' : 'Study all decks'} <ArrowIcon /></button>
              </div>
              {selectedGroup && <>{adding ? <CardForm submitLabel="Add card" onSubmit={createCard} onCancel={() => setAdding(false)} /> : <button className="add-card" onClick={() => setAdding(true)}><PlusIcon /> Add card</button>}
              {groupCards.length === 0 ? <p className="empty deck-empty">No cards in this deck yet.</p> : <ul className="card-list">{groupCards.map((card, index) => <li key={card.id} className="card-row">{editingId === card.id ? <CardForm initial={card} submitLabel="Save" onSubmit={(fields) => updateCard(card.id, fields)} onCancel={() => setEditingId(null)} /> : <><span className="card-number">{String(groupCards.length - index).padStart(2, '0')}</span><button className="card-copy" onClick={() => setEditingId(card.id)}><strong>{card.front}</strong><span>{card.back}</span></button><button className="icon-danger card-delete" aria-label="Delete card" onClick={() => deleteCard(card.id)}><TrashIcon /></button></>}</li>)}</ul>}</>}
            </section>}
          </>}
        </section>
      </div>}
      <div className="bottom-space" aria-hidden="true" />
    </main>
  )
}
