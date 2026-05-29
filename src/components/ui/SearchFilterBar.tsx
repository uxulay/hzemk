"use client";

import { useState, type ReactNode } from "react";
import { XIcon } from "@/components/ui/icons";

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const renderFilterFields = () => (
    <>
      {filters}
      {dateFilters}
      {children}
    </>
  );
  const desktopFilterContent = (
    <>
      {renderFilterFields()}
      {onReset ? (
        <button className="secondaryButton" type="button" onClick={onReset}>
          重置
        </button>
      ) : null}
    </>
  );

  return (
    <>
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
        <div className="searchFilterDesktopFilters">{desktopFilterContent}</div>
        {filters || dateFilters || children || onReset ? (
          <button
            className="secondaryButton searchFilterMobileButton"
            type="button"
            onClick={() => setFiltersOpen(true)}
          >
            筛选
          </button>
        ) : null}
        {rightActions ? <div className="searchFilterRightActions">{rightActions}</div> : null}
      </div>

      {filtersOpen ? (
        <div className="filterSheetBackdrop" role="presentation">
          <section
            className="filterSheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-sheet-title"
          >
            <div className="filterSheetHeader">
              <h3 id="filter-sheet-title">筛选</h3>
              <button
                className="iconButton"
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="关闭筛选"
              >
                <XIcon size={18} />
              </button>
            </div>
            <div className="filterSheetBody">{renderFilterFields()}</div>
            <div className="filterSheetFooter">
              {onReset ? (
                <button className="secondaryButton" type="button" onClick={onReset}>
                  重置
                </button>
              ) : null}
              <button
                className="primaryButton"
                type="button"
                onClick={() => setFiltersOpen(false)}
              >
                确认
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
