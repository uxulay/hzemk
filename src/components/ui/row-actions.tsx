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
  viewLabel?: string;
  editLabel?: string;
  children?: ReactNode;
};

export function RowActions({
  onView,
  onEdit,
  moreActions = [],
  viewLabel = "查看",
  editLabel = "编辑",
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
      {moreActions.length > 0 ? (
        <div className="rowMoreWrap">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="更多操作"
            onClick={() => setOpen((current) => !current)}
          >
            <MoreHorizontalIcon size={16} />
          </button>
          {open ? (
            <div className="rowMoreMenu" role="menu">
              {moreActions.map((action) => (
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
