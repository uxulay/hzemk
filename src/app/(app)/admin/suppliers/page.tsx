"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BulkActionBar } from "@/components/BulkActionBar";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { DrawerForm } from "@/components/ui/DrawerForm";
import { InfoCell } from "@/components/ui/info-cell";
import { PageHeader } from "@/components/ui/PageHeader";
import { RowActions } from "@/components/ui/row-actions";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  bulkImportSuppliers,
  deactivateSuppliersByIds,
  deleteSuppliersByIds,
  validateSupplierImportRows,
  type SupplierImportInput
} from "@/lib/api/bulk-management";
import {
  createSupplier,
  getSupplierDefaultMaterials,
  getSupplierPurchaseOrders,
  getSupplierStats,
  getSuppliersPage,
  toggleSupplierStatus,
  updateSupplier,
  type SupplierListRow,
  type SupplierDefaultMaterialRow,
  type SupplierPurchaseOrderRow,
  type SupplierStats,
  type SupplierStatus
} from "@/lib/api/suppliers";
import { downloadCsvTemplate, type CsvTemplateField } from "@/lib/utils/csv";
import { DEFAULT_PAGE_SIZE } from "@/lib/utils/pagination";

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
  suppliersWithPurchaseOrders: 0,
  suppliersWithDefaultMaterials: 0
};

