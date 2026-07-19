export function canOpenModelCard(card) {
  return Boolean(card?.hasAttribute?.("data-viewable") && card.dataset?.file);
}
