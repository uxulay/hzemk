"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getProducts,
  getSkus,
  getWarehouses,
  type Product,
  type Sku,
  type Warehouse
} from "@/lib/api/master-data";
import { createFbaReplenishmentRequest } from "@/lib/api/replenishment";
import { FbaReplenishmentBulkImportPanel } from "./fba-replenishment-bulk-import-panel";

type FormState = {
  productId: string;
  skuId: string;
  amazonSite: string;
  targetWarehouseId: string;
  fbaWarehouseCode: string;
  requestedQuantity: string;
  targetShipDate: string;
  priority: string;
  notes: string;
};

type CreateMode = "single" | "bulk";

const initialFormState: FormState = {
  productId: "",
  skuId: "",
  amazonSite: "US",
  targetWarehouseId: "",
  fbaWarehouseCode: "",
  requestedQuantity: "",
  targetShipDate: "",
  priority: "normal",
  notes: ""
};

const amazonSites = [
  { value: "US", label: "美国站 US" },
  { value: "CA", label: "加拿大站 CA" },
  { value: "MX", label: "墨西哥站 MX" },
  { value: "UK", label: "英国站 UK" },
  { value: "DE", label: "德国站 DE" },
  { value: "FR", label: "法国站 FR" },
  { value: "IT", label: "意大利站 IT" },
  { value: "ES", label: "西班牙站 ES" },
  { value: "JP", label: "日本站 JP" }
];

const priorities = [
  { value: "low", label: "低" },
  { value: "normal", label: "普通" },
  { value: "high", label: "高" },
  { value: "urgent", label: "紧急" }
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "操作失败，请稍后重试。";
}

function sortWarehouses(warehouses: Warehouse[]) {
  const priority: Record<string, number> = {
    fba: 1,
    finished_product: 2,
    finished_good: 2,
    internal: 3,
    semi_finished: 4,
    material: 5
  };

  return [...warehouses].sort((a, b) => {
    const aPriority = priority[a.warehouse_type] ?? 99;
    const bPriority = priority[b.warehouse_type] ?? 99;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    return a.warehouse_code.localeCompare(b.warehouse_code);
  });
}

