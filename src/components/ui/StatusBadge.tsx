type StatusBadgeProps = {
  status?: string;
  label?: string;
  type?: "success" | "warning" | "danger" | "info" | "neutral";
};

function getTone(status: string) {
  if (
    ["active", "normal", "ready", "received", "completed", "shipped"].includes(
      status
    )
  ) {
    return "success";
  }

  if (
    [
      "submitted",
      "accepted",
      "in_production",
      "ordered",
      "in_progress",
      "product_in",
      "material_in"
    ].includes(status)
  ) {
    return "info";
  }

  if (
    [
      "draft",
      "planned",
      "pending",
      "reserved",
      "partially_received",
      "material_pending",
      "low_stock"
    ].includes(status)
  ) {
    return "warning";
  }

  if (
    ["inactive", "disabled", "cancelled", "rejected", "shortage", "out_of_stock"].includes(
      status
    )
  ) {
    return "danger";
  }

  return "neutral";
}

export function StatusBadge({ status = "neutral", label, type }: StatusBadgeProps) {
  const tone = type ?? getTone(status);

  return (
    <span className={`statusBadge statusBadge-${tone}`}>
      {label ?? status}
    </span>
  );
}
