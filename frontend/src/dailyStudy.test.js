import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDailyStudyRounds } from './dailyStudy.js'

test('daily study rounds preserve deck order and apply each subset', () => {
  const groups = [{ id: 1, name: 'First' }, { id: 2, name: 'Second' }]
  const cards = [
    { id: 1, group_id: 1, is_known: true },
    { id: 2, group_id: 1, is_known: false },
    ...Array.from({ length: 23 }, (_, index) => ({ id: index + 3, group_id: 2, is_known: false })),
  ]
  const task = { steps: [
    { group_id: 2, rounds: 4, card_subset: 'unknown', game_type: 'back' },
    { group_id: 1, rounds: 1, card_subset: 'known', game_type: 'front' },
  ] }

  const rounds = buildDailyStudyRounds(task, groups, cards, () => 0.999)

  assert.deepEqual(rounds.map((round) => round.groupName), ['Second', 'Second', 'Second', 'First'])
  assert.deepEqual(rounds.map((round) => round.mode), ['back', 'back', 'back', 'front'])
  assert.deepEqual(rounds.map((round) => round.cards.length), [10, 10, 3, 1])
  assert.equal(new Set(rounds.slice(0, 3).flatMap((round) => round.cards.map((card) => card.id))).size, 23)
  assert.deepEqual(rounds.slice(0, 3).map((round) => round.roundCount), [3, 3, 3])
})

test('an "all decks" step draws from every deck in the task\'s workspace', () => {
  const groups = [
    { id: 1, name: 'First', tab_id: 10 },
    { id: 2, name: 'Second', tab_id: 10 },
    { id: 3, name: 'Other workspace', tab_id: 20 },
  ]
  const cards = [
    { id: 1, group_id: 1, is_known: false },
    { id: 2, group_id: 2, is_known: false },
    { id: 3, group_id: 3, is_known: false },
  ]
  const task = { tab_id: 10, steps: [{ group_id: null, rounds: 1, card_subset: 'all', game_type: 'front' }] }

  const rounds = buildDailyStudyRounds(task, groups, cards, () => 0.999)

  assert.equal(rounds.length, 1)
  assert.equal(rounds[0].groupName, 'All decks')
  assert.deepEqual(new Set(rounds[0].cards.map((card) => card.id)), new Set([1, 2]))
})

test('daily study refuses to skip a configured empty subset', () => {
  assert.throws(
    () => buildDailyStudyRounds(
      { steps: [{ group_id: 1, rounds: 1, card_subset: 'known', game_type: 'front' }] },
      [{ id: 1, name: 'Deck' }],
      [{ id: 1, group_id: 1, is_known: false }],
    ),
    /Deck has no cards/,
  )
})
