"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import {
  getMaterialInventory,
  getProductInventory,
  getWarehousesForFilter,
  type CurrentInventoryFilters,
  type CurrentInventoryRow,
  type CurrentInventoryWarehouse,
  type InventoryStockStatus,
  type InventoryStockStatusFilter,
  type MaterialInventoryRow,
  type ProductInventoryRow
} from "@/lib/api/inventory";
import { getBrandOptions, type BrandRow } from "@/lib/api/brands";
import { getBrandCodeName } from "@/lib/brand-utils";
import { DEFAULT_PAGE_SIZE, paginateItems } from "@/lib/utils/pagination";

type CurrentInventoryPageMode = "materials" | "products";

type CurrentInventoryPageProps = {
  mode: CurrentInventoryPageMode;
  embedded?: boolean;
};

const stockStatusOptions: Array<{
  value: InventoryStockStatusFilter;
  label: string;
}> = [
  { value: "all", label: "全部库存状态" },
  { value: "out_of_stock", label: "无库存" },
  { value: "low_stock", label: "低于安全库存" },
  { value: "normal", label: "库存正常" }
];

const stockStatusLabels: Record<InventoryStockStatus, string> = {
  out_of_stock: "无库存",
  low_stock: "低于安全库存",
  normal: "库存正常"
};

const pageConfig: Record<
  CurrentInventoryPageMode,
  {
    title: string;
    description: string;
    keywordLabel: string;
    keywordPlaceholder: string;
    emptyText: string;
  }
> = {
  materials: {
    title: "原材料库存",
    description: "查看各仓库当前原材料库存、安全库存和库存状态。",
    keywordLabel: "原材料搜索",
    keywordPlaceholder: "输入原材料编码或名称",
    emptyText: "暂无原材料库存"
  },
  products: {
    title: "成品库存",
    description: "查看生产完成后留存在各仓库的当前成品库存。",
    keywordLabel: "SKU 搜索",
    keywordPlaceholder: "输入 SKU 编码或名称",
    emptyText: "暂无成品库存"
  }
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "读取当前库存失败，请稍后重试。";
}

