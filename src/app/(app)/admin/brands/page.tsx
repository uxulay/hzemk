"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BulkActionBar } from "@/components/BulkActionBar";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImageCell } from "@/components/ImageCell";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import {
  bulkImportBrands,
  deactivateBrandsByIds,
  deleteBrandsByIds,
  validateBrandImportRows,
  type BrandImportInput
} from "@/lib/api/bulk-management";
import {
  createBrand,
  getBrandStats,
  getBrands,
  toggleBrandStatus,
  updateBrand,
  type BrandListRow,
  type BrandStats,
  type BrandStatus
} from "@/lib/api/brands";
import { downloadCsvTemplate, type CsvTemplateField } from "@/lib/utils/csv";
import { DEFAULT_PAGE_SIZE, paginateItems } from "@/lib/utils/pagination";

const brandStatusLabels: Record<string, string> = {
  active: "启用",
  inactive: "停用"
};

type BrandFormState = {
  brandCode: string;
  name: string;
  englishName: string;
  logoUrl: string;
  status: BrandStatus;
  notes: string;
};

type BrandEditFormState = Omit<BrandFormState, "brandCode"> & {
  brandId: string;
  brandCode: string;
};

const initialBrandForm: BrandFormState = {
  brandCode: "",
  name: "",
  englishName: "",
  logoUrl: "",
  status: "active",
  notes: ""
};

const initialStats: BrandStats = {
  totalBrands: 0,
  activeBrands: 0,
  inactiveBrands: 0,
  totalLinkedProducts: 0
};

const brandImportFields: CsvTemplateField[] = [
  {
    key: "brand_code",
    label: "品牌编码",
    required: true,
    example: "BRAND-A"
  },
  {
    key: "name",
    label: "品牌名称",
    required: true,
    example: "品牌 A"
  },
  {
    key: "english_name",
    label: "英文名称",
    example: "Brand A"
  },
  {
    key: "logo_url",
    label: "Logo URL",
    example: "https://example.com/logo.png"
  },
  {
    key: "status",
    label: "状态",
    example: "active"
  },
  {
    key: "notes",
    label: "备注",
    example: "品牌说明"
  }
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "操作失败，请稍后重试。";
}

