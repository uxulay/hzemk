"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
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
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  BoxIcon,
  DatabaseIcon,
  DownloadIcon,
  PlusIcon,
  UploadIcon,
  WarehouseIcon
} from "@/components/ui/icons";
import {
  bulkImportSkus,
  deactivateSkusByIds,
  deleteSkusByIds,
  validateSkuImportRows,
  type SkuImportInput
} from "@/lib/api/bulk-management";
import {
  createSku,
  getSkusPage,
  getProductsForSkuForm,
  getSkuBomUsage,
  toggleSkuStatus,
  updateSku,
  type SkuBomUsage,
  type SkuEditableType,
  type SkuListRow,
  type SkuProductOption,
  type SkuStatus
} from "@/lib/api/skus";
import { getBrandOptions, type BrandRow } from "@/lib/api/brands";
import { getBrandCodeName, getSkuBrandLabel } from "@/lib/brand-utils";
import { downloadCsvTemplate, type CsvTemplateField } from "@/lib/utils/csv";

const SKU_PAGE_SIZE = 100;

const skuTypeLabels: Record<string, string> = {
  finished_good: "成品",
  finished_product: "成品",
  semi_finished: "半成品"
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
  defaultSupplierId: string;
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
  defaultSupplierId: string;
  unit: string;
  specs: string;
  status: SkuStatus;
};

type SkuStats = {
  totalSkus: number;
  finishedGoodSkus: number;
  semiFinishedSkus: number;
  inStockSkus: number;
  outOfStockSkus: number;
};

