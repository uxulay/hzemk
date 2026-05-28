"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { InfoCell } from "@/components/ui/info-cell";
import { PageHeader } from "@/components/ui/PageHeader";
import { RowActions } from "@/components/ui/row-actions";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  getCurrentInventoryPage,
  getMaterialInventoryStatus,
  getWarehousesForFilter,
  type CurrentInventoryFilters,
  type CurrentInventoryRow,
  type CurrentInventorySummary,
  type CurrentInventoryWarehouse,
  type InventoryStockStatus,
  type InventoryStockStatusFilter,
  type MaterialInventoryRow,
  type ProductInventoryRow
} from "@/lib/api/inventory";
import { getBrandOptions, type BrandRow } from "@/lib/api/brands";
import { getBrandCodeName } from "@/lib/brand-utils";
import { DEFAULT_PAGE_SIZE } from "@/lib/utils/pagination";

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

const pageConfig: Record<
  CurrentInventoryPageMode,
  {
    title: string;
    keywordLabel: string;
    keywordPlaceholder: string;
    emptyText: string;
  }
> = {
  materials: {
    title: "原材料库存",
    keywordLabel: "辅料搜索",
    keywordPlaceholder: "物料名称 / 编码 / 规格",
    emptyText: "暂无原材料库存"
  },
  products: {
    title: "成品库存",
    keywordLabel: "SKU 搜索",
    keywordPlaceholder: "产品名称 / SKU / SPU",
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
  return row.material?.unit ?? row.product_sku?.unit ?? row.sku?.unit ?? row.unit ?? "-";
}

function getItemCode(row: CurrentInventoryRow) {
  return row.material?.material_code ?? row.product_sku?.sku_code ?? row.sku?.sku_code ?? "-";
}

function getItemName(row: CurrentInventoryRow) {
  return row.material?.material_name ?? row.product_sku?.sku_name ?? row.sku?.sku_name ?? "-";
}

function getAvailableQuantity(row: CurrentInventoryRow) {
  return Number(row.quantity_on_hand) - Number(row.reserved_quantity ?? 0);
}

function getStockStatusLabel(status: InventoryStockStatus) {
  if (status === "out_of_stock") {
    return "预警";
  }

  if (status === "low_stock") {
    return "偏低";
  }

  return "充足";
}

function getStockStatusBadgeType(status: InventoryStockStatus) {
  if (status === "out_of_stock") {
    return "danger" as const;
  }

  if (status === "low_stock") {
    return "warning" as const;
  }

  return "success" as const;
}

function getProductName(row: CurrentInventoryRow) {
  return row.product_sku?.product?.name ?? row.sku?.product?.name ?? "-";
}

function getProductImageUrl(row: CurrentInventoryRow) {
  return (
    row.product_sku?.product?.product_image_url ??
    row.sku?.product?.product_image_url ??
    null
  );
}

function escapeCsvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
}

