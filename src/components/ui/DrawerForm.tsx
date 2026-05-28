"use client";

import type { ReactNode } from "react";
import { XIcon } from "@/components/ui/icons";

type DrawerFormProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: "md" | "lg";
  onSave?: () => void;
  onSaveAndContinue?: () => void;
  saving?: boolean;
};

export function DrawerForm({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  width = "md",
  onSave,
  onSaveAndContinue,
  saving = false
}: DrawerFormProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="drawerBackdrop" role="presentation">
      <aside
        className={`drawerPanel drawerPanel-${width}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <div className="detailHeader">
          <div>
            <h3 id="drawer-title">{title}</h3>
            {description ? <p className="drawerDescription">{description}</p> : null}
          </div>
          <button className="iconButton" type="button" onClick={onClose} aria-label="关闭">
            <XIcon size={18} />
          </button>
        </div>
        <div className="drawerBody">{children}</div>
        <div className="modalFooter drawerFooter">
          {footer ?? (
            <>
              <button className="secondaryButton" type="button" onClick={onClose}>
                取消
              </button>
              {onSaveAndContinue ? (
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={onSaveAndContinue}
                  disabled={saving}
                >
                  保存并继续新增
                </button>
              ) : null}
              {onSave ? (
                <button
                  className="primaryButton"
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                >
                  保存
                </button>
              ) : null}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
