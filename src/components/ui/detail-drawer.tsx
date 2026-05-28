"use client";

import type { ReactNode } from "react";
import { XIcon } from "@/components/ui/icons";

type DetailDrawerProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: "md" | "lg";
  onClose: () => void;
};

export function DetailDrawer({
  open,
  title,
  children,
  footer,
  width = "md",
  onClose
}: DetailDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="drawerBackdrop" role="presentation">
      <aside
        className={`drawerPanel drawerPanel-${width}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-drawer-title"
      >
        <div className="detailHeader">
          <h3 id="detail-drawer-title">{title}</h3>
          <button className="iconButton" type="button" onClick={onClose} aria-label="关闭">
            <XIcon size={18} />
          </button>
        </div>
        <div className="drawerBody">{children}</div>
        {footer ? <div className="modalFooter drawerFooter">{footer}</div> : null}
      </aside>
    </div>
  );
}
