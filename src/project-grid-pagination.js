export const DEFAULT_PROJECT_GRID_PAGE_SIZE = 8;

export function projectGridPageCapacity(width, height) {
  const measuredWidth = Number(width);
  const measuredHeight = Number(height);
  if (!Number.isFinite(measuredWidth) || !Number.isFinite(measuredHeight) || measuredWidth <= 0 || measuredHeight <= 0) {
    return DEFAULT_PROJECT_GRID_PAGE_SIZE;
  }

  const compact = measuredWidth <= 760;
  const gap = compact ? 8 : 12;
  const horizontalPadding = compact ? 20 : 36;
  const verticalPadding = compact ? 20 : 34;
  const cardHeight = compact ? 202 : 224;
  const usableWidth = Math.max(0, measuredWidth - horizontalPadding);
  const usableHeight = Math.max(0, measuredHeight - verticalPadding);
  const columns = measuredWidth <= 420
    ? 1
    : compact
      ? 2
      : Math.max(1, Math.floor((usableWidth + gap) / (190 + gap)));
  const rows = Math.max(1, Math.floor((usableHeight + gap) / (cardHeight + gap)));

  return columns * rows;
}
