"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  addBomItem,
  createBomHeader,
  getBomDetail,
  getBomList,
  getFinishedGoodSkus,
  getMaterialSkus,
  toggleBomStatus,
  updateBomItem,
  type BomDetail,
  type BomItemRow,
  type BomListRow,
  type BomSkuOption,
  type BomStatus
} from "@/lib/api/bom";

const bomStatusLabels: Record<BomStatus, string> = {
  active: "启用",
  inactive: "停用"
};

type BomHeaderFormState = {
  productSkuId: string;
  version: string;
  status: BomStatus;
  notes: string;
};

type BomItemFormState = {
  componentSkuId: string;
  quantityPer: string;
  lossRate: string;
  notes: string;
};

type EditingBomItem = {
  id: string;
  quantityPer: string;
  lossRate: string;
  notes: string;
};

const initialHeaderForm: BomHeaderFormState = {
  productSkuId: "",
  version: "v1",
  status: "active",
  notes: ""
};

const initialItemForm: BomItemFormState = {
  componentSkuId: "",
  quantityPer: "",
  lossRate: "0",
  notes: ""
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "操作失败，请稍后重试。";
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

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function getSkuOptionLabel(sku: BomSkuOption) {
  const productName = sku.product?.name ? ` / ${sku.product.name}` : "";

  return `${sku.sku_code} / ${sku.sku_name}${productName}`;
}

function getItemUnit(item: BomItemRow) {
  return item.component_sku?.unit ?? item.unit;
}

export default function BomPage() {
  const [boms, setBoms] = useState<BomListRow[]>([]);
  const [bomDetail, setBomDetail] = useState<BomDetail | null>(null);
  const [finishedGoodSkus, setFinishedGoodSkus] = useState<BomSkuOption[]>([]);
  const [materialSkus, setMaterialSkus] = useState<BomSkuOption[]>([]);
  const [selectedBomId, setSelectedBomId] = useState("");
  const [headerForm, setHeaderForm] =
    useState<BomHeaderFormState>(initialHeaderForm);
  const [itemForm, setItemForm] = useState<BomItemFormState>(initialItemForm);
  const [editingItem, setEditingItem] = useState<EditingBomItem | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submittingHeader, setSubmittingHeader] = useState(false);
  const [submittingItem, setSubmittingItem] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [updatingItemId, setUpdatingItemId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedActiveBom = useMemo(() => {
    if (!headerForm.productSkuId || headerForm.status !== "active") {
      return null;
    }

    return (
      boms.find(
        (bom) =>
          bom.product_sku_id === headerForm.productSkuId &&
          bom.status === "active"
      ) ?? null
    );
  }, [boms, headerForm.productSkuId, headerForm.status]);

  const duplicateMaterial = useMemo(() => {
    if (!bomDetail || !itemForm.componentSkuId) {
      return null;
    }

    return (
      bomDetail.items.find(
        (item) => item.component_sku_id === itemForm.componentSkuId
      ) ?? null
    );
  }, [bomDetail, itemForm.componentSkuId]);

  const loadBomDetail = async (bomHeaderId: string) => {
    try {
      setDetailLoading(true);
      setErrorMessage("");
      setSelectedBomId(bomHeaderId);
      setBomDetail(await getBomDetail(bomHeaderId));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setBomDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const loadPageData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [bomData, finishedGoodData, materialData] = await Promise.all([
        getBomList(),
        getFinishedGoodSkus(),
        getMaterialSkus()
      ]);

      setBoms(bomData);
      setFinishedGoodSkus(finishedGoodData);
      setMaterialSkus(materialData);

      if (selectedBomId && !bomData.some((bom) => bom.id === selectedBomId)) {
        setSelectedBomId("");
        setBomDetail(null);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setBoms([]);
      setFinishedGoodSkus([]);
      setMaterialSkus([]);
      setBomDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  const refreshCurrentDetail = async () => {
    if (selectedBomId) {
      await loadBomDetail(selectedBomId);
    }
  };

  const refreshAll = async () => {
    await loadPageData();
    await refreshCurrentDetail();
  };

  const submitHeader = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSubmittingHeader(true);
      setErrorMessage("");
      setSuccessMessage("");

      const created = await createBomHeader({
        productSkuId: headerForm.productSkuId,
        version: headerForm.version,
        status: headerForm.status,
        notes: headerForm.notes
      });

      setSuccessMessage(`BOM ${created.bom_code} 创建成功。`);
      setHeaderForm(initialHeaderForm);
      await loadPageData();
      await loadBomDetail(created.id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmittingHeader(false);
    }
  };

  const openBomDetail = async (bomHeaderId: string, openItemForm = false) => {
    setShowItemForm(openItemForm);
    setItemForm(initialItemForm);
    setEditingItem(null);
    setSuccessMessage("");
    await loadBomDetail(bomHeaderId);
  };

  const submitItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!bomDetail) {
      setErrorMessage("请先选择 BOM。");
      return;
    }

    try {
      setSubmittingItem(true);
      setErrorMessage("");
      setSuccessMessage("");

      await addBomItem({
        bomHeaderId: bomDetail.id,
        componentSkuId: itemForm.componentSkuId,
        quantityPer: Number(itemForm.quantityPer),
        lossRate: Number(itemForm.lossRate),
        notes: itemForm.notes
      });

      setSuccessMessage("BOM 原材料添加成功。");
      setItemForm(initialItemForm);
      await refreshAll();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmittingItem(false);
    }
  };

  const changeBomStatus = async (bom: BomListRow) => {
    try {
      setStatusUpdatingId(bom.id);
      setErrorMessage("");
      setSuccessMessage("");

      const nextStatus = await toggleBomStatus(bom.id, bom.status);
      setSuccessMessage(`BOM ${bom.bom_code} 已${bomStatusLabels[nextStatus]}。`);
      await refreshAll();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setStatusUpdatingId("");
    }
  };

  const startEditItem = (item: BomItemRow) => {
    setEditingItem({
      id: item.id,
      quantityPer: String(Number(item.quantity_per)),
      lossRate: String(Number(item.loss_rate)),
      notes: item.notes ?? ""
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const saveEditingItem = async () => {
    if (!editingItem) {
      return;
    }

    try {
      setUpdatingItemId(editingItem.id);
      setErrorMessage("");
      setSuccessMessage("");

      await updateBomItem({
        bomItemId: editingItem.id,
        quantityPer: Number(editingItem.quantityPer),
        lossRate: Number(editingItem.lossRate),
        notes: editingItem.notes
      });

      setSuccessMessage("BOM 明细更新成功。");
      setEditingItem(null);
      await refreshAll();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setUpdatingItemId("");
    }
  };

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">物料与采购</p>
          <h2>BOM 管理</h2>
          <p>
            管理每个成品 SKU 的 BOM 版本和原材料用量，生产任务会按启用中的 BOM 自动计算物料需求。
          </p>
        </div>
        <span className="statusPill">Supabase 数据</span>
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
            <p className="eyebrow">新增 BOM</p>
            <h3>创建成品 SKU 的 BOM 版本</h3>
          </div>
        </div>

        {selectedActiveBom ? (
          <div className="warningNotice">
            <strong>提示</strong>
            <p>
              这个成品 SKU 已经有启用 BOM：{selectedActiveBom.bom_code}。
              本次仍可新增版本，但生产任务会优先查找启用中的 BOM。
            </p>
          </div>
        ) : null}

        <form className="dataForm bomHeaderForm" onSubmit={submitHeader}>
          <label>
            成品 SKU
            <select
              value={headerForm.productSkuId}
              onChange={(event) =>
                setHeaderForm((current) => ({
                  ...current,
                  productSkuId: event.target.value
                }))
              }
              disabled={submittingHeader || loading}
              required
            >
              <option value="">请选择成品 SKU</option>
              {finishedGoodSkus.map((sku) => (
                <option key={sku.id} value={sku.id}>
                  {getSkuOptionLabel(sku)}
                </option>
              ))}
            </select>
          </label>

          <label>
            BOM 版本
            <input
              value={headerForm.version}
              onChange={(event) =>
                setHeaderForm((current) => ({
                  ...current,
                  version: event.target.value
                }))
              }
              disabled={submittingHeader}
              required
            />
          </label>

          <label>
            状态
            <select
              value={headerForm.status}
              onChange={(event) =>
                setHeaderForm((current) => ({
                  ...current,
                  status: event.target.value as BomStatus
                }))
              }
              disabled={submittingHeader}
            >
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </label>

          <label className="fullField">
            备注
            <textarea
              value={headerForm.notes}
              onChange={(event) =>
                setHeaderForm((current) => ({
                  ...current,
                  notes: event.target.value
                }))
              }
              disabled={submittingHeader}
              placeholder="可填写 BOM 说明"
            />
          </label>

          <div className="formActions">
            <button
              className="primaryButton"
              type="submit"
              disabled={submittingHeader || loading}
            >
              {submittingHeader ? "正在创建..." : "新增 BOM"}
            </button>
          </div>
        </form>
      </section>

      <section className="listPanel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">BOM 列表</p>
            <h3>所有 BOM</h3>
          </div>
          <button className="secondaryButton" type="button" onClick={refreshAll}>
            {loading ? "正在刷新..." : "刷新"}
          </button>
        </div>

        {loading ? <div className="debugNotice">正在读取 BOM 数据...</div> : null}

        {!loading && boms.length === 0 ? (
          <div className="emptyState">暂无 BOM</div>
        ) : null}

        {!loading && boms.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable bomTable">
              <thead>
                <tr>
                  <th>BOM 编号</th>
                  <th>成品 SKU 编码</th>
                  <th>成品 SKU 名称</th>
                  <th>产品名称</th>
                  <th>BOM 版本</th>
                  <th>BOM 状态</th>
                  <th>原材料数量</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {boms.map((bom) => {
                  const updating = statusUpdatingId === bom.id;

                  return (
                    <tr key={bom.id}>
                      <td>{bom.bom_code}</td>
                      <td>{bom.product_sku?.sku_code ?? "-"}</td>
                      <td>{bom.product_sku?.sku_name ?? "-"}</td>
                      <td>{bom.product_sku?.product?.name ?? "-"}</td>
                      <td>{bom.version}</td>
                      <td>
                        <span className={`tablePill bom-status-${bom.status}`}>
                          {bomStatusLabels[bom.status] ?? bom.status}
                        </span>
                      </td>
                      <td>{bom.item_count}</td>
                      <td>{formatDateTime(bom.created_at)}</td>
                      <td>
                        <div className="rowActions">
                          <button
                            type="button"
                            onClick={() => openBomDetail(bom.id)}
                            disabled={detailLoading}
                          >
                            查看明细
                          </button>
                          <button
                            type="button"
                            onClick={() => openBomDetail(bom.id, true)}
                            disabled={detailLoading}
                          >
                            添加原材料
                          </button>
                          <button
                            type="button"
                            onClick={() => changeBomStatus(bom)}
                            disabled={updating}
                          >
                            {updating
                              ? "正在处理..."
                              : bom.status === "active"
                                ? "停用"
                                : "启用"}
                          </button>
                          <button type="button" disabled>
                            编辑（预留）
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

      {detailLoading ? (
        <div className="debugNotice">正在读取 BOM 明细...</div>
      ) : null}

      {bomDetail ? (
        <section className="detailPanel">
          <div className="detailHeader">
            <div>
              <p className="eyebrow">BOM 明细</p>
              <h3>{bomDetail.bom_code}</h3>
            </div>
            <div className="rowActions">
              <button
                className="secondaryButton"
                type="button"
                onClick={() => setShowItemForm((current) => !current)}
              >
                {showItemForm ? "收起添加" : "添加原材料"}
              </button>
              <button
                className="secondaryButton"
                type="button"
                onClick={() => {
                  setBomDetail(null);
                  setSelectedBomId("");
                  setShowItemForm(false);
                  setEditingItem(null);
                }}
              >
                收起明细
              </button>
            </div>
          </div>

          <div className="detailGrid">
            <div className="detailItem">
              <span>成品 SKU</span>
              <strong>{bomDetail.product_sku?.sku_code ?? "-"}</strong>
            </div>
            <div className="detailItem">
              <span>成品名称</span>
              <strong>{bomDetail.product_sku?.sku_name ?? "-"}</strong>
            </div>
            <div className="detailItem">
              <span>BOM 状态</span>
              <strong>{bomStatusLabels[bomDetail.status] ?? bomDetail.status}</strong>
            </div>
            <div className="detailItem detailItemWide">
              <span>备注</span>
              <strong>{bomDetail.notes ?? "-"}</strong>
            </div>
          </div>

          {showItemForm ? (
            <form className="dataForm bomItemForm" onSubmit={submitItem}>
              <label>
                原材料 SKU
                <select
                  value={itemForm.componentSkuId}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      componentSkuId: event.target.value
                    }))
                  }
                  disabled={submittingItem}
                  required
                >
                  <option value="">请选择原材料 SKU</option>
                  {materialSkus.map((sku) => (
                    <option key={sku.id} value={sku.id}>
                      {sku.sku_code} / {sku.sku_name} / {sku.unit}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                单位用量
                <input
                  min="0.0001"
                  step="0.0001"
                  type="number"
                  value={itemForm.quantityPer}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      quantityPer: event.target.value
                    }))
                  }
                  disabled={submittingItem}
                  required
                />
              </label>

              <label>
                损耗率
                <input
                  min="0"
                  step="0.0001"
                  type="number"
                  value={itemForm.lossRate}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      lossRate: event.target.value
                    }))
                  }
                  disabled={submittingItem}
                  required
                />
              </label>

              <label className="fullField">
                备注
                <textarea
                  value={itemForm.notes}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      notes: event.target.value
                    }))
                  }
                  disabled={submittingItem}
                  placeholder="可填写原材料用量说明"
                />
              </label>

              {duplicateMaterial ? (
                <div className="warningNotice fullField">
                  <strong>提示</strong>
                  <p>
                    这个原材料已经在当前 BOM 明细里：{duplicateMaterial.component_sku?.sku_code ?? "-"}。
                  </p>
                </div>
              ) : null}

              <div className="formActions">
                <button
                  className="primaryButton"
                  type="submit"
                  disabled={submittingItem}
                >
                  {submittingItem ? "正在添加..." : "添加原材料"}
                </button>
              </div>
            </form>
          ) : null}

          {bomDetail.items.length === 0 ? (
            <div className="emptyState">当前 BOM 暂无原材料明细</div>
          ) : (
            <div className="tableWrap">
              <table className="dataTable bomDetailTable">
                <thead>
                  <tr>
                    <th>原材料 SKU 编码</th>
                    <th>原材料名称</th>
                    <th>单位</th>
                    <th>每生产 1 个成品需要数量</th>
                    <th>损耗率</th>
                    <th>备注</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {bomDetail.items.map((item) => {
                    const isEditing = editingItem?.id === item.id;
                    const updating = updatingItemId === item.id;

                    return (
                      <tr key={item.id}>
                        <td>{item.component_sku?.sku_code ?? "-"}</td>
                        <td>{item.component_sku?.sku_name ?? "-"}</td>
                        <td>{getItemUnit(item)}</td>
                        <td>
                          {isEditing ? (
                            <input
                              className="tableInput"
                              min="0.0001"
                              step="0.0001"
                              type="number"
                              value={editingItem.quantityPer}
                              onChange={(event) =>
                                setEditingItem((current) =>
                                  current
                                    ? {
                                        ...current,
                                        quantityPer: event.target.value
                                      }
                                    : current
                                )
                              }
                              disabled={updating}
                            />
                          ) : (
                            formatQuantity(item.quantity_per)
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              className="tableInput"
                              min="0"
                              step="0.0001"
                              type="number"
                              value={editingItem.lossRate}
                              onChange={(event) =>
                                setEditingItem((current) =>
                                  current
                                    ? {
                                        ...current,
                                        lossRate: event.target.value
                                      }
                                    : current
                                )
                              }
                              disabled={updating}
                            />
                          ) : (
                            formatPercent(item.loss_rate)
                          )}
                        </td>
                        <td className="notesCell">
                          {isEditing ? (
                            <textarea
                              className="tableTextarea"
                              value={editingItem.notes}
                              onChange={(event) =>
                                setEditingItem((current) =>
                                  current
                                    ? {
                                        ...current,
                                        notes: event.target.value
                                      }
                                    : current
                                )
                              }
                              disabled={updating}
                            />
                          ) : (
                            item.notes ?? "-"
                          )}
                        </td>
                        <td>
                          <div className="rowActions">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={saveEditingItem}
                                  disabled={updating}
                                >
                                  {updating ? "正在保存..." : "保存"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingItem(null)}
                                  disabled={updating}
                                >
                                  取消
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEditItem(item)}
                              >
                                编辑用量/损耗/备注
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
