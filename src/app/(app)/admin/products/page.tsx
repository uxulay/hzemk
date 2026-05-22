"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  const [loading, setLoading] = useState(true);
  const [skuLoading, setSkuLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
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
      setSelectedProduct(null);
      setSelectedSkus([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

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
        <section className="formPanel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">编辑产品</p>
              <h3>{editForm.productCode}</h3>
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
        </section>
      ) : null}

      <section className="listPanel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">产品列表</p>
            <h3>所有产品</h3>
          </div>
          <button className="secondaryButton" type="button" onClick={refreshAll}>
            {loading ? "正在刷新..." : "刷新列表"}
          </button>
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

        {loading ? <div className="debugNotice">正在读取产品数据...</div> : null}

        {!loading && filteredProducts.length === 0 ? (
          <div className="emptyState">暂无产品</div>
        ) : null}

        {!loading && filteredProducts.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable productTable">
              <thead>
                <tr>
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
                {filteredProducts.map((product) => {
                  const statusUpdating = statusUpdatingId === product.id;

                  return (
                    <tr key={product.id}>
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

      {skuLoading ? (
        <div className="debugNotice">正在读取关联 SKU...</div>
      ) : null}

      {selectedProduct ? (
        <section className="detailPanel">
          <div className="detailHeader">
            <div>
              <p className="eyebrow">关联 SKU</p>
              <h3>
                {selectedProduct.product_code} / {selectedProduct.name}
              </h3>
            </div>
            <button
              className="secondaryButton"
              type="button"
              onClick={() => {
                setSelectedProduct(null);
                setSelectedSkus([]);
              }}
            >
              收起 SKU
            </button>
          </div>

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
        </section>
      ) : null}
    </main>
  );
}
