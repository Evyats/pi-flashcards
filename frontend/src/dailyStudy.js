function shuffle(items, random) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

export function buildDailyStudyRounds(task, groups, cards, random = Math.random) {
  return task.steps.flatMap((step) => {
    const group = groups.find((item) => item.id === step.group_id)
    const candidates = cards.filter((card) => card.group_id === step.group_id && (
      step.card_subset === 'all' || (step.card_subset === 'known' ? card.is_known : !card.is_known)
    ))
    if (!candidates.length) {
      throw new Error(`${group?.name ?? 'A configured deck'} has no cards matching the configured subset.`)
    }
    const shuffled = shuffle(candidates, random)
    const roundCount = Math.min(step.rounds, Math.ceil(shuffled.length / 10))
    return Array.from({ length: roundCount }, (_, index) => ({
      cards: shuffled.slice(index * 10, (index + 1) * 10),
      groupName: group?.name ?? 'Deck',
      mode: step.game_type,
      round: index + 1,
      roundCount,
    }))
  })
}
