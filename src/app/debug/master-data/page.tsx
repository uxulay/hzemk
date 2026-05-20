"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  getMaterialSkus,
  getProducts,
  getRoles,
  getSkus,
  getSuppliers,
  getWarehouses,
  type Product,
  type Role,
  type Sku,
  type Supplier,
  type Warehouse
} from "@/lib/api/master-data";

type MasterDataState = {
  roles: Role[];
  products: Product[];
  finishedSkus: Sku[];
  materialSkus: Sku[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
};

const emptyMasterData: MasterDataState = {
  roles: [],
  products: [],
  finishedSkus: [],
  materialSkus: [],
  suppliers: [],
  warehouses: []
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "读取数据失败，请检查 Supabase 配置。";
}

export default function DebugMasterDataPage() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [masterData, setMasterData] =
    useState<MasterDataState>(emptyMasterData);

  useEffect(() => {
    let isMounted = true;

    async function loadMasterData() {
      try {
        setLoading(true);
        setErrorMessage("");

        const [
          roles,
          products,
          finishedSkus,
          materialSkus,
          suppliers,
          warehouses
        ] = await Promise.all([
          getRoles(),
          getProducts(),
          getSkus(),
          getMaterialSkus(),
          getSuppliers(),
          getWarehouses()
        ]);

        if (isMounted) {
          setMasterData({
            roles,
            products,
            finishedSkus,
            materialSkus,
            suppliers,
            warehouses
          });
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadMasterData();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="debugPage">
      <section className="debugHeader">
        <p className="eyebrow">Supabase 连接测试</p>
        <h1>基础资料读取</h1>
        <p>
          这个页面只用来确认前端能不能连接 Supabase，并读取 roles、products、skus、suppliers、warehouses
          这些基础资料。
        </p>
      </section>

      {loading ? <div className="debugNotice">正在读取 Supabase 数据...</div> : null}

      {errorMessage ? (
        <div className="debugError">
          <strong>读取失败</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      {!loading && !errorMessage ? (
        <section className="debugGrid">
          <DataSection
            title="角色列表"
            items={masterData.roles}
            renderItem={(role) => (
              <>
                <strong>{role.name}</strong>
                <span>{role.code}</span>
              </>
            )}
          />
          <DataSection
            title="产品列表"
            items={masterData.products}
            renderItem={(product) => (
              <>
                <strong>{product.name}</strong>
                <span>{product.product_code}</span>
              </>
            )}
          />
          <DataSection
            title="成品 SKU 列表"
            items={masterData.finishedSkus}
            renderItem={(sku) => (
              <>
                <strong>{sku.sku_name}</strong>
                <span>
                  {sku.sku_code} / {sku.sku_type}
                </span>
              </>
            )}
          />
          <DataSection
            title="原材料 SKU 列表"
            items={masterData.materialSkus}
            renderItem={(sku) => (
              <>
                <strong>{sku.sku_name}</strong>
                <span>
                  {sku.sku_code} / {sku.unit}
                </span>
              </>
            )}
          />
          <DataSection
            title="供应商列表"
            items={masterData.suppliers}
            renderItem={(supplier) => (
              <>
                <strong>{supplier.name}</strong>
                <span>{supplier.supplier_code}</span>
              </>
            )}
          />
          <DataSection
            title="仓库列表"
            items={masterData.warehouses}
            renderItem={(warehouse) => (
              <>
                <strong>{warehouse.name}</strong>
                <span>
                  {warehouse.warehouse_code} / {warehouse.warehouse_type}
                </span>
              </>
            )}
          />
        </section>
      ) : null}
    </main>
  );
}

function DataSection<T>({
  title,
  items,
  renderItem
}: {
  title: string;
  items: T[];
  renderItem: (item: T) => ReactNode;
}) {
  return (
    <article className="debugPanel">
      <div className="debugPanelHeader">
        <h2>{title}</h2>
        <span>{items.length} 条</span>
      </div>

      {items.length === 0 ? (
        <p className="emptyText">暂无数据</p>
      ) : (
        <ul className="debugList">
          {items.map((item, index) => (
            <li key={index}>{renderItem(item)}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
