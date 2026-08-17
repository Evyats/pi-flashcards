import { ChevronIcon, PlusIcon, TrashIcon } from './Icons'

export default function DeckGrid({ groups, selectedId, editingId, editing, colorGroupId, colors, darkColors, knownCardsByGroup, onSelect, onEdit, onRename, onMove, onDelete, onCreate, onToggleColor, onColor, onCancelEdit }) {
  function handleNameKeyDown(event) {
    if (event.key === 'Enter') event.currentTarget.blur()
    if (event.key === 'Escape') onCancelEdit()
  }

  return (
    <nav className="deck-grid" aria-label="Card decks">
      {groups.map((group, index) => {
        const knownCount = knownCardsByGroup.get(group.id) ?? 0
        const knownPercent = group.card_count ? (knownCount / group.card_count) * 100 : 0
        return (
        <div
          key={group.id}
          style={{ '--deck-index': index, '--deck-color': group.color, '--deck-dark-color': darkColors[group.color] ?? darkColors['#ffffff'] }}
          className={`deck-tile ${group.id === selectedId ? 'active' : ''} ${editingId === group.id ? 'deck-editing' : ''}`}
        >
          {editingId === group.id ? (
            <input autoFocus defaultValue={group.name} maxLength="100" aria-label="Deck name" onFocus={(event) => event.target.select()} onBlur={(event) => onRename(group, event.target.value)} onKeyDown={handleNameKeyDown} />
          ) : (
            <button className="deck-select" onClick={() => onSelect(group.id)} onDoubleClick={() => editing && onEdit(group.id)}>
              <span className="deck-name">{group.name}</span>
              <span className="deck-meta">
                <small>{group.card_count} {group.card_count === 1 ? 'card' : 'cards'}</small>
                <span className="deck-known-progress" role="progressbar" aria-label={`${knownCount} of ${group.card_count} cards known`} aria-valuemin="0" aria-valuemax={Math.max(group.card_count, 1)} aria-valuenow={knownCount} title={`${knownCount} of ${group.card_count} known`}>
                  <span style={{ width: `${knownPercent}%` }} />
                </span>
              </span>
            </button>
          )}
          {editing && (
            <>
              <button className="deck-delete" aria-label={`Delete ${group.name}`} onClick={() => onDelete(group)}><TrashIcon /></button>
              <div className="deck-order">
                <button disabled={index === 0} aria-label={`Move ${group.name} left`} onClick={() => onMove(group.id, -1)}><ChevronIcon direction="left" /></button>
                <button disabled={index === groups.length - 1} aria-label={`Move ${group.name} right`} onClick={() => onMove(group.id, 1)}><ChevronIcon direction="right" /></button>
              </div>
              <button className="deck-color-button" aria-label={`Change ${group.name} color`} title="Deck color" onClick={() => onToggleColor(group.id)}><span style={{ background: group.color }} /></button>
              {colorGroupId === group.id && (
                <div className="deck-palette" role="group" aria-label={`Choose ${group.name} color`}>
                  <strong>Deck color</strong>
                  {colors.map((color) => <button key={color} aria-label={`Use ${color}`} className={group.color === color ? 'active' : ''} style={{ background: color }} onClick={() => onColor(group, color)} />)}
                </div>
              )}
            </>
          )}
        </div>
      )})}
      {editing && <button className="deck-add" aria-label="Create deck" onClick={onCreate}><PlusIcon /></button>}
    </nav>
  )
}
