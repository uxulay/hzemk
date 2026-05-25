import type { ReactNode } from "react";

type SearchFilterBarProps = {
  searchLabel?: string;
  searchValue: string;
  searchPlaceholder?: string;
  onSearchChange: (value: string) => void;
  children?: ReactNode;
  onReset?: () => void;
};

export function SearchFilterBar({
  searchLabel = "搜索",
  searchValue,
  searchPlaceholder,
  onSearchChange,
  children,
  onReset
}: SearchFilterBarProps) {
  return (
    <div className="searchFilterBar">
      <label>
        {searchLabel}
        <input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
        />
      </label>
      {children}
      {onReset ? (
        <button className="secondaryButton" type="button" onClick={onReset}>
          重置
        </button>
      ) : null}
    </div>
  );
}
