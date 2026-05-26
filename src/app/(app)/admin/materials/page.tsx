"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMockRole } from "@/components/auth/mock-role-provider";
import { BulkActionBar } from "@/components/BulkActionBar";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import { SupplierSearchSelect } from "@/components/SupplierSearchSelect";
import {
  bulkImportMaterials,
  createMaterial,
  deactivateMaterialsByIds,
  deleteMaterialsByIds,
  getMaterialDetail,
  getMaterials,
  getMaterialSupplierOptions,
  toggleMaterialStatus,
  updateMaterial,
  validateMaterialImportRows,
  type MaterialDetail,
  type MaterialImportInput,
  type MaterialListRow,
  type MaterialSupplier,
  type MaterialStatus
} from "@/lib/api/materials";
import { downloadCsvTemplate, type CsvTemplateField } from "@/lib/utils/csv";
import { DEFAULT_PAGE_SIZE, paginateItems } from "@/lib/utils/pagination";

type MaterialFormState = {
  skuCode: string;
  skuName: string;
  category: string;
  unit: string;
  specs: string;
  defaultSupplierId: string;
  status: MaterialStatus;
  notes: string;
};

type MaterialEditFormState = {
  materialId: string;
  skuCode: string;
  skuName: string;
  category: string;
  unit: string;
  specs: string;
  defaultSupplierId: string;
  status: MaterialStatus;
  notes: string;
};

type MaterialStats = {
  totalMaterials: number;
  activeMaterials: number;
  inactiveMaterials: number;
  inStockMaterials: number;
  lowStockMaterials: number;
};

const initialMaterialForm: MaterialFormState = {
  skuCode: "",
  skuName: "",
  category: "",
  unit: "pcs",
  specs: "",
  defaultSupplierId: "",
  status: "active",
  notes: ""
};

const initialStats: MaterialStats = {
  totalMaterials: 0,
  activeMaterials: 0,
  inactiveMaterials: 0,
  inStockMaterials: 0,
  lowStockMaterials: 0
};

const materialStatusLabels: Record<string, string> = {
  active: "启用",
  inactive: "停用"
};

const transactionTypeLabels: Record<string, string> = {
  material_in: "辅料入库",
  material_out: "辅料出库",
  product_in: "成品入库",
  product_out: "成品出库",
  adjustment: "库存调整"
};

const defaultUnitOptions = ["pcs", "m", "kg", "g", "roll", "box", "set", "bag"];

const materialImportFields: CsvTemplateField[] = [
  {
    key: "辅料编码",
    label: "辅料编码",
    required: true,
    example: "MAT-001",
    aliases: ["material_code", "sku_code"]
  },
  {
    key: "辅料名称",
    label: "辅料名称",
    required: true,
    example: "黑色扎带",
    aliases: ["material_name", "sku_name", "name"]
  },
  {
    key: "分类",
    label: "分类",
    example: "包装辅料",
    aliases: ["category"]
  },
  {
    key: "单位",
    label: "单位",
    example: "pcs",
    aliases: ["unit"]
  },
  {
    key: "规格",
    label: "规格",
    example: "4x200mm",
    aliases: ["specs", "remark"]
  },
  {
    key: "默认供应商编码",
    label: "默认供应商编码",
    example: "SUP-001",
    aliases: ["supplier_code"]
  },
  {
    key: "默认供应商名称",
    label: "默认供应商名称",
    example: "深圳某某包装有限公司",
    aliases: ["supplier_name"]
  },
  {
    key: "状态",
    label: "状态",
    example: "active",
    aliases: ["status"]
  },
  {
    key: "备注",
    label: "备注",
    example: "常用包装耗材",
    aliases: ["notes"]
  }
];

const materialImportSampleRows = [
  {
    辅料编码: "MAT-001",
    辅料名称: "黑色扎带",
    分类: "包装辅料",
    单位: "pcs",
    规格: "4x200mm",
    默认供应商编码: "SUP-001",
    默认供应商名称: "",
    状态: "active",
    备注: "常用包装耗材"
  },
  {
    辅料编码: "MAT-002",
    辅料名称: "牛皮纸箱",
    分类: "纸箱",
    单位: "box",
    规格: "30x20x15cm",
    默认供应商编码: "",
    默认供应商名称: "深圳某某包装有限公司",
    状态: "active",
    备注: ""
  }
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "操作失败，请稍后重试。";
}

function getMaterialStatusLabel(status: string) {
  return materialStatusLabels[status] ?? status;
}