export default function NewReplenishmentPage() {
  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">创建入口已调整</p>
          <h2>请前往 FBA 备货需求页面创建备货单</h2>
          <p>
            新流程是在 FBA 备货需求列表右上角点击“+ 创建备货单”，一次创建包含多个产品和多个 SKU 明细的整张备货单。
          </p>
        </div>
        <Link className="primaryButton successButton" href="/replenishment">
          前往 FBA 备货需求
        </Link>
      </section>
    </main>
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [activeTab, setActiveTab] = useState<CreateMode>("single");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadOptions() {
      try {
        setLoadingOptions(true);
        setErrorMessage("");

        const [productsData, skusData, warehousesData] = await Promise.all([
          getProducts(),
          getSkus(),
          getWarehouses()
        ]);

        if (isMounted) {
          setProducts(productsData);
          setSkus(skusData);
          setWarehouses(sortWarehouses(warehousesData));
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setLoadingOptions(false);
        }
      }
    }

    loadOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredSkus = useMemo(() => {
    if (!form.productId) {
      return skus;
    }

    return skus.filter((sku) => sku.product_id === form.productId);
  }, [form.productId, skus]);

  const updateForm = (field: keyof FormState, value: string) => {
    setForm((current) => {
      if (field === "productId") {
        return {
          ...current,
          productId: value,
          skuId: ""
        };
      }

      return {
        ...current,
        [field]: value
      };
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const validateForm = () => {
    if (!form.productId) {
      return "请选择产品。";
    }

    if (!form.skuId) {
      return "请选择成品 SKU。";
    }

    if (!form.amazonSite) {
      return "请选择亚马逊站点。";
    }

    if (!form.targetWarehouseId) {
      return "请选择目标 FBA 仓库。";
    }

    const quantity = Number(form.requestedQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return "备货数量必须大于 0。";
    }

    if (!form.targetShipDate) {
      return "请选择期望完成日期。";
    }

    if (!form.priority) {
      return "请选择优先级。";
    }

    return "";
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationMessage = validateForm();
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const created = await createFbaReplenishmentRequest({
        skuId: form.skuId,
        targetWarehouseId: form.targetWarehouseId,
        fbaWarehouseCode: form.fbaWarehouseCode,
        requestedQuantity: Number(form.requestedQuantity),
        targetShipDate: form.targetShipDate,
        priority: form.priority,
        amazonSite: form.amazonSite,
        notes: form.notes
      });

      setSuccessMessage(`创建成功：${created.request_no}`);
      setForm(initialFormState);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">运营创建</p>
          <h2>创建 FBA 备货需求</h2>
          <p>
            这里创建的是内部备货生产需求，不是客户订单，也不是销售订单。
            提交后状态会进入已提交，等待厂长接收并排产。
          </p>
        </div>
        <span className="statusPill">Supabase 数据</span>
      </section>

      <section className="formPanel">
        <div className="tabBar" role="tablist" aria-label="创建方式">
          <button
            className={activeTab === "single" ? "tabButton active" : "tabButton"}
            type="button"
            role="tab"
            aria-selected={activeTab === "single"}
            onClick={() => setActiveTab("single")}
          >
            单条创建
          </button>
          <button
            className={activeTab === "bulk" ? "tabButton active" : "tabButton"}
            type="button"
            role="tab"
            aria-selected={activeTab === "bulk"}
            onClick={() => setActiveTab("bulk")}
          >
            批量导入
          </button>
        </div>

        {activeTab === "single" ? (
          <>
            {loadingOptions ? (
              <div className="debugNotice">正在读取产品、SKU 和仓库数据...</div>
            ) : null}

            {errorMessage ? (
              <div className="debugError">
                <strong>操作失败</strong>
                <p>{errorMessage}</p>
              </div>
            ) : null}

            {successMessage ? (
              <div className="successNotice">
                <strong>提交成功</strong>
                <p>{successMessage}</p>
              </div>
            ) : null}

            <form className="dataForm" onSubmit={handleSubmit}>
              <label>
                产品
                <select
                  value={form.productId}
                  onChange={(event) =>
                    updateForm("productId", event.target.value)
                  }
                  disabled={loadingOptions || submitting}
                >
                  <option value="">请选择产品</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} / {product.product_code}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                成品 SKU
                <select
                  value={form.skuId}
                  onChange={(event) => updateForm("skuId", event.target.value)}
                  disabled={loadingOptions || submitting || !form.productId}
                >
                  <option value="">
                    {form.productId ? "请选择成品 SKU" : "请先选择产品"}
                  </option>
                  {filteredSkus.map((sku) => (
                    <option key={sku.id} value={sku.id}>
                      {sku.sku_name} / {sku.sku_code}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                亚马逊站点
                <select
                  value={form.amazonSite}
                  onChange={(event) =>
                    updateForm("amazonSite", event.target.value)
                  }
                  disabled={submitting}
                >
                  {amazonSites.map((site) => (
                    <option key={site.value} value={site.value}>
                      {site.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                目标 FBA 仓库
                <select
                  value={form.targetWarehouseId}
                  onChange={(event) =>
                    updateForm("targetWarehouseId", event.target.value)
                  }
                  disabled={loadingOptions || submitting}
                >
                  <option value="">请选择目标仓库</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} / {warehouse.warehouse_type}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                FBA 仓库代码
                <input
                  value={form.fbaWarehouseCode}
                  onChange={(event) =>
                    updateForm("fbaWarehouseCode", event.target.value)
                  }
                  placeholder="例如 ONT8、LAX9"
                  disabled={submitting}
                />
              </label>

              <label>
                备货数量
                <input
                  min="1"
                  step="1"
                  type="number"
                  value={form.requestedQuantity}
                  onChange={(event) =>
                    updateForm("requestedQuantity", event.target.value)
                  }
                  placeholder="请输入大于 0 的数量"
                  disabled={submitting}
                />
              </label>

              <label>
                期望完成日期
                <input
                  type="date"
                  value={form.targetShipDate}
                  onChange={(event) =>
                    updateForm("targetShipDate", event.target.value)
                  }
                  disabled={submitting}
                />
              </label>

              <label>
                优先级
                <select
                  value={form.priority}
                  onChange={(event) =>
                    updateForm("priority", event.target.value)
                  }
                  disabled={submitting}
                >
                  {priorities.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="fullField">
                备注
                <textarea
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  placeholder="例如：根据 30 天销量和当前 FBA 库存，需要安排补货。"
                  disabled={submitting}
                />
              </label>

              <div className="formActions">
                <button
                  className="primaryButton successButton"
                  type="submit"
                  disabled={loadingOptions || submitting}
                >
                  {submitting ? "正在提交..." : "提交 FBA 备货需求"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <FbaReplenishmentBulkImportPanel />
        )}
      </section>
    </main>
  );
}
