"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BulkActionBar } from "@/components/BulkActionBar";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductImage } from "@/components/ui/ProductImage";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { BoxIcon, DownloadIcon, PlusIcon, UploadIcon } from "@/components/ui/icons";
import {
  bulkImportProducts,
  deactivateProductsByIds,
  deleteProductsByIds,
  validateProductImportRows,
  type ProductImportInput
} from "@/lib/api/bulk-management";
import {
  createProduct,
  getProductSkus,
  getProductStats,
  getProductsPage,
  toggleProductStatus,
  updateProduct,
  type ProductListRow,
  type ProductSkuRow,
  type ProductStats,
  type ProductStatus
} from "@/lib/api/products";
import { getBrandOptions, type BrandRow } from "@/lib/api/brands";
import { getBrandCodeName } from "@/lib/brand-utils";
import { downloadCsvTemplate, type CsvTemplateField } from "@/lib/utils/csv";
import { DEFAULT_PAGE_SIZE } from "@/lib/utils/pagination";

const productStatusLabels: Record<string, string> = {
  active: "启用",
  inactive: "停用"
};

const skuTypeLabels: Record<string, string> = {
  finished_good: "成品",
  material: "原材料"
};

type ProductFormState = {
  productCode: string;
  name: string;
  brandId: string;
  category: string;
  description: string;
  productImageUrl: string;
  status: ProductStatus;
};

type ProductEditFormState = {
  productId: string;
  productCode: string;
  name: string;
  brandId: string;
  category: string;
  description: string;
  productImageUrl: string;
  status: ProductStatus;
};

const initialProductForm: ProductFormState = {
  productCode: "",
  name: "",
  brandId: "",
  category: "",
  description: "",
  productImageUrl: "",
  status: "active"
};

const initialStats: ProductStats = {
  totalProducts: 0,
  activeProducts: 0,
  inactiveProducts: 0,
  totalSkus: 0
};

