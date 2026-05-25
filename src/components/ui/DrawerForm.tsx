"use client";

import type { ReactNode } from "react";

type DrawerFormProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

export function DrawerForm({
  open,
  title,
  description,
  children,
  footer,
  onClose
}: DrawerFormProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="drawerBackdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="drawerPanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="detailHeader">
          <div>
            <p className="eyebrow">表单</p>
            <h3 id="drawer-title">{title}</h3>
            {description ? <p className="drawerDescription">{description}</p> : null}
          </div>
          <button className="secondaryButton" type="button" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="drawerBody">{children}</div>
        {footer ? <div className="modalFooter">{footer}</div> : null}
      </aside>
    </div>
  );
}
