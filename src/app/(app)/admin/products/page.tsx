"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BulkActionBar } from "@/components/BulkActionBar";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
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
  getProducts,
  toggleProductStatus,
  updateProduct,
  type ProductListRow,
  type ProductSkuRow,
  type ProductStats,
  type ProductStatus
} from "@/lib/api/products";
import { downloadCsvTemplate, type CsvTemplateField } from "@/lib/utils/csv";
import { DEFAULT_PAGE_SIZE, paginateItems } from "@/lib/utils/pagination";

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
  description: string;
  status: ProductStatus;
};

type ProductEditFormState = {
  productId: string;
  productCode: string;
  name: string;
  description: string;
  status: ProductStatus;
};

const initialProductForm: ProductFormState = {
  productCode: "",
  name: "",
  description: "",
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
    key: "product_code",
    label: "产品编码",
    required: true,
    example: "PROD-001"
  },
  {
    key: "product_name",
    label: "产品名称",
    required: true,
    example: "折叠收纳箱"
  },
  {
    key: "remark",
    label: "备注",
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
  const [stats, setStats] = useState<ProductStats>(initialStats);
  const [productForm, setProductForm] =
    useState<ProductFormState>(initialProductForm);
  const [editForm, setEditForm] = useState<ProductEditFormState | null>(null);
  const [selectedProduct, setSelectedProduct] =
    useState<ProductListRow | null>(null);
  const [selectedSkus, setSelectedSkus] = useState<ProductSkuRow[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
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

  const filteredProducts = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return products.filter((product) => {
      const matchesKeyword =
        !keyword ||
        product.name.toLowerCase().includes(keyword) ||
        product.product_code.toLowerCase().includes(keyword);
      const matchesStatus =
        statusFilter === "all" || product.status === statusFilter;

      return matchesKeyword && matchesStatus;
    });
  }, [products, searchKeyword, statusFilter]);

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedProductIds.includes(product.id)),
    [products, selectedProductIds]
  );
  const paginatedProducts = useMemo(
    () => paginateItems(filteredProducts, page),
    [filteredProducts, page]
  );
  const allFilteredSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((product) => selectedProductIds.includes(product.id));

  const loadPageData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [productData, statsData] = await Promise.all([
        getProducts(),
        getProductStats()
      ]);

      setProducts(productData);
      setStats(statsData);
      setSelectedProductIds((current) =>
        current.filter((productId) =>
          productData.some((product) => product.id === productId)
        )
      );
      setSelectedProduct((current) => {
        if (!current) {
          return null;
        }

        return productData.find((product) => product.id === current.id) ?? null;
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setProducts([]);
      setStats(initialStats);
      setSelectedProductIds([]);
      setSelectedProduct(null);
      setSelectedSkus([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchKeyword, statusFilter]);

  const refreshAll = async () => {
    const productToRefresh = selectedProduct;

    await loadPageData();

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
      await loadPageData();
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
      description: product.description ?? "",
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
      await loadPageData();
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
      await loadPageData();
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
            !filteredProducts.some((product) => product.id === productId)
        )
      );
      return;
    }

    setSelectedProductIds((current) =>
      Array.from(
        new Set([...current, ...filteredProducts.map((product) => product.id)])
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

    await loadPageData();
    setSuccessMessage(
      `产品批量导入完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条。`
    );

    return result;
  };

  const batchDeactivateProducts = async (items: ProductListRow[]) => {
    const results = await deactivateProductsByIds(items.map((item) => item.id));
    await loadPageData();
    return results;
  };

  const batchDeleteProducts = async (items: ProductListRow[]) => {
    const results = await deleteProductsByIds(items.map((item) => item.id));
    await loadPageData();
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
      await loadPageData();
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

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">基础资料</p>
          <h2>产品管理</h2>
          <p>
            管理公司产品基础资料。产品是 SKU 的上级分类，后续 SKU、BOM 和 FBA
            备货需求都会围绕产品归集。
          </p>
        </div>
        <span className="statusPill">Supabase 数据</span>
      </section>

      <section className="metricGrid">
        <div className="metric">
          <span>产品总数</span>
          <strong>{stats.totalProducts}</strong>
        </div>
        <div className="metric">
          <span>启用产品数</span>
          <strong>{stats.activeProducts}</strong>
        </div>
        <div className="metric">
          <span>停用产品数</span>
          <strong>{stats.inactiveProducts}</strong>
        </div>
        <div className="metric">
          <span>SKU 总数</span>
          <strong>{stats.totalSkus}</strong>
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
            <p className="eyebrow">新增产品</p>
            <h3>创建产品基础资料</h3>
          </div>
        </div>

        <form className="dataForm productForm" onSubmit={submitCreateProduct}>
          <label>
            产品编码
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
      </section>

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

      <section className="listPanel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">产品列表</p>
            <h3>所有产品</h3>
          </div>
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

        <div className="listToolbar productToolbar">
          <label>
            搜索产品名称 / 编码
            <input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="输入产品名称或产品编码"
            />
          </label>

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

          <button className="secondaryButton" type="button" onClick={refreshAll}>
            刷新
          </button>
        </div>

        <BulkActionBar
          selectedItems={selectedProducts}
          getItemLabel={(product) => `${product.product_code} / ${product.name}`}
          entityName="产品"
          onClearSelection={() => setSelectedProductIds([])}
          onDeactivateSelected={batchDeactivateProducts}
          onDeleteSelected={batchDeleteProducts}
        />

        {loading ? <div className="debugNotice">正在读取产品数据...</div> : null}

        {!loading && filteredProducts.length === 0 ? (
          <div className="emptyState">暂无产品</div>
        ) : null}

        {!loading && filteredProducts.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable productTable">
              <thead>
                <tr>
                  <th className="selectColumn">
                    <input
                      aria-label="全选当前页产品"
                      className="tableCheckbox"
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAllFilteredProducts}
                    />
                  </th>
                  <th>产品编码</th>
                  <th>产品名称</th>
                  <th>产品状态</th>
                  <th>关联 SKU 数量</th>
                  <th>创建时间</th>
                  <th>更新时间</th>
                  <th>备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((product) => {
                  const statusUpdating = statusUpdatingId === product.id;

                  return (
                    <tr key={product.id}>
                      <td>
                        <input
                          aria-label={`选择产品 ${product.product_code}`}
                          className="tableCheckbox"
                          type="checkbox"
                          checked={selectedProductIds.includes(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                        />
                      </td>
                      <td>{product.product_code}</td>
                      <td>{product.name}</td>
                      <td>
                        <span className={`tablePill product-status-${product.status}`}>
                          {getStatusLabel(product.status)}
                        </span>
                      </td>
                      <td>{product.sku_count}</td>
                      <td>{formatDateTime(product.created_at)}</td>
                      <td>{formatDateTime(product.updated_at)}</td>
                      <td className="notesCell">{product.description ?? "-"}</td>
                      <td>
                        <div className="rowActions">
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
                              ? "正在处理..."
                              : product.status === "active"
                                ? "停用"
                                : "启用"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openProductSkus(product)}
                            disabled={skuLoading}
                          >
                            查看 SKU
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && filteredProducts.length > 0 ? (
          <Pagination
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            total={filteredProducts.length}
            onPageChange={setPage}
          />
        ) : null}
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
        description="请按模板填写产品编码、产品名称、备注和状态。上传后会先逐行校验，确认导入后才写入 Supabase。"
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