const initialSkuForm: SkuFormState = {
  skuCode: "",
  skuName: "",
  skuType: "finished_good",
  productId: "",
  defaultSupplierId: "",
  unit: "pcs",
  specs: "",
  status: "active"
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

function getProductLabel(product: SkuProductOption | null | undefined) {
  if (!product) {
    return "未绑定产品";
  }

  return `${product.product_code} / ${product.name}`;
}

function getProductOptionLabel(product: SkuProductOption) {
  const statusText =
    product.status === "inactive" ? " / 停用" : "";
  const brandText = product.brand ? ` / ${getBrandCodeName(product.brand)}` : "";

  return `${product.product_code} / ${product.name}${brandText}${statusText}`;
}

type ProductSearchSelectProps = {
  products: SkuProductOption[];
  value: string;
  disabled?: boolean;
  required?: boolean;
  loading?: boolean;
  onSearch: (keyword: string) => void;
  onChange: (productId: string) => void;
};

function ProductSearchSelect({
  products,
  value,
  disabled = false,
  required = false,
  loading = false,
  onSearch,
  onChange
}: ProductSearchSelectProps) {
  const [keyword, setKeyword] = useState("");
  const selectedProduct = products.find((product) => product.id === value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onSearch(keyword);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [keyword, onSearch]);

  return (
    <div className="fieldBlock">
      <span>所属产品{required ? "（成品必选）" : ""}</span>
      <input
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        disabled={disabled}
        placeholder={
          selectedProduct
            ? `当前：${getProductOptionLabel(selectedProduct)}`
            : "搜索 SPU 或产品名称"
        }
      />
      {selectedProduct ? (
        <div className="selectedPickerValue">
          <strong>{getProductOptionLabel(selectedProduct)}</strong>
          <button type="button" onClick={() => onChange("")} disabled={disabled}>
            清除
          </button>
        </div>
      ) : null}
      <div className="searchPickerList">
        {loading ? (
          <p className="tableHint">正在搜索产品...</p>
        ) : products.length === 0 ? (
          <p className="tableHint">没有匹配的产品。</p>
        ) : (
          products.map((product) => (
            <button
              type="button"
              key={product.id}
              className={product.id === value ? "active" : undefined}
              onClick={() => {
                onChange(product.id);
                setKeyword("");
              }}
              disabled={disabled}
            >
              {getProductOptionLabel(product)}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function getInventoryHref(skuType: string) {
  return "/inventory/products";
}

function getBomUsageTitle(sku: SkuListRow) {
  if (sku.sku_type === "finished_good") {
    return "作为成品使用的 BOM";
  }

  return "BOM 关联";
}

export default function AdminSkusPage() {
  const router = useRouter();
  const [skus, setSkus] = useState<SkuListRow[]>([]);
  const [products, setProducts] = useState<SkuProductOption[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [skuForm, setSkuForm] = useState<SkuFormState>(initialSkuForm);
  const [editForm, setEditForm] = useState<SkuEditFormState | null>(null);
  const [selectedBomSku, setSelectedBomSku] = useState<SkuListRow | null>(null);
  const [bomUsage, setBomUsage] = useState<SkuBomUsage | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [skuTypeFilter, setSkuTypeFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSkuIds, setSelectedSkuIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [skuTotal, setSkuTotal] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [skuToDelete, setSkuToDelete] = useState<SkuListRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [productLoading, setProductLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [deletingSkuId, setDeletingSkuId] = useState("");
  const [bomUsageLoading, setBomUsageLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const stats = useMemo<SkuStats>(() => {
    const inStockSkus = skus.filter((sku) => sku.inventory_quantity > 0).length;

    return {
      totalSkus: skuTotal,
      finishedGoodSkus: skus.filter(
        (sku) => sku.sku_type === "finished_good" || sku.sku_type === "finished_product"
      ).length,
      semiFinishedSkus: skus.filter((sku) => sku.sku_type === "semi_finished").length,
      inStockSkus,
      outOfStockSkus: skus.length - inStockSkus
    };
  }, [skus, skuTotal]);

  const brandOptions = brands;

  const selectedSkuRows = useMemo(
    () => skus.filter((sku) => selectedSkuIds.includes(sku.id)),
    [skus, selectedSkuIds]
  );
  const allPageSelected =
    skus.length > 0 && skus.every((sku) => selectedSkuIds.includes(sku.id));

  const buildSkuName = (productId: string, specs: string) => {
    const productName = products.find((product) => product.id === productId)?.name ?? "";
    const normalizedSpecs = specs.trim();

    return [productName, normalizedSpecs].filter(Boolean).join("-");
  };

  const loadSkuPage = async (targetPage = page) => {
    try {
      setLoading(true);
      setErrorMessage("");

      const skuPage = await getSkusPage({
        page: targetPage,
        pageSize: SKU_PAGE_SIZE,
        keyword: searchKeyword,
        skuType: skuTypeFilter,
        status: statusFilter,
        brandId: brandFilter,
        productId: productFilter
      });

      setSkus(skuPage.rows);
      setSkuTotal(skuPage.total);
      if (skuPage.page > skuPage.totalPages) {
        setPage(skuPage.totalPages);
      }
      setSelectedSkuIds((current) =>
        current.filter((skuId) => skuPage.rows.some((sku) => sku.id === skuId))
      );
      setSelectedBomSku((current) => {
        if (!current) {
          return null;
        }

        return skuPage.rows.find((sku) => sku.id === current.id) ?? current;
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setSkus([]);
      setSkuTotal(0);
      setSelectedSkuIds([]);
      setSelectedBomSku(null);
      setBomUsage(null);
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const [productData, brandData] = await Promise.all([
        getProductsForSkuForm("", 20),
        getBrandOptions()
      ]);
      setProducts(productData);
      setBrands(brandData);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setProducts([]);
      setBrands([]);
    }
  };

  const searchProducts = useCallback(async (keyword: string) => {
    try {
      setProductLoading(true);
      const productData = await getProductsForSkuForm(keyword, 20);
      setProducts((current) => {
        const selected = current.filter(
          (product) =>
            product.id === skuForm.productId ||
            product.id === editForm?.productId
        );
        const merged = new Map<string, SkuProductOption>();
        [...selected, ...productData].forEach((product) =>
          merged.set(product.id, product)
        );

        return [...merged.values()];
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setProductLoading(false);
    }
  }, [editForm?.productId, skuForm.productId]);

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    loadSkuPage(page);
  }, [
    brandFilter,
    page,
    productFilter,
    searchKeyword,
    skuTypeFilter,
    statusFilter,
  ]);

  const refreshAll = async () => {
    const skuToRefresh = selectedBomSku;

    await loadSkuPage(page);

    if (skuToRefresh) {
      await openBomUsage(skuToRefresh, false);
    }
  };

  const resetToFirstPage = () => {
    if (page !== 1) {
      setPage(1);
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
      setCreateOpen(false);
      setPage(1);
      await loadSkuPage(1);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const startEditSku = (sku: SkuListRow) => {
    if (sku.product) {
      setProducts((current) =>
        current.some((product) => product.id === sku.product?.id)
          ? current
          : [sku.product as SkuProductOption, ...current]
      );
    }

    setEditForm({
      skuId: sku.id,
      skuCode: sku.sku_code,
      skuName: sku.sku_name,
      skuType: sku.sku_type,
      productId: sku.product_id ?? "",
      defaultSupplierId: sku.default_supplier_id ?? "",
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
      await loadSkuPage(page);
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
      await loadSkuPage(page);
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

  const toggleAllPageSkus = () => {
    if (allPageSelected) {
      setSelectedSkuIds((current) =>
        current.filter((skuId) => !skus.some((sku) => sku.id === skuId))
      );
      return;
    }

    setSelectedSkuIds((current) =>
      Array.from(new Set([...current, ...skus.map((sku) => sku.id)]))
    );
  };

  const importSkus = async (rows: Array<{ data?: SkuImportInput }>) => {
    const result = await bulkImportSkus(
      rows
        .map((row) => row.data)
        .filter((row): row is SkuImportInput => Boolean(row))
    );

    setPage(1);
    await loadSkuPage(1);
    setSuccessMessage(
      `SKU 批量导入完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条。`
    );

    return result;
  };

  const batchDeactivateSkus = async (items: SkuListRow[]) => {
    const results = await deactivateSkusByIds(items.map((item) => item.id));
    await loadSkuPage(page);
    return results;
  };

  const batchDeleteSkus = async (items: SkuListRow[]) => {
    const results = await deleteSkusByIds(items.map((item) => item.id));
    await loadSkuPage(page);
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
      await loadSkuPage(page);
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

  const skuColumns: DataTableColumn<SkuListRow>[] = [
    {
      key: "select",
      title: (
        <input
          aria-label="全选当前页 SKU"
          className="tableCheckbox"
          type="checkbox"
          checked={allPageSelected}
          onChange={toggleAllPageSkus}
        />
      ),
      className: "selectColumn",
      render: (sku) => (
        <input
          aria-label={`选择 SKU ${sku.sku_code}`}
          className="tableCheckbox"
          type="checkbox"
          checked={selectedSkuIds.includes(sku.id)}
          onChange={() => toggleSkuSelection(sku.id)}
        />
      )
    },
    {
      key: "sku",
      title: "SKU 信息",
      width: "34%",
      render: (sku) => (
        <InfoCell
          imageUrl={sku.product?.product_image_url}
          imageAlt={`${sku.sku_code} ${sku.sku_name}`}
          title={sku.sku_code}
          subtitle={`${sku.product?.name ?? "未绑定产品"} / ${sku.sku_name}`}
        />
      )
    },
    {
      key: "spu",
      title: "SPU",
      render: (sku) => sku.product?.product_code ?? "-"
    },
    {
      key: "specs",
      title: "规格/米数",
      render: (sku) => sku.specs ?? "-"
    },
    {
      key: "status",
      title: "状态",
      render: (sku) => <StatusBadge status={sku.status} label={getSkuStatusLabel(sku.status)} />
    },
    {
      key: "createdAt",
      title: "创建时间",
      render: (sku) => formatDateTime(sku.created_at)
    },
    {
      key: "actions",
      title: "操作",
      render: (sku) => {
        const statusUpdating = statusUpdatingId === sku.id;

        return (
          <RowActions
            onView={() => openBomUsage(sku)}
            onEdit={() => startEditSku(sku)}
            moreActions={[
              {
                label: statusUpdating
                  ? "正在处理"
                  : sku.status === "active"
                    ? "停用"
                    : "启用",
                disabled: statusUpdating,
                onClick: () => changeSkuStatus(sku)
              },
              {
                label: "查看库存",
                onClick: () => router.push(getInventoryHref(sku.sku_type))
              },
              {
                label: "删除",
                danger: true,
                disabled: deletingSkuId === sku.id,
                onClick: () => setSkuToDelete(sku)
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
        title="SKU 管理"
        actions={
          <div className="rowActions">
            <button type="button" onClick={() => router.push("/admin/materials")}>
              辅料管理
            </button>
            <button
              type="button"
              onClick={() =>
                downloadCsvTemplate("skus-import-template.csv", skuImportFields)
              }
            >
              <DownloadIcon size={16} />
              导出模板
            </button>
            <button type="button" onClick={() => setImportOpen(true)}>
              <UploadIcon size={16} />
              导入
            </button>
            <button className="primaryButton" type="button" onClick={() => setCreateOpen(true)}>
              <PlusIcon size={16} />
              新增 SKU
            </button>
          </div>
        }
      />

      <section className="modernStatGrid skuStatGrid">
        <StatCard title="当前筛选 SKU" value={stats.totalSkus} change="符合当前条件" tone="blue" icon={<DatabaseIcon size={20} />} />
        <StatCard title="本页成品 SKU" value={stats.finishedGoodSkus} change="用于生产和 FBA" tone="green" icon={<BoxIcon size={20} />} />
        <StatCard title="本页半成品 SKU" value={stats.semiFinishedSkus} change="用于后续生产扩展" tone="orange" icon={<DatabaseIcon size={20} />} />
        <StatCard title="本页有库存 SKU" value={stats.inStockSkus} change="已有库存记录" tone="purple" icon={<WarehouseIcon size={20} />} />
        <StatCard title="本页无库存 SKU" value={stats.outOfStockSkus} change="暂无库存记录" tone="red" icon={<WarehouseIcon size={20} />} />
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
        title="新增 SKU"
        width="lg"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button className="secondaryButton" type="button" onClick={() => setCreateOpen(false)}>
              取消
            </button>
            <button className="primaryButton" form="create-sku-form" type="submit" disabled={creating}>
              {creating ? "正在新增..." : "新增 SKU"}
            </button>
          </>
        }
      >
        <form id="create-sku-form" className="dataForm skuForm" onSubmit={submitCreateSku}>
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
              readOnly
              disabled={creating}
              placeholder="选择产品并填写规格后自动生成"
              required
            />
            <span className="fieldHint">由“产品名称 + '-' + 规格/米数”自动生成。</span>
          </label>

          <label>
            SKU 类型
            <select
              value={skuForm.skuType}
              onChange={(event) =>
                setSkuForm((current) => ({
                  ...current,
                  skuType: event.target.value as SkuEditableType,
                  defaultSupplierId: ""
                }))
              }
              disabled={creating}
              required
            >
              <option value="finished_good">成品</option>
              <option value="semi_finished">半成品</option>
            </select>
          </label>

          <ProductSearchSelect
            products={products}
            value={skuForm.productId}
            disabled={creating}
            required={skuForm.skuType === "finished_good"}
            loading={productLoading}
            onSearch={searchProducts}
            onChange={(productId) =>
              setSkuForm((current) => ({
                ...current,
                productId,
                skuName: buildSkuName(productId, current.specs)
              }))
            }
          />

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
            规格/米数
            <input
              value={skuForm.specs}
              onChange={(event) =>
                setSkuForm((current) => ({
                  ...current,
                  specs: event.target.value,
                  skuName: buildSkuName(current.productId, event.target.value)
                }))
              }
              disabled={creating}
              placeholder="例如 1.5m / 黑色 / 10pcs"
            />
          </label>
        </form>
      </DrawerForm>

      {editForm ? (
        <DrawerForm
          open={Boolean(editForm)}
          title={`编辑 SKU：${editForm.skuCode}`}
          width="lg"
          onClose={() => setEditForm(null)}
          footer={
            <>
              <button className="secondaryButton" type="button" onClick={() => setEditForm(null)}>
                取消
              </button>
              <button className="primaryButton" form="edit-sku-form" type="submit" disabled={updating}>
                {updating ? "正在保存..." : "保存编辑"}
              </button>
            </>
          }
        >
          <form id="edit-sku-form" className="dataForm skuForm" onSubmit={submitEditSku}>
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
                {["finished_good", "finished_product", "semi_finished"].includes(editForm.skuType) ? null : (
                  <option value={editForm.skuType}>
                    {getSkuTypeLabel(editForm.skuType)}
                  </option>
                )}
                <option value="finished_good">成品</option>
                <option value="semi_finished">半成品</option>
              </select>
              <span className="fieldHint">
                SKU 类型已锁定，避免影响现有 BOM、库存和生产记录。
              </span>
            </label>

            <ProductSearchSelect
            products={products}
            value={editForm.productId}
            disabled={updating}
            required={editForm.skuType === "finished_good"}
            loading={productLoading}
            onSearch={searchProducts}
            onChange={(productId) =>
              setEditForm((current) =>
                  current
                    ? {
                        ...current,
                        productId
                      }
                    : current
                )
              }
            />

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
              规格/米数
              <input
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
                placeholder="例如 1.5m / 黑色 / 10pcs"
              />
            </label>
          </form>
        </DrawerForm>
      ) : null}

      <section className="modernCard">
        <div className="modernCardHeader">
          <div>
            <p className="eyebrow">SKU 列表</p>
            <h3>所有 SKU</h3>
          </div>
          <div className="rowActions">
            <button type="button" onClick={refreshAll}>
              {loading ? "正在刷新..." : "刷新列表"}
            </button>
          </div>
        </div>

        <SearchFilterBar
          searchLabel="搜索 SKU / 产品名称 / SPU"
          searchValue={searchKeyword}
          searchPlaceholder="输入 SKU、产品名称、SPU 或规格"
          onSearchChange={(value) => {
            resetToFirstPage();
            setSearchKeyword(value);
          }}
          onReset={() => {
            resetToFirstPage();
            setSearchKeyword("");
            setSkuTypeFilter("all");
            setBrandFilter("all");
            setProductFilter("all");
            setStatusFilter("all");
          }}
        >

          <label>
            SKU 类型
            <select
              value={skuTypeFilter}
              onChange={(event) => {
                resetToFirstPage();
                setSkuTypeFilter(event.target.value);
              }}
            >
              <option value="all">全部类型</option>
              <option value="finished_good">成品</option>
              <option value="semi_finished">半成品</option>
            </select>
          </label>

          <label>
            所属产品
            <select
              value={productFilter}
              onChange={(event) => {
                resetToFirstPage();
                setProductFilter(event.target.value);
              }}
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
            品牌
            <select
              value={brandFilter}
              onChange={(event) => {
                resetToFirstPage();
                setBrandFilter(event.target.value);
              }}
            >
              <option value="all">全部品牌</option>
              <option value="none">无品牌</option>
              {brandOptions.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {getBrandCodeName(brand)}
                </option>
              ))}
            </select>
          </label>

          <label>
            状态
            <select
              value={statusFilter}
              onChange={(event) => {
                resetToFirstPage();
                setStatusFilter(event.target.value);
              }}
            >
              <option value="all">全部状态</option>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </label>

        </SearchFilterBar>

        <BulkActionBar
          selectedItems={selectedSkuRows}
          getItemLabel={(sku) => `${sku.sku_code} / ${sku.sku_name}`}
          entityName="SKU"
          onClearSelection={() => setSelectedSkuIds([])}
          onDeactivateSelected={batchDeactivateSkus}
          onDeleteSelected={batchDeleteSkus}
        />

        <DataTable
          columns={skuColumns}
          rows={skus}
          getRowKey={(sku) => sku.id}
          loading={loading}
          loadingText="正在读取 SKU 数据..."
          emptyText="暂无 SKU"
          minWidth={900}
          page={page}
          pageSize={SKU_PAGE_SIZE}
          total={skuTotal}
          onPageChange={setPage}
        />
      </section>

      {bomUsageLoading ? (
        <div className="debugNotice">正在读取 BOM 关联...</div>
      ) : null}

      {selectedBomSku ? (
        <DetailDrawer
          open={Boolean(selectedBomSku)}
          title={`${selectedBomSku.sku_code} / ${getBomUsageTitle(selectedBomSku)}`}
          width="lg"
          onClose={() => {
            setSelectedBomSku(null);
            setBomUsage(null);
          }}
        >
          <div className="detailGrid">
            <div className="detailItem">
              <span>SKU</span>
              <strong>
                {selectedBomSku.sku_code} / {selectedBomSku.sku_name}
              </strong>
            </div>
            <div className="detailItem">
              <span>所属产品</span>
              <strong>{getProductLabel(selectedBomSku.product)}</strong>
            </div>
            <div className="detailItem">
              <span>品牌</span>
              <strong>
                {getSkuBrandLabel({
                  skuType: selectedBomSku.sku_type,
                  product: selectedBomSku.product
                })}
              </strong>
            </div>
            <div className="detailItem">
              <span>SKU 类型</span>
              <strong>{getSkuTypeLabel(selectedBomSku.sku_type)}</strong>
            </div>
            <div className="detailItem">
              <span>默认供应商</span>
              <strong>辅料供应商请到辅料管理查看</strong>
            </div>
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

          {bomUsage &&
          !["finished_good", "finished_product"].includes(selectedBomSku.sku_type) ? (
            <div className="emptyState">
              当前 SKU 不是成品 SKU，暂不展示 BOM 主表关系。
            </div>
          ) : null}
        </DetailDrawer>
      ) : null}

      <BulkImportDialog<SkuImportInput>
        open={importOpen}
        title="SKU 批量导入"
        description="只导入成品和半成品 SKU；辅料请到“辅料管理”批量导入。成品 SKU 必须填写所属产品编码。"
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
            删除前会检查 BOM、备货单、生产任务、物料需求、采购单、当前库存和库存流水。只要已有任何引用，就不能物理删除，建议改为停用。
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
