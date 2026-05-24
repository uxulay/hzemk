"use client";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange
}: PaginationProps) {
  if (total <= 0) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <div className="paginationBar">
      <div>
        第 {safePage} / {totalPages} 页
        <span>
          共 {total} 条，当前显示 {start}-{end} 条
        </span>
      </div>

      <div className="rowActions">
        <button
          className="secondaryButton"
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
        >
          上一页
        </button>
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
  );
}
