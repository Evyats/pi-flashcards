import { useState } from 'react'
import { copyText } from '../clipboard'
import { ArrowIcon } from './Icons'

const EMPTY_CARD = { front: '', back: '' }
const BULK_PROMPT = 'Create flashcards as valid JSON only. Return an array where every item has exactly two string fields: "front" and "back". Example: [{"front":"Hello","back":"שלום"}]. Do not use Markdown or add any explanation.'
const FULL_PROMPT = `I want to generate some flashcards based on what came up in this conversation. Please give me a list of questions I could add (no answers yet), and I’ll choose the ones I find relevant.

Focus especially on topics I explored more deeply, since those were important for me to really understand. Keep the questions short, and focus especially on terms and concepts.

For questions about terms—for example, “What is a CDN?”—I prefer simply **“CDN”**. When I see that flashcard, I’ll understand that I’m supposed to define the term. Similarly, instead of “What does CRUD stand for?”, use **“CRUD stands for…”**.

Only include things we actually discussed in some depth, not terms that were merely mentioned briefly. If we discussed the differences between two concepts, you can also include questions like **“X vs. Y”**.

After that, I’ll send you the questions I want to add. In response, return them with their answers in the following format:

\`[{"front":"Hello","back":"שלום"}]\`

Please indent the JSON so it’s easy to read. Keep the answers short and concise whenever possible—I don’t like being overwhelmed with too much text.`

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

  async function copyFullPrompt() {
    try {
      await copyText(FULL_PROMPT)
      setMessage('Prompt copied.')
    } catch { setMessage('Could not access the clipboard.') }
  }

  return <form className="bulk-card-form" onSubmit={submit}>
    <div className="bulk-form-heading">
      <div><h3>Import cards</h3><p>Paste a JSON array of front/back pairs.</p></div>
      <div className="copy-prompt-actions">
        <button type="button" className="copy-prompt" onClick={copyFullPrompt}>Copy conversation prompt</button>
        <button type="button" className="copy-prompt" onClick={copyPrompt}>Copy format prompt</button>
      </div>
    </div>
    <textarea autoFocus spellCheck="false" value={value} onChange={(event) => setValue(event.target.value)} placeholder={'[{"front":"Hello","back":"שלום"}]'} />
    {message && <p className="bulk-message" role="status">{message}</p>}
    <div className="form-actions"><button type="button" className="quiet-button" onClick={onCancel}>Cancel</button><button disabled={!value.trim()}>Add cards</button></div>
  </form>
}
