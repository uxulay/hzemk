type SupabasePagedResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type SupabasePagedQuery = {
  range: (from: number, to: number) => PromiseLike<SupabasePagedResult<unknown>>;
};

const DEFAULT_SUPABASE_PAGE_SIZE = 1000;

async function withPaginationTimeout<T>(
  promise: PromiseLike<T>,
  action: string
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(`${action}超时：请检查 Supabase 地址、anon key、网络和 RLS 策略。`)
      );
    }, 10000);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function fetchAllSupabaseRows<T>(
  createQuery: () => SupabasePagedQuery,
  action: string,
  pageSize = DEFAULT_SUPABASE_PAGE_SIZE
): Promise<T[]> {
  const rows: T[] = [];
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await withPaginationTimeout(
      createQuery().range(from, to),
      action
    );

    if (error) {
      throw new Error(`${action}失败：${error.message}`);
    }

    const pageRows = (data ?? []) as T[];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      break;
    }

    page += 1;
  }

  return rows;
}
