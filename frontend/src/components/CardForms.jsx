import { useState } from 'react'
import { copyText } from '../clipboard'
import { ArrowIcon } from './Icons'

const EMPTY_CARD = { front: '', back: '' }
const BULK_PROMPT = 'Create flashcards as valid JSON only. Return an array where every item has exactly two string fields: "front" and "back". Example: [{"front":"Hello","back":"שלום"}]. Do not use Markdown or add any explanation.'

export function CardForm({ initial = EMPTY_CARD, submitLabel, onSubmit, onCancel }) {
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

  return <form className="card-form" onSubmit={submit}>
    <h3>{initial.id ? 'Edit card' : 'New card'}</h3>
    <div className="card-sides">
      <label><span>Front</span><textarea autoFocus dir="auto" maxLength="2000" value={front} onInput={resize} onKeyDown={handleKeyDown} onChange={(event) => setFront(event.target.value)} placeholder="Hello" /></label>
      <span className="card-direction" aria-hidden="true"><ArrowIcon /></span>
      <label><span>Back</span><textarea dir="auto" maxLength="2000" value={back} onInput={resize} onKeyDown={handleKeyDown} onChange={(event) => setBack(event.target.value)} placeholder="שלום" /></label>
    </div>
    <div className="form-actions">{onCancel && <button type="button" className="quiet-button" onClick={onCancel}>Cancel</button>}<button disabled={!front.trim() || !back.trim()}>{submitLabel}</button></div>
  </form>
}

export function BulkCardForm({ onSubmit, onCancel }) {
  const [value, setValue] = useState('')
  const [message, setMessage] = useState('')

  function submit(event) {
    event.preventDefault()
    try {
      const cards = JSON.parse(value)
      if (!Array.isArray(cards) || cards.length === 0) throw new Error('Enter a non-empty JSON array.')
      if (cards.length > 200) throw new Error('Import at most 200 cards at once.')
      const normalized = cards.map((card, index) => {
        if (!card || typeof card !== 'object' || Array.isArray(card) || typeof card.front !== 'string' || typeof card.back !== 'string' || !card.front.trim() || !card.back.trim()) throw new Error(`Card ${index + 1} must contain non-empty front and back strings.`)
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
      await copyText(BULK_PROMPT)
      setMessage('Prompt copied.')
    } catch { setMessage('Could not access the clipboard.') }
  }

  return <form className="bulk-card-form" onSubmit={submit}>
    <div className="bulk-form-heading"><div><h3>Import cards</h3><p>Paste a JSON array of front/back pairs.</p></div><button type="button" className="copy-prompt" onClick={copyPrompt}>Copy GPT prompt</button></div>
    <textarea autoFocus spellCheck="false" value={value} onChange={(event) => setValue(event.target.value)} placeholder={'[{"front":"Hello","back":"שלום"}]'} />
    {message && <p className="bulk-message" role="status">{message}</p>}
    <div className="form-actions"><button type="button" className="quiet-button" onClick={onCancel}>Cancel</button><button disabled={!value.trim()}>Add cards</button></div>
  </form>
}
