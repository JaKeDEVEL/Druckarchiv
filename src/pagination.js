export const PAGE_SIZES = Object.freeze([25, 50]);

export function normalizePageSize(value, fallback = PAGE_SIZES[0]) {
  const numericValue = Number(value);
  return PAGE_SIZES.includes(numericValue) ? numericValue : fallback;
}

export function paginateEntries(entries, requestedPage = 1, requestedPageSize = PAGE_SIZES[0]) {
  const pageSize = normalizePageSize(requestedPageSize);
  const total = entries.length;
  const totalPages = total ? Math.ceil(total / pageSize) : 0;
  const numericPage = Number.isFinite(Number(requestedPage)) ? Math.trunc(Number(requestedPage)) : 1;
  const page = totalPages ? Math.min(Math.max(numericPage, 1), totalPages) : 1;
  const start = total ? (page - 1) * pageSize : 0;
  const end = Math.min(start + pageSize, total);

  return {
    items: entries.slice(start, end),
    page,
    pageSize,
    start,
    end,
    total,
    totalPages
  };
}

export function paginationTokens(page, totalPages) {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages = [...new Set([1, totalPages, page - 1, page, page + 1]
    .filter(candidate => candidate >= 1 && candidate <= totalPages))]
    .sort((left, right) => left - right);
  const tokens = [];

  pages.forEach((candidate, index) => {
    if (index && candidate - pages[index - 1] > 1) tokens.push("ellipsis");
    tokens.push(candidate);
  });

  return tokens;
}
