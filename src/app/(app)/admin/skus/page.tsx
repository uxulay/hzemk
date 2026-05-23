"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BulkActionBar } from "@/components/BulkActionBar";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  bulkImportSkus,
  deactivateSkusByIds,
  deleteSkusByIds,
  validateSkuImportRows,
  type SkuImportInput
} from "@/lib/api/bulk-management";
import {
  createSku,
  getProductsForSkuForm,
  getSkuBomUsage,
  getSkus,
  toggleSkuStatus,
  updateSku,
  type SkuBomUsage,
  type SkuEditableType,
  type SkuListRow,
  type SkuProductOption,
  type SkuStatus
} from "@/lib/api/skus";
import { downloadCsvTemplate, type CsvTemplateField } from "@/lib/utils/csv";

const skuTypeLabels: Record<string, string> = {
  finished_good: "成品",
  material: "原材料"
};

const skuStatusLabels: Record<string, string> = {
  active: "启用",
  inactive: "停用"
};

type SkuFormState = {
  skuCode: string;
  skuName: string;
  skuType: SkuEditableType;
  productId: string;
  unit: string;
  specs: string;
  status: SkuStatus;
};

type SkuEditFormState = {
  skuId: string;
  skuCode: string;
  skuName: string;
  skuType: string;
  productId: string;
  unit: string;
  specs: string;
  status: SkuStatus;
};

type SkuStats = {
  totalSkus: number;
  finishedGoodSkus: number;
  materialSkus: number;
  inStockSkus: number;
  outOfStockSkus: number;
};

const initialSkuForm: SkuFormState = {
  skuCode: "",
  skuName: "",
  skuType: "finished_good",
  productId: "",
  unit: "pcs",
  specs: "",
  status: "active"
};

const initialStats: SkuStats = {
  totalSkus: 0,
  finishedGoodSkus: 0,
  materialSkus: 0,
  inStockSkus: 0,
  outOfStockSkus: 0
};

