"use client";

import { useEffect, useState } from "react";
import { useMemo } from "react";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import {
  getMaterialRequirements,
  type MaterialRequirementRow,
  type MaterialRequirementStatus,
  type MaterialRequirementStatusFilter
} from "@/lib/api/material-requirements";
import { DEFAULT_PAGE_SIZE, paginateItems } from "@/lib/utils/pagination";

const statusOptions: {
  value: MaterialRequirementStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "全部状态" },
  { value: "enough", label: "库存足够" },
  { value: "shortage", label: "缺料" },
  { value: "purchased", label: "已采购" },
  { value: "received", label: "已到货" }
];

const statusLabels: Record<MaterialRequirementStatus, string> = {
  enough: "库存足够",
  shortage: "缺料",
  purchased: "已采购",
  received: "已到货",
  ready: "库存足够",
  pending: "待处理",
  reserved: "已预留"
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "读取失败，请稍后重试。";
}

function formatQuantity(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return Number(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 4
  });
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${Number(value * 100).toLocaleString("zh-CN", {
    maximumFractionDigits: 2
  })}%`;
}

export default function MaterialRequirementsPage() {
  const [requirements, setRequirements] = useState<MaterialRequirementRow[]>([]);
  const [statusFilter, setStatusFilter] =
    useState<MaterialRequirementStatusFilter>("all");
  const [selectedRequirement, setSelectedRequirement] =
    useState<MaterialRequirementRow | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const paginatedRequirements = useMemo(
    () => paginateItems(requirements, page),
    [page, requirements]
  );

  const loadRequirements = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const data = await getMaterialRequirements({ status: statusFilter });
      setRequirements(data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setRequirements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequirements();
  }, [statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">物料需求</p>
          <h2>物料需求列表</h2>
          <p>
            显示生产任务根据 BOM 自动计算出来的物料需求，方便厂长和采购查看库存是否足够。
          </p>
        </div>
        <span className="statusPill">Supabase 数据</span>
      </section>

      <section className="listPanel">
        <div className="listToolbar">
          <label>
            状态
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as MaterialRequirementStatusFilter
                )
              }
              disabled={loading}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div />

          <button
            className="secondaryButton"
            type="button"
            onClick={loadRequirements}
            disabled={loading}
          >
            {loading ? "正在刷新..." : "刷新列表"}
          </button>
        </div>

        {loading ? (
          <div className="debugNotice">正在读取物料需求列表...</div>
        ) : null}

        {errorMessage ? (
          <div className="debugError">
            <strong>查询失败</strong>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        {!loading && !errorMessage && requirements.length === 0 ? (
          <div className="emptyState">暂无物料需求</div>
        ) : null}

        {!loading && !errorMessage && requirements.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>生产任务单号</th>
                  <th>成品 SKU</th>
                  <th>计划生产数量</th>
                  <th>原材料编码</th>
                  <th>原材料名称</th>
                  <th>单位</th>
                  <th>BOM 单位用量</th>
                  <th>损耗率</th>
                  <th>总需求数量</th>
                  <th>当前库存数量</th>
                  <th>缺料数量</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRequirements.map((requirement) => {
                  const isShortage =
                    requirement.status === "shortage" ||
                    Number(requirement.shortage_quantity) > 0;

                  return (
                    <tr
                      className={isShortage ? "shortageRow" : undefined}
                      key={requirement.id}
                    >
                      <td>
                        {requirement.production_order?.production_order_no ?? "-"}
                      </td>
                      <td>
                        <strong>
                          {requirement.production_order?.finished_sku
                            ?.sku_code ?? "-"}
                        </strong>
                        <span>
                          {requirement.production_order?.finished_sku
                            ?.sku_name ?? "-"}
                        </span>
                      </td>
                      <td>
                        {formatQuantity(
                          requirement.production_order?.planned_quantity
                        )}
                      </td>
                      <td>{requirement.material_sku?.sku_code ?? "-"}</td>
                      <td>{requirement.material_sku?.sku_name ?? "-"}</td>
                      <td>{requirement.unit}</td>
                      <td>{formatQuantity(requirement.bom_item?.quantity_per)}</td>
                      <td>{formatPercent(requirement.bom_item?.loss_rate)}</td>
                      <td>{formatQuantity(requirement.required_quantity)}</td>
                      <td>{formatQuantity(requirement.available_quantity)}</td>
                      <td>{formatQuantity(requirement.shortage_quantity)}</td>
                      <td>
                        <span
                          className={`tablePill material-status-${requirement.status}`}
                        >
                          {statusLabels[requirement.status] ??
                            requirement.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="secondaryButton"
                          type="button"
                          onClick={() => setSelectedRequirement(requirement)}
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && !errorMessage && requirements.length > 0 ? (
          <Pagination
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            total={requirements.length}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      {selectedRequirement ? (
        <Modal
          open={Boolean(selectedRequirement)}
          eyebrow="物料需求详情"
          title={selectedRequirement.production_order?.production_order_no ?? "物料需求"}
          onClose={() => setSelectedRequirement(null)}
        >
          <div className="detailGrid">
            <div className="detailItem">
              <span>生产任务</span>
              <strong>
                {selectedRequirement.production_order?.production_order_no ?? "-"}
              </strong>
            </div>
            <div className="detailItem">
              <span>成品 SKU</span>
              <strong>
                {selectedRequirement.production_order?.finished_sku?.sku_code ?? "-"} /{" "}
                {selectedRequirement.production_order?.finished_sku?.sku_name ?? "-"}
              </strong>
            </div>
            <div className="detailItem">
              <span>计划生产数量</span>
              <strong>
                {formatQuantity(selectedRequirement.production_order?.planned_quantity)}
              </strong>
            </div>
            <div className="detailItem">
              <span>原材料 SKU</span>
              <strong>
                {selectedRequirement.material_sku?.sku_code ?? "-"} /{" "}
                {selectedRequirement.material_sku?.sku_name ?? "-"}
              </strong>
            </div>
            <div className="detailItem">
              <span>BOM 单位用量</span>
              <strong>{formatQuantity(selectedRequirement.bom_item?.quantity_per)}</strong>
            </div>
            <div className="detailItem">
              <span>损耗率</span>
              <strong>{formatPercent(selectedRequirement.bom_item?.loss_rate)}</strong>
            </div>
            <div className="detailItem">
              <span>总需求数量</span>
              <strong>{formatQuantity(selectedRequirement.required_quantity)}</strong>
            </div>
            <div className="detailItem">
              <span>当前库存数量</span>
              <strong>{formatQuantity(selectedRequirement.available_quantity)}</strong>
            </div>
            <div className="detailItem">
              <span>缺料数量</span>
              <strong>{formatQuantity(selectedRequirement.shortage_quantity)}</strong>
            </div>
            <div className="detailItem">
              <span>状态</span>
              <strong>
                {statusLabels[selectedRequirement.status] ??
                  selectedRequirement.status}
              </strong>
            </div>
            <div className="detailItem detailItemWide">
              <span>备注</span>
              <strong>{selectedRequirement.notes ?? "-"}</strong>
            </div>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