function getInventoryActionHref(
  row: CurrentInventoryRow,
  path: "/inventory/transactions" | "/inventory/adjustments" | "/inventory/inbound" | "/inventory/fba-outbound",
  tab?: "other"
) {
  const keyword = getItemCode(row) !== "-" ? getItemCode(row) : getItemName(row);
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

const emptySummary: CurrentInventorySummary = {
  skuKindCount: 0,
  totalQuantity: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
  inStockSkuCount: 0,
  outOfStockSkuCount: 0
};

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
  const [total, setTotal] = useState(0);
  const [summary, setSummary] =
    useState<CurrentInventorySummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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
    filters: CurrentInventoryFilters = buildFilters(),
    targetPage = 1
  ) => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [inventoryPage, warehouseData, brandData] = await Promise.all([
        getCurrentInventoryPage({
          mode,
          page: targetPage,
          pageSize: DEFAULT_PAGE_SIZE,
          filters
        }),
        getWarehousesForFilter(),
        mode === "products" ? getBrandOptions() : Promise.resolve([])
      ]);

      setItems(inventoryPage.rows);
      setTotal(inventoryPage.total);
      setSummary(inventoryPage.summary);
      setPage(inventoryPage.page);
      setWarehouses(warehouseData);
      setBrands(brandData);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setItems([]);
      setTotal(0);
      setSummary(emptySummary);
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
    loadInventory(buildFilters(), 1);
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
    loadInventory(nextFilters, 1);
  };

  const refreshInventory = () => {
    loadInventory(buildFilters(), page);
  };

  const exportCurrentRows = () => {
    const headers =
      mode === "materials"
        ? [
            "物料编码",
            "物料名称",
            "规格",
            "仓库",
            "当前库存",
            "可用库存",
            "安全库存",
            "安全状态",
            "最近变动"
          ]
        : [
            "SKU",
            "产品名称",
            "规格",
            "仓库",
            "当前库存",
            "可用库存",
            "安全库存",
            "安全状态",
            "最近变动"
          ];
    const rows = items.map((item) => {
      const status =
        mode === "materials"
          ? getStockStatusLabel((item as MaterialInventoryRow).stock_status)
          : "按需查看";

      return [
        getItemCode(item),
        mode === "materials" ? getItemName(item) : getProductName(item),
        mode === "materials" ? item.material?.specs ?? "" : getItemName(item),
        item.warehouse?.name ?? "",
        Number(item.quantity_on_hand),
        getAvailableQuantity(item),
        Number(item.safety_stock_quantity ?? 0),
        status,
        formatDateTime(item.updated_at)
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${config.title}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const inventoryColumns: DataTableColumn<CurrentInventoryRow>[] =
    mode === "materials"
      ? [
          {
            key: "material",
            title: "物料信息",
            width: 230,
            render: (item) => (
              <InfoCell
                title={getItemName(item)}
                subtitle={`${getItemCode(item)} / ${item.material?.specs ?? "无规格"}`}
              />
            )
          },
          {
            key: "warehouse",
            title: "仓库",
            width: 160,
            render: (item) => (
              <InfoCell
                title={item.warehouse?.name ?? "-"}
                subtitle={item.warehouse?.warehouse_code ?? "-"}
              />
            )
          },
          {
            key: "quantity_on_hand",
            title: "当前库存",
            width: 110,
            align: "right",
            render: (item) => `${formatQuantity(item.quantity_on_hand)} ${getUnit(item)}`
          },
          {
            key: "available",
            title: "可用库存",
            width: 110,
            align: "right",
            render: (item) => formatQuantity(getAvailableQuantity(item))
          },
          {
            key: "safety",
            title: "安全库存",
            width: 110,
            align: "right",
            render: (item) => formatQuantity(item.safety_stock_quantity)
          },
          {
            key: "stock_status",
            title: "安全状态",
            width: 120,
            render: (item) => {
              const status = (item as MaterialInventoryRow).stock_status;
              const current = Number(item.quantity_on_hand);
              const safety = Number(item.safety_stock_quantity ?? 0);
              const percent = safety > 0 ? Math.min(100, (current / safety) * 100) : 100;

              return (
                <div className="stockStatusCell">
                  <StatusBadge
                    status={status}
                    label={getStockStatusLabel(status)}
                    type={getStockStatusBadgeType(status)}
                  />
                  <span className="stockSafetyBar">
                    <i style={{ width: `${percent}%` }} />
                  </span>
                </div>
              );
            }
          },
          {
            key: "updated_at",
            title: "最近变动",
            width: 150,
            render: (item) => formatDateTime(item.updated_at)
          },
          {
            key: "actions",
            title: "操作",
            width: 150,
            render: (item) => (
              <RowActions
                onView={() => setSelectedItem(item)}
                editLabel="调整"
                onEdit={() => {
                  window.location.href = getInventoryActionHref(
                    item,
                    "/inventory/adjustments"
                  );
                }}
              />
            )
          }
        ]
      : [
          {
            key: "product",
            title: "产品信息",
            width: 260,
            render: (item) => (
              <InfoCell
                imageUrl={getProductImageUrl(item)}
                imageAlt={getProductName(item)}
                title={getItemCode(item)}
                subtitle={`${getProductName(item)} / ${getItemName(item)}`}
              />
            )
          },
          {
            key: "warehouse",
            title: "仓库",
            width: 160,
            render: (item) => (
              <InfoCell
                title={item.warehouse?.name ?? "-"}
                subtitle={item.warehouse?.warehouse_code ?? "-"}
              />
            )
          },
          {
            key: "quantity_on_hand",
            title: "当前库存",
            width: 110,
            align: "right",
            render: (item) => `${formatQuantity(item.quantity_on_hand)} ${getUnit(item)}`
          },
          {
            key: "available",
            title: "可用库存",
            width: 110,
            align: "right",
            render: (item) => formatQuantity(getAvailableQuantity(item))
          },
          {
            key: "safety",
            title: "安全库存",
            width: 110,
            align: "right",
            render: (item) => formatQuantity(item.safety_stock_quantity)
          },
          {
            key: "stock_status",
            title: "安全状态",
            width: 120,
            render: (item) => {
              const status = getMaterialInventoryStatus(item);

              return (
                <StatusBadge
                  status={status}
                  label={getStockStatusLabel(status)}
                  type={getStockStatusBadgeType(status)}
                />
              );
            }
          },
          {
            key: "updated_at",
            title: "最近变动",
            width: 150,
            render: (item) => formatDateTime(item.updated_at)
          },
          {
            key: "actions",
            title: "操作",
            width: 150,
            render: (item) => (
              <RowActions
                onView={() => setSelectedItem(item)}
                editLabel="调整"
                onEdit={() => {
                  window.location.href = getInventoryActionHref(
                    item,
                    "/inventory/adjustments"
                  );
                }}
              />
            )
          }
        ];

  return (
    <Shell className={embedded ? "embeddedInventoryPage" : "pageShell"}>
      {!embedded ? (
        <PageHeader
          title={config.title}
          secondaryActions={
            <button
              type="button"
              onClick={exportCurrentRows}
              disabled={loading || items.length === 0}
            >
              导出
            </button>
          }
          primaryAction={
            <Link className="primaryButton" href="/inventory/adjustments">
              库存调整
            </Link>
          }
        />
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

        <form onSubmit={submitFilters}>
          <SearchFilterBar
            searchLabel={config.keywordLabel}
            searchValue={skuKeyword}
            searchPlaceholder={config.keywordPlaceholder}
            onSearchChange={setSkuKeyword}
            onReset={resetFilters}
            filters={
              <>
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

                <label>
                  安全状态
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

                {mode === "materials" ? (
                  <label>
                    物料分类
                    <select disabled>
                      <option>全部分类</option>
                    </select>
                  </label>
                ) : (
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
                )}
              </>
            }
            rightActions={
              <>
                <button type="submit" disabled={loading}>
                  {loading ? "查询中..." : "查询"}
                </button>
                <button type="button" onClick={refreshInventory} disabled={loading}>
                  {loading ? "刷新中..." : "刷新"}
                </button>
              </>
            }
          />
        </form>

        <DataTable
          columns={inventoryColumns}
          rows={items}
          getRowKey={(item) => item.id}
          loading={loading}
          loadingText={`正在读取${config.title}，请稍候...`}
          emptyText={config.emptyText}
          minWidth={1020}
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          total={total}
          onPageChange={(nextPage) => loadInventory(buildFilters(), nextPage)}
        />
      </section>

      {selectedItem ? (
        <DetailDrawer
          open={Boolean(selectedItem)}
          title={`${getItemCode(selectedItem)} / ${getItemName(selectedItem)}`}
          width="lg"
          onClose={() => setSelectedItem(null)}
          footer={
            <>
              <button type="button" onClick={() => setSelectedItem(null)}>
                关闭
              </button>
              <Link
                className="secondaryButton"
                href={getInventoryActionHref(selectedItem, "/inventory/transactions")}
              >
                查看流水
              </Link>
              <Link
                className="primaryButton"
                href={getInventoryActionHref(selectedItem, "/inventory/adjustments")}
              >
                库存调整
              </Link>
            </>
          }
        >
          <div className="detailGrid">
            <div className="detailItem">
              <span>{mode === "materials" ? "辅料编码" : "SKU 编码"}</span>
              <strong>{getItemCode(selectedItem)}</strong>
            </div>
            <div className="detailItem">
              <span>{mode === "materials" ? "辅料名称" : "SKU 名称"}</span>
              <strong>{getItemName(selectedItem)}</strong>
            </div>
            <div className="detailItem">
              <span>{mode === "materials" ? "规格" : "所属产品"}</span>
              <strong>
                {mode === "materials"
                  ? selectedItem.material?.specs ?? "-"
                  : selectedItem.product_sku?.product?.name ??
                    selectedItem.sku?.product?.name ??
                    "-"}
              </strong>
            </div>
            {mode === "products" ? (
              <div className="detailItem">
                <span>品牌</span>
                <strong>
                  {getBrandCodeName(
                    selectedItem.product_sku?.product?.brand ??
                      selectedItem.sku?.product?.brand
                  )}
                </strong>
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
        </DetailDrawer>
      ) : null}
    </Shell>
  );
}
