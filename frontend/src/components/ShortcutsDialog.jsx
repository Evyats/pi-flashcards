import { useEffect, useRef } from 'react'
import { CrossIcon } from './Icons'

const SECTIONS = [
  ['Browse', [
    [['E'], 'Toggle edit mode'],
    [['←', '→'], 'Switch workspace when no deck is selected'],
    [['Arrow keys'], 'Navigate decks'],
    [['Esc'], 'Deselect the current deck'],
    [['Enter'], 'Show study modes'],
  ]],
  ['Edit', [
    [['+'], 'Add a card to the selected deck'],
    [['Ctrl', 'Enter'], 'Save a card form'],
  ]],
  ['Choose study mode', [
    [['1'], 'Front to back'],
    [['2'], 'Alternate directions'],
    [['3'], 'Back to front'],
  ]],
  ['While studying', [
    [['↑', '↓'], 'Flip the card'],
    [['←'], "Didn't know"],
    [['→'], 'Knew it'],
    [['Enter'], 'Continue or finish'],
    [['Esc'], 'Exit study'],
  ]],
]

export default function ShortcutsDialog({ onClose }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  return <dialog
    ref={dialogRef}
    className="shortcuts-dialog"
    aria-labelledby="shortcuts-title"
    onCancel={(event) => { event.preventDefault(); onClose() }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
  >
    <section className="shortcuts-panel">
      <header><div><p className="eyebrow">KEYBOARD</p><h2 id="shortcuts-title">Shortcuts</h2></div><button type="button" className="dialog-close" aria-label="Close keyboard shortcuts" onClick={onClose}><CrossIcon /></button></header>
      <div className="shortcut-sections">
        {SECTIONS.map(([title, shortcuts]) => <section key={title}>
          <h3>{title}</h3>
          <dl>{shortcuts.map(([keys, description]) => <div key={`${title}-${description}`}><dt>{keys.map((key) => <kbd key={key}>{key}</kbd>)}</dt><dd>{description}</dd></div>)}</dl>
        </section>)}
      </div>
      <p className="shortcut-hint"><kbd>Ctrl</kbd><kbd>/</kbd> opens or closes this window.</p>
    </section>
  </dialog>
}
