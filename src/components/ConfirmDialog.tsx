"use client";

import type { ReactNode } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  items?: string[];
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "取消",
  danger = false,
  loading = false,
  items,
  onConfirm,
  onClose
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modalBackdrop" role="presentation">
      <div className="modalPanel confirmDialog" role="dialog" aria-modal="true">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">{danger ? "危险操作确认" : "操作确认"}</p>
            <h3>{title}</h3>
          </div>
        </div>

        <div className={danger ? "dangerNotice" : "debugNotice"}>
          {typeof description === "string" ? <p>{description}</p> : description}
        </div>

        {items && items.length > 0 ? (
          <div className="confirmItemList">
            {items.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ) : null}

        <div className="modalFooter">
          <button
            className="secondaryButton"
            type="button"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            className={danger ? "dangerButton" : "primaryButton"}
            type="button"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "正在处理..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
