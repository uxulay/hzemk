import type { ReactNode } from "react";

type EllipsisTextProps = {
  children: ReactNode;
  title?: string;
  className?: string;
};

export function EllipsisText({ children, title, className }: EllipsisTextProps) {
  return (
    <span className={["ellipsisText", className].filter(Boolean).join(" ")} title={title}>
      {children}
    </span>
  );
}
