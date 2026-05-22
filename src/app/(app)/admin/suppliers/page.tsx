"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createSupplier,
  getSupplierPurchaseOrders,
  getSupplierStats,
  getSuppliers,
  toggleSupplierStatus,
  updateSupplier,
  type SupplierListRow,
  type SupplierPurchaseOrderRow,
  type SupplierStats,
  type SupplierStatus
} from "@/lib/api/suppliers";

const supplierStatusLabels: Record<string, string> = {
  active: "启用",
  inactive: "停用"
};

const purchaseStatusLabels: Record<string, string> = {
  draft: "草稿",
  ordered: "已下单",
  partially_received: "部分到货",
  received: "已到货",
  cancelled: "已取消"
};

type SupplierFormState = {
  supplierCode: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  status: SupplierStatus;
};

type SupplierEditFormState = SupplierFormState & {
  supplierId: string;
};

const initialSupplierForm: SupplierFormState = {
  supplierCode: "",
  name: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  status: "active"
};

const initialStats: SupplierStats = {
  totalSuppliers: 0,
  activeSuppliers: 0,
  inactiveSuppliers: 0,
  suppliersWithPurchaseOrders: 0
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "操作失败，请稍后重试。";
}

function getSupplierStatusLabel(status: string) {
  return supplierStatusLabels[status] ?? status;
}

function getPurchaseStatusLabel(status: string) {
  return purchaseStatusLabels[status] ?? status;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("zh-CN");
}

function toEditableStatus(status: string): SupplierStatus {
  return status === "inactive" ? "inactive" : "active";
}

