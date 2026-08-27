import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import ActiveDeck from './components/ActiveDeck'
import DailyHub from './components/DailyHub'
import DeckGrid from './components/DeckGrid'
import { GearIcon, PlusIcon, ThemeIcon } from './components/Icons'
import ShortcutsDialog from './components/ShortcutsDialog'
import StudyView from './components/StudyView'
import WorkspaceTabs from './components/WorkspaceTabs'
import useFlashcardsData from './hooks/useFlashcardsData'
import { playSound } from './sounds'
import { buildDailyStudyRounds } from './dailyStudy'
import { ALL_DECKS, DAILY_HUB, initialUiState, uiReducer } from './state/uiState'

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

export default function App() {
  const cardListRegionRef = useRef(null)
  const studyButtonRef = useRef(null)
  const { tabs, groups, cards, dailyTasks, loading, error, actions } = useFlashcardsData()
  const [ui, dispatch] = useReducer(uiReducer, initialUiState)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('pi-flashcards-theme') === 'dark')
  const [studying, setStudying] = useState(() => window.history.state?.flashcardsScreen === 'study')
  const [dailyStudy, setDailyStudy] = useState(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const {
    selectedTabId, selectedGroupId, editingTabId, editingGroupId, editingStructure,
    colorGroupId, editingCardId, addingMode, studyMode, studyModeContext,
    cardFilter, reservedBottomSpace,
  } = ui
  const adding = addingMode === 'single'
  const addingBulk = addingMode === 'bulk'
  const patchUi = (value) => dispatch({ type: 'PATCH', value })

  const tabGroups = useMemo(() => groups.filter((group) => group.tab_id === selectedTabId), [groups, selectedTabId])
  const knownCardsByGroup = useMemo(() => {
    const counts = new Map()
    cards.forEach((card) => {
      if (card.is_known) counts.set(card.group_id, (counts.get(card.group_id) ?? 0) + 1)
    })
    return counts
  }, [cards])
  const selectedTab = tabs.find((tab) => tab.id === selectedTabId) ?? null
  const selectedGroup = groups.find((group) => group.id === selectedGroupId && group.tab_id === selectedTabId) ?? null
  const allDecksSelected = selectedGroupId === ALL_DECKS
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
  const currentStudyContext = `${selectedTabId}:${selectedGroupId ?? 'none'}:${cardFilter}`

  useEffect(() => {
    if (Number.isInteger(selectedGroupId)) playSound('deck-soft')
  }, [selectedGroupId])

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
      if (!nextStudying) patchUi({ studyModeContext: null })
    }
    window.addEventListener('popstate', handleHistoryChange)
    return () => window.removeEventListener('popstate', handleHistoryChange)
  }, [])

  useEffect(() => {
    if (colorGroupId === null) return undefined
    function closePalette(event) {
      if (!event.target.closest('.deck-palette, .deck-color-button')) patchUi({ colorGroupId: null })
    }
    document.addEventListener('pointerdown', closePalette)
    return () => document.removeEventListener('pointerdown', closePalette)
  }, [colorGroupId])

  function switchTab(direction) {
    const navigationTabs = [{ id: DAILY_HUB }, ...tabs]
    const currentIndex = navigationTabs.findIndex((tab) => tab.id === selectedTabId)
    if (currentIndex === -1) return
    const nextIndex = (currentIndex + direction + navigationTabs.length) % navigationTabs.length
    playSound('button-tiny-pop')
    dispatch({ type: 'SELECT_TAB', tabId: navigationTabs[nextIndex].id })
  }

  function navigateDeckGrid(key) {
    if (!tabGroups.length) return
    const currentIndex = tabGroups.findIndex((group) => group.id === selectedGroupId)
    if (currentIndex === -1) {
      dispatch({ type: 'FOCUS_GROUP', groupId: tabGroups[0].id })
      return
    }
    const columns = window.innerWidth <= 760 ? 2 : 3
    const count = tabGroups.length
    const row = Math.floor(currentIndex / columns)
    const col = currentIndex % columns
    const rowCount = Math.ceil(count / columns)
    const rowStart = row * columns
    const rowEnd = Math.min(rowStart + columns, count) - 1
    let nextIndex = currentIndex
    if (key === 'ArrowLeft') nextIndex = col === 0 ? rowEnd : currentIndex - 1
    else if (key === 'ArrowRight') nextIndex = currentIndex === rowEnd ? rowStart : currentIndex + 1
    else if (key === 'ArrowUp') {
      const previousRow = row === 0 ? rowCount - 1 : row - 1
      nextIndex = Math.min(previousRow * columns + col, count - 1)
    } else if (key === 'ArrowDown') {
      const nextRow = row === rowCount - 1 ? 0 : row + 1
      nextIndex = Math.min(nextRow * columns + col, count - 1)
    }
    dispatch({ type: 'FOCUS_GROUP', groupId: tabGroups[nextIndex].id })
  }

  useEffect(() => {
    function isTextEntry(target) {
      const tag = target.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
    }
    function handleKeyDown(event) {
      const shortcutHelp = (event.ctrlKey || event.metaKey) && !event.altKey && (event.code === 'Slash' || event.key === '/')
      if (shortcutHelp) {
        event.preventDefault()
        event.stopImmediatePropagation()
        setShortcutsOpen((current) => !current)
        return
      }
      if (shortcutsOpen) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setShortcutsOpen(false)
        }
        event.stopImmediatePropagation()
        return
      }
      if (studying) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isTextEntry(event.target)) return

      if (!event.repeat && event.key.toLowerCase() === 'e') {
        event.preventDefault()
        playSound('button-tiny-pop')
        dispatch({ type: 'TOGGLE_STRUCTURE_EDITING' })
        return
      }
      if (event.key === 'Escape') {
        if (selectedGroupId !== null) {
          event.preventDefault()
          playSound('deck-soft-low')
          dispatch({ type: 'FOCUS_GROUP', groupId: null })
        }
        return
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        if (selectedGroupId === null) {
          event.preventDefault()
          if (event.key === 'ArrowLeft') switchTab(-1)
          else if (event.key === 'ArrowRight') switchTab(1)
          else if (tabGroups.length) dispatch({ type: 'FOCUS_GROUP', groupId: tabGroups[0].id })
          return
        }
        if (!tabGroups.length) return
        event.preventDefault()
        navigateDeckGrid(event.key)
        return
      }
      if (event.key === 'Enter') {
        if (event.target.tagName === 'BUTTON') return
        event.preventDefault()
        studyButtonRef.current?.click()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  })

  function selectTab(tabId) {
    if (tabId === DAILY_HUB) {
      dispatch({ type: 'SELECT_TAB', tabId })
      return
    }
    if (tabId === selectedTabId) {
      playSound(allDecksSelected ? 'deck-soft-low' : 'deck-soft')
      dispatch({ type: 'TOGGLE_ALL_DECKS' })
      return
    }
    dispatch({ type: 'SELECT_TAB', tabId })
  }

  function selectGroup(groupId) {
    if (groupId === selectedGroupId) playSound('deck-soft-low')
    dispatch({ type: 'SELECT_GROUP', groupId })
  }

  async function createTab() {
    const tab = await actions.createTab('Untitled')
    if (tab) patchUi({ selectedTabId: tab.id, selectedGroupId: null, editingTabId: tab.id })
  }

  async function renameTab(tab, name) {
    const trimmed = name.trim()
    if (!trimmed || trimmed === tab.name) {
      patchUi({ editingTabId: null })
      return
    }
    if (await actions.renameTab(tab, trimmed)) patchUi({ editingTabId: null })
  }

  async function deleteTab(tab) {
    if (!window.confirm(`Delete “${tab.name}”, all its groups, and all their cards?`)) return
    const remainingTabs = await actions.deleteTab(tab)
    if (remainingTabs) dispatch({ type: 'SELECT_TAB', tabId: remainingTabs[0]?.id ?? DAILY_HUB })
  }

  const moveTab = (tabId, direction) => actions.moveTab(tabId, direction)

  async function createGroup() {
    const group = await actions.createGroup(selectedTabId)
    if (group) patchUi({ selectedGroupId: group.id, editingGroupId: group.id })
  }

  async function renameGroup(group, name) {
    const trimmed = name.trim()
    if (!trimmed || trimmed === group.name) {
      patchUi({ editingGroupId: null })
      return
    }
    if (await actions.updateGroup(group, { name: trimmed })) patchUi({ editingGroupId: null })
  }

  async function changeGroupColor(group, color) {
    await actions.updateGroup(group, { color })
  }

  function startAddingCards(mode) {
    patchUi({
      cardFilter: 'all',
      addingMode: mode,
      editingCardId: null,
      studyModeContext: null,
      reservedBottomSpace: 0,
    })
  }

  async function deleteGroup(group) {
    if (!window.confirm(`Delete “${group.name}” and all its cards?`)) return
    if (await actions.deleteGroup(group)) {
      if (selectedGroupId === group.id) patchUi({ selectedGroupId: null })
    }
  }

  const moveGroup = (groupId, direction) => actions.moveGroup(selectedTabId, groupId, direction)

  async function createCard(fields) {
    if (await actions.createCard(effectiveGroupId, selectedTabId, fields)) patchUi({ addingMode: null })
  }

  async function createCardsBulk(fields) {
    if (await actions.createCards(effectiveGroupId, selectedTabId, fields)) patchUi({ addingMode: null })
  }

  async function updateCard(id, fields, groupId = effectiveGroupId) {
    if (await actions.updateCard(id, groupId, fields)) patchUi({ editingCardId: null })
  }

  async function deleteCard(id) {
    if (!window.confirm('Delete this card?')) return
    await actions.deleteCard(id)
  }

  const moveCard = (id, targetGroupId) => actions.moveCard(id, targetGroupId)

  const reviewCard = (id, known) => actions.reviewCard(id, known)

  function chooseCardFilter(filter) {
    const region = cardListRegionRef.current
    let nextReservedSpace = 0
    if (region && window.scrollY > 0) {
      const regionTop = window.scrollY + region.getBoundingClientRect().top
      const requiredHeight = window.scrollY + window.innerHeight - regionTop - 60
      nextReservedSpace = Math.max(0, requiredHeight)
    }
    patchUi({ studyModeContext: null, reservedBottomSpace: nextReservedSpace, cardFilter: filter, addingMode: null, editingCardId: null })
  }

  function startStudying(mode) {
    setDailyStudy(null)
    patchUi({ studyMode: mode })
    window.history.pushState({ ...window.history.state, flashcardsScreen: 'study' }, '')
    setStudying(true)
  }

  function closeStudying() {
    patchUi({ studyModeContext: null })
    setDailyStudy(null)
    if (window.history.state?.flashcardsScreen === 'study') window.history.back()
    else setStudying(false)
  }

  function startDailyStudy(task) {
    let rounds
    try {
      rounds = buildDailyStudyRounds(task, groups, cards)
    } catch (reason) {
      window.alert(reason.message)
      return
    }
    if (!rounds.length) {
      window.alert('No cards currently match this task’s configuration.')
      return
    }
    setDailyStudy({ task, rounds })
    window.history.pushState({ ...window.history.state, flashcardsScreen: 'study' }, '')
    setStudying(true)
  }

  function playDefaultButtonSound(event) {
    const button = event.target.closest('button')
    if (!button || button.disabled) return
    const hasDedicatedSound = button.matches('.deck-select, .study-card-scene, .study-controls button')
      || (button.matches('.tab-select') && button.closest('.tab-item')?.classList.contains('active'))
    if (!hasDedicatedSound) playSound('button-tiny-pop')
  }

  if (studying && (selectedTab || dailyStudy)) return <main className="app" onClickCapture={playDefaultButtonSound}><StudyView
    cards={dailyStudy ? [] : studyCards}
    rounds={dailyStudy?.rounds}
    groupName={dailyStudy?.task.name ?? studyTitle}
    mode={studyMode}
    onClose={closeStudying}
    onReview={reviewCard}
    onComplete={dailyStudy ? () => actions.completeDailyStudy(dailyStudy.task.id) : undefined}
  />{shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}</main>

  return (
    <main className="app" onClickCapture={playDefaultButtonSound}>
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <div className="brand-copy"><p className="eyebrow">PI FLASHCARDS</p><h1>Make it stick.</h1><p className="summary">Your private space for active recall.</p></div>
        <div className="header-actions">
          {editingStructure && <button className="theme-toggle" aria-label={darkMode ? 'Use light mode' : 'Use dark mode'} title={darkMode ? 'Light mode' : 'Dark mode'} onClick={toggleTheme}><ThemeIcon dark={darkMode} /></button>}
          <button className={`edit-structure ${editingStructure ? 'active' : ''}`} aria-label={editingStructure ? 'Done editing' : 'Edit workspace'} title={editingStructure ? 'Done editing (e)' : 'Edit workspace (e)'} onClick={() => dispatch({ type: 'TOGGLE_STRUCTURE_EDITING' })}><GearIcon /></button>
        </div>
      </header>
      {error && <p className="error" role="alert">{error}</p>}

      {loading ? <p className="empty">Opening your decks…</p> : <div className="workspace">
        <WorkspaceTabs
          tabs={tabs} selectedId={selectedTabId} editingId={editingTabId} editing={editingStructure}
          onSelect={selectTab} onEdit={(id) => patchUi({ editingTabId: id })} onRename={renameTab} onMove={moveTab}
          onDelete={deleteTab} onCreate={createTab} onCancelEdit={() => patchUi({ editingTabId: null })}
        />
        <section className={`workspace-content ${allDecksSelected ? 'all-decks-selected' : ''}`}>
          {selectedTabId === DAILY_HUB ? <DailyHub tasks={dailyTasks} tabs={tabs} groups={groups} editing={editingStructure} actions={actions} onStartStudy={startDailyStudy} /> : tabs.length === 0 ? <section className="empty empty-first"><div className="empty-deck" aria-hidden="true"><span /><span /><span /></div><h2>No workspaces yet</h2><p>Enter edit mode to create your first workspace.</p>{editingStructure && <button onClick={createTab}><PlusIcon /> Create your first workspace</button>}</section> : tabGroups.length === 0 && !editingStructure ? <section className="empty"><h3>This workspace is empty</h3><p>Enter edit mode to create a deck.</p></section> : <>
            <DeckGrid
              groups={tabGroups} selectedId={selectedGroupId} editingId={editingGroupId} editing={editingStructure}
              knownCardsByGroup={knownCardsByGroup}
              colorGroupId={colorGroupId} colors={DECK_COLORS} darkColors={DARK_DECK_COLORS}
              onSelect={selectGroup} onEdit={(id) => patchUi({ editingGroupId: id })} onRename={renameGroup} onMove={moveGroup}
              onDelete={deleteGroup} onCreate={createGroup}
              onToggleColor={(id) => patchUi({ colorGroupId: colorGroupId === id ? null : id })}
              onColor={changeGroupColor} onCancelEdit={() => patchUi({ editingGroupId: null })}
            />

            {tabGroups.length > 0 && (selectedGroup || allDecksSelected) && (
              <ActiveDeck
                selectedGroup={selectedGroup} groups={tabGroups} studyReady={studyModeContext === currentStudyContext}
                studyCards={studyCards} onPrepareStudy={() => patchUi({ studyModeContext: currentStudyContext })} onStartStudy={startStudying}
                studyButtonRef={studyButtonRef}
                filter={cardFilter} onFilter={chooseCardFilter} counts={filterCounts} editing={editingStructure}
                adding={adding} addingBulk={addingBulk}
                onStartAdd={() => startAddingCards('single')} onStartBulk={() => startAddingCards('bulk')}
                onCancelAdd={() => patchUi({ addingMode: null })} onCancelBulk={() => patchUi({ addingMode: null })} onCreate={createCard} onCreateBulk={createCardsBulk}
                cards={visibleCards} editingCardId={editingCardId} onEditCard={(id) => patchUi({ editingCardId: id })} onCancelEditCard={() => patchUi({ editingCardId: null })}
                onUpdateCard={updateCard} onMoveCard={moveCard} onDeleteCard={deleteCard} listRef={cardListRegionRef}
              />
            )}
          </>}
        </section>
      </div>}
      <div className="bottom-space" style={{ height: `${44 + reservedBottomSpace}px` }} aria-hidden="true" />
      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
    </main>
  )
}
