type StatusBadgeProps = {
  status: string;
  label?: string;
};

function getTone(status: string) {
  if (
    ["active", "normal", "ready", "received", "completed", "shipped"].includes(
      status
    )
  ) {
    return "green";
  }

  if (
    [
      "submitted",
      "accepted",
      "ordered",
      "in_progress",
      "product_in",
      "material_in"
    ].includes(status)
  ) {
    return "blue";
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
    return "orange";
  }

  if (
    ["inactive", "disabled", "cancelled", "rejected", "shortage", "out_of_stock"].includes(
      status
    )
  ) {
    return "red";
  }

  return "gray";
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={`statusBadge statusBadge-${getTone(status)}`}>
      {label ?? status}
    </span>
  );
}
