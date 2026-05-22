"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createWarehouse,
  getWarehouseInventory,
  getWarehouseStats,
  getWarehouses,
  toggleWarehouseStatus,
  updateWarehouse,
  type WarehouseInventoryRow,
  type WarehouseListRow,
  type WarehouseStats,
  type WarehouseStatus
} from "@/lib/api/warehouses";

const warehouseStatusLabels: Record<string, string> = {
  active: "启用",
  inactive: "停用"
};

const warehouseTypeLabels: Record<string, string> = {
  internal: "内部仓",
  material: "原材料仓",
  finished_good: "成品仓",
  finished_product: "成品仓",
  semi_finished: "半成品仓",
  fba_staging: "FBA 发货暂存仓",
  fba: "FBA 发货暂存仓"
};

const skuTypeLabels: Record<string, string> = {
  material: "原材料",
  semi_finished: "半成品",
  finished_good: "成品",
  finished_product: "成品"
};

const warehouseTypeOptions = [
  { value: "material", label: "原材料仓" },
  { value: "finished_product", label: "成品仓" },
  { value: "semi_finished", label: "半成品仓" },
  { value: "fba", label: "FBA 发货暂存仓" },
  { value: "internal", label: "内部仓" }
];

type WarehouseFormState = {
  warehouseCode: string;
  name: string;
  warehouseType: string;
  address: string;
  status: WarehouseStatus;
};

type WarehouseEditFormState = WarehouseFormState & {
  warehouseId: string;
};

const initialWarehouseForm: WarehouseFormState = {
  warehouseCode: "",
  name: "",
  warehouseType: "material",
  address: "",
  status: "active"
};

const initialStats: WarehouseStats = {
  totalWarehouses: 0,
  materialWarehouses: 0,
  finishedGoodWarehouses: 0,
  fbaStagingWarehouses: 0,
  warehousesWithInventory: 0
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "操作失败，请稍后重试。";
}

function getWarehouseStatusLabel(status: string) {
  return warehouseStatusLabels[status] ?? status;
}

function getWarehouseTypeLabel(warehouseType: string) {
  return warehouseTypeLabels[warehouseType] ?? warehouseType;
}

function getSkuTypeLabel(skuType: string | null | undefined) {
  if (!skuType) {
    return "-";
  }

  return skuTypeLabels[skuType] ?? skuType;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function formatQuantity(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return Number(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 4
  });
}

function getOptionalText(value: string | null | undefined) {
  return value || "-";
}

function toEditableStatus(status: string): WarehouseStatus {
  return status === "inactive" ? "inactive" : "active";
}

function getTransactionsHref(warehouse: Pick<WarehouseListRow, "id">) {
  return `/inventory/transactions?warehouseId=${encodeURIComponent(warehouse.id)}`;
}

