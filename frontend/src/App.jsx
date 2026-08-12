import { useEffect, useState } from 'react'

const API = '/flashcards/api/cards'
const EMPTY_CARD = { front: '', back: '' }

async function request(url, options) {
  const response = await fetch(url, options)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || 'Something went wrong')
  }
  return response.status === 204 ? null : response.json()
}

function CardForm({ initial = EMPTY_CARD, submitLabel, onSubmit, onCancel }) {
  const [front, setFront] = useState(initial.front)
  const [back, setBack] = useState(initial.back)

  function submit(event) {
    event.preventDefault()
    if (!front.trim() || !back.trim()) return
    onSubmit({ front: front.trim(), back: back.trim() })
  }

  return (
    <form className="card-form" onSubmit={submit}>
      <label>
        Front
        <textarea autoFocus maxLength="2000" value={front} onChange={(event) => setFront(event.target.value)} placeholder="Question or term" />
      </label>
      <label>
        Back
        <textarea maxLength="2000" value={back} onChange={(event) => setBack(event.target.value)} placeholder="Answer or definition" />
      </label>
      <div className="form-actions">
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancel</button>}
        <button disabled={!front.trim() || !back.trim()}>{submitLabel}</button>
      </div>
    </form>
  )
}

function StudyView({ cards, onClose }) {
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const card = cards[index]

  function move(nextIndex) {
    setIndex(nextIndex)
    setRevealed(false)
  }

  return (
    <section className="study">
      <div className="study-header">
        <span>{index + 1} / {cards.length}</span>
        <button className="secondary" onClick={onClose}>Close</button>
      </div>
      <button className={`study-card ${revealed ? 'revealed' : ''}`} onClick={() => setRevealed(true)}>
        <span className="side-label">{revealed ? 'BACK' : 'FRONT'}</span>
        <strong>{revealed ? card.back : card.front}</strong>
        {!revealed && <small>Tap to reveal</small>}
      </button>
      <div className="study-controls">
        <button className="secondary" disabled={index === 0} onClick={() => move(index - 1)}>Previous</button>
        <button disabled={index === cards.length - 1} onClick={() => move(index + 1)}>Next</button>
      </div>
    </section>
  )
}

export default function App() {
  const [cards, setCards] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [studying, setStudying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    request(API).then(setCards).catch((err) => setError(err.message)).finally(() => setLoading(false))
  }, [])

  async function createCard(fields) {
    try {
      const card = await request(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) })
      setCards((current) => [card, ...current])
      setAdding(false)
      setError('')
    } catch (err) { setError(err.message) }
  }

  async function updateCard(id, fields) {
    try {
      const card = await request(`${API}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) })
      setCards((current) => current.map((item) => item.id === id ? card : item))
      setEditingId(null)
      setError('')
    } catch (err) { setError(err.message) }
  }

  async function deleteCard(id) {
    try {
      await request(`${API}/${id}`, { method: 'DELETE' })
      setCards((current) => current.filter((card) => card.id !== id))
      setError('')
    } catch (err) { setError(err.message) }
  }

  if (studying && cards.length) return <main className="app"><StudyView cards={cards} onClose={() => setStudying(false)} /></main>

  return (
    <main className="app">
      <header>
        <div><p className="eyebrow">MEMORY DECK</p><h1>Flashcards</h1><p className="summary">{cards.length} {cards.length === 1 ? 'card' : 'cards'}</p></div>
        <button className="study-button" disabled={!cards.length} onClick={() => setStudying(true)}>Study</button>
      </header>

      {error && <p className="error" role="alert">{error}</p>}

      {adding ? <CardForm submitLabel="Add card" onSubmit={createCard} onCancel={() => setAdding(false)} /> : (
        <button className="add-card" onClick={() => setAdding(true)}>+ Add a card</button>
      )}

      {loading ? <p className="empty">Loading…</p> : cards.length === 0 ? <p className="empty">Your deck is empty. Add the first card.</p> : (
        <ul className="card-list">
          {cards.map((card) => (
            <li key={card.id} className="card-row">
              {editingId === card.id ? <CardForm initial={card} submitLabel="Save" onSubmit={(fields) => updateCard(card.id, fields)} onCancel={() => setEditingId(null)} /> : (
                <>
                  <div className="card-copy"><strong>{card.front}</strong><span>{card.back}</span></div>
                  <div className="row-actions"><button className="secondary" onClick={() => setEditingId(card.id)}>Edit</button><button className="danger" onClick={() => deleteCard(card.id)}>Delete</button></div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

