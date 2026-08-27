import { useEffect, useState } from 'react'

import { API, jsonOptions, request } from '../api'

export default function useFlashcardsData() {
  const [tabs, setTabs] = useState([])
  const [groups, setGroups] = useState([])
  const [cards, setCards] = useState([])
  const [dailyTasks, setDailyTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([request(`${API}/tabs`), request(`${API}/groups`), request(`${API}/cards`), request(`${API}/daily-tasks`)])
      .then(([loadedTabs, loadedGroups, loadedCards, loadedDailyTasks]) => {
        setTabs(loadedTabs)
        setGroups(loadedGroups)
        setCards(loadedCards)
        setDailyTasks(loadedDailyTasks)
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let timer
    function scheduleReset() {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setHours(24, 0, 1, 0)
      timer = window.setTimeout(async () => {
        try {
          setDailyTasks(await request(`${API}/daily-tasks`))
        } catch (reason) {
          setError(reason.message)
        }
        scheduleReset()
      }, tomorrow.getTime() - now.getTime())
    }
    scheduleReset()
    return () => window.clearTimeout(timer)
  }, [])

  async function mutate(operation) {
    try {
      const result = await operation()
      setError('')
      return result
    } catch (reason) {
      setError(reason.message)
      return null
    }
  }

  function adjustCardCounts(groupId, tabId, amount) {
    setGroups((current) => current.map((group) => group.id === groupId ? { ...group, card_count: group.card_count + amount } : group))
    setTabs((current) => current.map((tab) => tab.id === tabId ? { ...tab, card_count: tab.card_count + amount } : tab))
  }

  const actions = {
    createTab: (name) => mutate(async () => {
      const tab = await request(`${API}/tabs`, jsonOptions('POST', { name }))
      setTabs((current) => [...current, tab])
      return tab
    }),
    renameTab: (tab, name) => mutate(async () => {
      const updated = await request(`${API}/tabs/${tab.id}`, jsonOptions('PUT', { name }))
      setTabs((current) => current.map((item) => item.id === tab.id ? updated : item))
      return updated
    }),
    deleteTab: (tab) => mutate(async () => {
      await request(`${API}/tabs/${tab.id}`, { method: 'DELETE' })
      const removedGroupIds = new Set(groups.filter((group) => group.tab_id === tab.id).map((group) => group.id))
      const remainingTabs = tabs.filter((item) => item.id !== tab.id)
      setTabs(remainingTabs)
      setGroups((current) => current.filter((group) => group.tab_id !== tab.id))
      setCards((current) => current.filter((card) => !removedGroupIds.has(card.group_id)))
      setDailyTasks((current) => current.filter((task) => task.tab_id !== tab.id))
      return remainingTabs
    }),
    moveTab: (tabId, direction) => mutate(async () => {
      const index = tabs.findIndex((tab) => tab.id === tabId)
      const target = index + direction
      if (index < 0 || target < 0 || target >= tabs.length) return tabs
      const reordered = [...tabs]
      const [moved] = reordered.splice(index, 1)
      reordered.splice(target, 0, moved)
      setTabs(reordered)
      try {
        await request(`${API}/tabs-order`, jsonOptions('PUT', { tab_ids: reordered.map((tab) => tab.id) }))
      } catch (error) {
        setTabs(tabs)
        throw error
      }
      return reordered
    }),
    createGroup: (tabId) => mutate(async () => {
      const group = await request(`${API}/groups`, jsonOptions('POST', { name: 'Untitled', tab_id: tabId, color: '#ffffff' }))
      setGroups((current) => [...current, group])
      setTabs((current) => current.map((tab) => tab.id === tabId ? { ...tab, group_count: tab.group_count + 1 } : tab))
      return group
    }),
    updateGroup: (group, fields) => mutate(async () => {
      const updated = await request(`${API}/groups/${group.id}`, jsonOptions('PUT', { name: group.name, tab_id: group.tab_id, color: group.color, ...fields }))
      setGroups((current) => current.map((item) => item.id === group.id ? updated : item))
      return updated
    }),
    deleteGroup: (group) => mutate(async () => {
      await request(`${API}/groups/${group.id}`, { method: 'DELETE' })
      setGroups((current) => current.filter((item) => item.id !== group.id))
      setCards((current) => current.filter((card) => card.group_id !== group.id))
      setTabs((current) => current.map((tab) => tab.id === group.tab_id ? { ...tab, group_count: tab.group_count - 1, card_count: tab.card_count - group.card_count } : tab))
      return true
    }),
    moveGroup: (tabId, groupId, direction) => mutate(async () => {
      const tabGroups = groups.filter((group) => group.tab_id === tabId)
      const index = tabGroups.findIndex((group) => group.id === groupId)
      const target = index + direction
      if (index < 0 || target < 0 || target >= tabGroups.length) return groups
      const reordered = [...tabGroups]
      const [moved] = reordered.splice(index, 1)
      reordered.splice(target, 0, moved)
      let position = 0
      const nextGroups = groups.map((group) => group.tab_id === tabId ? reordered[position++] : group)
      setGroups(nextGroups)
      try {
        await request(`${API}/groups-order`, jsonOptions('PUT', { tab_id: tabId, group_ids: reordered.map((group) => group.id) }))
      } catch (error) {
        setGroups(groups)
        throw error
      }
      return nextGroups
    }),
    createCard: (groupId, tabId, fields) => mutate(async () => {
      const card = await request(`${API}/cards`, jsonOptions('POST', { ...fields, group_id: groupId }))
      setCards((current) => [card, ...current])
      adjustCardCounts(groupId, tabId, 1)
      return card
    }),
    createCards: (groupId, tabId, fields) => mutate(async () => {
      const created = await request(`${API}/cards/bulk`, jsonOptions('POST', fields.map((card) => ({ ...card, group_id: groupId }))))
      setCards((current) => [...created, ...current])
      adjustCardCounts(groupId, tabId, created.length)
      return created
    }),
    updateCard: (id, groupId, fields) => mutate(async () => {
      const card = await request(`${API}/cards/${id}`, jsonOptions('PUT', { ...fields, group_id: groupId }))
      setCards((current) => current.map((item) => item.id === id ? card : item))
      return card
    }),
    moveCard: (id, targetGroupId) => mutate(async () => {
      const sourceCard = cards.find((card) => card.id === id)
      const sourceGroup = groups.find((group) => group.id === sourceCard?.group_id)
      const targetGroup = groups.find((group) => group.id === targetGroupId)
      if (!sourceCard || !sourceGroup || !targetGroup || sourceGroup.tab_id !== targetGroup.tab_id || sourceGroup.id === targetGroup.id) {
        throw new Error('The card can only move to another deck in the same workspace.')
      }
      const movedCard = await request(`${API}/cards/${id}`, jsonOptions('PUT', {
        front: sourceCard.front,
        back: sourceCard.back,
        group_id: targetGroupId,
      }))
      setCards((current) => current.map((card) => card.id === id ? movedCard : card))
      setGroups((current) => current.map((group) => {
        if (group.id === sourceGroup.id) return { ...group, card_count: Math.max(0, group.card_count - 1) }
        if (group.id === targetGroup.id) return { ...group, card_count: group.card_count + 1 }
        return group
      }))
      return movedCard
    }),
    deleteCard: (id) => mutate(async () => {
      const deletedCard = cards.find((card) => card.id === id)
      const deletedGroup = groups.find((group) => group.id === deletedCard?.group_id)
      await request(`${API}/cards/${id}`, { method: 'DELETE' })
      setCards((current) => current.filter((card) => card.id !== id))
      if (deletedGroup) adjustCardCounts(deletedGroup.id, deletedGroup.tab_id, -1)
      return true
    }),
    reviewCard: (id, known) => mutate(async () => {
      const reviewed = await request(`${API}/cards/${id}/review`, jsonOptions('POST', { known }))
      setCards((current) => current.map((card) => card.id === id ? reviewed : card))
      return reviewed
    }),
    createDailyTask: (fields) => mutate(async () => {
      const task = await request(`${API}/daily-tasks`, jsonOptions('POST', fields))
      setDailyTasks((current) => [...current, task])
      return task
    }),
    updateDailyTask: (id, fields) => mutate(async () => {
      const task = await request(`${API}/daily-tasks/${id}`, jsonOptions('PUT', fields))
      setDailyTasks((current) => current.map((item) => item.id === id ? task : item))
      return task
    }),
    completeDailyTask: (id, completed) => mutate(async () => {
      const task = await request(`${API}/daily-tasks/${id}/completion`, jsonOptions('PUT', { completed }))
      setDailyTasks((current) => current.map((item) => item.id === id ? task : item))
      return task
    }),
    completeDailyStudy: (id) => mutate(async () => {
      const task = await request(`${API}/daily-tasks/${id}/complete-study`, { method: 'POST' })
      setDailyTasks((current) => current.map((item) => item.id === id ? task : item))
      return task
    }),
    deleteDailyTask: (id) => mutate(async () => {
      await request(`${API}/daily-tasks/${id}`, { method: 'DELETE' })
      setDailyTasks((current) => current.filter((item) => item.id !== id))
      return true
    }),
    moveDailyTask: (id, direction) => mutate(async () => {
      const index = dailyTasks.findIndex((task) => task.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= dailyTasks.length) return dailyTasks
      const reordered = [...dailyTasks]
      const [moved] = reordered.splice(index, 1)
      reordered.splice(target, 0, moved)
      setDailyTasks(reordered)
      try {
        await request(`${API}/daily-tasks-order`, jsonOptions('PUT', { task_ids: reordered.map((task) => task.id) }))
      } catch (error) {
        setDailyTasks(dailyTasks)
        throw error
      }
      return reordered
    }),
  }

  return { tabs, groups, cards, dailyTasks, loading, error, actions }
}