function getTransactionTypeLabel(transactionType: string) {
  return transactionTypeLabels[transactionType] ?? transactionType;
}

function toEditableStatus(status: string): MaterialStatus {
  return status === "inactive" ? "inactive" : "active";
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

function formatQuantity(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return Number(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 4
  });
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return Number(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 4
  });
}

function getMaterialCategory(material: Pick<MaterialListRow, "category">) {
  return material.category?.trim() || "-";
}

function getMaterialSupplierLabel(material: Pick<MaterialListRow, "default_supplier">) {
  if (!material.default_supplier) {
    return "未设置";
  }

  const statusText =
    material.default_supplier.status === "inactive" ? " / 停用" : "";

  return `${material.default_supplier.supplier_code} / ${material.default_supplier.name}${statusText}`;
}

function isLowStock(material: MaterialListRow) {
  return (
    material.safety_stock_quantity > 0 &&
    material.inventory_quantity < material.safety_stock_quantity
  );
}

function getTransactionsHref(material: MaterialListRow) {
  return `/inventory/transactions?skuKeyword=${encodeURIComponent(
    material.sku_code
  )}`;
}

export default function AdminMaterialsPage() {
  const { user } = useMockRole();
  const canManageMaterials = user.role === "admin" || user.role === "procurement";
  const [materials, setMaterials] = useState<MaterialListRow[]>([]);
  const [suppliers, setSuppliers] = useState<MaterialSupplier[]>([]);
  const [materialForm, setMaterialForm] =
    useState<MaterialFormState>(initialMaterialForm);
  const [editForm, setEditForm] = useState<MaterialEditFormState | null>(null);
  const [selectedDetailMaterial, setSelectedDetailMaterial] =
    useState<MaterialListRow | null>(null);
  const [materialDetail, setMaterialDetail] = useState<MaterialDetail | null>(
    null
  );
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [materialToDelete, setMaterialToDelete] =
    useState<MaterialListRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [deletingMaterialId, setDeletingMaterialId] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const stats = useMemo<MaterialStats>(() => {
    if (materials.length === 0) {
      return initialStats;
    }

    return {
      totalMaterials: materials.length,
      activeMaterials: materials.filter(
        (material) => material.status === "active"
      ).length,
      inactiveMaterials: materials.filter(
        (material) => material.status === "inactive"
      ).length,
      inStockMaterials: materials.filter(
        (material) => material.inventory_quantity > 0
      ).length,
      lowStockMaterials: materials.filter(isLowStock).length
    };
  }, [materials]);

  const unitOptions = useMemo(() => {
    const actualUnits = materials
      .map((material) => material.unit)
      .filter((unit): unit is string => Boolean(unit));

    return Array.from(new Set([...actualUnits, ...defaultUnitOptions])).sort(
      (first, second) => first.localeCompare(second)
    );
  }, [materials]);

  const supplierOptions = useMemo(() => {
    const supplierById = new Map<string, MaterialSupplier>();

    suppliers.forEach((supplier) => supplierById.set(supplier.id, supplier));
    materials.forEach((material) => {
      if (material.default_supplier) {
        supplierById.set(material.default_supplier.id, material.default_supplier);
      }
    });

    return [...supplierById.values()].sort((first, second) =>
      first.supplier_code.localeCompare(second.supplier_code, "zh-CN")
    );
  }, [materials, suppliers]);

  const filteredMaterials = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return materials.filter((material) => {
      const matchesKeyword =
        !keyword ||
        material.sku_code.toLowerCase().includes(keyword) ||
        material.sku_name.toLowerCase().includes(keyword) ||
        (material.category ?? "").toLowerCase().includes(keyword) ||
        (material.specs ?? "").toLowerCase().includes(keyword) ||
        (material.notes ?? "").toLowerCase().includes(keyword);
      const matchesStatus =
        statusFilter === "all" || material.status === statusFilter;
      const matchesUnit = unitFilter === "all" || material.unit === unitFilter;
      const matchesSupplier =
        supplierFilter === "all" ||
        (supplierFilter === "none"
          ? !material.default_supplier_id
          : material.default_supplier_id === supplierFilter);

      return matchesKeyword && matchesStatus && matchesUnit && matchesSupplier;
    });
  }, [materials, searchKeyword, statusFilter, supplierFilter, unitFilter]);

  const selectedMaterialRows = useMemo(
    () =>
      materials.filter((material) => selectedMaterialIds.includes(material.id)),
    [materials, selectedMaterialIds]
  );
  const paginatedMaterials = useMemo(
    () => paginateItems(filteredMaterials, page),
    [filteredMaterials, page]
  );
  const allFilteredSelected =
    filteredMaterials.length > 0 &&
    filteredMaterials.every((material) =>
      selectedMaterialIds.includes(material.id)
    );

  const loadPageData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [materialData, supplierData] = await Promise.all([
        getMaterials(),
        getMaterialSupplierOptions()
      ]);

      setMaterials(materialData);
      setSuppliers(supplierData);
      setSelectedMaterialIds((current) =>
        current.filter((materialId) =>
          materialData.some((material) => material.id === materialId)
        )
      );
      setSelectedDetailMaterial((current) => {
        if (!current) {
          return null;
        }

        return materialData.find((material) => material.id === current.id) ?? null;
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setMaterials([]);
      setSuppliers([]);
      setSelectedMaterialIds([]);
      setSelectedDetailMaterial(null);
      setMaterialDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchKeyword, statusFilter, supplierFilter, unitFilter]);

  const refreshAll = async () => {
    const detailMaterial = selectedDetailMaterial;

    await loadPageData();

    if (detailMaterial) {
      await openMaterialDetail(detailMaterial, false);
    }
  };

  const submitCreateMaterial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManageMaterials) {
      setErrorMessage("当前角色只能查看辅料资料，不能新增。");
      return;
    }

    try {
      setCreating(true);
      setErrorMessage("");
      setSuccessMessage("");

      const created = await createMaterial(materialForm);

      setSuccessMessage(`辅料 ${created.sku_code} 新增成功。`);
      setMaterialForm(initialMaterialForm);
      setCreateOpen(false);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const startEditMaterial = (material: MaterialListRow) => {
    if (!canManageMaterials) {
      setErrorMessage("当前角色只能查看辅料资料，不能编辑。");
      return;
    }

    setEditForm({
      materialId: material.id,
      skuCode: material.sku_code,
      skuName: material.sku_name,
      category: material.category ?? "",
      unit: material.unit,
      specs: material.specs ?? "",
      defaultSupplierId: material.default_supplier_id ?? "",
      status: toEditableStatus(material.status),
      notes: material.notes ?? ""
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const submitEditMaterial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editForm) {
      return;
    }

    if (!canManageMaterials) {
      setErrorMessage("当前角色只能查看辅料资料，不能编辑。");
      return;
    }

    try {
      setUpdating(true);
      setErrorMessage("");
      setSuccessMessage("");

      await updateMaterial(editForm);
      setSuccessMessage(`辅料 ${editForm.skuCode} 编辑成功。`);
      setEditForm(null);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setUpdating(false);
    }
  };

  const changeMaterialStatus = async (material: MaterialListRow) => {
    if (!canManageMaterials) {
      setErrorMessage("当前角色只能查看辅料资料，不能启用或停用。");
      return;
    }

    try {
      setStatusUpdatingId(material.id);
      setErrorMessage("");
      setSuccessMessage("");

      const nextStatus = await toggleMaterialStatus(material.id, material.status);
      setSuccessMessage(
        `辅料 ${material.sku_code} 已${getMaterialStatusLabel(nextStatus)}。`
      );
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setStatusUpdatingId("");
    }
  };

  const toggleMaterialSelection = (materialId: string) => {
    setSelectedMaterialIds((current) =>
      current.includes(materialId)
        ? current.filter((id) => id !== materialId)
        : [...current, materialId]
    );
  };

  const toggleAllFilteredMaterials = () => {
    if (allFilteredSelected) {
      setSelectedMaterialIds((current) =>
        current.filter(
          (materialId) =>
            !filteredMaterials.some((material) => material.id === materialId)
        )
      );
      return;
    }

    setSelectedMaterialIds((current) =>
      Array.from(
        new Set([...current, ...filteredMaterials.map((material) => material.id)])
      )
    );
  };

  const importMaterials = async (
    rows: Array<{ data?: MaterialImportInput }>
  ) => {
    const result = await bulkImportMaterials(
      rows
        .map((row) => row.data)
        .filter((row): row is MaterialImportInput => Boolean(row))
    );

    await loadPageData();
    setSuccessMessage(
      `辅料批量导入完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条。`
    );

    return result;
  };

  const batchDeactivateMaterials = async (items: MaterialListRow[]) => {
    const results = await deactivateMaterialsByIds(items.map((item) => item.id));
    await loadPageData();
    return results;
  };

  const batchDeleteMaterials = async (items: MaterialListRow[]) => {
    const results = await deleteMaterialsByIds(items.map((item) => item.id));
    await loadPageData();
    return results;
  };

  const confirmDeleteMaterial = async () => {
    if (!materialToDelete) {
      return;
    }

    if (!canManageMaterials) {
      setErrorMessage("当前角色只能查看辅料资料，不能删除。");
      return;
    }

    try {
      setDeletingMaterialId(materialToDelete.id);
      setErrorMessage("");
      setSuccessMessage("");

      const [result] = await deleteMaterialsByIds([materialToDelete.id]);

      if (result?.success) {
        setSuccessMessage(`辅料 ${materialToDelete.sku_code} 已删除。`);
      } else {
        setErrorMessage(result?.message ?? "辅料删除失败，请刷新后再试。");
      }

      setMaterialToDelete(null);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setDeletingMaterialId("");
    }
  };

  const openMaterialDetail = async (
    material: MaterialListRow,
    clearMessage = true
  ) => {
    try {
      setDetailLoading(true);
      setErrorMessage("");

      if (clearMessage) {
        setSuccessMessage("");
      }

      setSelectedDetailMaterial(material);
      setMaterialDetail(null);
      setMaterialDetail(await getMaterialDetail(material.id));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setMaterialDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">基础资料</p>
          <h2>辅料管理</h2>
          <p>
            专门维护辅料基础资料。阶段一开始读取独立 materials 表，
            旧 skus 里的原辅料数据仍保留不动。
          </p>
        </div>
        <span className="statusPill">Supabase 数据</span>
      </section>

      <section className="transactionSummaryGrid">
        <div className="metric">
          <span>辅料总数</span>
          <strong>{stats.totalMaterials}</strong>
        </div>
        <div className="metric">
          <span>启用辅料</span>
          <strong>{stats.activeMaterials}</strong>
        </div>
        <div className="metric">
          <span>停用辅料</span>
          <strong>{stats.inactiveMaterials}</strong>
        </div>
        <div className="metric">
          <span>有库存辅料</span>
          <strong>{stats.inStockMaterials}</strong>
        </div>
        <div className="metric">
          <span>低库存辅料</span>
          <strong>{stats.lowStockMaterials}</strong>
        </div>
      </section>

      {!canManageMaterials ? (
        <div className="debugNotice">
          当前是仓库查看权限：可以查看辅料资料、库存和引用情况；新增、编辑、导入、删除由管理员或采购处理。
        </div>
      ) : null}

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

      <datalist id="material-unit-options">
        {unitOptions.map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>

      <Modal
        open={createOpen}
        eyebrow="新增辅料"
        title="创建辅料基础资料"
        maxWidth="lg"
        onClose={() => setCreateOpen(false)}
      >
        <form className="dataForm skuForm" onSubmit={submitCreateMaterial}>
          <label>
            辅料编码
            <input
              value={materialForm.skuCode}
              onChange={(event) =>
                setMaterialForm((current) => ({
                  ...current,
                  skuCode: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 MAT-001"
              required
            />
          </label>

          <label>
            辅料名称
            <input
              value={materialForm.skuName}
              onChange={(event) =>
                setMaterialForm((current) => ({
                  ...current,
                  skuName: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 黑色扎带"
              required
            />
          </label>

          <label>
            分类
            <input
              value={materialForm.category}
              onChange={(event) =>
                setMaterialForm((current) => ({
                  ...current,
                  category: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 包装辅料"
            />
          </label>

          <label>
            单位
            <input
              list="material-unit-options"
              value={materialForm.unit}
              onChange={(event) =>
                setMaterialForm((current) => ({
                  ...current,
                  unit: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 pcs"
              required
            />
          </label>

          <SupplierSearchSelect
            label="默认供应商"
            suppliers={supplierOptions}
            value={materialForm.defaultSupplierId}
            disabled={creating}
            onChange={(supplierId) =>
              setMaterialForm((current) => ({
                ...current,
                defaultSupplierId: supplierId
              }))
            }
          />

          <label>
            状态
            <select
              value={materialForm.status}
              onChange={(event) =>
                setMaterialForm((current) => ({
                  ...current,
                  status: event.target.value as MaterialStatus
                }))
              }
              disabled={creating}
            >
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </label>

          <label className="fullField">
            规格
            <textarea
              value={materialForm.specs}
              onChange={(event) =>
                setMaterialForm((current) => ({
                  ...current,
                  specs: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 4x200mm、30x20x15cm"
            />
          </label>

          <label className="fullField">
            备注
            <textarea
              value={materialForm.notes}
              onChange={(event) =>
                setMaterialForm((current) => ({
                  ...current,
                  notes: event.target.value
                }))
              }
              disabled={creating}
              placeholder="可填写采购、替代料或使用注意事项"
            />
          </label>

          <div className="formActions">
            <button className="primaryButton" type="submit" disabled={creating}>
              {creating ? "正在新增..." : "新增辅料"}
            </button>
          </div>
        </form>
      </Modal>

      {editForm ? (
        <Modal
          open={Boolean(editForm)}
          eyebrow="编辑辅料"
          title={editForm.skuCode}
          maxWidth="lg"
          onClose={() => setEditForm(null)}
        >
          <form className="dataForm skuForm" onSubmit={submitEditMaterial}>
            <label>
              辅料编码
              <input value={editForm.skuCode} disabled />
              <span className="fieldHint">
                编码已锁定，避免后续对接 BOM、采购、库存时产生历史混乱。
              </span>
            </label>

            <label>
              辅料名称
              <input
                value={editForm.skuName}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          skuName: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating}
                required
              />
            </label>

            <label>
              分类
              <input
                value={editForm.category}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          category: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating}
                placeholder="例如 包装辅料"
              />
            </label>

            <label>
              单位
              <input
                list="material-unit-options"
                value={editForm.unit}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          unit: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating}
                required
              />
            </label>

            <SupplierSearchSelect
              label="默认供应商"
              suppliers={supplierOptions}
              value={editForm.defaultSupplierId}
              disabled={updating}
              onChange={(supplierId) =>
                setEditForm((current) =>
                  current
                    ? {
                        ...current,
                        defaultSupplierId: supplierId
                      }
                    : current
                )
              }
            />

            <label>
              状态
              <select
                value={editForm.status}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          status: event.target.value as MaterialStatus
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
              规格
              <textarea
                value={editForm.specs}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          specs: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating}
                placeholder="例如 4x200mm、30x20x15cm"
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
                placeholder="可填写采购、替代料或使用注意事项"
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
        </Modal>
      ) : null}

      <section className="listPanel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">辅料列表</p>
            <h3>辅料基础资料</h3>
          </div>
          <div className="rowActions">
            {canManageMaterials ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    downloadCsvTemplate(
                      "materials-import-template.csv",
                      materialImportFields,
                      materialImportSampleRows
                    )
                  }
                >
                  下载模板
                </button>
                <button type="button" onClick={() => setImportOpen(true)}>
                  批量导入
                </button>
              </>
            ) : null}
            <button type="button" onClick={refreshAll}>
              {loading ? "正在刷新..." : "刷新列表"}
            </button>
            {canManageMaterials ? (
              <button
                className="primaryButton"
                type="button"
                onClick={() => setCreateOpen(true)}
              >
                新增辅料
              </button>
            ) : null}
          </div>
        </div>

        <div className="listToolbar skuToolbar">
          <label>
            搜索辅料编码 / 名称 / 分类 / 规格 / 备注
            <input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="输入辅料编码、名称、分类、规格或备注"
            />
          </label>

          <label>
            状态
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">全部状态</option>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </label>

          <label>
            单位
            <select
              value={unitFilter}
              onChange={(event) => setUnitFilter(event.target.value)}
            >
              <option value="all">全部单位</option>
              {unitOptions.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>

          <label>
            默认供应商
            <select
              value={supplierFilter}
              onChange={(event) => setSupplierFilter(event.target.value)}
            >
              <option value="all">全部供应商</option>
              <option value="none">未设置供应商</option>
              {supplierOptions.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplier_code} / {supplier.name}
                  {supplier.status === "inactive" ? " / 停用" : ""}
                </option>
              ))}
            </select>
          </label>

          <button className="secondaryButton" type="button" onClick={refreshAll}>
            刷新
          </button>
        </div>

        {canManageMaterials ? (
          <BulkActionBar
            selectedItems={selectedMaterialRows}
            getItemLabel={(material) =>
              `${material.sku_code} / ${material.sku_name}`
            }
            entityName="辅料"
            onClearSelection={() => setSelectedMaterialIds([])}
            onDeactivateSelected={batchDeactivateMaterials}
            onDeleteSelected={batchDeleteMaterials}
          />
        ) : null}

        {loading ? <div className="debugNotice">正在读取辅料数据...</div> : null}

        {!loading && filteredMaterials.length === 0 ? (
          <div className="emptyState">暂无辅料</div>
        ) : null}

        {!loading && filteredMaterials.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable skuTable">
              <thead>
                <tr>
                  {canManageMaterials ? (
                    <th className="selectColumn">
                      <input
                        aria-label="全选当前辅料"
                        className="tableCheckbox"
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleAllFilteredMaterials}
                      />
                    </th>
                  ) : null}
                  <th>辅料编码</th>
                  <th>辅料名称</th>
                  <th>分类</th>
                  <th>单位</th>
                  <th>规格</th>
                  <th>默认供应商</th>
                  <th>供应商联系人</th>
                  <th>供应商电话</th>
                  <th>状态</th>
                  <th>当前库存</th>
                  <th>安全库存</th>
                  <th>BOM 引用</th>
                  <th>需求引用</th>
                  <th>采购引用</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMaterials.map((material) => {
                  const statusUpdating = statusUpdatingId === material.id;

                  return (
                    <tr key={material.id}>
                      {canManageMaterials ? (
                        <td>
                          <input
                            aria-label={`选择辅料 ${material.sku_code}`}
                            className="tableCheckbox"
                            type="checkbox"
                            checked={selectedMaterialIds.includes(material.id)}
                            onChange={() => toggleMaterialSelection(material.id)}
                          />
                        </td>
                      ) : null}
                      <td>
                        <strong>{material.sku_code}</strong>
                      </td>
                      <td>{material.sku_name}</td>
                      <td>{getMaterialCategory(material)}</td>
                      <td>{material.unit}</td>
                      <td className="notesCell">{material.specs ?? "-"}</td>
                      <td>{getMaterialSupplierLabel(material)}</td>
                      <td>{material.default_supplier?.contact_name ?? "-"}</td>
                      <td>{material.default_supplier?.phone ?? "-"}</td>
                      <td>
                        <span
                          className={`tablePill sku-status-${material.status}`}
                        >
                          {getMaterialStatusLabel(material.status)}
                        </span>
                      </td>
                      <td className="quantityCell">
                        {formatQuantity(material.inventory_quantity)}
                        <span>
                          {material.inventory_row_count > 0
                            ? `占用 ${formatQuantity(material.reserved_quantity)}`
                            : "暂无库存记录"}
                        </span>
                      </td>
                      <td className="quantityCell">
                        {formatQuantity(material.safety_stock_quantity)}
                        {isLowStock(material) ? <span>低于安全库存</span> : null}
                      </td>
                      <td>{material.bom_usage_count}</td>
                      <td>{material.material_requirement_usage_count}</td>
                      <td>{material.purchase_usage_count}</td>
                      <td>
                        <div className="rowActions skuRowActions">
                          <button
                            type="button"
                            onClick={() => openMaterialDetail(material)}
                            disabled={detailLoading}
                          >
                            查看
                          </button>
                          {canManageMaterials ? (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditMaterial(material)}
                                disabled={updating}
                              >
                                编辑
                              </button>
                              <button
                                type="button"
                                onClick={() => changeMaterialStatus(material)}
                                disabled={statusUpdating}
                              >
                                {statusUpdating
                                  ? "正在处理..."
                                  : material.status === "active"
                                    ? "停用"
                                    : "启用"}
                              </button>
                              <button
                                className="dangerButton"
                                type="button"
                                onClick={() => setMaterialToDelete(material)}
                                disabled={deletingMaterialId === material.id}
                              >
                                删除
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && filteredMaterials.length > 0 ? (
          <Pagination
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            total={filteredMaterials.length}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      {detailLoading ? (
        <div className="debugNotice">正在读取辅料详情...</div>
      ) : null}

      {selectedDetailMaterial ? (
        <Modal
          open={Boolean(selectedDetailMaterial)}
          eyebrow="辅料详情"
          title={`${selectedDetailMaterial.sku_code} / ${selectedDetailMaterial.sku_name}`}
          maxWidth="xl"
          onClose={() => {
            setSelectedDetailMaterial(null);
            setMaterialDetail(null);
          }}
        >
          {!materialDetail && detailLoading ? (
            <div className="debugNotice">正在加载详情...</div>
          ) : null}

          {materialDetail ? (
            <>
              <div className="detailGrid">
                <div className="detailItem">
                  <span>辅料编码</span>
                  <strong>{materialDetail.material.sku_code}</strong>
                </div>
                <div className="detailItem">
                  <span>辅料名称</span>
                  <strong>{materialDetail.material.sku_name}</strong>
                </div>
                <div className="detailItem">
                  <span>分类</span>
                  <strong>{materialDetail.material.category ?? "-"}</strong>
                </div>
                <div className="detailItem">
                  <span>单位</span>
                  <strong>{materialDetail.material.unit}</strong>
                </div>
                <div className="detailItem">
                  <span>状态</span>
                  <strong>
                    {getMaterialStatusLabel(materialDetail.material.status)}
                  </strong>
                </div>
                <div className="detailItem">
                  <span>默认供应商</span>
                  <strong>{getMaterialSupplierLabel(materialDetail.material)}</strong>
                </div>
                <div className="detailItem">
                  <span>供应商联系人</span>
                  <strong>
                    {materialDetail.material.default_supplier?.contact_name ?? "-"}
                  </strong>
                </div>
                <div className="detailItem">
                  <span>供应商电话</span>
                  <strong>{materialDetail.material.default_supplier?.phone ?? "-"}</strong>
                </div>
                <div className="detailItem">
                  <span>当前库存汇总</span>
                  <strong>
                    {formatQuantity(materialDetail.material.inventory_quantity)}
                  </strong>
                </div>
                <div className="detailItem">
                  <span>安全库存汇总</span>
                  <strong>
                    {formatQuantity(
                      materialDetail.material.safety_stock_quantity
                    )}
                  </strong>
                </div>
                <div className="detailItem">
                  <span>BOM 引用次数</span>
                  <strong>{materialDetail.material.bom_usage_count}</strong>
                </div>
                <div className="detailItem">
                  <span>物料需求引用次数</span>
                  <strong>
                    {materialDetail.material.material_requirement_usage_count}
                  </strong>
                </div>
                <div className="detailItem">
                  <span>采购引用次数</span>
                  <strong>{materialDetail.material.purchase_usage_count}</strong>
                </div>
                <div className="detailItem fullDetailItem">
                  <span>规格</span>
                  <strong>{materialDetail.material.specs ?? "-"}</strong>
                </div>
                <div className="detailItem fullDetailItem">
                  <span>备注</span>
                  <strong>{materialDetail.material.notes ?? "-"}</strong>
                </div>
              </div>

              <section className="detailSection">
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">当前库存</p>
                    <h3>按仓库汇总</h3>
                  </div>
                  <Link
                    className="secondaryButton"
                    href={getTransactionsHref(materialDetail.material)}
                  >
                    查看库存流水
                  </Link>
                </div>
                {materialDetail.inventoryItems.length === 0 ? (
                  <div className="emptyState">暂无库存记录</div>
                ) : (
                  <div className="tableWrap">
                    <table className="dataTable compactDataTable">
                      <thead>
                        <tr>
                          <th>仓库</th>
                          <th>当前库存</th>
                          <th>占用库存</th>
                          <th>安全库存</th>
                          <th>单位</th>
                          <th>最后更新时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialDetail.inventoryItems.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <strong>{item.warehouse?.name ?? "-"}</strong>
                              <span>{item.warehouse?.warehouse_code ?? "-"}</span>
                            </td>
                            <td>{formatQuantity(item.quantity_on_hand)}</td>
                            <td>{formatQuantity(item.reserved_quantity)}</td>
                            <td>{formatQuantity(item.safety_stock_quantity)}</td>
                            <td>{item.unit}</td>
                            <td>{formatDateTime(item.updated_at)}</td>
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
                    <p className="eyebrow">BOM 引用</p>
                    <h3>被哪些 BOM 使用</h3>
                  </div>
                </div>
                {materialDetail.bomUsages.length === 0 ? (
                  <div className="emptyState">当前辅料暂无 BOM 引用</div>
                ) : (
                  <div className="tableWrap">
                    <table className="dataTable compactDataTable">
                      <thead>
                        <tr>
                          <th>BOM 编码</th>
                          <th>版本</th>
                          <th>成品 SKU</th>
                          <th>单位用量</th>
                          <th>单位</th>
                          <th>BOM 状态</th>
                          <th>备注</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialDetail.bomUsages.map((item) => (
                          <tr key={item.id}>
                            <td>{item.bom_header?.bom_code ?? "-"}</td>
                            <td>{item.bom_header?.version ?? "-"}</td>
                            <td>
                              {item.bom_header?.product_sku
                                ? `${item.bom_header.product_sku.sku_code} / ${item.bom_header.product_sku.sku_name}`
                                : "-"}
                            </td>
                            <td>{formatQuantity(item.quantity_per)}</td>
                            <td>{item.unit}</td>
                            <td>
                              <span
                                className={`tablePill bom-status-${item.bom_header?.status ?? "unknown"}`}
                              >
                                {getMaterialStatusLabel(
                                  item.bom_header?.status ?? "-"
                                )}
                              </span>
                            </td>
                            <td className="notesCell">{item.notes ?? "-"}</td>
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
                    <h3>最近采购</h3>
                  </div>
                </div>
                {materialDetail.purchaseRecords.length === 0 ? (
                  <div className="emptyState">当前辅料暂无采购记录</div>
                ) : (
                  <div className="tableWrap">
                    <table className="dataTable compactDataTable">
                      <thead>
                        <tr>
                          <th>采购单号</th>
                          <th>供应商</th>
                          <th>采购数量</th>
                          <th>已到货</th>
                          <th>单位</th>
                          <th>单价</th>
                          <th>采购状态</th>
                          <th>预计到货</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialDetail.purchaseRecords.map((record) => (
                          <tr key={record.id}>
                            <td>
                              {record.purchase_order?.purchase_order_no ?? "-"}
                            </td>
                            <td>
                              {record.purchase_order?.supplier
                                ? `${record.purchase_order.supplier.supplier_code} / ${record.purchase_order.supplier.name}`
                                : "-"}
                            </td>
                            <td>{formatQuantity(record.ordered_quantity)}</td>
                            <td>{formatQuantity(record.received_quantity)}</td>
                            <td>{record.unit}</td>
                            <td>{formatMoney(record.unit_price)}</td>
                            <td>{record.purchase_order?.status ?? "-"}</td>
                            <td>
                              {formatDate(
                                record.purchase_order?.expected_arrival_date
                              )}
                            </td>
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
                    <p className="eyebrow">库存流水</p>
                    <h3>最近变动</h3>
                  </div>
                </div>
                {materialDetail.inventoryTransactions.length === 0 ? (
                  <div className="emptyState">当前辅料暂无库存流水</div>
                ) : (
                  <div className="tableWrap">
                    <table className="dataTable compactDataTable">
                      <thead>
                        <tr>
                          <th>流水号</th>
                          <th>类型</th>
                          <th>仓库</th>
                          <th>数量</th>
                          <th>发生时间</th>
                          <th>备注</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialDetail.inventoryTransactions.map(
                          (transaction) => (
                            <tr key={transaction.id}>
                              <td>{transaction.transaction_no}</td>
                              <td>
                                {getTransactionTypeLabel(
                                  transaction.transaction_type
                                )}
                              </td>
                              <td>
                                {transaction.warehouse
                                  ? `${transaction.warehouse.warehouse_code} / ${transaction.warehouse.name}`
                                  : "-"}
                              </td>
                              <td>{formatQuantity(transaction.quantity)}</td>
                              <td>{formatDateTime(transaction.occurred_at)}</td>
                              <td className="notesCell">
                                {transaction.notes ?? "-"}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          ) : null}
        </Modal>
      ) : null}

      <BulkImportDialog<MaterialImportInput>
        open={importOpen}
        title="辅料批量导入"
        description="辅料会写入新的 materials 表；默认供应商按供应商编码优先匹配，匹配不到会在预览里报错，不会自动创建供应商。"
        templateFileName="materials-import-template.csv"
        fields={materialImportFields}
        sampleRows={materialImportSampleRows}
        validateRows={validateMaterialImportRows}
        onImport={importMaterials}
        onClose={() => setImportOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(materialToDelete)}
        title="确认删除辅料"
        description={
          <p>
            阶段一暂不做辅料物理删除。请先使用停用，等 BOM、采购和库存引用迁移完成后再统一处理删除规则。
          </p>
        }
        confirmLabel="确认删除"
        danger
        loading={Boolean(deletingMaterialId)}
        items={
          materialToDelete
            ? [`${materialToDelete.sku_code} / ${materialToDelete.sku_name}`]
            : []
        }
        onClose={() => setMaterialToDelete(null)}
        onConfirm={confirmDeleteMaterial}
      />
    </main>
  );
}
