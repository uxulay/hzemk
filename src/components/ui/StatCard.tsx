import type { ReactNode } from "react";

type StatCardProps = {
  title: string;
  value: string | number;
  change?: string;
  tone?: "blue" | "green" | "orange" | "red" | "purple" | "cyan";
  icon?: ReactNode;
};

export function StatCard({
  title,
  value,
  change,
  tone = "blue",
  icon
}: StatCardProps) {
  return (
    <div className={`statCard statCard-${tone}`}>
      <div className="statCardIcon">{icon}</div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        {change ? <small>{change}</small> : null}
      </div>
    </div>
  );
}
