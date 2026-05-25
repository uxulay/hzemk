import type { ReactNode } from "react";
import { Pagination } from "@/components/Pagination";

export type DataTableColumn<TRow> = {
  key: string;
  title: ReactNode;
  render: (row: TRow) => ReactNode;
  className?: string;
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
  onPageChange
}: DataTableProps<TRow>) {
  if (loading) {
    return <div className="debugNotice">{loadingText}</div>;
  }

  if (rows.length === 0) {
    return <div className="emptyState">{emptyText}</div>;
  }

  return (
    <>
      <div className="tableWrap">
        <table className="dataTable modernDataTable" style={{ minWidth }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th className={column.className} key={column.key}>
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((column) => (
                  <td className={column.className} key={column.key}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {page && pageSize && total !== undefined && onPageChange ? (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
        />
      ) : null}
    </>
  );
}
