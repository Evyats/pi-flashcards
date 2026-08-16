import { ChevronIcon, PlusIcon, TrashIcon } from './Icons'

export default function WorkspaceTabs({ tabs, selectedId, editingId, editing, onSelect, onEdit, onRename, onMove, onDelete, onCreate, onCancelEdit }) {
  function handleNameKeyDown(event) {
    if (event.key === 'Enter') event.currentTarget.blur()
    if (event.key === 'Escape') onCancelEdit()
  }

  return (
    <nav className="tab-bar" aria-label="Workspaces">
      {tabs.map((tab, index) => (
        <div className={`tab-item ${tab.id === selectedId ? 'active' : ''}`} key={tab.id}>
          {editingId === tab.id ? (
            <input
              className="tab-name-input"
              autoFocus
              defaultValue={tab.name}
              maxLength="100"
              aria-label="Workspace name"
              onFocus={(event) => event.target.select()}
              onBlur={(event) => onRename(tab, event.target.value)}
              onKeyDown={handleNameKeyDown}
            />
          ) : (
            <button className="tab-select" onClick={() => onSelect(tab.id)} onDoubleClick={() => editing && onEdit(tab.id)}>
              <span>{tab.name}</span>
              <small>{tab.card_count}</small>
            </button>
          )}
          {editing && (
            <>
              <div className="tab-order">
                <button disabled={index === 0} aria-label={`Move ${tab.name} left`} onClick={() => onMove(tab.id, -1)}><ChevronIcon direction="left" /></button>
                <button disabled={index === tabs.length - 1} aria-label={`Move ${tab.name} right`} onClick={() => onMove(tab.id, 1)}><ChevronIcon direction="right" /></button>
              </div>
              <button className="tab-delete" aria-label={`Delete ${tab.name}`} onClick={() => onDelete(tab)}><TrashIcon /></button>
            </>
          )}
        </div>
      ))}
      {editing && <button className="tab-add" aria-label="New workspace" onClick={onCreate}><PlusIcon /></button>}
    </nav>
  )
}
