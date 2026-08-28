import { useEffect, useMemo, useRef, useState } from 'react'
import DailyHistoryCalendar from './DailyHistoryCalendar'
import { CheckIcon, ChevronIcon, CrossIcon, EditIcon, ExternalLinkIcon, PlayIcon, PlusIcon, TrashIcon } from './Icons'

const EMPTY_FORM = {
  name: '',
  task_type: 'general',
  tab_id: '',
  link: '',
  steps: [],
}

function todayLabel() {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
}

function DailyTaskDialog({ task, tabs, groups, onClose, onSave }) {
  const dialogRef = useRef(null)
  const [form, setForm] = useState(() => task ? {
    name: task.name,
    task_type: task.task_type,
    tab_id: task.tab_id ?? '',
    link: task.link ?? '',
    steps: task.steps.map((step) => ({ ...step })),
  } : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const tabGroups = useMemo(
    () => groups.filter((group) => group.tab_id === Number(form.tab_id)),
    [form.tab_id, groups],
  )
  const selectedIds = new Set(form.steps.map((step) => step.group_id))

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  function updateStep(index, fields) {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...fields } : step),
    }))
  }

  function moveStep(index, direction) {
    const target = index + direction
    if (target < 0 || target >= form.steps.length) return
    setForm((current) => {
      const steps = [...current.steps]
      const [moved] = steps.splice(index, 1)
      steps.splice(target, 0, moved)
      return { ...current, steps }
    })
  }

  function addDeck(groupId) {
    setForm((current) => ({
      ...current,
      steps: [...current.steps, {
        group_id: groupId,
        rounds: 1,
        card_subset: 'all',
        game_type: 'alternating',
      }],
    }))
  }

  async function submit(event) {
    event.preventDefault()
    if (!form.name.trim()) return
    const study = form.task_type === 'study'
    if (study && (!form.tab_id || !form.steps.length)) return
    setSaving(true)
    const saved = await onSave({
      name: form.name.trim(),
      task_type: form.task_type,
      tab_id: study ? Number(form.tab_id) : null,
      link: study ? null : form.link.trim() || null,
      steps: study ? form.steps : [],
    })
    setSaving(false)
    if (saved) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="daily-task-dialog"
      aria-labelledby="daily-task-dialog-title"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === dialogRef.current) onClose() }}
    >
      <form className="daily-task-form" onSubmit={submit}>
        <header>
          <div><p className="eyebrow">DAILY PLAN</p><h2 id="daily-task-dialog-title">{task ? 'Edit task' : 'New task'}</h2></div>
          <button type="button" className="dialog-close" aria-label="Close" onClick={onClose}><CrossIcon /></button>
        </header>

        <label className="daily-field"><span>Name</span><input autoFocus maxLength="100" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Read for 20 minutes" /></label>

        <fieldset className="daily-type-picker">
          <legend>Task type</legend>
          <div>
            <button type="button" className={form.task_type === 'general' ? 'active' : ''} onClick={() => setForm({ ...form, task_type: 'general', tab_id: '', steps: [] })}>General</button>
            <button type="button" className={form.task_type === 'study' ? 'active' : ''} onClick={() => setForm({ ...form, task_type: 'study' })}>Flashcards</button>
          </div>
        </fieldset>

        {form.task_type === 'general' && <label className="daily-field"><span>Link <small>optional</small></span><input type="url" inputMode="url" maxLength="2048" value={form.link} onChange={(event) => setForm({ ...form, link: event.target.value })} placeholder="https://example.com" /></label>}

        {form.task_type === 'study' && (
          <div className="daily-study-config">
            <label className="daily-field"><span>Workspace</span><select value={form.tab_id} onChange={(event) => setForm({ ...form, tab_id: event.target.value, steps: [] })}><option value="">Choose a workspace</option>{tabs.map((tab) => <option value={tab.id} key={tab.id}>{tab.name}</option>)}</select></label>

            {form.steps.length > 0 && <ol className="daily-step-list">
              {form.steps.map((step, index) => {
                const group = groups.find((item) => item.id === step.group_id)
                return <li key={step.group_id}>
                  <div className="daily-step-heading"><strong>{group?.name ?? 'Missing deck'}</strong><div><button type="button" disabled={index === 0} aria-label="Move deck up" onClick={() => moveStep(index, -1)}><ChevronIcon direction="up" /></button><button type="button" disabled={index === form.steps.length - 1} aria-label="Move deck down" onClick={() => moveStep(index, 1)}><ChevronIcon direction="down" /></button><button type="button" aria-label="Remove deck" onClick={() => setForm((current) => ({ ...current, steps: current.steps.filter((_, stepIndex) => stepIndex !== index) }))}><TrashIcon /></button></div></div>
                  <div className="daily-step-fields">
                    <label><span>Maximum rounds</span><input type="number" min="1" max="20" value={step.rounds} onChange={(event) => updateStep(index, { rounds: Number(event.target.value) })} /></label>
                    <label><span>Cards</span><select value={step.card_subset} onChange={(event) => updateStep(index, { card_subset: event.target.value })}><option value="all">All</option><option value="known">Known</option><option value="unknown">Unknown</option></select></label>
                    <label><span>Game type</span><select value={step.game_type} onChange={(event) => updateStep(index, { game_type: event.target.value })}><option value="alternating">Alternate</option><option value="front">Front → back</option><option value="back">Back → front</option></select></label>
                  </div>
                </li>
              })}
            </ol>}

            {form.tab_id && <div className="daily-deck-options"><span>Add decks</span><div>{tabGroups.filter((group) => !selectedIds.has(group.id)).map((group) => <button type="button" key={group.id} onClick={() => addDeck(group.id)}><PlusIcon /> {group.name}</button>)}</div>{tabGroups.length === 0 && <small>This workspace has no decks.</small>}{tabGroups.length > 0 && tabGroups.every((group) => selectedIds.has(group.id)) && <small>All decks are included.</small>}</div>}
          </div>
        )}

        <footer><button type="button" className="quiet-button" onClick={onClose}>Cancel</button><button className="daily-save" disabled={saving || !form.name.trim() || (form.task_type === 'study' && (!form.tab_id || !form.steps.length))}>{saving ? 'Saving…' : 'Save task'}</button></footer>
      </form>
    </dialog>
  )
}

