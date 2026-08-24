import { useEffect, useRef, useState } from 'react'
import { ArrowIcon, CrossIcon } from './Icons'

export default function MoveCardDialog({ card, groups, onMove, onClose }) {
  const dialogRef = useRef(null)
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  async function chooseGroup(groupId) {
    setMoving(true)
    setError('')
    const moved = await onMove(card.id, groupId)
    if (moved) onClose()
    else {
      setMoving(false)
      setError('Could not move the card. Please try again.')
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="move-card-dialog"
      aria-labelledby="move-card-title"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget && !moving) onClose() }}
    >
      <section className="move-card-panel">
        <header>
          <div>
            <h2 id="move-card-title">Move card</h2>
            <p>Choose another deck in this workspace.</p>
          </div>
          <button type="button" className="move-dialog-close" aria-label="Close" disabled={moving} onClick={onClose}><CrossIcon /></button>
        </header>
        <p className="move-card-preview" title={card.front}>{card.front}</p>
        <div className="move-card-options">
          {groups.map((group) => (
            <button type="button" key={group.id} disabled={moving} onClick={() => chooseGroup(group.id)}>
              <span className="move-deck-color" style={{ '--move-deck-color': group.color }} aria-hidden="true" />
              <span><strong>{group.name}</strong><small>{group.card_count} {group.card_count === 1 ? 'card' : 'cards'}</small></span>
              <ArrowIcon />
            </button>
          ))}
        </div>
        {error && <p className="move-card-error" role="alert">{error}</p>}
      </section>
    </dialog>
  )
}
