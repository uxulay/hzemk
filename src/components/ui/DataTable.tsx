import type { ReactNode } from "react";
import { EmptyIcon } from "@/components/ui/icons";

export type DataTableColumn<TRow> = {
  key: string;
  title: ReactNode;
  render: (row: TRow) => ReactNode;
  className?: string;
  width?: number | string;
  ellipsis?: boolean;
  align?: "left" | "center" | "right";
};

type DataTableProps<TRow> = {
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  getRowKey: (row: TRow) => string;
  loading?: boolean;
  loadingText?: string;
  emptyText?: string;
  minWidth?: number;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  onRowClick?: (row: TRow) => void;
  emptyAction?: ReactNode;
};

export function DataTable<TRow>({
  columns,
  rows,
  getRowKey,
  loading = false,
  loadingText = "正在读取数据，请稍候...",
  emptyText = "暂无数据",
  minWidth = 960,
  page,
  pageSize,
  total,
  onPageChange,
  pageSizeOptions = [20, 50, 100],
  onPageSizeChange,
  onRowClick,
  emptyAction
}: DataTableProps<TRow>) {
  if (loading) {
    return <div className="debugNotice">{loadingText}</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="emptyState dataTableEmpty">
        <EmptyIcon size={28} />
        <strong>{emptyText}</strong>
        {emptyAction ? <div>{emptyAction}</div> : null}
      </div>
    );
  }

  const totalPages =
    page && pageSize && total !== undefined
      ? Math.max(1, Math.ceil(total / pageSize))
      : 0;
  const safePage =
    page && totalPages ? Math.min(Math.max(page, 1), totalPages) : page ?? 1;

  return (
    <>
      <div className="tableWrap">
        <table className="dataTable modernDataTable" style={{ minWidth }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  className={column.className}
                  key={column.key}
                  style={{
                    textAlign: column.align,
                    width: column.width
                  }}
                >
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                className={onRowClick ? "clickableRow" : undefined}
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {columns.map((column) => (
                  <td
                    className={column.className}
                    key={column.key}
                    style={{
                      textAlign: column.align,
                      width: column.width
                    }}
                  >
                    {column.ellipsis ? (
                      <span className="ellipsisText">{column.render(row)}</span>
                    ) : (
                      column.render(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {page && pageSize && total !== undefined && onPageChange ? (
        <div className="paginationBar compactPagination">
          <span>共 {total} 条</span>
          {onPageSizeChange ? (
            <select
              aria-label="每页条数"
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option} 条/页
                </option>
              ))}
            </select>
          ) : (
            <span>{pageSize} 条/页</span>
          )}
          <div className="paginationButtons">
            <button
              className="secondaryButton"
              type="button"
              onClick={() => onPageChange(safePage - 1)}
              disabled={safePage <= 1}
            >
              上一页
            </button>
            <strong>{safePage}</strong>
            <span>/ {totalPages}</span>
            <button
              className="secondaryButton"
              type="button"
              onClick={() => onPageChange(safePage + 1)}
              disabled={safePage >= totalPages}
            >
              下一页
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