const productImportFields: CsvTemplateField[] = [
  {
    key: "spu",
    label: "SPU",
    required: true,
    example: "PROD-001"
  },
  {
    key: "name",
    label: "产品名称",
    required: true,
    example: "折叠收纳箱"
  },
  {
    key: "brand",
    label: "品牌编码或名称",
    example: "BRAND-A"
  },
  {
    key: "category",
    label: "分类",
    example: "收纳用品"
  },
  {
    key: "image_url",
    label: "图片 URL",
    example: "https://example.com/product.jpg"
  },
  {
    key: "description",
    label: "产品说明",
    example: "产品说明"
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

function getStatusLabel(status: string) {
  return productStatusLabels[status] ?? status;
}

function getSkuTypeLabel(skuType: string) {
  return skuTypeLabels[skuType] ?? skuType;
}

function getBrandOptionLabel(brand: BrandRow) {
  const statusText = brand.status === "inactive" ? " / 停用" : "";

  return `${brand.brand_code} / ${brand.name}${statusText}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function toEditableStatus(status: string): ProductStatus {
  return status === "inactive" ? "inactive" : "active";
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductListRow[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [stats, setStats] = useState<ProductStats>(initialStats);
  const [productForm, setProductForm] =
    useState<ProductFormState>(initialProductForm);
  const [editForm, setEditForm] = useState<ProductEditFormState | null>(null);
  const [selectedProduct, setSelectedProduct] =
    useState<ProductListRow | null>(null);
  const [selectedSkus, setSelectedSkus] = useState<ProductSkuRow[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [productTotal, setProductTotal] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [productToDelete, setProductToDelete] =
    useState<ProductListRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [skuLoading, setSkuLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [deletingProductId, setDeletingProductId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedProductIds.includes(product.id)),
    [products, selectedProductIds]
  );
  const allFilteredSelected =
    products.length > 0 &&
    products.every((product) => selectedProductIds.includes(product.id));

  const loadPageData = async (targetPage = page) => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [productPage, brandData, statsData] = await Promise.all([
        getProductsPage({
          page: targetPage,
          pageSize: DEFAULT_PAGE_SIZE,
          keyword: searchKeyword,
          filters: {
            status: statusFilter,
            brandId: brandFilter
          }
        }),
        getBrandOptions(),
        getProductStats()
      ]);

      setProducts(productPage.rows);
      setProductTotal(productPage.total);
      setPage(productPage.page);
      setBrands(brandData);
      setStats(statsData);
      setSelectedProductIds((current) =>
        current.filter((productId) =>
          productPage.rows.some((product) => product.id === productId)
        )
      );
      setSelectedProduct((current) => {
        if (!current) {
          return null;
        }

        return productPage.rows.find((product) => product.id === current.id) ?? null;
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setProducts([]);
      setProductTotal(0);
      setBrands([]);
      setStats(initialStats);
      setSelectedProductIds([]);
      setSelectedProduct(null);
      setSelectedSkus([]);
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
  }, [brandFilter, searchKeyword, statusFilter]);

  const refreshAll = async () => {
    const productToRefresh = selectedProduct;

    await loadPageData(page);

    if (productToRefresh) {
      await openProductSkus(productToRefresh, false);
    }
  };

  const submitCreateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setCreating(true);
      setErrorMessage("");
      setSuccessMessage("");

      const created = await createProduct(productForm);

      setSuccessMessage(`产品 ${created.product_code} 新增成功。`);
      setProductForm(initialProductForm);
      setCreateOpen(false);
      setPage(1);
      await loadPageData(1);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const startEditProduct = (product: ProductListRow) => {
    setEditForm({
      productId: product.id,
      productCode: product.product_code,
      name: product.name,
      brandId: product.brand_id ?? "",
      category: product.category ?? "",
      description: product.description ?? "",
      productImageUrl: product.product_image_url ?? "",
      status: toEditableStatus(product.status)
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const submitEditProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editForm) {
      return;
    }

    try {
      setUpdating(true);
      setErrorMessage("");
      setSuccessMessage("");

      await updateProduct(editForm);
      setSuccessMessage(`产品 ${editForm.productCode} 编辑成功。`);
      setEditForm(null);
      await loadPageData(page);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setUpdating(false);
    }
  };

  const changeProductStatus = async (product: ProductListRow) => {
    try {
      setStatusUpdatingId(product.id);
      setErrorMessage("");
      setSuccessMessage("");

      const nextStatus = await toggleProductStatus(product.id, product.status);
      setSuccessMessage(
        `产品 ${product.product_code} 已${getStatusLabel(nextStatus)}。`
      );
      await loadPageData(page);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setStatusUpdatingId("");
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  };

  const toggleAllFilteredProducts = () => {
    if (allFilteredSelected) {
      setSelectedProductIds((current) =>
        current.filter(
          (productId) =>
            !products.some((product) => product.id === productId)
        )
      );
      return;
    }

    setSelectedProductIds((current) =>
      Array.from(
        new Set([...current, ...products.map((product) => product.id)])
      )
    );
  };

  const importProducts = async (
    rows: Array<{ data?: ProductImportInput }>
  ) => {
    const result = await bulkImportProducts(
      rows
        .map((row) => row.data)
        .filter((row): row is ProductImportInput => Boolean(row))
    );

    setPage(1);
    await loadPageData(1);
    setSuccessMessage(
      `产品批量导入完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条。`
    );

    return result;
  };

  const batchDeactivateProducts = async (items: ProductListRow[]) => {
    const results = await deactivateProductsByIds(items.map((item) => item.id));
    await loadPageData(page);
    return results;
  };

  const batchDeleteProducts = async (items: ProductListRow[]) => {
    const results = await deleteProductsByIds(items.map((item) => item.id));
    await loadPageData(page);
    return results;
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) {
      return;
    }

    try {
      setDeletingProductId(productToDelete.id);
      setErrorMessage("");
      setSuccessMessage("");

      const [result] = await deleteProductsByIds([productToDelete.id]);

      if (result?.success) {
        setSuccessMessage(`产品 ${productToDelete.product_code} 已删除。`);
      } else {
        setErrorMessage(
          result?.message ?? "产品删除失败，请刷新后再试。"
        );
      }

      setProductToDelete(null);
      await loadPageData(page);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setDeletingProductId("");
    }
  };

  const openProductSkus = async (
    product: ProductListRow,
    clearMessage = true
  ) => {
    try {
      setSkuLoading(true);
      setErrorMessage("");

      if (clearMessage) {
        setSuccessMessage("");
      }

      setSelectedProduct(product);
      setSelectedSkus(await getProductSkus(product.id));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setSelectedSkus([]);
    } finally {
      setSkuLoading(false);
    }
  };

  const productColumns: DataTableColumn<ProductListRow>[] = [
    {
      key: "select",
      title: (
        <input
          aria-label="全选当前筛选产品"
          className="tableCheckbox"
          type="checkbox"
          checked={allFilteredSelected}
          onChange={toggleAllFilteredProducts}
        />
      ),
      className: "selectColumn",
      render: (product) => (
        <input
          aria-label={`选择产品 ${product.product_code}`}
          className="tableCheckbox"
          type="checkbox"
          checked={selectedProductIds.includes(product.id)}
          onChange={() => toggleProductSelection(product.id)}
        />
      )
    },
    {
      key: "image",
      title: "产品图片",
      render: (product) => (
        <ProductImage
          src={product.product_image_url}
          alt={`${product.product_code} ${product.name}`}
        />
      )
    },
    {
      key: "code",
      title: "SPU",
      render: (product) => <strong>{product.product_code}</strong>
    },
    {
      key: "name",
      title: "产品名称",
      render: (product) => (
        <div>
          <strong>{product.name}</strong>
          <span className="tableSubText">{getBrandCodeName(product.brand)}</span>
        </div>
      )
    },
    {
      key: "category",
      title: "类目",
      render: (product) => product.category ?? "-"
    },
    {
      key: "status",
      title: "状态",
      render: (product) => (
        <StatusBadge status={product.status} label={getStatusLabel(product.status)} />
      )
    },
    {
      key: "skuCount",
      title: "SKU 数量",
      render: (product) => product.sku_count
    },
    {
      key: "createdAt",
      title: "创建时间",
      render: (product) => formatDateTime(product.created_at)
    },
    {
      key: "actions",
      title: "操作",
      render: (product) => {
        const statusUpdating = statusUpdatingId === product.id;

        return (
          <div className="rowActions productRowActions">
            <button
              type="button"
              onClick={() => openProductSkus(product)}
              disabled={skuLoading}
            >
              查看
            </button>
            <button
              type="button"
              onClick={() => startEditProduct(product)}
              disabled={updating}
            >
              编辑
            </button>
            <button
              type="button"
              onClick={() => changeProductStatus(product)}
              disabled={statusUpdating}
            >
              {statusUpdating
                ? "处理中"
                : product.status === "active"
                  ? "停用"
                  : "启用"}
            </button>
            <button
              className="dangerButton"
              type="button"
              onClick={() => setProductToDelete(product)}
              disabled={deletingProductId === product.id}
            >
              删除
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <main className="pageShell modernPageShell">
      <PageHeader
        eyebrow="基础资料"
        title="产品管理"
        description="管理产品 SPU、图片、类目、状态和关联 SKU。产品是 SKU、BOM 和 FBA 备货需求的上级资料。"
        actions={
          <div className="rowActions">
            <button
              type="button"
              onClick={() =>
                downloadCsvTemplate(
                  "products-import-template.csv",
                  productImportFields
                )
              }
            >
              <DownloadIcon size={16} />
              下载模板
            </button>
            <button type="button" onClick={() => setImportOpen(true)}>
              <UploadIcon size={16} />
              批量导入
            </button>
            <button className="primaryButton" type="button" onClick={() => setCreateOpen(true)}>
              <PlusIcon size={16} />
              新增产品
            </button>
          </div>
        }
      />

      <section className="modernStatGrid productStatGrid">
        <StatCard
          title="产品总数"
          value={stats.totalProducts}
          change="全部 SPU"
          tone="blue"
          icon={<BoxIcon size={20} />}
        />
        <StatCard
          title="启用产品"
          value={stats.activeProducts}
          change="可用于业务"
          tone="green"
          icon={<BoxIcon size={20} />}
        />
        <StatCard
          title="停用产品"
          value={stats.inactiveProducts}
          change="不再新增业务"
          tone="orange"
          icon={<BoxIcon size={20} />}
        />
        <StatCard
          title="SKU 总数"
          value={stats.totalSkus}
          change="关联 SKU"
          tone="purple"
          icon={<BoxIcon size={20} />}
        />
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

      <Modal
        open={createOpen}
        eyebrow="新增产品"
        title="创建产品基础资料"
        maxWidth="lg"
        onClose={() => setCreateOpen(false)}
      >
        <form className="dataForm productForm" onSubmit={submitCreateProduct}>
          <label>
            SPU
            <input
              value={productForm.productCode}
              onChange={(event) =>
                setProductForm((current) => ({
                  ...current,
                  productCode: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 STORAGE-BOX"
              required
            />
          </label>

          <label>
            产品名称
            <input
              value={productForm.name}
              onChange={(event) =>
                setProductForm((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 折叠收纳箱"
              required
            />
          </label>

          <label>
            所属品牌
            <select
              value={productForm.brandId}
              onChange={(event) =>
                setProductForm((current) => ({
                  ...current,
                  brandId: event.target.value
                }))
              }
              disabled={creating}
            >
              <option value="">暂不绑定品牌</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {getBrandOptionLabel(brand)}
                </option>
              ))}
            </select>
          </label>

          <label>
            分类
            <input
              value={productForm.category}
              onChange={(event) =>
                setProductForm((current) => ({
                  ...current,
                  category: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 收纳用品"
            />
          </label>

          <label>
            状态
            <select
              value={productForm.status}
              onChange={(event) =>
                setProductForm((current) => ({
                  ...current,
                  status: event.target.value as ProductStatus
                }))
              }
              disabled={creating}
            >
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </label>

          <label className="fullField">
            图片 URL
            <input
              value={productForm.productImageUrl}
              onChange={(event) =>
                setProductForm((current) => ({
                  ...current,
                  productImageUrl: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 https://example.com/product.jpg"
            />
          </label>

          <label className="fullField">
            备注
            <textarea
              value={productForm.description}
              onChange={(event) =>
                setProductForm((current) => ({
                  ...current,
                  description: event.target.value
                }))
              }
              disabled={creating}
              placeholder="可填写产品说明"
            />
          </label>

          <div className="formActions">
            <button className="primaryButton" type="submit" disabled={creating}>
              {creating ? "正在新增..." : "新增产品"}
            </button>
          </div>
        </form>
      </Modal>

      {editForm ? (
        <Modal
          open={Boolean(editForm)}
          eyebrow="编辑产品"
          title={editForm.productCode}
          maxWidth="md"
          onClose={() => setEditForm(null)}
        >
          <form className="dataForm productForm" onSubmit={submitEditProduct}>
            <label>
              产品名称
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
              所属品牌
              <select
                value={editForm.brandId}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          brandId: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating}
              >
                <option value="">暂不绑定品牌</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {getBrandOptionLabel(brand)}
                  </option>
                ))}
              </select>
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
                placeholder="例如 收纳用品"
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
                          status: event.target.value as ProductStatus
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
              图片 URL
              <input
                value={editForm.productImageUrl}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          productImageUrl: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating}
                placeholder="例如 https://example.com/product.jpg"
              />
            </label>

            <label className="fullField">
              备注
              <textarea
                value={editForm.description}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          description: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating}
                placeholder="可填写产品说明"
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

      <section className="modernCard">
        <div className="modernCardHeader">
          <div>
            <p className="eyebrow">产品列表</p>
            <h3>所有产品</h3>
          </div>
          <div className="rowActions">
            <button type="button" onClick={refreshAll}>
              {loading ? "正在刷新..." : "刷新列表"}
            </button>
          </div>
        </div>

        <SearchFilterBar
          searchLabel="搜索产品名称 / SPU"
          searchValue={searchKeyword}
          searchPlaceholder="输入 SPU、产品名称或品牌"
          onSearchChange={setSearchKeyword}
          onReset={() => {
            setSearchKeyword("");
            setStatusFilter("all");
            setBrandFilter("all");
            setPage(1);
          }}
        >

          <label>
            产品状态
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
            所属品牌
            <select
              value={brandFilter}
              onChange={(event) => setBrandFilter(event.target.value)}
            >
              <option value="all">全部品牌</option>
              <option value="none">无品牌</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {getBrandOptionLabel(brand)}
                </option>
              ))}
            </select>
          </label>
        </SearchFilterBar>

        <BulkActionBar
          selectedItems={selectedProducts}
          getItemLabel={(product) => `${product.product_code} / ${product.name}`}
          entityName="产品"
          onClearSelection={() => setSelectedProductIds([])}
          onDeactivateSelected={batchDeactivateProducts}
          onDeleteSelected={batchDeleteProducts}
        />

        <DataTable
          columns={productColumns}
          rows={products}
          getRowKey={(product) => product.id}
          loading={loading}
          loadingText="正在读取产品数据..."
          emptyText="暂无产品"
          minWidth={1120}
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          total={productTotal}
          onPageChange={(nextPage) => loadPageData(nextPage)}
        />
      </section>

      {skuLoading ? (
        <div className="debugNotice">正在读取关联 SKU...</div>
      ) : null}

      {selectedProduct ? (
        <Modal
          open={Boolean(selectedProduct)}
          eyebrow="关联 SKU"
          title={`${selectedProduct.product_code} / ${selectedProduct.name}`}
          maxWidth="xl"
          onClose={() => {
            setSelectedProduct(null);
            setSelectedSkus([]);
          }}
        >

          {selectedSkus.length === 0 ? (
            <div className="emptyState">当前产品暂无关联 SKU</div>
          ) : (
            <div className="tableWrap">
              <table className="dataTable productSkuTable">
                <thead>
                  <tr>
                    <th>SKU 编码</th>
                    <th>SKU 名称</th>
                    <th>SKU 类型</th>
                    <th>单位</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSkus.map((sku) => (
                    <tr key={sku.id}>
                      <td>{sku.sku_code}</td>
                      <td>{sku.sku_name}</td>
                      <td>{getSkuTypeLabel(sku.sku_type)}</td>
                      <td>{sku.unit}</td>
                      <td>
                        <span className={`tablePill product-status-${sku.status}`}>
                          {getStatusLabel(sku.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      ) : null}

      <BulkImportDialog<ProductImportInput>
        open={importOpen}
        title="产品批量导入"
        description="请按模板填写 SPU、产品名称、品牌、分类、图片 URL、产品说明和状态。品牌可以填品牌编码或品牌名称；匹配不到会提示错误，不会自动新建品牌。"
        templateFileName="products-import-template.csv"
        fields={productImportFields}
        validateRows={validateProductImportRows}
        onImport={importProducts}
        onClose={() => setImportOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(productToDelete)}
        title="确认删除产品"
        description={
          <p>
            删除前会检查这个产品下面是否已有 SKU。只要已有 SKU 或业务引用，就不会物理删除，建议改为停用。
          </p>
        }
        confirmLabel="确认删除"
        danger
        loading={Boolean(deletingProductId)}
        items={
          productToDelete
            ? [`${productToDelete.product_code} / ${productToDelete.name}`]
            : []
        }
        onClose={() => setProductToDelete(null)}
        onConfirm={confirmDeleteProduct}
      />
    </main>
  );
}
