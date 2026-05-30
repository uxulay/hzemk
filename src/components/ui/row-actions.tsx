"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditIcon, EyeIcon, MoreHorizontalIcon } from "@/components/ui/icons";

export type RowAction = {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

type RowActionsProps = {
  onView?: () => void;
  onEdit?: () => void;
  moreActions?: RowAction[];
  maxInlineActions?: number;
  inlineAll?: boolean;
  viewLabel?: string;
  editLabel?: string;
  moreLabel?: string;
  children?: ReactNode;
};

function shouldKeepInMore(action: RowAction) {
  return action.danger || /删除|导出|取消/.test(action.label);
}

export function RowActions({
  onView,
  onEdit,
  moreActions = [],
  maxInlineActions = 3,
  inlineAll = false,
  viewLabel = "查看",
  editLabel = "编辑",
  moreLabel,
  children
}: RowActionsProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const inlineActions = moreActions.filter((action) => inlineAll || !shouldKeepInMore(action));
  const menuActions = moreActions.filter((action) => !inlineActions.includes(action));
  const visibleInlineActions = inlineAll
    ? inlineActions
    : inlineActions.slice(0, Math.max(0, maxInlineActions));
  const overflowActions = inlineAll ? [] : inlineActions.slice(visibleInlineActions.length);
  const finalMoreActions = [...overflowActions, ...menuActions];

  return (
    <div className="rowActions rowActionsCompact" ref={wrapperRef}>
      {onView ? (
        <button type="button" onClick={onView}>
          <EyeIcon size={14} />
          {viewLabel}
        </button>
      ) : null}
      {onEdit ? (
        <button type="button" onClick={onEdit}>
          <EditIcon size={14} />
          {editLabel}
        </button>
      ) : null}
      {children}
      {visibleInlineActions.map((action) => (
        <button
          className={action.danger ? "dangerButton" : undefined}
          disabled={action.disabled}
          key={action.label}
          type="button"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ))}
      {finalMoreActions.length > 0 ? (
        <div className="rowMoreWrap">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="更多操作"
            onClick={() => setOpen((current) => !current)}
          >
            <MoreHorizontalIcon size={16} />
            {moreLabel ? <span>{moreLabel}</span> : null}
          </button>
          {open ? (
            <div className="rowMoreMenu" role="menu">
              {finalMoreActions.map((action) => (
                <button
                  className={action.danger ? "dangerTextButton" : undefined}
                  disabled={action.disabled}
                  key={action.label}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    action.onClick();
                    setOpen(false);
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
