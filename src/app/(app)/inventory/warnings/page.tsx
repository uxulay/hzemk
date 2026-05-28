"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { InfoCell } from "@/components/ui/info-cell";
import { PageHeader } from "@/components/ui/PageHeader";
import { RowActions } from "@/components/ui/row-actions";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  getMaterialInventoryStatus,
  getMaterialInventory,
  getProductInventory,
  getWarehousesForFilter,
  type CurrentInventoryRow,
  type CurrentInventoryWarehouse,
  type InventoryStockStatusFilter
} from "@/lib/api/inventory";

type WarningType = "all" | "materials" | "products";

function formatQuantity(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return Number(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 4
  });
}

function getItemCode(row: CurrentInventoryRow) {
  return row.material?.material_code ?? row.product_sku?.sku_code ?? row.sku?.sku_code ?? "-";
}

function getItemName(row: CurrentInventoryRow) {
  return row.material?.material_name ?? row.product_sku?.sku_name ?? row.sku?.sku_name ?? "-";
}

function getUnit(row: CurrentInventoryRow) {
  return row.material?.unit ?? row.product_sku?.unit ?? row.sku?.unit ?? row.unit ?? "";
}

function getGap(row: CurrentInventoryRow) {
  return Math.max(0, Number(row.safety_stock_quantity ?? 0) - Number(row.quantity_on_hand));
}

function getWarningLevel(row: CurrentInventoryRow) {
  const status = getMaterialInventoryStatus(row);

  if (status === "out_of_stock") {
    return { label: "预警", type: "danger" as const };
  }

  if (status === "low_stock") {
    return { label: "偏低", type: "warning" as const };
  }

  return { label: "充足", type: "success" as const };
}

export default function InventoryWarningsPage() {
  const [rows, setRows] = useState<CurrentInventoryRow[]>([]);
  const [warehouses, setWarehouses] = useState<CurrentInventoryWarehouse[]>([]);
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<WarningType>("all");
  const [level, setLevel] = useState<InventoryStockStatusFilter>("low_stock");
  const [warehouseId, setWarehouseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesKeyword =
        !normalizedKeyword ||
        [getItemCode(row), getItemName(row), row.material?.specs ?? ""]
          .join(" / ")
          .toLowerCase()
          .includes(normalizedKeyword);
      const matchesType =
        type === "all" ||
        (type === "materials" && Boolean(row.material_id)) ||
        (type === "products" && Boolean(row.product_sku_id || row.sku_id));
      const matchesLevel =
        level === "all" || getMaterialInventoryStatus(row) === level;
      const matchesWarehouse = !warehouseId || row.warehouse_id === warehouseId;

      return matchesKeyword && matchesType && matchesLevel && matchesWarehouse;
    });
  }, [keyword, level, rows, type, warehouseId]);

  const loadWarnings = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [materialRows, productRows, warehouseData] = await Promise.all([
        getMaterialInventory({ stockStatus: "low_stock" }),
        getProductInventory(),
        getWarehousesForFilter()
      ]);
      const warningProductRows = productRows.filter(
        (row) => getMaterialInventoryStatus(row) !== "normal"
      );

      setRows([...materialRows, ...warningProductRows]);
      setWarehouses(warehouseData);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取库存预警失败。");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWarnings();
  }, []);

  const columns: DataTableColumn<CurrentInventoryRow>[] = [
    {
      key: "item",
      title: "物料/产品信息",
      width: 260,
      render: (row) => (
        <InfoCell
          title={getItemName(row)}
          subtitle={`${getItemCode(row)} / ${row.material?.specs ?? row.product_sku?.product?.name ?? "-"}`}
        />
      )
    },
    {
      key: "type",
      title: "类型",
      width: 90,
      render: (row) => (row.material_id ? "原材料" : "成品")
    },
    {
      key: "warehouse",
      title: "仓库",
      width: 160,
      render: (row) => row.warehouse?.name ?? "-"
    },
    {
      key: "quantity",
      title: "当前库存",
      width: 110,
      align: "right",
      render: (row) => `${formatQuantity(row.quantity_on_hand)} ${getUnit(row)}`
    },
    {
      key: "safety",
      title: "安全库存",
      width: 110,
      align: "right",
      render: (row) => formatQuantity(row.safety_stock_quantity)
    },
    {
      key: "gap",
      title: "缺口",
      width: 100,
      align: "right",
      render: (row) => formatQuantity(getGap(row))
    },
    {
      key: "level",
      title: "预警级别",
      width: 110,
      render: (row) => {
        const warning = getWarningLevel(row);

        return <StatusBadge status="warning" label={warning.label} type={warning.type} />;
      }
    },
    {
      key: "actions",
      title: "操作",
      width: 170,
      render: (row) => (
        <RowActions
          onView={() => {
            window.location.href = `/inventory/transactions?skuKeyword=${encodeURIComponent(
              getItemCode(row)
            )}&warehouseId=${row.warehouse_id}`;
          }}
          editLabel="调整"
          onEdit={() => {
            window.location.href = `/inventory/adjustments?skuKeyword=${encodeURIComponent(
              getItemCode(row)
            )}&warehouseId=${row.warehouse_id}`;
          }}
          moreActions={[
            {
              label: "创建采购单",
              onClick: () => {
                window.location.href = "/purchase/orders";
              },
              disabled: !row.material_id
            }
          ]}
        />
      )
    }
  ];

  return (
    <main className="pageShell">
      <PageHeader
        title="库存预警"
        secondaryActions={<button type="button" disabled={loading}>导出</button>}
        primaryAction={
          <Link className="primaryButton" href="/purchase/orders">
            生成采购建议
          </Link>
        }
      />

      {errorMessage ? (
        <div className="debugError">
          <strong>读取失败</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <section className="listPanel">
        <SearchFilterBar
          searchLabel="搜索"
          searchValue={keyword}
          searchPlaceholder="物料 / 产品 / SKU"
          onSearchChange={setKeyword}
          onReset={() => {
            setKeyword("");
            setType("all");
            setLevel("low_stock");
            setWarehouseId("");
          }}
          filters={
            <>
              <label>
                类型
                <select value={type} onChange={(event) => setType(event.target.value as WarningType)}>
                  <option value="all">全部类型</option>
                  <option value="materials">原材料</option>
                  <option value="products">成品</option>
                </select>
              </label>
              <label>
                预警级别
                <select
                  value={level}
                  onChange={(event) => setLevel(event.target.value as InventoryStockStatusFilter)}
                >
                  <option value="all">全部</option>
                  <option value="out_of_stock">预警</option>
                  <option value="low_stock">偏低</option>
                </select>
              </label>
              <label>
                仓库
                <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
                  <option value="">全部仓库</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.warehouse_code} / {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          }
        />

        <DataTable
          columns={columns}
          rows={filteredRows}
          getRowKey={(row) => row.id}
          loading={loading}
          emptyText="暂无库存预警"
          minWidth={1040}
        />
      </section>
    </main>
  );
}
