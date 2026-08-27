import assert from 'node:assert/strict'
import test from 'node:test'

import { ALL_DECKS, DAILY_HUB, initialUiState, uiReducer } from './uiState.js'

test('daily learning is the default fixed destination', () => {
  assert.equal(initialUiState.selectedTabId, DAILY_HUB)
})

test('selecting a tab resets deck-specific state', () => {
  const state = { ...initialUiState, selectedGroupId: 4, addingMode: 'single', cardFilter: 'known' }
  const next = uiReducer(state, { type: 'SELECT_TAB', tabId: 2 })
  assert.equal(next.selectedTabId, 2)
  assert.equal(next.selectedGroupId, null)
  assert.equal(next.addingMode, null)
  assert.equal(next.cardFilter, 'all')
})

test('selecting an active deck deselects it', () => {
  const selected = uiReducer(initialUiState, { type: 'SELECT_GROUP', groupId: 3 })
  const deselected = uiReducer(selected, { type: 'SELECT_GROUP', groupId: 3 })
  assert.equal(selected.selectedGroupId, 3)
  assert.equal(deselected.selectedGroupId, null)
})

test('all-decks mode toggles without leaving stale editors', () => {
  const state = { ...initialUiState, editingCardId: 8, addingMode: 'bulk' }
  const selected = uiReducer(state, { type: 'TOGGLE_ALL_DECKS' })
  assert.equal(selected.selectedGroupId, ALL_DECKS)
  assert.equal(selected.editingCardId, null)
  assert.equal(selected.addingMode, null)
  assert.equal(uiReducer(selected, { type: 'TOGGLE_ALL_DECKS' }).selectedGroupId, null)
})

test('leaving structure edit mode closes every structural editor', () => {
  const state = { ...initialUiState, editingStructure: true, editingTabId: 1, editingGroupId: 2, colorGroupId: 2 }
  const next = uiReducer(state, { type: 'TOGGLE_STRUCTURE_EDITING' })
  assert.equal(next.editingStructure, false)
  assert.equal(next.editingTabId, null)
  assert.equal(next.editingGroupId, null)
  assert.equal(next.colorGroupId, null)
})