function getOptionalText(value: string | null | undefined) {
  return value || "-";
}

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierListRow[]>([]);
  const [stats, setStats] = useState<SupplierStats>(initialStats);
  const [supplierForm, setSupplierForm] =
    useState<SupplierFormState>(initialSupplierForm);
  const [editForm, setEditForm] = useState<SupplierEditFormState | null>(null);
  const [selectedSupplier, setSelectedSupplier] =
    useState<SupplierListRow | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<
    SupplierPurchaseOrderRow[]
  >([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [purchaseOrdersLoading, setPurchaseOrdersLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const filteredSuppliers = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return suppliers.filter((supplier) => {
      const matchesKeyword =
        !keyword ||
        supplier.name.toLowerCase().includes(keyword) ||
        supplier.supplier_code.toLowerCase().includes(keyword) ||
        (supplier.contact_name ?? "").toLowerCase().includes(keyword);
      const matchesStatus =
        statusFilter === "all" || supplier.status === statusFilter;

      return matchesKeyword && matchesStatus;
    });
  }, [suppliers, searchKeyword, statusFilter]);

  const loadPageData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [supplierData, statsData] = await Promise.all([
        getSuppliers(),
        getSupplierStats()
      ]);

      setSuppliers(supplierData);
      setStats(statsData);
      setSelectedSupplier((current) => {
        if (!current) {
          return null;
        }

        return (
          supplierData.find((supplier) => supplier.id === current.id) ?? null
        );
      });

      return supplierData;
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setSuppliers([]);
      setStats(initialStats);
      setSelectedSupplier(null);
      setPurchaseOrders([]);

      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  const refreshAll = async () => {
    const selectedSupplierId = selectedSupplier?.id;
    const supplierData = await loadPageData();

    if (!selectedSupplierId) {
      return;
    }

    const supplierToRefresh = supplierData.find(
      (supplier) => supplier.id === selectedSupplierId
    );

    if (supplierToRefresh) {
      await openSupplierPurchaseOrders(supplierToRefresh, false);
    }
  };

  const submitCreateSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setCreating(true);
      setErrorMessage("");
      setSuccessMessage("");

      const created = await createSupplier(supplierForm);

      setSuccessMessage(`供应商 ${created.supplier_code} 新增成功。`);
      setSupplierForm(initialSupplierForm);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const startEditSupplier = (supplier: SupplierListRow) => {
    setEditForm({
      supplierId: supplier.id,
      supplierCode: supplier.supplier_code,
      name: supplier.name,
      contactName: supplier.contact_name ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      notes: supplier.notes ?? "",
      status: toEditableStatus(supplier.status)
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const submitEditSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editForm) {
      return;
    }

    try {
      setUpdating(true);
      setErrorMessage("");
      setSuccessMessage("");

      await updateSupplier(editForm);
      setSuccessMessage(`供应商 ${editForm.supplierCode} 编辑成功。`);
      setEditForm(null);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setUpdating(false);
    }
  };

  const changeSupplierStatus = async (supplier: SupplierListRow) => {
    try {
      setStatusUpdatingId(supplier.id);
      setErrorMessage("");
      setSuccessMessage("");

      const nextStatus = await toggleSupplierStatus(
        supplier.id,
        supplier.status
      );
      setSuccessMessage(
        `供应商 ${supplier.supplier_code} 已${getSupplierStatusLabel(nextStatus)}。`
      );
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setStatusUpdatingId("");
    }
  };

  const openSupplierPurchaseOrders = async (
    supplier: SupplierListRow,
    clearMessage = true
  ) => {
    try {
      setPurchaseOrdersLoading(true);
      setErrorMessage("");

      if (clearMessage) {
        setSuccessMessage("");
      }

      setSelectedSupplier(supplier);
      setPurchaseOrders(await getSupplierPurchaseOrders(supplier.id));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setPurchaseOrders([]);
    } finally {
      setPurchaseOrdersLoading(false);
    }
  };

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">基础资料</p>
          <h2>供应商管理</h2>
          <p>
            管理采购用的供应商基础资料。采购单通过供应商 ID 关联供应商，
            后续采购下单时会从这里选择供应商。
          </p>
        </div>
        <span className="statusPill">Supabase 数据</span>
      </section>

      <section className="metricGrid">
        <div className="metric">
          <span>供应商总数</span>
          <strong>{stats.totalSuppliers}</strong>
        </div>
        <div className="metric">
          <span>启用供应商数</span>
          <strong>{stats.activeSuppliers}</strong>
        </div>
        <div className="metric">
          <span>停用供应商数</span>
          <strong>{stats.inactiveSuppliers}</strong>
        </div>
        <div className="metric">
          <span>已产生采购单的供应商</span>
          <strong>{stats.suppliersWithPurchaseOrders}</strong>
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
            <p className="eyebrow">新增供应商</p>
            <h3>创建供应商基础资料</h3>
          </div>
        </div>

        <form
          className="dataForm supplierForm"
          onSubmit={submitCreateSupplier}
        >
          <label>
            供应商编码
            <input
              value={supplierForm.supplierCode}
              onChange={(event) =>
                setSupplierForm((current) => ({
                  ...current,
                  supplierCode: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 SUP-001"
              required
            />
          </label>

          <label>
            供应商名称
            <input
              value={supplierForm.name}
              onChange={(event) =>
                setSupplierForm((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 深圳某某包装有限公司"
              required
            />
          </label>

          <label>
            联系人
            <input
              value={supplierForm.contactName}
              onChange={(event) =>
                setSupplierForm((current) => ({
                  ...current,
                  contactName: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 张三"
            />
          </label>

          <label>
            联系电话
            <input
              value={supplierForm.phone}
              onChange={(event) =>
                setSupplierForm((current) => ({
                  ...current,
                  phone: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 13800000000"
            />
          </label>

          <label>
            邮箱
            <input
              type="email"
              value={supplierForm.email}
              onChange={(event) =>
                setSupplierForm((current) => ({
                  ...current,
                  email: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 buyer@example.com"
            />
          </label>

          <label>
            状态
            <select
              value={supplierForm.status}
              onChange={(event) =>
                setSupplierForm((current) => ({
                  ...current,
                  status: event.target.value as SupplierStatus
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
              value={supplierForm.address}
              onChange={(event) =>
                setSupplierForm((current) => ({
                  ...current,
                  address: event.target.value
                }))
              }
              disabled={creating}
              placeholder="可填写供应商地址"
            />
          </label>

          <label className="fullField">
            备注
            <textarea
              value={supplierForm.notes}
              onChange={(event) =>
                setSupplierForm((current) => ({
                  ...current,
                  notes: event.target.value
                }))
              }
              disabled={creating}
              placeholder="可填写合作说明、付款方式或其他备注"
            />
          </label>

          <div className="formActions">
            <button className="primaryButton" type="submit" disabled={creating}>
              {creating ? "正在新增..." : "新增供应商"}
            </button>
          </div>
        </form>
      </section>

      {editForm ? (
        <section className="formPanel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">编辑供应商</p>
              <h3>{editForm.supplierCode}</h3>
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

          <form className="dataForm supplierForm" onSubmit={submitEditSupplier}>
            <label>
              供应商编码
              <input value={editForm.supplierCode} disabled />
              <span className="fieldHint">
                供应商编码已锁定，避免影响历史采购单关联。
              </span>
            </label>

            <label>
              供应商名称
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
              联系人
              <input
                value={editForm.contactName}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          contactName: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating}
              />
            </label>

            <label>
              联系电话
              <input
                value={editForm.phone}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          phone: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating}
              />
            </label>

            <label>
              邮箱
              <input
                type="email"
                value={editForm.email}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          email: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating}
              />
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
                          status: event.target.value as SupplierStatus
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
              />
            </label>

            <label className="fullField">
              备注
              <textarea
                value={editForm.notes}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          notes: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating}
                placeholder="可填写合作说明、付款方式或其他备注"
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
            <p className="eyebrow">供应商列表</p>
            <h3>所有供应商</h3>
          </div>
          <button className="secondaryButton" type="button" onClick={refreshAll}>
            {loading ? "正在刷新..." : "刷新列表"}
          </button>
        </div>

        <div className="listToolbar supplierToolbar">
          <label>
            搜索供应商名称 / 编码 / 联系人
            <input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="输入名称、编码或联系人"
            />
          </label>

          <label>
            供应商状态
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
          <div className="debugNotice">正在读取供应商数据...</div>
        ) : null}

        {!loading && filteredSuppliers.length === 0 ? (
          <div className="emptyState">暂无供应商</div>
        ) : null}

        {!loading && filteredSuppliers.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable supplierTable">
              <thead>
                <tr>
                  <th>供应商编码</th>
                  <th>供应商名称</th>
                  <th>联系人</th>
                  <th>联系电话</th>
                  <th>邮箱</th>
                  <th>地址</th>
                  <th>状态</th>
                  <th>关联采购单数量</th>
                  <th>创建时间</th>
                  <th>更新时间</th>
                  <th>备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((supplier) => {
                  const statusUpdating = statusUpdatingId === supplier.id;

                  return (
                    <tr key={supplier.id}>
                      <td>
                        <strong>{supplier.supplier_code}</strong>
                      </td>
                      <td>{supplier.name}</td>
                      <td>{getOptionalText(supplier.contact_name)}</td>
                      <td>{getOptionalText(supplier.phone)}</td>
                      <td>{getOptionalText(supplier.email)}</td>
                      <td className="notesCell">
                        {getOptionalText(supplier.address)}
                      </td>
                      <td>
                        <span
                          className={`tablePill supplier-status-${supplier.status}`}
                        >
                          {getSupplierStatusLabel(supplier.status)}
                        </span>
                      </td>
                      <td>{supplier.purchase_order_count}</td>
                      <td>{formatDateTime(supplier.created_at)}</td>
                      <td>{formatDateTime(supplier.updated_at)}</td>
                      <td className="notesCell">
                        {getOptionalText(supplier.notes)}
                      </td>
                      <td>
                        <div className="rowActions supplierRowActions">
                          <button
                            type="button"
                            onClick={() => startEditSupplier(supplier)}
                            disabled={updating}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => changeSupplierStatus(supplier)}
                            disabled={statusUpdating}
                          >
                            {statusUpdating
                              ? "正在处理..."
                              : supplier.status === "active"
                                ? "停用"
                                : "启用"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openSupplierPurchaseOrders(supplier)}
                            disabled={purchaseOrdersLoading}
                          >
                            查看采购单
                          </button>
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

      {purchaseOrdersLoading ? (
        <div className="debugNotice">正在读取关联采购单...</div>
      ) : null}

      {selectedSupplier ? (
        <section className="detailPanel">
          <div className="detailHeader">
            <div>
              <p className="eyebrow">关联采购单</p>
              <h3>
                {selectedSupplier.supplier_code} / {selectedSupplier.name}
              </h3>
            </div>
            <button
              className="secondaryButton"
              type="button"
              onClick={() => {
                setSelectedSupplier(null);
                setPurchaseOrders([]);
              }}
            >
              收起采购单
            </button>
          </div>

          {purchaseOrders.length === 0 ? (
            <div className="emptyState">当前供应商暂无关联采购单</div>
          ) : (
            <div className="tableWrap">
              <table className="dataTable supplierPurchaseTable">
                <thead>
                  <tr>
                    <th>采购单号</th>
                    <th>状态</th>
                    <th>下单日期</th>
                    <th>预计到货日期</th>
                    <th>创建时间</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map((purchaseOrder) => (
                    <tr key={purchaseOrder.id}>
                      <td>
                        <strong>{purchaseOrder.purchase_order_no}</strong>
                      </td>
                      <td>
                        <span
                          className={`tablePill purchase-status-${purchaseOrder.status}`}
                        >
                          {getPurchaseStatusLabel(purchaseOrder.status)}
                        </span>
                      </td>
                      <td>{formatDateTime(purchaseOrder.ordered_at)}</td>
                      <td>{formatDate(purchaseOrder.expected_arrival_date)}</td>
                      <td>{formatDateTime(purchaseOrder.created_at)}</td>
                      <td className="notesCell">
                        {getOptionalText(purchaseOrder.notes)}
                      </td>
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
