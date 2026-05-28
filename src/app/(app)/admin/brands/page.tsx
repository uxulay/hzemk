"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { DrawerForm } from "@/components/ui/DrawerForm";
import { EllipsisText } from "@/components/ui/ellipsis-text";
import { InfoCell } from "@/components/ui/info-cell";
import { PageHeader } from "@/components/ui/PageHeader";
import { RowActions } from "@/components/ui/row-actions";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { deleteBrandsByIds } from "@/lib/api/bulk-management";
import {
  createBrand,
  getBrandsPage,
  toggleBrandStatus,
  updateBrand,
  type BrandListRow,
  type BrandStatus
} from "@/lib/api/brands";
import { DEFAULT_PAGE_SIZE } from "@/lib/utils/pagination";

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
  const [brandForm, setBrandForm] = useState<BrandFormState>(initialBrandForm);
  const [editForm, setEditForm] = useState<BrandEditFormState | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<BrandListRow | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalBrands, setTotalBrands] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [brandToDelete, setBrandToDelete] = useState<BrandListRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [deletingBrandId, setDeletingBrandId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadPageData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const brandPage = await getBrandsPage({
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        keyword: searchKeyword,
        filters: {
          status: statusFilter
        }
      });

      setBrands(brandPage.rows);
      setTotalBrands(brandPage.total);
      setSelectedBrand((current) => {
        if (!current) {
          return null;
        }

        return brandPage.rows.find((brand) => brand.id === current.id) ?? current;
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setBrands([]);
      setTotalBrands(0);
      setSelectedBrand(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPageData();
    }, 300);

    return () => clearTimeout(timer);
  }, [page, searchKeyword, statusFilter]);

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

  const brandColumns: DataTableColumn<BrandListRow>[] = [
    {
      key: "brand",
      title: "品牌信息",
      width: "48%",
      render: (brand) => (
        <InfoCell
          title={brand.name}
          subtitle={`${brand.brand_code}${brand.notes ? ` / ${brand.notes}` : ""}`}
        />
      )
    },
    {
      key: "status",
      title: "状态",
      render: (brand) => (
        <StatusBadge status={brand.status} label={getStatusLabel(brand.status)} />
      )
    },
    {
      key: "createdAt",
      title: "创建时间",
      render: (brand) => formatDateTime(brand.created_at)
    },
    {
      key: "actions",
      title: "操作",
      render: (brand) => {
        const statusUpdating = statusUpdatingId === brand.id;

        return (
          <RowActions
            onView={() => setSelectedBrand(brand)}
            onEdit={() => startEditBrand(brand)}
            moreActions={[
              {
                label: statusUpdating
                  ? "正在处理"
                  : brand.status === "active"
                    ? "停用"
                    : "启用",
                disabled: statusUpdating,
                onClick: () => changeBrandStatus(brand)
              },
              {
                label: "删除",
                danger: true,
                disabled: deletingBrandId === brand.id,
                onClick: () => setBrandToDelete(brand)
              }
            ]}
          />
        );
      }
    }
  ];

  return (
    <main className="pageShell modernPageShell">
      <PageHeader
        eyebrow="基础资料"
        title="品牌管理"
        actions={
          <button className="primaryButton" type="button" onClick={() => setCreateOpen(true)}>
            新增品牌
          </button>
        }
      />

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

      <DrawerForm
        open={createOpen}
        title="新增品牌"
        width="lg"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button className="secondaryButton" type="button" onClick={() => setCreateOpen(false)}>
              取消
            </button>
            <button className="primaryButton" form="create-brand-form" type="submit" disabled={creating}>
              {creating ? "正在新增..." : "新增品牌"}
            </button>
          </>
        }
      >
        <form id="create-brand-form" className="dataForm productForm" onSubmit={submitCreateBrand}>
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
        </form>
      </DrawerForm>

      {editForm ? (
        <DrawerForm
          open={Boolean(editForm)}
          title={`编辑品牌：${editForm.brandCode}`}
          width="lg"
          onClose={() => setEditForm(null)}
          footer={
            <>
              <button className="secondaryButton" type="button" onClick={() => setEditForm(null)}>
                取消
              </button>
              <button className="primaryButton" form="edit-brand-form" type="submit" disabled={updating}>
                {updating ? "正在保存..." : "保存编辑"}
              </button>
            </>
          }
        >
          <form id="edit-brand-form" className="dataForm productForm" onSubmit={submitEditBrand}>
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
          </form>
        </DrawerForm>
      ) : null}

      <section className="modernCard">
        <div className="modernCardHeader">
          <div>
            <p className="eyebrow">品牌列表</p>
            <h3>所有品牌</h3>
          </div>
          <div className="rowActions">
            <button type="button" onClick={refreshAll}>
              {loading ? "正在刷新..." : "刷新列表"}
            </button>
          </div>
        </div>

        <SearchFilterBar
          searchLabel="搜索品牌名称 / 编码"
          searchValue={searchKeyword}
          searchPlaceholder="输入品牌名称或编码"
          onSearchChange={setSearchKeyword}
          onReset={() => {
            setSearchKeyword("");
            setStatusFilter("all");
            setPage(1);
          }}
        >
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
        </SearchFilterBar>

        <DataTable
          columns={brandColumns}
          rows={brands}
          getRowKey={(brand) => brand.id}
          loading={loading}
          loadingText="正在读取品牌数据..."
          emptyText="暂无品牌"
          minWidth={760}
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          total={totalBrands}
          onPageChange={setPage}
        />
      </section>

      {selectedBrand ? (
        <DetailDrawer
          open={Boolean(selectedBrand)}
          title={`${selectedBrand.brand_code} / ${selectedBrand.name}`}
          width="md"
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
              <strong>
                <EllipsisText title={selectedBrand.logo_url ?? undefined}>
                  {selectedBrand.logo_url ?? "-"}
                </EllipsisText>
              </strong>
            </div>
            <div className="detailItem detailItemWide">
              <span>备注</span>
              <strong>
                <EllipsisText title={selectedBrand.notes ?? undefined}>
                  {selectedBrand.notes ?? "-"}
                </EllipsisText>
              </strong>
            </div>
          </div>
        </DetailDrawer>
      ) : null}

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
