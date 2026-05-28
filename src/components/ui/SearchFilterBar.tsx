import type { ReactNode } from "react";

type SearchFilterBarProps = {
  searchLabel?: string;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  filters?: ReactNode;
  dateFilters?: ReactNode;
  rightActions?: ReactNode;
  children?: ReactNode;
  onReset?: () => void;
};

export function SearchFilterBar({
  searchLabel = "搜索",
  searchValue,
  searchPlaceholder,
  onSearchChange,
  filters,
  dateFilters,
  rightActions,
  children,
  onReset
}: SearchFilterBarProps) {
  return (
    <div className="searchFilterBar">
      {onSearchChange ? (
        <label className="searchFilterSearch">
          {searchLabel}
          <input
            value={searchValue ?? ""}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>
      ) : null}
      {filters}
      {dateFilters}
      {children}
      {onReset ? (
        <button className="secondaryButton" type="button" onClick={onReset}>
          重置
        </button>
      ) : null}
      {rightActions ? <div className="searchFilterRightActions">{rightActions}</div> : null}
    </div>
  );
}