export default function DailyHub({ tasks, history, tabs, groups, editing, actions, onStartStudy }) {
  const [editingTask, setEditingTask] = useState(undefined)
  const completed = tasks.filter((task) => task.completed).length

  async function saveTask(fields) {
    return editingTask?.id
      ? actions.updateDailyTask(editingTask.id, fields)
      : actions.createDailyTask(fields)
  }

  async function removeTask(task) {
    if (window.confirm(`Delete “${task.name}”?`)) await actions.deleteDailyTask(task.id)
  }

  return <section className="daily-hub">
    <header className="daily-heading">
      <div><p className="eyebrow">TODAY</p><h2>Daily learning</h2><p>{todayLabel()}</p></div>
      {editing && <button className="daily-add" aria-label="Add daily task" onClick={() => setEditingTask(null)}><PlusIcon /></button>}
    </header>

    {tasks.length > 0 && <div className="daily-progress" aria-label={`${completed} of ${tasks.length} tasks complete`}><span style={{ width: `${(completed / tasks.length) * 100}%` }} /></div>}

    {tasks.length === 0 ? <div className="daily-empty"><span className="daily-empty-check"><CheckIcon /></span><h3>Your daily plan is empty</h3><p>{editing ? 'Use the plus button to add your first learning task.' : 'Enter edit mode to build your daily learning plan.'}</p></div> : <ol className="daily-list">
      {tasks.map((task, index) => <li className={task.completed ? 'complete' : ''} key={task.id}>
        <label className={`daily-check ${task.task_type === 'study' ? 'automatic' : ''}`} title={task.task_type === 'study' ? 'Completes after the study session' : undefined}>
          <input type="checkbox" checked={task.completed} disabled={task.task_type === 'study'} onChange={(event) => actions.completeDailyTask(task.id, event.target.checked)} />
          <span><CheckIcon /></span>
        </label>
        <div className="daily-task-copy"><strong>{task.name}</strong>{task.task_type === 'study' && <small>{task.steps.reduce((sum, step) => sum + step.rounds, 0)} rounds · {tabs.find((tab) => tab.id === task.tab_id)?.name ?? 'Missing workspace'}</small>}</div>
        {task.task_type === 'study' && !task.completed && <button className="daily-start" onClick={() => onStartStudy(task)}><PlayIcon /> Start</button>}
        {task.task_type === 'general' && task.link && <a className="daily-start" href={task.link} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon /> Go</a>}
        {editing && <div className="daily-row-actions"><button aria-label={`Edit ${task.name}`} onClick={() => setEditingTask(task)}><EditIcon /></button><button disabled={index === 0} aria-label={`Move ${task.name} up`} onClick={() => actions.moveDailyTask(task.id, -1)}><ChevronIcon direction="up" /></button><button disabled={index === tasks.length - 1} aria-label={`Move ${task.name} down`} onClick={() => actions.moveDailyTask(task.id, 1)}><ChevronIcon direction="down" /></button><button className="danger" aria-label={`Delete ${task.name}`} onClick={() => removeTask(task)}><TrashIcon /></button></div>}
      </li>)}
    </ol>}

    <DailyHistoryCalendar history={history} />

    {editingTask !== undefined && <DailyTaskDialog task={editingTask} tabs={tabs} groups={groups} onClose={() => setEditingTask(undefined)} onSave={saveTask} />}
  </section>
}