function getWarehouseTypeClass(warehouseType: string) {
  return warehouseType.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function hasKnownWarehouseType(warehouseType: string) {
  return warehouseTypeOptions.some((option) => option.value === warehouseType);
}

export default function AdminWarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseListRow[]>([]);
  const [stats, setStats] = useState<WarehouseStats>(initialStats);
  const [warehouseForm, setWarehouseForm] =
    useState<WarehouseFormState>(initialWarehouseForm);
  const [editForm, setEditForm] = useState<WarehouseEditFormState | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] =
    useState<WarehouseListRow | null>(null);
  const [warehouseInventory, setWarehouseInventory] = useState<
    WarehouseInventoryRow[]
  >([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [warehouseTypeFilter, setWarehouseTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const filteredWarehouses = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return warehouses.filter((warehouse) => {
      const matchesKeyword =
        !keyword ||
        warehouse.name.toLowerCase().includes(keyword) ||
        warehouse.warehouse_code.toLowerCase().includes(keyword);
      const matchesType =
        warehouseTypeFilter === "all" ||
        warehouse.warehouse_type === warehouseTypeFilter;
      const matchesStatus =
        statusFilter === "all" || warehouse.status === statusFilter;

      return matchesKeyword && matchesType && matchesStatus;
    });
  }, [warehouses, searchKeyword, warehouseTypeFilter, statusFilter]);

  const loadPageData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [warehouseData, statsData] = await Promise.all([
        getWarehouses(),
        getWarehouseStats()
      ]);

      setWarehouses(warehouseData);
      setStats(statsData);
      setSelectedWarehouse((current) => {
        if (!current) {
          return null;
        }

        return (
          warehouseData.find((warehouse) => warehouse.id === current.id) ?? null
        );
      });

      return warehouseData;
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setWarehouses([]);
      setStats(initialStats);
      setSelectedWarehouse(null);
      setWarehouseInventory([]);

      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  const refreshAll = async () => {
    const selectedWarehouseId = selectedWarehouse?.id;
    const warehouseData = await loadPageData();

    if (!selectedWarehouseId) {
      return;
    }

    const warehouseToRefresh = warehouseData.find(
      (warehouse) => warehouse.id === selectedWarehouseId
    );

    if (warehouseToRefresh) {
      await openWarehouseInventory(warehouseToRefresh, false);
    }
  };

  const submitCreateWarehouse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setCreating(true);
      setErrorMessage("");
      setSuccessMessage("");

      const created = await createWarehouse(warehouseForm);

      setSuccessMessage(`仓库 ${created.warehouse_code} 新增成功。`);
      setWarehouseForm(initialWarehouseForm);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const startEditWarehouse = (warehouse: WarehouseListRow) => {
    setEditForm({
      warehouseId: warehouse.id,
      warehouseCode: warehouse.warehouse_code,
      name: warehouse.name,
      warehouseType: warehouse.warehouse_type,
      address: warehouse.address ?? "",
      status: toEditableStatus(warehouse.status)
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const submitEditWarehouse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editForm) {
      return;
    }

    try {
      setUpdating(true);
      setErrorMessage("");
      setSuccessMessage("");

      await updateWarehouse(editForm);
      setSuccessMessage(`仓库 ${editForm.warehouseCode} 编辑成功。`);
      setEditForm(null);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setUpdating(false);
    }
  };

  const changeWarehouseStatus = async (warehouse: WarehouseListRow) => {
    try {
      setStatusUpdatingId(warehouse.id);
      setErrorMessage("");
      setSuccessMessage("");

      const nextStatus = await toggleWarehouseStatus(
        warehouse.id,
        warehouse.status
      );
      setSuccessMessage(
        `仓库 ${warehouse.warehouse_code} 已${getWarehouseStatusLabel(nextStatus)}。`
      );
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setStatusUpdatingId("");
    }
  };

  const openWarehouseInventory = async (
    warehouse: WarehouseListRow,
    clearMessage = true
  ) => {
    try {
      setInventoryLoading(true);
      setErrorMessage("");

      if (clearMessage) {
        setSuccessMessage("");
      }

      setSelectedWarehouse(warehouse);
      setWarehouseInventory(await getWarehouseInventory(warehouse.id));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setWarehouseInventory([]);
    } finally {
      setInventoryLoading(false);
    }
  };

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">基础资料</p>
          <h2>仓库管理</h2>
          <p>
            维护仓库基础资料。库存、入库、出库和库存流水都会通过仓库 ID
            关联到这里的仓库。
          </p>
        </div>
        <span className="statusPill">Supabase 数据</span>
      </section>

      <section className="metricGrid warehouseMetricGrid">
        <div className="metric">
          <span>仓库总数</span>
          <strong>{stats.totalWarehouses}</strong>
        </div>
        <div className="metric">
          <span>原材料仓数量</span>
          <strong>{stats.materialWarehouses}</strong>
        </div>
        <div className="metric">
          <span>成品仓数量</span>
          <strong>{stats.finishedGoodWarehouses}</strong>
        </div>
        <div className="metric">
          <span>FBA 暂存仓数量</span>
          <strong>{stats.fbaStagingWarehouses}</strong>
        </div>
        <div className="metric">
          <span>有库存的仓库数量</span>
          <strong>{stats.warehousesWithInventory}</strong>
        </div>
      </section>

      {successMessage ? (
        <div className="successNotice">
          <strong>操作成功</strong>
          <p>{successMessage}</p>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="debugError">
          <strong>操作失败</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <section className="formPanel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">新增仓库</p>
            <h3>创建仓库基础资料</h3>
          </div>
        </div>

        <form className="dataForm warehouseForm" onSubmit={submitCreateWarehouse}>
          <label>
            仓库编码
            <input
              value={warehouseForm.warehouseCode}
              onChange={(event) =>
                setWarehouseForm((current) => ({
                  ...current,
                  warehouseCode: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 WH-MATERIAL"
              required
            />
          </label>

          <label>
            仓库名称
            <input
              value={warehouseForm.name}
              onChange={(event) =>
                setWarehouseForm((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 原材料仓"
              required
            />
          </label>

          <label>
            仓库类型
            <select
              value={warehouseForm.warehouseType}
              onChange={(event) =>
                setWarehouseForm((current) => ({
                  ...current,
                  warehouseType: event.target.value
                }))
              }
              disabled={creating}
            >
              {warehouseTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            状态
            <select
              value={warehouseForm.status}
              onChange={(event) =>
                setWarehouseForm((current) => ({
                  ...current,
                  status: event.target.value as WarehouseStatus
                }))
              }
              disabled={creating}
            >
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </label>

          <label className="fullField">
            地址
            <textarea
              value={warehouseForm.address}
              onChange={(event) =>
                setWarehouseForm((current) => ({
                  ...current,
                  address: event.target.value
                }))
              }
              disabled={creating}
              placeholder="可填写仓库地址"
            />
          </label>

          <div className="formActions">
            <button className="primaryButton" type="submit" disabled={creating}>
              {creating ? "正在新增..." : "新增仓库"}
            </button>
          </div>
        </form>
      </section>

      {editForm ? (
        <section className="formPanel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">编辑仓库</p>
              <h3>{editForm.warehouseCode}</h3>
            </div>
            <button
              className="secondaryButton"
              type="button"
              onClick={() => setEditForm(null)}
              disabled={updating}
            >
              取消编辑
            </button>
          </div>

          <form className="dataForm warehouseForm" onSubmit={submitEditWarehouse}>
            <label>
              仓库编码
              <input value={editForm.warehouseCode} disabled />
              <span className="fieldHint">
                仓库编码已锁定，避免影响历史库存和流水关联。
              </span>
            </label>

            <label>
              仓库名称
              <input
                value={editForm.name}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          name: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating}
                required
              />
            </label>

            <label>
              仓库类型
              <select
                value={editForm.warehouseType}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          warehouseType: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating}
              >
                {!hasKnownWarehouseType(editForm.warehouseType) ? (
                  <option value={editForm.warehouseType}>
                    {getWarehouseTypeLabel(editForm.warehouseType)}
                  </option>
                ) : null}
                {warehouseTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              状态
              <select
                value={editForm.status}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          status: event.target.value as WarehouseStatus
                        }
                      : current
                  )
                }
                disabled={updating}
              >
                <option value="active">启用</option>
                <option value="inactive">停用</option>
              </select>
            </label>

            <label className="fullField">
              地址
              <textarea
                value={editForm.address}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          address: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating}
                placeholder="可填写仓库地址"
              />
            </label>

            <div className="formActions">
              <button
                className="primaryButton"
                type="submit"
                disabled={updating}
              >
                {updating ? "正在保存..." : "保存编辑"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="listPanel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">仓库列表</p>
            <h3>所有仓库</h3>
          </div>
          <button className="secondaryButton" type="button" onClick={refreshAll}>
            {loading ? "正在刷新..." : "刷新列表"}
          </button>
        </div>

        <div className="listToolbar warehouseToolbar">
          <label>
            搜索仓库名称 / 编码
            <input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="输入仓库名称或编码"
            />
          </label>

          <label>
            仓库类型
            <select
              value={warehouseTypeFilter}
              onChange={(event) => setWarehouseTypeFilter(event.target.value)}
            >
              <option value="all">全部类型</option>
              {warehouseTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            仓库状态
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">全部状态</option>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </label>

          <button className="secondaryButton" type="button" onClick={refreshAll}>
            刷新
          </button>
        </div>

        {loading ? (
          <div className="debugNotice">正在读取仓库数据...</div>
        ) : null}

        {!loading && filteredWarehouses.length === 0 ? (
          <div className="emptyState">暂无仓库</div>
        ) : null}

        {!loading && filteredWarehouses.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable warehouseTable">
              <thead>
                <tr>
                  <th>仓库编码</th>
                  <th>仓库名称</th>
                  <th>仓库类型</th>
                  <th>地址</th>
                  <th>状态</th>
                  <th>当前库存 SKU 数量</th>
                  <th>当前库存总数量</th>
                  <th>创建时间</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredWarehouses.map((warehouse) => {
                  const statusUpdating = statusUpdatingId === warehouse.id;

                  return (
                    <tr key={warehouse.id}>
                      <td>
                        <strong>{warehouse.warehouse_code}</strong>
                      </td>
                      <td>{warehouse.name}</td>
                      <td>
                        <span
                          className={`tablePill warehouse-type-${getWarehouseTypeClass(
                            warehouse.warehouse_type
                          )}`}
                        >
                          {getWarehouseTypeLabel(warehouse.warehouse_type)}
                        </span>
                      </td>
                      <td className="notesCell">
                        {getOptionalText(warehouse.address)}
                      </td>
                      <td>
                        <span
                          className={`tablePill warehouse-status-${warehouse.status}`}
                        >
                          {getWarehouseStatusLabel(warehouse.status)}
                        </span>
                      </td>
                      <td>{warehouse.inventory_sku_count}</td>
                      <td className="quantityCell">
                        {formatQuantity(warehouse.inventory_total_quantity)}
                      </td>
                      <td>{formatDateTime(warehouse.created_at)}</td>
                      <td>{formatDateTime(warehouse.updated_at)}</td>
                      <td>
                        <div className="rowActions warehouseRowActions">
                          <button
                            type="button"
                            onClick={() => startEditWarehouse(warehouse)}
                            disabled={updating}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => changeWarehouseStatus(warehouse)}
                            disabled={statusUpdating}
                          >
                            {statusUpdating
                              ? "正在处理..."
                              : warehouse.status === "active"
                                ? "停用"
                                : "启用"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openWarehouseInventory(warehouse)}
                            disabled={inventoryLoading}
                          >
                            查看库存
                          </button>
                          <Link
                            className="secondaryButton"
                            href={getTransactionsHref(warehouse)}
                          >
                            查看流水
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {inventoryLoading ? (
        <div className="debugNotice">正在读取仓库库存...</div>
      ) : null}

      {selectedWarehouse ? (
        <section className="detailPanel">
          <div className="detailHeader">
            <div>
              <p className="eyebrow">仓库库存</p>
              <h3>
                {selectedWarehouse.warehouse_code} / {selectedWarehouse.name}
              </h3>
            </div>
            <button
              className="secondaryButton"
              type="button"
              onClick={() => {
                setSelectedWarehouse(null);
                setWarehouseInventory([]);
              }}
            >
              收起库存
            </button>
          </div>

          {warehouseInventory.length === 0 ? (
            <div className="emptyState">当前仓库暂无库存</div>
          ) : (
            <div className="tableWrap">
              <table className="dataTable warehouseInventoryTable">
                <thead>
                  <tr>
                    <th>SKU 编码</th>
                    <th>SKU 名称</th>
                    <th>SKU 类型</th>
                    <th>当前库存数量</th>
                    <th>单位</th>
                    <th>最后更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouseInventory.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.sku?.sku_code ?? "-"}</strong>
                      </td>
                      <td>{item.sku?.sku_name ?? "-"}</td>
                      <td>{getSkuTypeLabel(item.sku?.sku_type)}</td>
                      <td className="quantityCell">
                        {formatQuantity(item.quantity_on_hand)}
                      </td>
                      <td>{item.sku?.unit ?? item.unit ?? "-"}</td>
                      <td>{formatDateTime(item.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
