import { useMemo, useState } from 'react'
import { ChevronIcon } from './Icons'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function localIsoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function monthStart(value) {
  const date = new Date(`${value}T12:00:00`)
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export default function DailyHistoryCalendar({ history }) {
  const now = new Date()
  const today = localIsoDate(now)
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const earliestMonth = history.length ? monthStart(history[0].completed_on) : currentMonth
  const [month, setMonth] = useState(() => currentMonth)
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const leadingBlanks = month.getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cellCount = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`
  const monthHistory = history.filter((entry) => entry.completed_on.startsWith(monthPrefix))
  const completedThisMonth = monthHistory.reduce((sum, entry) => sum + entry.completed_count, 0)
  const tasksThisMonth = monthHistory.reduce((sum, entry) => sum + entry.task_count, 0)
  const historyByDate = useMemo(() => new Map(history.map((entry) => [entry.completed_on, entry])), [history])
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month)
  const canGoPrevious = month.getTime() > earliestMonth.getTime()
  const canGoNext = month.getTime() < currentMonth.getTime()
  const cells = Array.from({ length: cellCount }, (_, index) => {
    const day = index - leadingBlanks + 1
    return day >= 1 && day <= daysInMonth ? day : null
  })

  function moveMonth(amount) {
    const next = new Date(year, monthIndex + amount, 1)
    setMonth(next < earliestMonth ? earliestMonth : next > currentMonth ? currentMonth : next)
  }

  return <section className="daily-calendar" aria-label="Daily learning history">
    <div className="daily-calendar-toolbar">
      <div><h3>{monthLabel}</h3><p><strong>{completedThisMonth}</strong> of <strong>{tasksThisMonth}</strong> tasks completed this month</p></div>
      <div className="daily-calendar-navigation">
        <button type="button" aria-label="Previous month" disabled={!canGoPrevious} onClick={() => moveMonth(-1)}><ChevronIcon direction="left" /></button>
        <button type="button" onClick={() => setMonth(currentMonth)}>Today</button>
        <button type="button" aria-label="Next month" disabled={!canGoNext} onClick={() => moveMonth(1)}><ChevronIcon direction="right" /></button>
      </div>
    </div>
    <div className="daily-calendar-board">
      <div className="daily-calendar-weekdays" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="daily-calendar-grid">
        {cells.map((day, index) => {
          if (day === null) return <span className="daily-calendar-empty" aria-hidden="true" key={`empty-${index}`} />
          const date = localIsoDate(new Date(year, monthIndex, day))
          const entry = historyByDate.get(date)
          const isFuture = date > today
          const side = entry?.task_count ? Math.ceil(Math.sqrt(entry.task_count)) : 0
          const slotCount = side * side
          const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(year, monthIndex, day))
          const progressLabel = entry ? `, ${entry.completed_count} of ${entry.task_count} tasks completed` : ', no activity recorded'
          return <div className={`daily-calendar-day ${date === today ? 'is-today' : ''} ${isFuture ? 'is-future' : ''}`} role="img" aria-label={`${dateLabel}${progressLabel}`} key={date}>
            {slotCount > 0 && <span className="daily-calendar-squares" dir="ltr" style={{ '--history-grid-side': side }} aria-hidden="true">
              {Array.from({ length: slotCount }, (_, slot) => <i className={`${slot < entry.task_count ? 'task-slot' : 'unused'} ${slot < entry.completed_count ? 'completed' : ''}`} key={slot} />)}
            </span>}
            <strong>{day}</strong>
          </div>
        })}
      </div>
    </div>
  </section>
}
