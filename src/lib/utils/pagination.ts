export const DEFAULT_PAGE_SIZE = 20;

export function paginateItems<T>(items: T[], page: number, pageSize = DEFAULT_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return items.slice(start, start + pageSize);
}
