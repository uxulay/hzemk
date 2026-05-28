import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  subtitle?: string;
  actions?: ReactNode;
  secondaryActions?: ReactNode;
  primaryAction?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  subtitle,
  actions,
  secondaryActions,
  primaryAction
}: PageHeaderProps) {
  const supportText = subtitle ?? description;

  return (
    <section className="pageHeader">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {supportText ? <p>{supportText}</p> : null}
      </div>
      {actions || secondaryActions || primaryAction ? (
        <div className="pageHeaderActions">
          {secondaryActions}
          {actions}
          {primaryAction}
        </div>
      ) : null}
    </section>
  );
}