const skuImportFields: CsvTemplateField[] = [
  {
    key: "sku_code",
    label: "SKU 编码",
    required: true,
    example: "SKU-001"
  },
  {
    key: "sku_name",
    label: "SKU 名称",
    required: true,
    example: "折叠收纳箱 黑色"
  },
  {
    key: "sku_type",
    label: "SKU 类型",
    required: true,
    example: "finished_good"
  },
  {
    key: "product_code",
    label: "所属产品编码",
    example: "PROD-001"
  },
  {
    key: "unit",
    label: "单位",
    example: "pcs"
  },
  {
    key: "remark",
    label: "备注",
    example: "规格说明"
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

function getSkuTypeLabel(skuType: string) {
  return skuTypeLabels[skuType] ?? skuType;
}

function getSkuStatusLabel(status: string) {
  return skuStatusLabels[status] ?? status;
}

function toEditableStatus(status: string): SkuStatus {
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

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${Number(value * 100).toLocaleString("zh-CN", {
    maximumFractionDigits: 2
  })}%`;
}

function getProductLabel(product: SkuProductOption | null | undefined) {
  if (!product) {
    return "未绑定产品";
  }

  return `${product.product_code} / ${product.name}`;
}

function getProductOptionLabel(product: SkuProductOption) {
  const statusText =
    product.status === "inactive" ? " / 停用" : "";

  return `${product.product_code} / ${product.name}${statusText}`;
}

function getInventoryHref(skuType: string) {
  return skuType === "material" ? "/inventory/materials" : "/inventory/products";
}

function getBomUsageTitle(sku: SkuListRow) {
  if (sku.sku_type === "finished_good") {
    return "作为成品使用的 BOM";
  }

  if (sku.sku_type === "material") {
    return "作为原材料使用的 BOM";
  }

  return "BOM 关联";
}

export default function AdminSkusPage() {
  const router = useRouter();
  const [skus, setSkus] = useState<SkuListRow[]>([]);
  const [products, setProducts] = useState<SkuProductOption[]>([]);
  const [skuForm, setSkuForm] = useState<SkuFormState>(initialSkuForm);
  const [editForm, setEditForm] = useState<SkuEditFormState | null>(null);
  const [selectedBomSku, setSelectedBomSku] = useState<SkuListRow | null>(null);
  const [bomUsage, setBomUsage] = useState<SkuBomUsage | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [skuTypeFilter, setSkuTypeFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSkuIds, setSelectedSkuIds] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [skuToDelete, setSkuToDelete] = useState<SkuListRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [deletingSkuId, setDeletingSkuId] = useState("");
  const [bomUsageLoading, setBomUsageLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const stats = useMemo<SkuStats>(() => {
    if (skus.length === 0) {
      return initialStats;
    }

    const inStockSkus = skus.filter((sku) => sku.inventory_quantity > 0).length;

    return {
      totalSkus: skus.length,
      finishedGoodSkus: skus.filter(
        (sku) => sku.sku_type === "finished_good"
      ).length,
      materialSkus: skus.filter((sku) => sku.sku_type === "material").length,
      inStockSkus,
      outOfStockSkus: skus.length - inStockSkus
    };
  }, [skus]);

  const filteredSkus = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return skus.filter((sku) => {
      const matchesKeyword =
        !keyword ||
        sku.sku_code.toLowerCase().includes(keyword) ||
        sku.sku_name.toLowerCase().includes(keyword);
      const matchesSkuType =
        skuTypeFilter === "all" || sku.sku_type === skuTypeFilter;
      const matchesProduct =
        productFilter === "all" ||
        (productFilter === "none"
          ? !sku.product_id
          : sku.product_id === productFilter);
      const matchesStatus =
        statusFilter === "all" || sku.status === statusFilter;

      return (
        matchesKeyword && matchesSkuType && matchesProduct && matchesStatus
      );
    });
  }, [skus, searchKeyword, skuTypeFilter, productFilter, statusFilter]);

  const selectedSkuRows = useMemo(
    () => skus.filter((sku) => selectedSkuIds.includes(sku.id)),
    [skus, selectedSkuIds]
  );
  const allFilteredSelected =
    filteredSkus.length > 0 &&
    filteredSkus.every((sku) => selectedSkuIds.includes(sku.id));

  const loadPageData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [skuData, productData] = await Promise.all([
        getSkus(),
        getProductsForSkuForm()
      ]);

      setSkus(skuData);
      setProducts(productData);
      setSelectedSkuIds((current) =>
        current.filter((skuId) => skuData.some((sku) => sku.id === skuId))
      );
      setSelectedBomSku((current) => {
        if (!current) {
          return null;
        }

        return skuData.find((sku) => sku.id === current.id) ?? null;
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setSkus([]);
      setProducts([]);
      setSelectedSkuIds([]);
      setSelectedBomSku(null);
      setBomUsage(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  const refreshAll = async () => {
    const skuToRefresh = selectedBomSku;

    await loadPageData();

    if (skuToRefresh) {
      await openBomUsage(skuToRefresh, false);
    }
  };

  const submitCreateSku = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setCreating(true);
      setErrorMessage("");
      setSuccessMessage("");

      const created = await createSku(skuForm);

      setSuccessMessage(`SKU ${created.sku_code} 新增成功。`);
      setSkuForm(initialSkuForm);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const startEditSku = (sku: SkuListRow) => {
    setEditForm({
      skuId: sku.id,
      skuCode: sku.sku_code,
      skuName: sku.sku_name,
      skuType: sku.sku_type,
      productId: sku.product_id ?? "",
      unit: sku.unit,
      specs: sku.specs ?? "",
      status: toEditableStatus(sku.status)
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const submitEditSku = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editForm) {
      return;
    }

    try {
      setUpdating(true);
      setErrorMessage("");
      setSuccessMessage("");

      await updateSku(editForm);
      setSuccessMessage(`SKU ${editForm.skuCode} 编辑成功。`);
      setEditForm(null);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setUpdating(false);
    }
  };

  const changeSkuStatus = async (sku: SkuListRow) => {
    try {
      setStatusUpdatingId(sku.id);
      setErrorMessage("");
      setSuccessMessage("");

      const nextStatus = await toggleSkuStatus(sku.id, sku.status);
      setSuccessMessage(
        `SKU ${sku.sku_code} 已${getSkuStatusLabel(nextStatus)}。`
      );
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setStatusUpdatingId("");
    }
  };

  const toggleSkuSelection = (skuId: string) => {
    setSelectedSkuIds((current) =>
      current.includes(skuId)
        ? current.filter((id) => id !== skuId)
        : [...current, skuId]
    );
  };

  const toggleAllFilteredSkus = () => {
    if (allFilteredSelected) {
      setSelectedSkuIds((current) =>
        current.filter((skuId) => !filteredSkus.some((sku) => sku.id === skuId))
      );
      return;
    }

    setSelectedSkuIds((current) =>
      Array.from(new Set([...current, ...filteredSkus.map((sku) => sku.id)]))
    );
  };

  const importSkus = async (rows: Array<{ data?: SkuImportInput }>) => {
    const result = await bulkImportSkus(
      rows
        .map((row) => row.data)
        .filter((row): row is SkuImportInput => Boolean(row))
    );

    await loadPageData();
    setSuccessMessage(
      `SKU 批量导入完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条。`
    );

    return result;
  };

  const batchDeactivateSkus = async (items: SkuListRow[]) => {
    const results = await deactivateSkusByIds(items.map((item) => item.id));
    await loadPageData();
    return results;
  };

  const batchDeleteSkus = async (items: SkuListRow[]) => {
    const results = await deleteSkusByIds(items.map((item) => item.id));
    await loadPageData();
    return results;
  };

  const confirmDeleteSku = async () => {
    if (!skuToDelete) {
      return;
    }

    try {
      setDeletingSkuId(skuToDelete.id);
      setErrorMessage("");
      setSuccessMessage("");

      const [result] = await deleteSkusByIds([skuToDelete.id]);

      if (result?.success) {
        setSuccessMessage(`SKU ${skuToDelete.sku_code} 已删除。`);
      } else {
        setErrorMessage(result?.message ?? "SKU 删除失败，请刷新后再试。");
      }

      setSkuToDelete(null);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setDeletingSkuId("");
    }
  };

  const openBomUsage = async (sku: SkuListRow, clearMessage = true) => {
    try {
      setBomUsageLoading(true);
      setErrorMessage("");

      if (clearMessage) {
        setSuccessMessage("");
      }

      setSelectedBomSku(sku);
      setBomUsage(
        await getSkuBomUsage({
          skuId: sku.id,
          skuType: sku.sku_type
        })
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setBomUsage(null);
    } finally {
      setBomUsageLoading(false);
    }
  };

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">基础资料</p>
          <h2>SKU 管理</h2>
          <p>
            管理公司 SKU 基础资料。成品 SKU 用于 FBA 备货、生产和成品库存；
            原材料 SKU 用于 BOM、物料需求、采购和原材料库存。
          </p>
        </div>
        <span className="statusPill">Supabase 数据</span>
      </section>

      <section className="transactionSummaryGrid">
        <div className="metric">
          <span>SKU 总数</span>
          <strong>{stats.totalSkus}</strong>
        </div>
        <div className="metric">
          <span>成品 SKU</span>
          <strong>{stats.finishedGoodSkus}</strong>
        </div>
        <div className="metric">
          <span>原材料 SKU</span>
          <strong>{stats.materialSkus}</strong>
        </div>
        <div className="metric">
          <span>有库存 SKU</span>
          <strong>{stats.inStockSkus}</strong>
        </div>
        <div className="metric">
          <span>无库存 SKU</span>
          <strong>{stats.outOfStockSkus}</strong>
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
            <p className="eyebrow">新增 SKU</p>
            <h3>创建 SKU 基础资料</h3>
          </div>
        </div>

        <form className="dataForm skuForm" onSubmit={submitCreateSku}>
          <label>
            SKU 编码
            <input
              value={skuForm.skuCode}
              onChange={(event) =>
                setSkuForm((current) => ({
                  ...current,
                  skuCode: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 STORAGE-BOX-BLACK"
              required
            />
          </label>

          <label>
            SKU 名称
            <input
              value={skuForm.skuName}
              onChange={(event) =>
                setSkuForm((current) => ({
                  ...current,
                  skuName: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 折叠收纳箱 黑色"
              required
            />
          </label>

          <label>
            SKU 类型
            <select
              value={skuForm.skuType}
              onChange={(event) =>
                setSkuForm((current) => ({
                  ...current,
                  skuType: event.target.value as SkuEditableType
                }))
              }
              disabled={creating}
              required
            >
              <option value="finished_good">成品</option>
              <option value="material">原材料</option>
            </select>
          </label>

          <label>
            所属产品
            <select
              value={skuForm.productId}
              onChange={(event) =>
                setSkuForm((current) => ({
                  ...current,
                  productId: event.target.value
                }))
              }
              disabled={creating}
              required={skuForm.skuType === "finished_good"}
            >
              <option value="">不选择产品</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {getProductOptionLabel(product)}
                </option>
              ))}
            </select>
          </label>

          <label>
            单位
            <input
              value={skuForm.unit}
              onChange={(event) =>
                setSkuForm((current) => ({
                  ...current,
                  unit: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 pcs"
              required
            />
          </label>

          <label>
            状态
            <select
              value={skuForm.status}
              onChange={(event) =>
                setSkuForm((current) => ({
                  ...current,
                  status: event.target.value as SkuStatus
                }))
              }
              disabled={creating}
            >
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </label>

          <label className="fullField">
            备注
            <textarea
              value={skuForm.specs}
              onChange={(event) =>
                setSkuForm((current) => ({
                  ...current,
                  specs: event.target.value
                }))
              }
              disabled={creating}
              placeholder="可填写规格或备注"
            />
          </label>

          <div className="formActions">
            <button className="primaryButton" type="submit" disabled={creating}>
              {creating ? "正在新增..." : "新增 SKU"}
            </button>
          </div>
        </form>
      </section>

      {editForm ? (
        <section className="formPanel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">编辑 SKU</p>
              <h3>{editForm.skuCode}</h3>
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

          <form className="dataForm skuForm" onSubmit={submitEditSku}>
            <label>
              SKU 编码
              <input value={editForm.skuCode} disabled />
            </label>

            <label>
              SKU 名称
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
              SKU 类型
              <select value={editForm.skuType} disabled>
                {["finished_good", "material"].includes(editForm.skuType) ? null : (
                  <option value={editForm.skuType}>
                    {getSkuTypeLabel(editForm.skuType)}
                  </option>
                )}
                <option value="finished_good">成品</option>
                <option value="material">原材料</option>
              </select>
              <span className="fieldHint">
                SKU 类型已锁定，避免影响现有 BOM、库存、采购和生产记录。
              </span>
            </label>

            <label>
              所属产品
              <select
                value={editForm.productId}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          productId: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating}
                required={editForm.skuType === "finished_good"}
              >
                <option value="">不选择产品</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {getProductOptionLabel(product)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              单位
              <input
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

            <label>
              状态
              <select
                value={editForm.status}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          status: event.target.value as SkuStatus
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
              备注
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
                placeholder="可填写规格或备注"
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
            <p className="eyebrow">SKU 列表</p>
            <h3>所有 SKU</h3>
          </div>
          <div className="rowActions">
            <button
              type="button"
              onClick={() =>
                downloadCsvTemplate("skus-import-template.csv", skuImportFields)
              }
            >
              下载模板
            </button>
            <button type="button" onClick={() => setImportOpen(true)}>
              批量导入
            </button>
            <button type="button" onClick={refreshAll}>
              {loading ? "正在刷新..." : "刷新列表"}
            </button>
          </div>
        </div>

        <div className="listToolbar skuToolbar">
          <label>
            搜索 SKU 编码 / 名称
            <input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="输入 SKU 编码或名称"
            />
          </label>

          <label>
            SKU 类型
            <select
              value={skuTypeFilter}
              onChange={(event) => setSkuTypeFilter(event.target.value)}
            >
              <option value="all">全部类型</option>
              <option value="finished_good">成品</option>
              <option value="material">原材料</option>
            </select>
          </label>

          <label>
            所属产品
            <select
              value={productFilter}
              onChange={(event) => setProductFilter(event.target.value)}
            >
              <option value="all">全部产品</option>
              <option value="none">未绑定产品</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {getProductOptionLabel(product)}
                </option>
              ))}
            </select>
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

          <button className="secondaryButton" type="button" onClick={refreshAll}>
            刷新
          </button>
        </div>

        <BulkActionBar
          selectedItems={selectedSkuRows}
          getItemLabel={(sku) => `${sku.sku_code} / ${sku.sku_name}`}
          entityName="SKU"
          onClearSelection={() => setSelectedSkuIds([])}
          onDeactivateSelected={batchDeactivateSkus}
          onDeleteSelected={batchDeleteSkus}
        />

        {loading ? <div className="debugNotice">正在读取 SKU 数据...</div> : null}

        {!loading && filteredSkus.length === 0 ? (
          <div className="emptyState">暂无 SKU</div>
        ) : null}

        {!loading && filteredSkus.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable skuTable">
              <thead>
                <tr>
                  <th className="selectColumn">
                    <input
                      aria-label="全选当前页 SKU"
                      className="tableCheckbox"
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAllFilteredSkus}
                    />
                  </th>
                  <th>SKU 编码</th>
                  <th>SKU 名称</th>
                  <th>SKU 类型</th>
                  <th>所属产品</th>
                  <th>单位</th>
                  <th>状态</th>
                  <th>当前库存数量</th>
                  <th>创建时间</th>
                  <th>更新时间</th>
                  <th>备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredSkus.map((sku) => {
                  const statusUpdating = statusUpdatingId === sku.id;

                  return (
                    <tr key={sku.id}>
                      <td>
                        <input
                          aria-label={`选择 SKU ${sku.sku_code}`}
                          className="tableCheckbox"
                          type="checkbox"
                          checked={selectedSkuIds.includes(sku.id)}
                          onChange={() => toggleSkuSelection(sku.id)}
                        />
                      </td>
                      <td>
                        <strong>{sku.sku_code}</strong>
                      </td>
                      <td>{sku.sku_name}</td>
                      <td>
                        <span className={`tablePill sku-type-${sku.sku_type}`}>
                          {getSkuTypeLabel(sku.sku_type)}
                        </span>
                      </td>
                      <td>{getProductLabel(sku.product)}</td>
                      <td>{sku.unit}</td>
                      <td>
                        <span className={`tablePill sku-status-${sku.status}`}>
                          {getSkuStatusLabel(sku.status)}
                        </span>
                      </td>
                      <td className="quantityCell">
                        {formatQuantity(sku.inventory_quantity)}
                        <span>
                          {sku.inventory_row_count > 0
                            ? `占用 ${formatQuantity(sku.reserved_quantity)}`
                            : "暂无库存记录"}
                        </span>
                      </td>
                      <td>{formatDateTime(sku.created_at)}</td>
                      <td>{formatDateTime(sku.updated_at)}</td>
                      <td className="notesCell">{sku.specs ?? "-"}</td>
                      <td>
                        <div className="rowActions skuRowActions">
                          <button
                            type="button"
                            onClick={() => startEditSku(sku)}
                            disabled={updating}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => changeSkuStatus(sku)}
                            disabled={statusUpdating}
                          >
                            {statusUpdating
                              ? "正在处理..."
                              : sku.status === "active"
                                ? "停用"
                                : "启用"}
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(getInventoryHref(sku.sku_type))}
                          >
                            查看库存
                          </button>
                          <button
                            type="button"
                            onClick={() => openBomUsage(sku)}
                            disabled={bomUsageLoading}
                          >
                            查看 BOM
                          </button>
                          <button
                            className="dangerButton"
                            type="button"
                            onClick={() => setSkuToDelete(sku)}
                            disabled={deletingSkuId === sku.id}
                          >
                            删除
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

      {bomUsageLoading ? (
        <div className="debugNotice">正在读取 BOM 关联...</div>
      ) : null}

      {selectedBomSku ? (
        <section className="detailPanel">
          <div className="detailHeader">
            <div>
              <p className="eyebrow">BOM 关联</p>
              <h3>
                {selectedBomSku.sku_code} / {getBomUsageTitle(selectedBomSku)}
              </h3>
            </div>
            <button
              className="secondaryButton"
              type="button"
              onClick={() => {
                setSelectedBomSku(null);
                setBomUsage(null);
              }}
            >
              收起关联
            </button>
          </div>

          {bomUsage && selectedBomSku.sku_type === "finished_good" ? (
            bomUsage.finishedBomHeaders.length === 0 ? (
              <div className="emptyState">当前成品 SKU 暂无 BOM 主表关联</div>
            ) : (
              <div className="tableWrap">
                <table className="dataTable skuBomTable">
                  <thead>
                    <tr>
                      <th>BOM 编码</th>
                      <th>版本</th>
                      <th>状态</th>
                      <th>明细数量</th>
                      <th>生效日期</th>
                      <th>创建时间</th>
                      <th>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bomUsage.finishedBomHeaders.map((bom) => (
                      <tr key={bom.id}>
                        <td>{bom.bom_code}</td>
                        <td>{bom.version}</td>
                        <td>
                          <span className={`tablePill bom-status-${bom.status}`}>
                            {getSkuStatusLabel(bom.status)}
                          </span>
                        </td>
                        <td>{bom.item_count}</td>
                        <td>{formatDate(bom.effective_from)}</td>
                        <td>{formatDateTime(bom.created_at)}</td>
                        <td className="notesCell">{bom.notes ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {bomUsage && selectedBomSku.sku_type === "material" ? (
            bomUsage.materialBomItems.length === 0 ? (
              <div className="emptyState">当前原材料 SKU 暂无 BOM 明细关联</div>
            ) : (
              <div className="tableWrap">
                <table className="dataTable skuBomTable">
                  <thead>
                    <tr>
                      <th>BOM 编码</th>
                      <th>成品 SKU</th>
                      <th>所属产品</th>
                      <th>单位用量</th>
                      <th>损耗率</th>
                      <th>单位</th>
                      <th>BOM 状态</th>
                      <th>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bomUsage.materialBomItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.bom_header?.bom_code ?? "-"}</td>
                        <td>
                          {item.bom_header?.product_sku
                            ? `${item.bom_header.product_sku.sku_code} / ${item.bom_header.product_sku.sku_name}`
                            : "-"}
                        </td>
                        <td>
                          {getProductLabel(item.bom_header?.product_sku?.product)}
                        </td>
                        <td className="quantityCell">
                          {formatQuantity(item.quantity_per)}
                        </td>
                        <td>{formatPercent(item.loss_rate)}</td>
                        <td>{item.unit}</td>
                        <td>
                          <span
                            className={`tablePill bom-status-${item.bom_header?.status ?? "unknown"}`}
                          >
                            {getSkuStatusLabel(item.bom_header?.status ?? "-")}
                          </span>
                        </td>
                        <td className="notesCell">{item.notes ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {bomUsage &&
          !["finished_good", "material"].includes(selectedBomSku.sku_type) ? (
            <div className="emptyState">
              当前 SKU 类型不是成品或原材料，请先确认业务类型后再查看 BOM 关系。
            </div>
          ) : null}
        </section>
      ) : null}

      <BulkImportDialog<SkuImportInput>
        open={importOpen}
        title="SKU 批量导入"
        description="原材料也写入 skus 表，通过 sku_type = material 区分；不会新增 materials 表。成品 SKU 必须填写所属产品编码。"
        templateFileName="skus-import-template.csv"
        fields={skuImportFields}
        validateRows={validateSkuImportRows}
        onImport={importSkus}
        onClose={() => setImportOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(skuToDelete)}
        title="确认删除 SKU"
        description={
          <p>
            删除前会检查 BOM、FBA 备货、生产任务、物料需求、采购单、当前库存和库存流水。只要已有任何引用，就不能物理删除，建议改为停用。
          </p>
        }
        confirmLabel="确认删除"
        danger
        loading={Boolean(deletingSkuId)}
        items={skuToDelete ? [`${skuToDelete.sku_code} / ${skuToDelete.sku_name}`] : []}
        onClose={() => setSkuToDelete(null)}
        onConfirm={confirmDeleteSku}
      />
    </main>
  );
}
