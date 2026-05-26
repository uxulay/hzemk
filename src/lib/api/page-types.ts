export type SortDirection = "asc" | "desc";

export type ListPageParams<TFilters = Record<string, string | undefined>> = {
  page?: number;
  pageSize?: number;
  keyword?: string;
  filters?: TFilters;
  sortBy?: string;
  sortDirection?: SortDirection;
};

export type ListPageResult<T, TSummary = undefined> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: TSummary;
};

type RpcPagePayload<T, TSummary> = {
  rows?: T[];
  total?: number | string | null;
  page?: number | string | null;
  pageSize?: number | string | null;
  page_size?: number | string | null;
  totalPages?: number | string | null;
  total_pages?: number | string | null;
  summary?: TSummary;
};

function toPositiveInteger(value: unknown, fallback: number) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.floor(numberValue)
    : fallback;
}

export function normalizeRpcPage<T, TSummary = undefined>(
  payload: unknown,
  fallback: {
    page: number;
    pageSize: number;
    summary: TSummary;
  }
): ListPageResult<T, TSummary> {
  const pagePayload = (payload ?? {}) as RpcPagePayload<T, TSummary>;
  const total = toPositiveInteger(pagePayload.total, 0);
  const page = toPositiveInteger(pagePayload.page, fallback.page);
  const pageSize = toPositiveInteger(
    pagePayload.pageSize ?? pagePayload.page_size,
    fallback.pageSize
  );
  const totalPages = toPositiveInteger(
    pagePayload.totalPages ?? pagePayload.total_pages,
    Math.max(1, Math.ceil(total / pageSize))
  );

  return {
    rows: Array.isArray(pagePayload.rows) ? pagePayload.rows : [],
    total,
    page,
    pageSize,
    totalPages,
    summary: pagePayload.summary ?? fallback.summary
  };
}