const supplierImportFields: CsvTemplateField[] = [
  {
    key: "supplier_code",
    label: "供应商编码",
    required: true,
    example: "SUP-001"
  },
  {
    key: "supplier_name",
    label: "供应商名称",
    required: true,
    example: "深圳某某包装有限公司"
  },
  {
    key: "contact_name",
    label: "联系人",
    example: "张三"
  },
  {
    key: "phone",
    label: "电话",
    example: "13800000000"
  },
  {
    key: "email",
    label: "邮箱",
    example: "buyer@example.com"
  },
  {
    key: "address",
    label: "地址",
    example: "广东省深圳市"
  },
  {
    key: "remark",
    label: "备注",
    example: "合作说明"
  },
  {
    key: "status",
    label: "状态",
    example: "active"
  }
];

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
  const [defaultMaterials, setDefaultMaterials] = useState<
    SupplierDefaultMaterialRow[]
  >([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [supplierTotal, setSupplierTotal] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] =
    useState<SupplierListRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [supplierDetailLoading, setSupplierDetailLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [deletingSupplierId, setDeletingSupplierId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedSuppliers = useMemo(
    () => suppliers.filter((supplier) => selectedSupplierIds.includes(supplier.id)),
    [suppliers, selectedSupplierIds]
  );
  const allFilteredSelected =
    suppliers.length > 0 &&
    suppliers.every((supplier) =>
      selectedSupplierIds.includes(supplier.id)
    );

  const loadPageData = async (targetPage = page) => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [supplierPage, statsData] = await Promise.all([
        getSuppliersPage({
          page: targetPage,
          pageSize: DEFAULT_PAGE_SIZE,
          keyword: searchKeyword,
          filters: { status: statusFilter }
        }),
        getSupplierStats()
      ]);

      setSuppliers(supplierPage.rows);
      setSupplierTotal(supplierPage.total);
      setPage(supplierPage.page);
      setStats(statsData);
      setSelectedSupplierIds((current) =>
        current.filter((supplierId) =>
          supplierPage.rows.some((supplier) => supplier.id === supplierId)
        )
      );
      setSelectedSupplier((current) => {
        if (!current) {
          return null;
        }

        return (
          supplierPage.rows.find((supplier) => supplier.id === current.id) ?? null
        );
      });

      return supplierPage.rows;
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setSuppliers([]);
      setSupplierTotal(0);
      setStats(initialStats);
      setSelectedSupplierIds([]);
      setSelectedSupplier(null);
      setPurchaseOrders([]);
      setDefaultMaterials([]);

      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData(1);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadPageData(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchKeyword, statusFilter]);

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
      await openSupplierDetail(supplierToRefresh, false);
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
      setCreateOpen(false);
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

  const toggleSupplierSelection = (supplierId: string) => {
    setSelectedSupplierIds((current) =>
      current.includes(supplierId)
        ? current.filter((id) => id !== supplierId)
        : [...current, supplierId]
    );
  };

  const toggleAllFilteredSuppliers = () => {
    if (allFilteredSelected) {
      setSelectedSupplierIds((current) =>
        current.filter(
          (supplierId) =>
            !suppliers.some((supplier) => supplier.id === supplierId)
        )
      );
      return;
    }

    setSelectedSupplierIds((current) =>
      Array.from(
        new Set([
          ...current,
          ...suppliers.map((supplier) => supplier.id)
        ])
      )
    );
  };

  const importSuppliers = async (
    rows: Array<{ data?: SupplierImportInput }>
  ) => {
    const result = await bulkImportSuppliers(
      rows
        .map((row) => row.data)
        .filter((row): row is SupplierImportInput => Boolean(row))
    );

    await loadPageData();
    setSuccessMessage(
      `供应商批量导入完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条。`
    );

    return result;
  };

  const batchDeactivateSuppliers = async (items: SupplierListRow[]) => {
    const results = await deactivateSuppliersByIds(items.map((item) => item.id));
    await loadPageData();
    return results;
  };

  const batchDeleteSuppliers = async (items: SupplierListRow[]) => {
    const results = await deleteSuppliersByIds(items.map((item) => item.id));
    await loadPageData();
    return results;
  };

  const confirmDeleteSupplier = async () => {
    if (!supplierToDelete) {
      return;
    }

    try {
      setDeletingSupplierId(supplierToDelete.id);
      setErrorMessage("");
      setSuccessMessage("");

      const [result] = await deleteSuppliersByIds([supplierToDelete.id]);

      if (result?.success) {
        setSuccessMessage(`供应商 ${supplierToDelete.supplier_code} 已删除。`);
      } else {
        setErrorMessage(result?.message ?? "供应商删除失败，请刷新后再试。");
      }

      setSupplierToDelete(null);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setDeletingSupplierId("");
    }
  };

  const openSupplierDetail = async (
    supplier: SupplierListRow,
    clearMessage = true
  ) => {
    try {
      setSupplierDetailLoading(true);
      setErrorMessage("");

      if (clearMessage) {
        setSuccessMessage("");
      }

      setSelectedSupplier(supplier);
      const [supplierPurchaseOrders, supplierMaterials] = await Promise.all([
        getSupplierPurchaseOrders(supplier.id),
        getSupplierDefaultMaterials(supplier.id)
      ]);

      setPurchaseOrders(supplierPurchaseOrders);
      setDefaultMaterials(supplierMaterials);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setPurchaseOrders([]);
      setDefaultMaterials([]);
    } finally {
      setSupplierDetailLoading(false);
    }
  };

  const supplierColumns: DataTableColumn<SupplierListRow>[] = [
    {
      key: "select",
      title: (
        <input
          aria-label="全选当前页供应商"
          className="tableCheckbox"
          type="checkbox"
          checked={allFilteredSelected}
          onChange={toggleAllFilteredSuppliers}
        />
      ),
      className: "selectColumn",
      render: (supplier) => (
        <input
          aria-label={`选择供应商 ${supplier.supplier_code}`}
          className="tableCheckbox"
          type="checkbox"
          checked={selectedSupplierIds.includes(supplier.id)}
          onChange={() => toggleSupplierSelection(supplier.id)}
        />
      )
    },
    {
      key: "supplier",
      title: "供应商信息",
      width: "34%",
      render: (supplier) => (
        <InfoCell
          title={supplier.name}
          subtitle={`${supplier.supplier_code}${supplier.notes ? ` / ${supplier.notes}` : ""}`}
        />
      )
    },
    {
      key: "contact",
      title: "联系方式",
      render: (supplier) => (
        <InfoCell
          title={getOptionalText(supplier.contact_name)}
          subtitle={getOptionalText(supplier.phone)}
        />
      )
    },
    {
      key: "materials",
      title: "供应物料",
      align: "right",
      render: (supplier) => supplier.default_material_count
    },
    {
      key: "status",
      title: "状态",
      render: (supplier) => (
        <StatusBadge status={supplier.status} label={getSupplierStatusLabel(supplier.status)} />
      )
    },
    {
      key: "createdAt",
      title: "创建时间",
      render: (supplier) => formatDateTime(supplier.created_at)
    },
    {
      key: "actions",
      title: "操作",
      render: (supplier) => {
        const statusUpdating = statusUpdatingId === supplier.id;

        return (
          <RowActions
            onView={() => openSupplierDetail(supplier)}
            onEdit={() => startEditSupplier(supplier)}
            moreActions={[
              {
                label: statusUpdating
                  ? "正在处理"
                  : supplier.status === "active"
                    ? "停用"
                    : "启用",
                disabled: statusUpdating,
                onClick: () => changeSupplierStatus(supplier)
              },
              {
                label: "删除",
                danger: true,
                disabled: deletingSupplierId === supplier.id,
                onClick: () => setSupplierToDelete(supplier)
              }
            ]}
          />
        );
      }
    }
  ];

  return (
    <main className="pageShell modernPageShell">
      <PageHeader
        eyebrow="基础资料"
        title="供应商管理"
        actions={
          <div className="rowActions">
            <button
              type="button"
              onClick={() =>
                downloadCsvTemplate(
                  "suppliers-import-template.csv",
                  supplierImportFields
                )
              }
            >
              导出模板
            </button>
            <button type="button" onClick={() => setImportOpen(true)}>
              导入
            </button>
            <button className="primaryButton" type="button" onClick={() => setCreateOpen(true)}>
              新增供应商
            </button>
          </div>
        }
      />

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
        <div className="metric">
          <span>已关联辅料的供应商</span>
          <strong>{stats.suppliersWithDefaultMaterials}</strong>
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

      <DrawerForm
        open={createOpen}
        title="新增供应商"
        width="lg"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button className="secondaryButton" type="button" onClick={() => setCreateOpen(false)}>
              取消
            </button>
            <button className="primaryButton" form="create-supplier-form" type="submit" disabled={creating}>
              {creating ? "正在新增..." : "新增供应商"}
            </button>
          </>
        }
      >
        <form
          id="create-supplier-form"
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
        </form>
      </DrawerForm>

      {editForm ? (
        <DrawerForm
          open={Boolean(editForm)}
          title={`编辑供应商：${editForm.supplierCode}`}
          width="lg"
          onClose={() => setEditForm(null)}
          footer={
            <>
              <button className="secondaryButton" type="button" onClick={() => setEditForm(null)}>
                取消
              </button>
              <button className="primaryButton" form="edit-supplier-form" type="submit" disabled={updating}>
                {updating ? "正在保存..." : "保存编辑"}
              </button>
            </>
          }
        >
          <form id="edit-supplier-form" className="dataForm supplierForm" onSubmit={submitEditSupplier}>
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
          </form>
        </DrawerForm>
      ) : null}

      <section className="modernCard">
        <div className="modernCardHeader">
          <div>
            <p className="eyebrow">供应商列表</p>
            <h3>所有供应商</h3>
          </div>
          <div className="rowActions">
            <button type="button" onClick={refreshAll}>
              {loading ? "正在刷新..." : "刷新列表"}
            </button>
          </div>
        </div>

        <SearchFilterBar
          searchLabel="搜索供应商名称 / 联系人 / 电话"
          searchValue={searchKeyword}
          searchPlaceholder="输入名称、联系人或电话"
          onSearchChange={setSearchKeyword}
          onReset={() => {
            setSearchKeyword("");
            setStatusFilter("all");
            setPage(1);
          }}
        >
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
        </SearchFilterBar>

        <BulkActionBar
          selectedItems={selectedSuppliers}
          getItemLabel={(supplier) =>
            `${supplier.supplier_code} / ${supplier.name}`
          }
          entityName="供应商"
          onClearSelection={() => setSelectedSupplierIds([])}
          onDeactivateSelected={batchDeactivateSuppliers}
          onDeleteSelected={batchDeleteSuppliers}
        />

        <DataTable
          columns={supplierColumns}
          rows={suppliers}
          getRowKey={(supplier) => supplier.id}
          loading={loading}
          loadingText="正在读取供应商数据..."
          emptyText="暂无供应商"
          minWidth={900}
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          total={supplierTotal}
          onPageChange={(nextPage) => loadPageData(nextPage)}
        />
      </section>

      {supplierDetailLoading ? (
        <div className="debugNotice">正在读取供应商关联资料...</div>
      ) : null}

      {selectedSupplier ? (
        <DetailDrawer
          open={Boolean(selectedSupplier)}
          title={`${selectedSupplier.supplier_code} / ${selectedSupplier.name}`}
          width="lg"
          onClose={() => {
            setSelectedSupplier(null);
            setPurchaseOrders([]);
            setDefaultMaterials([]);
          }}
        >
          <div className="detailGrid">
            <div className="detailItem">
              <span>关联辅料数量</span>
              <strong>{defaultMaterials.length}</strong>
            </div>
            <div className="detailItem">
              <span>关联采购单数量</span>
              <strong>{purchaseOrders.length}</strong>
            </div>
            <div className="detailItem">
              <span>联系人</span>
              <strong>{getOptionalText(selectedSupplier.contact_name)}</strong>
            </div>
            <div className="detailItem">
              <span>联系电话</span>
              <strong>{getOptionalText(selectedSupplier.phone)}</strong>
            </div>
          </div>

          <section className="detailSection">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">默认供应辅料</p>
                <h3>该供应商关联了哪些辅料</h3>
              </div>
            </div>
            {defaultMaterials.length === 0 ? (
              <div className="emptyState">当前供应商暂无默认辅料关联</div>
            ) : (
              <div className="tableWrap">
                <table className="dataTable supplierPurchaseTable">
                  <thead>
                    <tr>
                      <th>辅料编码</th>
                      <th>辅料名称</th>
                      <th>单位</th>
                      <th>规格</th>
                      <th>状态</th>
                      <th>更新时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {defaultMaterials.map((material) => (
                      <tr key={material.id}>
                        <td>
                          <strong>{material.sku_code}</strong>
                        </td>
                        <td>{material.sku_name}</td>
                        <td>{material.unit}</td>
                        <td className="notesCell">{material.specs ?? "-"}</td>
                        <td>
                          <span
                            className={`tablePill sku-status-${material.status}`}
                          >
                            {getSupplierStatusLabel(material.status)}
                          </span>
                        </td>
                        <td>{formatDateTime(material.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="detailSection">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">采购记录</p>
                <h3>关联采购单</h3>
              </div>
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
        </DetailDrawer>
      ) : null}

      <BulkImportDialog<SupplierImportInput>
        open={importOpen}
        title="供应商批量导入"
        description="请按模板填写供应商编码、名称、联系人、电话、邮箱、地址、备注和状态。邮箱如果填写，会做简单格式校验。"
        templateFileName="suppliers-import-template.csv"
        fields={supplierImportFields}
        validateRows={validateSupplierImportRows}
        onImport={importSuppliers}
        onClose={() => setImportOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(supplierToDelete)}
        title="确认删除供应商"
        description={
          <p>
            删除前会检查是否已有采购单引用，或是否被辅料设置为默认供应商。已有引用的供应商不能物理删除，建议改为停用。
          </p>
        }
        confirmLabel="确认删除"
        danger
        loading={Boolean(deletingSupplierId)}
        items={
          supplierToDelete
            ? [`${supplierToDelete.supplier_code} / ${supplierToDelete.name}`]
            : []
        }
        onClose={() => setSupplierToDelete(null)}
        onConfirm={confirmDeleteSupplier}
      />
    </main>
  );
}
