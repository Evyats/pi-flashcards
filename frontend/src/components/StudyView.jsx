import { useEffect, useRef, useState } from 'react'
import { playSound } from '../sounds'
import { ArrowIcon, CheckIcon, CrossIcon } from './Icons'

function shuffled(items) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

export default function StudyView({ cards, rounds, groupName, mode, onClose, onReview, onComplete }) {
  const swipeStart = useRef(null)
  const suppressFlip = useRef(false)
  const completionSent = useRef(false)
  const [session] = useState(() => rounds
    ? rounds.flatMap((round, roundIndex) => round.cards.map((card) => ({ ...card, roundIndex })))
    : shuffled(cards))
  const [index, setIndex] = useState(0)
  const [batchStart, setBatchStart] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [exitDirection, setExitDirection] = useState(null)
  const [results, setResults] = useState({ known: 0, missed: 0 })
  const [roundResults, setRoundResults] = useState(() => rounds?.map(() => ({ known: 0, missed: 0 })) ?? [])
  const plannedRound = rounds?.[session[Math.min(batchStart, session.length - 1)]?.roundIndex]
    ?? rounds?.[rounds.length - 1]
  const plannedRoundEnd = rounds
    ? session.findIndex((card, cardIndex) => cardIndex >= batchStart && card.roundIndex !== session[batchStart]?.roundIndex)
    : -1
  const batchEnd = rounds
    ? (plannedRoundEnd === -1 ? session.length : plannedRoundEnd)
    : Math.min(batchStart + 10, session.length)
  const batchSize = batchEnd - batchStart
  const batchFinished = index >= batchEnd
  const allFinished = index >= session.length
  const activeMode = plannedRound?.mode ?? mode
  const activeGroupName = plannedRound?.groupName ?? groupName
  const sessionResults = rounds && allFinished
    ? roundResults.reduce((total, result) => ({ known: total.known + result.known, missed: total.missed + result.missed }), { known: 0, missed: 0 })
    : results

  useEffect(() => {
    if (!allFinished || !onComplete || completionSent.current) return
    completionSent.current = true
    onComplete()
  }, [allFinished, onComplete])

  useEffect(() => {
    if (!rounds || !batchFinished || allFinished) return undefined
    const timer = window.setTimeout(() => {
      setBatchStart(batchEnd)
      setResults({ known: 0, missed: 0 })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [allFinished, batchEnd, batchFinished, rounds])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (batchFinished) {
        if (event.key === 'Enter') {
          event.preventDefault()
          if (allFinished) onClose()
          else { setBatchStart(batchEnd); setResults({ known: 0, missed: 0 }) }
        }
        return
      }
      if (event.key === 'ArrowLeft') { event.preventDefault(); answerCard(false) }
      else if (event.key === 'ArrowRight') { event.preventDefault(); answerCard(true) }
      else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); flipCard() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  if (batchFinished) {
    return <section className={`study study-results ${allFinished && rounds ? 'has-round-breakdown' : ''}`}>
    <div className="study-progress" role="progressbar" aria-label="Batch progress" aria-valuemin="0" aria-valuemax={batchSize} aria-valuenow={batchSize}><span style={{ width: '100%' }} /></div>
    <p className="eyebrow">{allFinished ? 'SESSION COMPLETE' : rounds ? 'ROUND COMPLETE' : 'BATCH COMPLETE'}</p><h1>{allFinished && rounds ? groupName : activeGroupName}</h1>
    <div className="result-counts"><strong>{sessionResults.known} knew</strong><strong>{sessionResults.missed} missed</strong></div>
    {allFinished && rounds && <ol className="round-breakdown" aria-label="Results by round">
      {rounds.map((round, roundIndex) => {
        const result = roundResults[roundIndex]
        const total = result.known + result.missed
        const accuracy = total ? Math.round((result.known / total) * 100) : 0
        return <li key={`${round.groupName}-${round.round}-${roundIndex}`}>
          <div><strong>{round.groupName}</strong><span>Round {round.round} of {round.roundCount} · {total} cards</span></div>
          <div><strong>{accuracy}%</strong><span>{result.known} knew · {result.missed} missed</span></div>
        </li>
      })}
    </ol>}
    {!allFinished && <p className="result-remaining">{session.length - batchEnd} remaining</p>}
    {allFinished ? <button onClick={onClose}>{rounds ? 'Back to daily' : 'Back to cards'} <ArrowIcon /></button> : rounds ? <p className="result-remaining">Next round…</p> : <div className="result-actions"><button className="quiet-button" onClick={onClose}>Back to cards</button><button onClick={() => { setBatchStart(batchEnd); setResults({ known: 0, missed: 0 }) }}>Continue <ArrowIcon /></button></div>}
    </section>
  }

  const card = session[index]
  const roundCardIndex = index - batchStart
  const reversed = activeMode === 'back' || (activeMode === 'alternating' && roundCardIndex % 2 === 1)
  const prompt = reversed ? card.back : card.front
  const answer = reversed ? card.front : card.back
  const nextCard = index + 1 < batchEnd ? session[index + 1] : null
  const nextIsSameRound = nextCard?.roundIndex === card.roundIndex || !rounds
  const nextReversed = activeMode === 'back' || (activeMode === 'alternating' && (roundCardIndex + 1) % 2 === 1)
  const nextPrompt = nextCard ? (nextReversed ? nextCard.back : nextCard.front) : ''

  function answerCard(known) {
    if (exitDirection) return
    playSound(known ? 'known-rise' : 'missed-fall-high')
    onReview(card.id, known)
    setExitDirection(known ? 'right' : 'left')
    window.setTimeout(() => {
      setResults((current) => ({ known: current.known + (known ? 1 : 0), missed: current.missed + (known ? 0 : 1) }))
      if (rounds) setRoundResults((current) => current.map((result, roundIndex) => roundIndex === card.roundIndex
        ? { known: result.known + (known ? 1 : 0), missed: result.missed + (known ? 0 : 1) }
        : result))
      setIndex((current) => current + 1)
      setRevealed(false)
      setExitDirection(null)
      if (index + 1 >= batchEnd) playSound('batch-complete')
    }, 380)
  }

  function startSwipe(event) {
    swipeStart.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function finishSwipe(event) {
    if (!swipeStart.current) return
    const deltaX = event.clientX - swipeStart.current.x
    const deltaY = event.clientY - swipeStart.current.y
    swipeStart.current = null
    if (Math.abs(deltaX) < 70 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return
    suppressFlip.current = true
    window.setTimeout(() => { suppressFlip.current = false }, 0)
    answerCard(deltaX > 0)
  }

  function flipCard() {
    if (suppressFlip.current) { suppressFlip.current = false; return }
    playSound('flip-pop')
    setRevealed((current) => !current)
  }

  return <section className="study">
    <div className="study-progress" role="progressbar" aria-label="Batch progress" aria-valuemin="0" aria-valuemax={batchSize} aria-valuenow={index - batchStart}><span style={{ width: `${((index - batchStart) / batchSize) * 100}%` }} /></div>
    <div className="study-header"><span>{index + 1} / {session.length} · {activeGroupName}{plannedRound ? ` · Round ${plannedRound.round}/${plannedRound.roundCount}` : ''}</span><button className="secondary" onClick={onClose}>Close</button></div>
    <div className={`study-card-stack ${exitDirection ? 'advancing' : ''}`}>
      {nextCard && nextIsSameRound && <div className="study-card-under" aria-hidden="true"><span className="study-face"><span className="side-label">{nextReversed ? 'BACK' : 'FRONT'}</span><strong>{nextPrompt}</strong></span></div>}
      <button key={`${index}-${card.id}`} className={`study-card-scene ${exitDirection ? `exiting-${exitDirection}` : ''}`} aria-label={revealed ? 'Show question' : 'Reveal answer'} onPointerDown={startSwipe} onPointerUp={finishSwipe} onPointerCancel={() => { swipeStart.current = null }} onClick={flipCard}>
        <span className={`study-card ${revealed ? 'revealed' : ''}`}><span className="study-face study-front"><span className="side-label">{reversed ? 'BACK' : 'FRONT'}</span><strong>{prompt}</strong></span><span className="study-face study-back"><span className="side-label">{reversed ? 'FRONT' : 'BACK'}</span><strong>{answer}</strong></span></span>
      </button>
    </div>
    <div className="study-controls"><button className="missed" disabled={Boolean(exitDirection)} onClick={() => answerCard(false)}><CrossIcon /> Didn't know</button><button className="known" disabled={Boolean(exitDirection)} onClick={() => answerCard(true)}><CheckIcon /> Knew it</button></div>
  </section>
}
