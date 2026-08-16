export default function CardFilters({ value, onChange, counts, actions = null }) {
  const filters = [['all', 'All'], ['known', 'Known'], ['unknown', "Don't know"]]
  return (
    <nav className="card-filters" aria-label="Card controls">
      <div className="card-filter-options">
        {filters.map(([filter, label]) => (
          <button key={filter} className={value === filter ? 'active' : ''} aria-pressed={value === filter} onClick={() => onChange(filter)}>
            {label} <small>{counts[filter]}</small>
          </button>
        ))}
      </div>
      {actions}
    </nav>
  )
}
