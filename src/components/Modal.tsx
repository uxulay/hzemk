"use client";

import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: "md" | "lg" | "xl";
  panelClassName?: string;
  placement?: "top" | "center";
  onClose: () => void;
};

export function Modal({
  open,
  title,
  eyebrow,
  children,
  footer,
  maxWidth = "lg",
  panelClassName,
  placement = "top",
  onClose
}: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className={`modalBackdrop modalBackdrop-${placement}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className={`modalPanel appModal appModal-${maxWidth} ${
          panelClassName ?? ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-modal-title"
      >
        <div className="detailHeader">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h3 id="app-modal-title">{title}</h3>
          </div>
          <button className="secondaryButton" type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="modalBody">{children}</div>

        {footer ? <div className="modalFooter">{footer}</div> : null}
      </section>
    </div>
  );
}
