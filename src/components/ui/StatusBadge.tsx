type StatusBadgeProps = {
  status?: string;
  label?: string;
  type?: "success" | "warning" | "danger" | "info" | "neutral" | string;
};

function getTone(status: string) {
  switch (status) {
    case "draft": return "draft";
    case "submitted": return "submitted";
    case "accepted": return "accepted";
    case "in_production":
    case "production":
    case "producing":
      return "production";
    case "ready_to_ship":
    case "ready":
    case "pending_outbound":
      return "pending_outbound";
    case "shipped":
    case "outbound_done":
      return "shipped";
    case "completed":
    case "done":
      return "completed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "rejected": return "rejected";
    case "shortage": return "danger"; // user said: 缺料 / shortage： danger
    case "pending_purchase": return "warning"; // user said: 待采购： warning
    case "pending_inbound": return "info"; // user said: 待入库： info
  }

  // Fallbacks
  if (["active", "normal", "received"].includes(status)) return "success";
  if (["ordered", "in_progress", "product_in", "material_in"].includes(status)) return "info";
  if (["planned", "pending", "reserved", "partially_received", "material_pending", "low_stock"].includes(status)) return "warning";
  if (["inactive", "disabled", "out_of_stock"].includes(status)) return "danger";

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
