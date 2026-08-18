import { useEffect, useRef, useState } from 'react'
import { copyText } from '../clipboard'
import { BulkCardForm, CardForm } from './CardForms'
import CardFilters from './CardFilters'
import { ArrowIcon, ExportIcon, ImportIcon, PlusIcon, TrashIcon } from './Icons'

const NOTICE_DURATION = 2200

export default function ActiveDeck({ selectedGroup, studyReady, studyCards, onPrepareStudy, onStartStudy, studyButtonRef, filter, onFilter, counts, editing, adding, addingBulk, onStartAdd, onStartBulk, onCancelAdd, onCancelBulk, onCreate, onCreateBulk, cards, editingCardId, onEditCard, onCancelEditCard, onUpdateCard, onDeleteCard, listRef }) {
  const [exportStatus, setExportStatus] = useState('')
  const [notice, setNotice] = useState(null)
  const noticeIdRef = useRef(0)
  const noticeTimerRef = useRef(null)

  useEffect(() => () => { if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current) }, [])

  useEffect(() => {
    if (!studyReady) return undefined
    function handleKeyDown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === '1') { event.preventDefault(); onStartStudy('front') }
      else if (event.key === '2') { event.preventDefault(); onStartStudy('alternating') }
      else if (event.key === '3') { event.preventDefault(); onStartStudy('back') }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [studyReady, onStartStudy])

  useEffect(() => {
    if (!editing || !selectedGroup) return undefined
    function isTextEntry(target) {
      const tag = target.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
    }
    function handleKeyDown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isTextEntry(event.target)) return
      if (event.key === '+') { event.preventDefault(); onStartAdd() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editing, selectedGroup, onStartAdd])

  function handleStudyClick() {
    if (!studyCards.length) {
      noticeIdRef.current += 1
      setNotice({ id: noticeIdRef.current, text: "Can't study — this list is empty." })
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
      noticeTimerRef.current = window.setTimeout(() => setNotice(null), NOTICE_DURATION)
      return
    }
    onPrepareStudy()
  }

  async function exportCards() {
    const payload = cards.map(({ front, back }) => ({ front, back }))
    try {
      await copyText(JSON.stringify(payload, null, 2))
      setExportStatus(`${payload.length} ${payload.length === 1 ? 'card' : 'cards'} copied`)
    } catch {
      setExportStatus('Could not access the clipboard')
    }
  }

  const addActions = editing ? (
    <div className="add-card-actions">
      <button className="add-card" aria-label="Add card" title="Add card" onClick={onStartAdd}><PlusIcon /></button>
      <button className="add-card" aria-label="Import cards from JSON" title="Import cards from JSON" onClick={onStartBulk}><ImportIcon /></button>
      <button className="add-card" disabled={!cards.length} aria-label="Copy cards as JSON" title="Copy cards as JSON" onClick={exportCards}><ExportIcon /></button>
      <span className="sr-only" role="status">{exportStatus}</span>
    </div>
  ) : null

  return (
    <section className="active-deck">
      <div className="study-launcher">
        {studyReady ? (
          <div className="mode-picker"><div className="mode-chips">
            <button type="button" onClick={() => onStartStudy('front')}>Front → Back</button>
            <button type="button" onClick={() => onStartStudy('alternating')}>Alternate ↔</button>
            <button type="button" onClick={() => onStartStudy('back')}>Back → Front</button>
          </div></div>
        ) : (
          <button ref={studyButtonRef} onClick={handleStudyClick}>{selectedGroup ? 'Start study' : 'Study all decks'} <ArrowIcon /></button>
        )}
        {notice && <p key={notice.id} className="study-notice" role="status">{notice.text}</p>}
      </div>
      {!selectedGroup && <CardFilters value={filter} onChange={onFilter} counts={counts} />}
      <div className="card-list-region" ref={listRef}>
        {selectedGroup && (
          <>
            <CardFilters value={filter} onChange={onFilter} counts={counts} actions={addActions} />
            {adding && <CardForm submitLabel="Add card" onSubmit={onCreate} onCancel={onCancelAdd} />}
            {addingBulk && <BulkCardForm onSubmit={onCreateBulk} onCancel={onCancelBulk} />}
          </>
        )}
        {cards.length === 0 ? <p className="empty deck-empty">No cards in this view.</p> : (
          <ul className="card-list">
            {cards.map((card, index) => (
              <li key={card.id} className="card-row">
                {editingCardId === card.id ? (
                  <CardForm initial={card} submitLabel="Save" onSubmit={(fields) => onUpdateCard(card.id, fields, card.group_id)} onCancel={onCancelEditCard} />
                ) : (
                  <>
                    <span className="card-number">{String(cards.length - index).padStart(2, '0')}</span>
                    <button className="card-copy" onClick={editing ? () => onEditCard(card.id) : undefined}><strong>{card.front}</strong><span>{card.back}</span></button>
                    {editing && <button className="icon-danger card-delete" aria-label="Delete card" onClick={() => onDeleteCard(card.id)}><TrashIcon /></button>}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
