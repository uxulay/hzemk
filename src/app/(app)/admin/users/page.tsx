"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import {
  createUserProfile,
  getRoles,
  getUsersPage,
  getUserStats,
  toggleUserStatus,
  updateUserProfile,
  type RoleRow,
  type UserListRow,
  type UserStats,
  type UserStatus
} from "@/lib/api/users";
import { DEFAULT_PAGE_SIZE } from "@/lib/utils/pagination";

const userStatusLabels: Record<string, string> = {
  active: "启用",
  disabled: "停用",
  inactive: "停用"
};

type UserFormState = {
  authUserId: string;
  fullName: string;
  email: string;
  roleId: string;
  phone: string;
  status: UserStatus;
};

type UserEditFormState = Omit<UserFormState, "authUserId"> & {
  profileId: string;
};

const initialUserForm: UserFormState = {
  authUserId: "",
  fullName: "",
  email: "",
  roleId: "",
  phone: "",
  status: "active"
};

const initialStats: UserStats = {
  totalUsers: 0,
  adminUsers: 0,
  operatorUsers: 0,
  factoryManagerUsers: 0,
  purchaserUsers: 0,
  warehouseUsers: 0
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "操作失败，请稍后重试。";
}

function getStatusLabel(status: string) {
  return userStatusLabels[status] ?? status;
}