function formatQuantity(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return Number(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 4
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function getUnit(row: CurrentInventoryRow) {
  return row.sku?.unit ?? row.unit ?? "-";
}

function getAvailableQuantity(row: CurrentInventoryRow) {
  return Number(row.quantity_on_hand) - Number(row.reserved_quantity ?? 0);
}

function getInventoryActionHref(
  row: CurrentInventoryRow,
  path: "/inventory/transactions" | "/inventory/adjustments" | "/inventory/inbound" | "/inventory/fba-outbound",
  tab?: "other"
) {
  const keyword = row.sku?.sku_code ?? row.sku?.sku_name ?? "";
  const params = new URLSearchParams();

  if (tab) {
    params.set("tab", tab);
  }

  if (keyword) {
    params.set("skuKeyword", keyword);
  }

  if (row.warehouse_id) {
    params.set("warehouseId", row.warehouse_id);
  }

  const queryString = params.toString();

  return queryString ? `${path}?${queryString}` : path;
}

function countUniqueSkus(rows: CurrentInventoryRow[]) {
  return new Set(rows.map((row) => row.sku_id)).size;
}

function getProductSkuStockCounts(rows: ProductInventoryRow[]) {
  const quantityBySku = new Map<string, number>();

  for (const row of rows) {
    quantityBySku.set(
      row.sku_id,
      (quantityBySku.get(row.sku_id) ?? 0) + Number(row.quantity_on_hand)
    );
  }

  let inStockSkuCount = 0;
  let outOfStockSkuCount = 0;

  for (const quantity of quantityBySku.values()) {
    if (quantity > 0) {
      inStockSkuCount += 1;
    } else {
      outOfStockSkuCount += 1;
    }
  }

  return {
    inStockSkuCount,
    outOfStockSkuCount
  };
}

export function CurrentInventoryPage({ mode, embedded = false }: CurrentInventoryPageProps) {
  const config = pageConfig[mode];
  const Shell = embedded ? "section" : "main";
  const [items, setItems] = useState<CurrentInventoryRow[]>([]);
  const [warehouses, setWarehouses] = useState<CurrentInventoryWarehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [brandId, setBrandId] = useState("all");
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [skuKeyword, setSkuKeyword] = useState("");
  const [stockStatus, setStockStatus] =
    useState<InventoryStockStatusFilter>("all");
  const [selectedItem, setSelectedItem] = useState<CurrentInventoryRow | null>(
    null
  );
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const summary = useMemo(() => {
    const totalQuantity = items.reduce(
      (sum, item) => sum + Number(item.quantity_on_hand),
      0
    );

    if (mode === "materials") {
      const materialItems = items as MaterialInventoryRow[];

      return {
        skuKindCount: countUniqueSkus(materialItems),
        totalQuantity,
        lowStockCount: materialItems.filter(
          (item) => item.stock_status === "low_stock"
        ).length,
        outOfStockCount: materialItems.filter(
          (item) => item.stock_status === "out_of_stock"
        ).length,
        inStockSkuCount: 0,
        outOfStockSkuCount: 0
      };
    }

    const productSkuCounts = getProductSkuStockCounts(items as ProductInventoryRow[]);

    return {
      skuKindCount: countUniqueSkus(items),
      totalQuantity,
      lowStockCount: 0,
      outOfStockCount: 0,
      inStockSkuCount: productSkuCounts.inStockSkuCount,
      outOfStockSkuCount: productSkuCounts.outOfStockSkuCount
    };
  }, [items, mode]);

  const paginatedItems = useMemo(
    () => paginateItems(items, page),
    [items, page]
  );

  const buildFilters = (
    overrides: Partial<CurrentInventoryFilters> = {}
  ): CurrentInventoryFilters => ({
    warehouseId,
    skuKeyword,
    stockStatus: mode === "materials" ? stockStatus : "all",
    brandId: mode === "products" ? brandId : "all",
    ...overrides
  });

  const loadInventory = async (
    filters: CurrentInventoryFilters = buildFilters()
  ) => {
    try {
      setLoading(true);
      setErrorMessage("");
      setPage(1);

      const [inventoryData, warehouseData, brandData] = await Promise.all([
        mode === "materials"
          ? getMaterialInventory(filters)
          : getProductInventory(filters),
        getWarehousesForFilter(),
        mode === "products" ? getBrandOptions() : Promise.resolve([])
      ]);

      setItems(inventoryData);
      setWarehouses(warehouseData);
      setBrands(brandData);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [brandId, skuKeyword, stockStatus, warehouseId]);

  const submitFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loadInventory();
  };

  const resetFilters = () => {
    const nextFilters: CurrentInventoryFilters = {
      warehouseId: "",
      skuKeyword: "",
      stockStatus: "all",
      brandId: "all"
    };

    setWarehouseId("");
    setBrandId("all");
    setSkuKeyword("");
    setStockStatus("all");
    loadInventory(nextFilters);
  };

  const refreshInventory = () => {
    loadInventory();
  };

  return (
    <Shell className={embedded ? "embeddedInventoryPage" : "pageShell"}>
      {!embedded ? (
        <section className="pageHero">
          <div>
            <p className="eyebrow">仓库管理</p>
            <h2>{config.title}</h2>
            <p>{config.description}</p>
          </div>
          <span className="statusPill">Supabase 数据</span>
        </section>
      ) : null}

      {errorMessage ? (
        <div className="debugError">
          <strong>读取失败</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <section className="metricGrid">
        {mode === "materials" ? (
          <>
            <div className="metric">
              <span>原材料种类数</span>
              <strong>{summary.skuKindCount}</strong>
            </div>
            <div className="metric">
              <span>当前库存总数量</span>
              <strong>{formatQuantity(summary.totalQuantity)}</strong>
            </div>
            <div className="metric">
              <span>低于安全库存数量</span>
              <strong>{summary.lowStockCount}</strong>
            </div>
            <div className="metric">
              <span>无库存数量</span>
              <strong>{summary.outOfStockCount}</strong>
            </div>
          </>
        ) : (
          <>
            <div className="metric">
              <span>成品 SKU 种类数</span>
              <strong>{summary.skuKindCount}</strong>
            </div>
            <div className="metric">
              <span>当前成品库存总数量</span>
              <strong>{formatQuantity(summary.totalQuantity)}</strong>
            </div>
            <div className="metric">
              <span>有库存 SKU 数量</span>
              <strong>{summary.inStockSkuCount}</strong>
            </div>
            <div className="metric">
              <span>无库存 SKU 数量</span>
              <strong>{summary.outOfStockSkuCount}</strong>
            </div>
          </>
        )}
      </section>

      <section className="listPanel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">当前库存</p>
            <h3>{config.title}</h3>
          </div>
        </div>

        <form
          className={`listToolbar currentInventoryToolbar ${
            mode === "materials"
              ? "materialInventoryToolbar"
              : "productInventoryToolbar"
          }`}
          onSubmit={submitFilters}
        >
          <label>
            仓库
            <select
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
              disabled={loading}
            >
              <option value="">全部仓库</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.warehouse_code} / {warehouse.name}
                </option>
              ))}
            </select>
          </label>

          {mode === "materials" ? (
            <label>
              库存状态
              <select
                value={stockStatus}
                onChange={(event) =>
                  setStockStatus(event.target.value as InventoryStockStatusFilter)
                }
                disabled={loading}
              >
                {stockStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {mode === "products" ? (
            <label>
              品牌
              <select
                value={brandId}
                onChange={(event) => setBrandId(event.target.value)}
                disabled={loading}
              >
                <option value="all">全部品牌</option>
                <option value="none">无品牌</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {getBrandCodeName(brand)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label>
            {config.keywordLabel}
            <input
              value={skuKeyword}
              onChange={(event) => setSkuKeyword(event.target.value)}
              placeholder={config.keywordPlaceholder}
              disabled={loading}
            />
          </label>

          <div className="rowActions">
            <button type="submit" disabled={loading}>
              {loading ? "查询中..." : "查询"}
            </button>
            <button type="button" onClick={refreshInventory} disabled={loading}>
              {loading ? "刷新中..." : "刷新"}
            </button>
            <button type="button" onClick={resetFilters} disabled={loading}>
              重置
            </button>
          </div>
        </form>

        {loading ? (
          <div className="debugNotice">正在读取{config.title}，请稍候...</div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="emptyState">{config.emptyText}</div>
        ) : null}

        {!loading && items.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable currentInventoryTable">
              <thead>
                {mode === "materials" ? (
                  <tr>
                    <th>原材料编码</th>
                    <th>原材料名称</th>
                    <th>品牌/所属产品</th>
                    <th>仓库</th>
                    <th>当前库存</th>
                    <th>可用库存</th>
                    <th>占用库存</th>
                    <th>安全库存</th>
                    <th>库存状态</th>
                    <th>操作</th>
                  </tr>
                ) : (
                  <tr>
                    <th>成品 SKU 编码</th>
                    <th>SKU 名称</th>
                    <th>产品名称</th>
                    <th>品牌</th>
                    <th>仓库</th>
                    <th>当前库存</th>
                    <th>可用库存</th>
                    <th>占用库存</th>
                    <th>操作</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {mode === "materials"
                  ? (paginatedItems as MaterialInventoryRow[]).map((item) => (
                      <tr key={item.id}>
                        <td>{item.sku?.sku_code ?? "-"}</td>
                        <td>{item.sku?.sku_name ?? "-"}</td>
                        <td>
                          <strong>{getBrandCodeName(item.sku?.product?.brand)}</strong>
                          <span>{item.sku?.product?.name ?? "-"}</span>
                        </td>
                        <td>
                          <strong>{item.warehouse?.name ?? "-"}</strong>
                          <span>{item.warehouse?.warehouse_code ?? "-"}</span>
                        </td>
                        <td className="quantityCell">
                          <strong>{formatQuantity(item.quantity_on_hand)}</strong>
                          <span>{getUnit(item)}</span>
                        </td>
                        <td className="quantityCell">
                          {formatQuantity(getAvailableQuantity(item))}
                        </td>
                        <td className="quantityCell">
                          {formatQuantity(item.reserved_quantity ?? 0)}
                        </td>
                        <td>{formatQuantity(item.safety_stock_quantity)}</td>
                        <td>
                          <span
                            className={`tablePill inventory-status-${item.stock_status}`}
                          >
                            {stockStatusLabels[item.stock_status]}
                          </span>
                        </td>
                        <td>
                          <div className="rowActions">
                            <Link
                              className="secondaryButton"
                              href={getInventoryActionHref(item, "/inventory/transactions")}
                            >
                              查看流水
                            </Link>
                            <Link
                              className="secondaryButton"
                              href={getInventoryActionHref(item, "/inventory/adjustments")}
                            >
                              库存调整
                            </Link>
                            <Link
                              className="secondaryButton"
                              href={getInventoryActionHref(item, "/inventory/inbound", "other")}
                            >
                              其他入库
                            </Link>
                            <Link
                              className="secondaryButton"
                              href={getInventoryActionHref(item, "/inventory/fba-outbound", "other")}
                            >
                              其他出库
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  : (paginatedItems as ProductInventoryRow[]).map((item) => (
                      <tr key={item.id}>
                        <td>{item.sku?.sku_code ?? "-"}</td>
                        <td>{item.sku?.sku_name ?? "-"}</td>
                        <td>{item.sku?.product?.name ?? "-"}</td>
                        <td>{getBrandCodeName(item.sku?.product?.brand)}</td>
                        <td>
                          <strong>{item.warehouse?.name ?? "-"}</strong>
                          <span>{item.warehouse?.warehouse_code ?? "-"}</span>
                        </td>
                        <td className="quantityCell">
                          <strong>{formatQuantity(item.quantity_on_hand)}</strong>
                          <span>{getUnit(item)}</span>
                        </td>
                        <td className="quantityCell">
                          {formatQuantity(getAvailableQuantity(item))}
                        </td>
                        <td className="quantityCell">
                          {formatQuantity(item.reserved_quantity ?? 0)}
                        </td>
                        <td>
                          <div className="rowActions">
                            <Link
                              className="secondaryButton"
                              href={getInventoryActionHref(item, "/inventory/transactions")}
                            >
                              查看流水
                            </Link>
                            <Link
                              className="secondaryButton"
                              href={getInventoryActionHref(item, "/inventory/adjustments")}
                            >
                              库存调整
                            </Link>
                            <Link
                              className="secondaryButton"
                              href={getInventoryActionHref(item, "/inventory/inbound", "other")}
                            >
                              其他入库
                            </Link>
                            <Link
                              className="secondaryButton"
                              href={getInventoryActionHref(item, "/inventory/fba-outbound", "other")}
                            >
                              其他出库
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && items.length > 0 ? (
          <Pagination
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            total={items.length}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      {selectedItem ? (
        <Modal
          open={Boolean(selectedItem)}
          eyebrow={mode === "materials" ? "原材料库存详情" : "成品库存详情"}
          title={`${selectedItem.sku?.sku_code ?? "-"} / ${
            selectedItem.sku?.sku_name ?? "-"
          }`}
          onClose={() => setSelectedItem(null)}
        >
          <div className="detailGrid">
            <div className="detailItem">
              <span>SKU 编码</span>
              <strong>{selectedItem.sku?.sku_code ?? "-"}</strong>
            </div>
            <div className="detailItem">
              <span>SKU 名称</span>
              <strong>{selectedItem.sku?.sku_name ?? "-"}</strong>
            </div>
            <div className="detailItem">
              <span>所属产品</span>
              <strong>{selectedItem.sku?.product?.name ?? "-"}</strong>
            </div>
            {mode === "products" ? (
              <div className="detailItem">
                <span>品牌</span>
                <strong>{getBrandCodeName(selectedItem.sku?.product?.brand)}</strong>
              </div>
            ) : null}
            <div className="detailItem">
              <span>仓库</span>
              <strong>
                {selectedItem.warehouse?.name ?? "-"} /{" "}
                {selectedItem.warehouse?.warehouse_code ?? "-"}
              </strong>
            </div>
            <div className="detailItem">
              <span>当前库存数量</span>
              <strong>{formatQuantity(selectedItem.quantity_on_hand)}</strong>
            </div>
            <div className="detailItem">
              <span>占用库存数量</span>
              <strong>{formatQuantity(selectedItem.reserved_quantity)}</strong>
            </div>
            <div className="detailItem">
              <span>安全库存</span>
              <strong>{formatQuantity(selectedItem.safety_stock_quantity)}</strong>
            </div>
            <div className="detailItem">
              <span>单位</span>
              <strong>{getUnit(selectedItem)}</strong>
            </div>
            <div className="detailItem">
              <span>最后更新时间</span>
              <strong>{formatDateTime(selectedItem.updated_at)}</strong>
            </div>
          </div>
        </Modal>
      ) : null}
    </Shell>
  );
}