function getStatusLabel(status: string) {
  return brandStatusLabels[status] ?? status;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function toEditableStatus(status: string): BrandStatus {
  return status === "inactive" ? "inactive" : "active";
}

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<BrandListRow[]>([]);
  const [stats, setStats] = useState<BrandStats>(initialStats);
  const [brandForm, setBrandForm] = useState<BrandFormState>(initialBrandForm);
  const [editForm, setEditForm] = useState<BrandEditFormState | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<BrandListRow | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [brandToDelete, setBrandToDelete] = useState<BrandListRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [deletingBrandId, setDeletingBrandId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const filteredBrands = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return brands.filter((brand) => {
      const matchesKeyword =
        !keyword ||
        brand.brand_code.toLowerCase().includes(keyword) ||
        brand.name.toLowerCase().includes(keyword) ||
        (brand.english_name ?? "").toLowerCase().includes(keyword);
      const matchesStatus =
        statusFilter === "all" || brand.status === statusFilter;

      return matchesKeyword && matchesStatus;
    });
  }, [brands, searchKeyword, statusFilter]);

  const selectedBrands = useMemo(
    () => brands.filter((brand) => selectedBrandIds.includes(brand.id)),
    [brands, selectedBrandIds]
  );
  const paginatedBrands = useMemo(
    () => paginateItems(filteredBrands, page),
    [filteredBrands, page]
  );
  const allFilteredSelected =
    filteredBrands.length > 0 &&
    filteredBrands.every((brand) => selectedBrandIds.includes(brand.id));

  const loadPageData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [brandData, statsData] = await Promise.all([
        getBrands(),
        getBrandStats()
      ]);

      setBrands(brandData);
      setStats(statsData);
      setSelectedBrandIds((current) =>
        current.filter((brandId) => brandData.some((brand) => brand.id === brandId))
      );
      setSelectedBrand((current) => {
        if (!current) {
          return null;
        }

        return brandData.find((brand) => brand.id === current.id) ?? null;
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setBrands([]);
      setStats(initialStats);
      setSelectedBrandIds([]);
      setSelectedBrand(null);
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
    await loadPageData();
  };

  const submitCreateBrand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setCreating(true);
      setErrorMessage("");
      setSuccessMessage("");

      const created = await createBrand(brandForm);

      setSuccessMessage(`品牌 ${created.brand_code} 新增成功。`);
      setBrandForm(initialBrandForm);
      setCreateOpen(false);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const startEditBrand = (brand: BrandListRow) => {
    setEditForm({
      brandId: brand.id,
      brandCode: brand.brand_code,
      name: brand.name,
      englishName: brand.english_name ?? "",
      logoUrl: brand.logo_url ?? "",
      status: toEditableStatus(brand.status),
      notes: brand.notes ?? ""
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const submitEditBrand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editForm) {
      return;
    }

    try {
      setUpdating(true);
      setErrorMessage("");
      setSuccessMessage("");

      await updateBrand(editForm);
      setSuccessMessage(`品牌 ${editForm.brandCode} 编辑成功。`);
      setEditForm(null);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setUpdating(false);
    }
  };

  const changeBrandStatus = async (brand: BrandListRow) => {
    try {
      setStatusUpdatingId(brand.id);
      setErrorMessage("");
      setSuccessMessage("");

      const nextStatus = await toggleBrandStatus(brand.id, brand.status);
      setSuccessMessage(`品牌 ${brand.brand_code} 已${getStatusLabel(nextStatus)}。`);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setStatusUpdatingId("");
    }
  };

  const toggleBrandSelection = (brandId: string) => {
    setSelectedBrandIds((current) =>
      current.includes(brandId)
        ? current.filter((id) => id !== brandId)
        : [...current, brandId]
    );
  };

  const toggleAllFilteredBrands = () => {
    if (allFilteredSelected) {
      setSelectedBrandIds((current) =>
        current.filter((brandId) => !filteredBrands.some((brand) => brand.id === brandId))
      );
      return;
    }

    setSelectedBrandIds((current) =>
      Array.from(new Set([...current, ...filteredBrands.map((brand) => brand.id)]))
    );
  };

  const importBrands = async (rows: Array<{ data?: BrandImportInput }>) => {
    const result = await bulkImportBrands(
      rows
        .map((row) => row.data)
        .filter((row): row is BrandImportInput => Boolean(row))
    );

    await loadPageData();
    setSuccessMessage(
      `品牌批量导入完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条。`
    );

    return result;
  };

  const batchDeactivateBrands = async (items: BrandListRow[]) => {
    const results = await deactivateBrandsByIds(items.map((item) => item.id));
    await loadPageData();
    return results;
  };

  const batchDeleteBrands = async (items: BrandListRow[]) => {
    const results = await deleteBrandsByIds(items.map((item) => item.id));
    await loadPageData();
    return results;
  };

  const confirmDeleteBrand = async () => {
    if (!brandToDelete) {
      return;
    }

    try {
      setDeletingBrandId(brandToDelete.id);
      setErrorMessage("");
      setSuccessMessage("");

      const [result] = await deleteBrandsByIds([brandToDelete.id]);

      if (result?.success) {
        setSuccessMessage(`品牌 ${brandToDelete.brand_code} 已删除。`);
      } else {
        setErrorMessage(result?.message ?? "品牌删除失败，请刷新后再试。");
      }

      setBrandToDelete(null);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setDeletingBrandId("");
    }
  };

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">基础资料</p>
          <h2>品牌管理</h2>
          <p>管理公司品牌基础资料。品牌挂在产品 SPU 上，SKU 会自动跟随所属产品的品牌。</p>
        </div>
        <span className="statusPill">Supabase 数据</span>
      </section>

      <section className="metricGrid">
        <div className="metric">
          <span>品牌总数</span>
          <strong>{stats.totalBrands}</strong>
        </div>
        <div className="metric">
          <span>启用品牌数</span>
          <strong>{stats.activeBrands}</strong>
        </div>
        <div className="metric">
          <span>停用品牌数</span>
          <strong>{stats.inactiveBrands}</strong>
        </div>
        <div className="metric">
          <span>已关联产品数</span>
          <strong>{stats.totalLinkedProducts}</strong>
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

      <Modal
        open={createOpen}
        eyebrow="新增品牌"
        title="创建品牌基础资料"
        maxWidth="lg"
        onClose={() => setCreateOpen(false)}
      >
        <form className="dataForm productForm" onSubmit={submitCreateBrand}>
          <label>
            品牌编码
            <input
              value={brandForm.brandCode}
              onChange={(event) =>
                setBrandForm((current) => ({
                  ...current,
                  brandCode: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 BRAND-A"
              required
            />
          </label>

          <label>
            品牌名称
            <input
              value={brandForm.name}
              onChange={(event) =>
                setBrandForm((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 品牌 A"
              required
            />
          </label>

          <label>
            英文名称
            <input
              value={brandForm.englishName}
              onChange={(event) =>
                setBrandForm((current) => ({
                  ...current,
                  englishName: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 Brand A"
            />
          </label>

          <label>
            状态
            <select
              value={brandForm.status}
              onChange={(event) =>
                setBrandForm((current) => ({
                  ...current,
                  status: event.target.value as BrandStatus
                }))
              }
              disabled={creating}
            >
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </label>

          <label className="fullField">
            Logo URL
            <input
              value={brandForm.logoUrl}
              onChange={(event) =>
                setBrandForm((current) => ({
                  ...current,
                  logoUrl: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 https://example.com/logo.png"
            />
          </label>

          <label className="fullField">
            备注
            <textarea
              value={brandForm.notes}
              onChange={(event) =>
                setBrandForm((current) => ({
                  ...current,
                  notes: event.target.value
                }))
              }
              disabled={creating}
              placeholder="可填写品牌说明"
            />
          </label>

          <div className="formActions">
            <button className="primaryButton" type="submit" disabled={creating}>
              {creating ? "正在新增..." : "新增品牌"}
            </button>
          </div>
        </form>
      </Modal>

      {editForm ? (
        <Modal
          open={Boolean(editForm)}
          eyebrow="编辑品牌"
          title={editForm.brandCode}
          maxWidth="lg"
          onClose={() => setEditForm(null)}
        >
          <form className="dataForm productForm" onSubmit={submitEditBrand}>
            <label>
              品牌名称
              <input
                value={editForm.name}
                onChange={(event) =>
                  setEditForm((current) =>
                    current ? { ...current, name: event.target.value } : current
                  )
                }
                disabled={updating}
                required
              />
            </label>

            <label>
              英文名称
              <input
                value={editForm.englishName}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? { ...current, englishName: event.target.value }
                      : current
                  )
                }
                disabled={updating}
              />
            </label>

            <label>
              状态
              <select
                value={editForm.status}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? { ...current, status: event.target.value as BrandStatus }
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
              Logo URL
              <input
                value={editForm.logoUrl}
                onChange={(event) =>
                  setEditForm((current) =>
                    current ? { ...current, logoUrl: event.target.value } : current
                  )
                }
                disabled={updating}
              />
            </label>

            <label className="fullField">
              备注
              <textarea
                value={editForm.notes}
                onChange={(event) =>
                  setEditForm((current) =>
                    current ? { ...current, notes: event.target.value } : current
                  )
                }
                disabled={updating}
              />
            </label>

            <div className="formActions">
              <button className="primaryButton" type="submit" disabled={updating}>
                {updating ? "正在保存..." : "保存编辑"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      <section className="listPanel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">品牌列表</p>
            <h3>所有品牌</h3>
          </div>
          <div className="rowActions">
            <button
              type="button"
              onClick={() =>
                downloadCsvTemplate("brands-import-template.csv", brandImportFields)
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
            <button
              className="primaryButton"
              type="button"
              onClick={() => setCreateOpen(true)}
            >
              新增品牌
            </button>
          </div>
        </div>

        <div className="listToolbar productToolbar">
          <label>
            搜索品牌编码 / 名称
            <input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="输入品牌编码、中文名或英文名"
            />
          </label>

          <label>
            品牌状态
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
          selectedItems={selectedBrands}
          getItemLabel={(brand) => `${brand.brand_code} / ${brand.name}`}
          entityName="品牌"
          onClearSelection={() => setSelectedBrandIds([])}
          onDeactivateSelected={batchDeactivateBrands}
          onDeleteSelected={batchDeleteBrands}
        />

        {loading ? <div className="debugNotice">正在读取品牌数据...</div> : null}

        {!loading && filteredBrands.length === 0 ? (
          <div className="emptyState">暂无品牌</div>
        ) : null}

        {!loading && filteredBrands.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable productTable">
              <thead>
                <tr>
                  <th className="selectColumn">
                    <input
                      aria-label="全选当前页品牌"
                      className="tableCheckbox"
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAllFilteredBrands}
                    />
                  </th>
                  <th>Logo</th>
                  <th>品牌编码</th>
                  <th>品牌名称</th>
                  <th>英文名称</th>
                  <th>状态</th>
                  <th>关联产品数</th>
                  <th>创建时间</th>
                  <th>更新时间</th>
                  <th>备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBrands.map((brand) => {
                  const statusUpdating = statusUpdatingId === brand.id;

                  return (
                    <tr key={brand.id}>
                      <td>
                        <input
                          aria-label={`选择品牌 ${brand.brand_code}`}
                          className="tableCheckbox"
                          type="checkbox"
                          checked={selectedBrandIds.includes(brand.id)}
                          onChange={() => toggleBrandSelection(brand.id)}
                        />
                      </td>
                      <td>
                        <ImageCell
                          src={brand.logo_url}
                          alt={`${brand.brand_code} ${brand.name}`}
                        />
                      </td>
                      <td>{brand.brand_code}</td>
                      <td>{brand.name}</td>
                      <td>{brand.english_name ?? "-"}</td>
                      <td>
                        <span className={`tablePill product-status-${brand.status}`}>
                          {getStatusLabel(brand.status)}
                        </span>
                      </td>
                      <td>{brand.product_count}</td>
                      <td>{formatDateTime(brand.created_at)}</td>
                      <td>{formatDateTime(brand.updated_at)}</td>
                      <td className="notesCell">{brand.notes ?? "-"}</td>
                      <td>
                        <div className="rowActions">
                          <button type="button" onClick={() => setSelectedBrand(brand)}>
                            查看
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditBrand(brand)}
                            disabled={updating}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => changeBrandStatus(brand)}
                            disabled={statusUpdating}
                          >
                            {statusUpdating
                              ? "正在处理..."
                              : brand.status === "active"
                                ? "停用"
                                : "启用"}
                          </button>
                          <button
                            className="dangerButton"
                            type="button"
                            onClick={() => setBrandToDelete(brand)}
                            disabled={deletingBrandId === brand.id}
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

        {!loading && filteredBrands.length > 0 ? (
          <Pagination
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            total={filteredBrands.length}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      {selectedBrand ? (
        <Modal
          open={Boolean(selectedBrand)}
          eyebrow="品牌详情"
          title={`${selectedBrand.brand_code} / ${selectedBrand.name}`}
          onClose={() => setSelectedBrand(null)}
        >
          <div className="detailGrid">
            <div className="detailItem">
              <span>品牌编码</span>
              <strong>{selectedBrand.brand_code}</strong>
            </div>
            <div className="detailItem">
              <span>品牌名称</span>
              <strong>{selectedBrand.name}</strong>
            </div>
            <div className="detailItem">
              <span>英文名称</span>
              <strong>{selectedBrand.english_name ?? "-"}</strong>
            </div>
            <div className="detailItem">
              <span>状态</span>
              <strong>{getStatusLabel(selectedBrand.status)}</strong>
            </div>
            <div className="detailItem">
              <span>关联产品数</span>
              <strong>{selectedBrand.product_count}</strong>
            </div>
            <div className="detailItem">
              <span>创建时间</span>
              <strong>{formatDateTime(selectedBrand.created_at)}</strong>
            </div>
            <div className="detailItem detailItemWide">
              <span>Logo URL</span>
              <strong>{selectedBrand.logo_url ?? "-"}</strong>
            </div>
            <div className="detailItem detailItemWide">
              <span>备注</span>
              <strong>{selectedBrand.notes ?? "-"}</strong>
            </div>
          </div>
        </Modal>
      ) : null}

      <BulkImportDialog<BrandImportInput>
        open={importOpen}
        title="品牌批量导入"
        description="请按模板填写品牌编码、品牌名称、英文名称、Logo URL、状态和备注。上传后会先逐行校验，确认导入后才写入 Supabase。"
        templateFileName="brands-import-template.csv"
        fields={brandImportFields}
        validateRows={validateBrandImportRows}
        onImport={importBrands}
        onClose={() => setImportOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(brandToDelete)}
        title="确认删除品牌"
        description={
          <p>
            删除前会检查这个品牌是否已关联产品。只要已有产品引用，就不会物理删除，建议改为停用。
          </p>
        }
        confirmLabel="确认删除"
        danger
        loading={Boolean(deletingBrandId)}
        items={brandToDelete ? [`${brandToDelete.brand_code} / ${brandToDelete.name}`] : []}
        onClose={() => setBrandToDelete(null)}
        onConfirm={confirmDeleteBrand}
      />
    </main>
  );
}