function getStatusClass(status: string) {
  return status.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getRoleClass(code: string | null | undefined) {
  return (code ?? "unassigned").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getRoleLabel(role: RoleRow | null) {
  if (!role) {
    return "未分配角色";
  }

  return role.name || role.code;
}

function getRoleOptionLabel(role: RoleRow) {
  return `${role.name} / ${role.code}`;
}

function getOptionalText(value: string | null | undefined) {
  return value || "-";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function toEditableStatus(status: string): UserStatus {
  return status === "disabled" || status === "inactive" ? "disabled" : "active";
}

function matchesStatusFilter(status: string, filter: string) {
  return (
    filter === "all" ||
    status === filter ||
    (filter === "disabled" && status === "inactive")
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserListRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [stats, setStats] = useState<UserStats>(initialStats);
  const [userForm, setUserForm] = useState<UserFormState>(initialUserForm);
  const [editForm, setEditForm] = useState<UserEditFormState | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserListRow | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadPageData = async (targetPage = page) => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [userPage, roleData, statsData] = await Promise.all([
        getUsersPage({
          page: targetPage,
          pageSize: DEFAULT_PAGE_SIZE,
          keyword: searchKeyword,
          filters: {
            roleId: roleFilter,
            status: statusFilter
          }
        }),
        getRoles(),
        getUserStats()
      ]);

      setUsers(userPage.rows);
      setUserTotal(userPage.total);
      setPage(userPage.page);
      setRoles(roleData);
      setStats(statsData);
      setSelectedUser((current) => {
        if (!current) {
          return null;
        }

        return userPage.rows.find((user) => user.id === current.id) ?? null;
      });

      return userPage.rows;
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setUsers([]);
      setUserTotal(0);
      setRoles([]);
      setStats(initialStats);
      setSelectedUser(null);

      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData(1);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadPageData(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [roleFilter, searchKeyword, statusFilter]);

  const submitCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setCreating(true);
      setErrorMessage("");
      setSuccessMessage("");

      const created = await createUserProfile(userForm);

      setSuccessMessage(`用户资料 ${created.full_name} 新增成功。`);
      setUserForm(initialUserForm);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const startEditUser = (user: UserListRow) => {
    setEditForm({
      profileId: user.id,
      fullName: user.full_name,
      email: user.email,
      roleId: user.role_id ?? "",
      phone: user.phone ?? "",
      status: toEditableStatus(user.status)
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const submitEditUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editForm) {
      return;
    }

    try {
      setUpdating(true);
      setErrorMessage("");
      setSuccessMessage("");

      await updateUserProfile(editForm);
      setSuccessMessage(`用户资料 ${editForm.fullName} 编辑成功。`);
      setEditForm(null);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setUpdating(false);
    }
  };

  const changeUserStatus = async (user: UserListRow) => {
    try {
      setStatusUpdatingId(user.id);
      setErrorMessage("");
      setSuccessMessage("");

      const nextStatus = await toggleUserStatus(user.id, user.status);
      setSuccessMessage(
        `用户 ${user.full_name} 已${getStatusLabel(nextStatus)}。`
      );
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setStatusUpdatingId("");
    }
  };

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">基础资料</p>
          <h2>用户管理</h2>
          <p>
            管理 profiles 用户资料和 roles 角色分配。当前页面只维护业务资料，
            不创建登录账号，也不使用 service_role key。
          </p>
        </div>
        <span className="statusPill">Supabase 数据</span>
      </section>

      <div className="warningNotice">
        <strong>
          当前仅创建用户资料，正式登录账号将在接入 Supabase Auth 后管理。
        </strong>
        <p>
          因为 schema 中 profiles.id 关联 auth.users.id，新增时需要填写已经存在的
          Supabase Auth 用户 ID。邀请用户、重置密码和真实登录后续单独接。
        </p>
      </div>

      <section className="metricGrid usersMetricGrid">
        <div className="metric">
          <span>用户总数</span>
          <strong>{stats.totalUsers}</strong>
        </div>
        <div className="metric">
          <span>管理员数量</span>
          <strong>{stats.adminUsers}</strong>
        </div>
        <div className="metric">
          <span>运营数量</span>
          <strong>{stats.operatorUsers}</strong>
        </div>
        <div className="metric">
          <span>厂长数量</span>
          <strong>{stats.factoryManagerUsers}</strong>
        </div>
        <div className="metric">
          <span>采购数量</span>
          <strong>{stats.purchaserUsers}</strong>
        </div>
        <div className="metric">
          <span>仓库数量</span>
          <strong>{stats.warehouseUsers}</strong>
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
            <p className="eyebrow">新增用户资料</p>
            <h3>创建 profiles 业务资料</h3>
          </div>
        </div>

        <form className="dataForm userForm" onSubmit={submitCreateUser}>
          <label>
            Supabase Auth 用户 ID
            <input
              value={userForm.authUserId}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  authUserId: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 11111111-1111-4111-8111-111111111111"
              required
            />
            <span className="fieldHint">
              必须是已存在的 Auth 用户 ID，本页不会创建登录账号。
            </span>
          </label>

          <label>
            用户名称
            <input
              value={userForm.fullName}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  fullName: event.target.value
                }))
              }
              disabled={creating}
              placeholder="例如 张三"
              required
            />
          </label>

          <label>
            邮箱
            <input
              type="email"
              value={userForm.email}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  email: event.target.value
                }))
              }
              disabled={creating}
              placeholder="name@example.com"
              required
            />
          </label>

          <label>
            角色
            <select
              value={userForm.roleId}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  roleId: event.target.value
                }))
              }
              disabled={creating || roles.length === 0}
              required
            >
              <option value="">请选择角色</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {getRoleOptionLabel(role)}
                </option>
              ))}
            </select>
          </label>

          <label>
            手机号
            <input
              value={userForm.phone}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  phone: event.target.value
                }))
              }
              disabled={creating}
              placeholder="可选"
            />
          </label>

          <label>
            状态
            <select
              value={userForm.status}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  status: event.target.value as UserStatus
                }))
              }
              disabled={creating}
            >
              <option value="active">启用</option>
              <option value="disabled">停用</option>
            </select>
          </label>

          <div className="formActions">
            <button className="primaryButton" type="submit" disabled={creating}>
              {creating ? "正在新增..." : "新增用户资料"}
            </button>
          </div>
        </form>
      </section>

      {editForm ? (
        <Modal
          open={Boolean(editForm)}
          eyebrow="编辑用户资料"
          title={editForm.fullName}
          maxWidth="lg"
          onClose={() => setEditForm(null)}
        >
          <form className="dataForm userForm" onSubmit={submitEditUser}>
            <label>
              用户 ID
              <input value={editForm.profileId} disabled />
              <span className="fieldHint">
                用户 ID 关联 Supabase Auth，编辑时不修改。
              </span>
            </label>

            <label>
              用户名称
              <input
                value={editForm.fullName}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          fullName: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating}
                required
              />
            </label>

            <label>
              邮箱
              <input
                type="email"
                value={editForm.email}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          email: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating}
                required
              />
            </label>

            <label>
              角色
              <select
                value={editForm.roleId}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          roleId: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating || roles.length === 0}
                required
              >
                <option value="">请选择角色</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {getRoleOptionLabel(role)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              手机号
              <input
                value={editForm.phone}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          phone: event.target.value
                        }
                      : current
                  )
                }
                disabled={updating}
                placeholder="可选"
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
                          status: event.target.value as UserStatus
                        }
                      : current
                  )
                }
                disabled={updating}
              >
                <option value="active">启用</option>
                <option value="disabled">停用</option>
              </select>
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
            <p className="eyebrow">用户列表</p>
            <h3>所有 profiles 用户资料</h3>
          </div>
          <button className="secondaryButton" type="button" onClick={() => loadPageData(page)}>
            {loading ? "正在刷新..." : "刷新列表"}
          </button>
        </div>

        <div className="listToolbar usersToolbar">
          <label>
            搜索用户名称 / 邮箱
            <input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="输入名称或邮箱"
            />
          </label>

          <label>
            角色
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="all">全部角色</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {getRoleOptionLabel(role)}
                </option>
              ))}
            </select>
          </label>

          <label>
            状态
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">全部状态</option>
              <option value="active">启用</option>
              <option value="disabled">停用</option>
            </select>
          </label>

          <button className="secondaryButton" type="button" onClick={() => loadPageData(page)}>
            刷新
          </button>
        </div>

        {loading ? <div className="debugNotice">正在读取用户数据...</div> : null}

        {!loading && users.length === 0 ? (
          <div className="emptyState">暂无用户</div>
        ) : null}

        {!loading && users.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable usersTable">
              <thead>
                <tr>
                  <th>用户名称</th>
                  <th>邮箱</th>
                  <th>角色</th>
                  <th>手机号</th>
                  <th>状态</th>
                  <th>创建时间</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const statusUpdating = statusUpdatingId === user.id;

                  return (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.full_name}</strong>
                        <span>{user.id}</span>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span
                          className={`tablePill rolePill role-code-${getRoleClass(
                            user.role?.code
                          )}`}
                        >
                          {getRoleLabel(user.role)}
                        </span>
                        <span>{user.role?.code ?? "-"}</span>
                      </td>
                      <td>{getOptionalText(user.phone)}</td>
                      <td>
                        <span
                          className={`tablePill user-status-${getStatusClass(
                            user.status
                          )}`}
                        >
                          {getStatusLabel(user.status)}
                        </span>
                      </td>
                      <td>{formatDateTime(user.created_at)}</td>
                      <td>{formatDateTime(user.updated_at)}</td>
                      <td>
                        <div className="rowActions userRowActions">
                          <button
                            type="button"
                            onClick={() => setSelectedUser(user)}
                          >
                            查看
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditUser(user)}
                            disabled={updating}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditUser(user)}
                            disabled={updating}
                          >
                            分配角色
                          </button>
                          <button
                            type="button"
                            onClick={() => changeUserStatus(user)}
                            disabled={statusUpdating}
                          >
                            {statusUpdating
                              ? "正在处理..."
                              : user.status === "active"
                                ? "停用"
                                : "启用"}
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

        {!loading && users.length > 0 ? (
          <Pagination
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            total={userTotal}
            onPageChange={(nextPage) => loadPageData(nextPage)}
          />
        ) : null}
      </section>

      {selectedUser ? (
        <Modal
          open={Boolean(selectedUser)}
          eyebrow="用户资料详情"
          title={selectedUser.full_name}
          onClose={() => setSelectedUser(null)}
        >
          <div className="detailGrid">
            <div className="detailItem detailItemWide">
              <span>用户 ID</span>
              <strong>{selectedUser.id}</strong>
            </div>
            <div className="detailItem">
              <span>邮箱</span>
              <strong>{selectedUser.email}</strong>
            </div>
            <div className="detailItem">
              <span>角色</span>
              <strong>{getRoleLabel(selectedUser.role)}</strong>
            </div>
            <div className="detailItem">
              <span>角色编码</span>
              <strong>{selectedUser.role?.code ?? "-"}</strong>
            </div>
            <div className="detailItem">
              <span>手机号</span>
              <strong>{getOptionalText(selectedUser.phone)}</strong>
            </div>
            <div className="detailItem">
              <span>状态</span>
              <strong>{getStatusLabel(selectedUser.status)}</strong>
            </div>
            <div className="detailItem">
              <span>创建时间</span>
              <strong>{formatDateTime(selectedUser.created_at)}</strong>
            </div>
            <div className="detailItem">
              <span>更新时间</span>
              <strong>{formatDateTime(selectedUser.updated_at)}</strong>
            </div>
          </div>
        </Modal>
      ) : null}

      <section className="listPanel">
        <div className="detailHeader">
          <div>
            <p className="eyebrow">角色列表</p>
            <h3>roles 只读信息</h3>
          </div>
        </div>

        {roles.length === 0 ? (
          <div className="emptyState">暂无角色</div>
        ) : (
          <div className="tableWrap">
            <table className="dataTable rolesTable">
              <thead>
                <tr>
                  <th>角色编码</th>
                  <th>角色名称</th>
                  <th>角色说明</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td>
                      <strong>{role.code}</strong>
                    </td>
                    <td>{role.name}</td>
                    <td className="notesCell">
                      {getOptionalText(role.description)}
                    </td>
                    <td>{formatDateTime(role.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
