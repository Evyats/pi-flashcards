function shuffle(items, random) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

export function buildDailyStudyRounds(task, groups, cards, random = Math.random) {
  const tabGroupIds = new Set(groups.filter((group) => group.tab_id === task.tab_id).map((group) => group.id))
  return task.steps.flatMap((step) => {
    const isAllDecks = step.group_id === null || step.group_id === undefined
    const group = isAllDecks ? null : groups.find((item) => item.id === step.group_id)
    const groupName = isAllDecks ? 'All decks' : (group?.name ?? 'Deck')
    const candidates = cards.filter((card) => (
      isAllDecks ? tabGroupIds.has(card.group_id) : card.group_id === step.group_id
    ) && (
      step.card_subset === 'all' || (step.card_subset === 'known' ? card.is_known : !card.is_known)
    ))
    if (!candidates.length) {
      throw new Error(`${isAllDecks ? 'All decks' : (group?.name ?? 'A configured deck')} has no cards matching the configured subset.`)
    }
    const shuffled = shuffle(candidates, random)
    const roundCount = Math.min(step.rounds, Math.ceil(shuffled.length / 10))
    return Array.from({ length: roundCount }, (_, index) => ({
      cards: shuffled.slice(index * 10, (index + 1) * 10),
      groupName,
      mode: step.game_type,
      round: index + 1,
      roundCount,
    }))
  })
}
