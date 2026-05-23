"use client";

import { useMemo, useState } from "react";
import type { BulkActionResult } from "@/lib/bulk-types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type BulkActionBarProps<TItem extends { id: string }> = {
  selectedItems: TItem[];
  getItemLabel: (item: TItem) => string;
  entityName: string;
  onClearSelection: () => void;
  onDeactivateSelected: (items: TItem[]) => Promise<BulkActionResult[]>;
  onDeleteSelected: (items: TItem[]) => Promise<BulkActionResult[]>;
};

type PendingAction = "deactivate" | "delete" | null;

function getActionText(action: PendingAction) {
  if (action === "delete") {
    return {
      title: "确认批量删除",
      confirmLabel: "确认删除",
      description:
        "系统会逐条检查是否已有业务数据引用。已经被业务使用的数据不会被物理删除。"
    };
  }

  return {
    title: "确认批量停用",
    confirmLabel: "确认停用",
    description:
      "停用不会删除历史资料，只是让它不再作为启用资料继续使用。"
  };
}

export function BulkActionBar<TItem extends { id: string }>({
  selectedItems,
  getItemLabel,
  entityName,
  onClearSelection,
  onDeactivateSelected,
  onDeleteSelected
}: BulkActionBarProps<TItem>) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<BulkActionResult[]>([]);

  const labels = useMemo(
    () => selectedItems.map((item) => getItemLabel(item)),
    [getItemLabel, selectedItems]
  );
  const actionText = getActionText(pendingAction);
  const successCount = results.filter((result) => result.success).length;
  const failedCount = results.length - successCount;

  if (selectedItems.length === 0) {
    return null;
  }

  const runAction = async () => {
    if (!pendingAction) {
      return;
    }

    try {
      setProcessing(true);
      setResults(
        pendingAction === "delete"
          ? await onDeleteSelected(selectedItems)
          : await onDeactivateSelected(selectedItems)
      );
      onClearSelection();
      setPendingAction(null);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="bulkActionBar">
      <div>
        <strong>
          已选择 {selectedItems.length} 条{entityName}
        </strong>
        <span>批量操作会逐条处理，失败原因会显示在下方。</span>
      </div>

      <div className="rowActions">
        <button type="button" onClick={() => setPendingAction("deactivate")}>
          批量停用
        </button>
        <button
          className="dangerButton"
          type="button"
          onClick={() => setPendingAction("delete")}
        >
          批量删除
        </button>
        <button type="button" onClick={onClearSelection}>
          取消选择
        </button>
      </div>

      {results.length > 0 ? (
        <div className="bulkResultBox">
          <strong>
            上次批量处理：成功 {successCount} 条，失败 {failedCount} 条
          </strong>
          <div className="bulkResultList">
            {results.map((result) => (
              <p
                className={result.success ? "bulkResultSuccess" : "bulkResultError"}
                key={`${result.id}-${result.action}`}
              >
                {result.label}：{result.message}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={`${actionText.title}${entityName}`}
        description={<p>{actionText.description}</p>}
        confirmLabel={actionText.confirmLabel}
        danger={pendingAction === "delete"}
        loading={processing}
        items={labels}
        onClose={() => setPendingAction(null)}
        onConfirm={runAction}
      />
    </div>
  );
}
