"use client";

import { useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getRoles, type RoleRow } from "@/lib/api/users";

const roleNames = ["管理员", "运营", "厂长", "采购", "仓库", "只读角色"];
const permissionGroups = [
  "备货管理",
  "生产管理",
  "采购管理",
  "库存管理",
  "基础资料",
  "系统管理"
];

const rolePermissions: Record<string, string[]> = {
  管理员: permissionGroups,
  运营: ["备货管理", "库存管理"],
  厂长: ["备货管理", "生产管理", "库存管理"],
  采购: ["采购管理", "库存管理", "基础资料"],
  仓库: ["库存管理", "基础资料"],
  只读角色: permissionGroups
};

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedRole, setSelectedRole] = useState(roleNames[0]);

  useEffect(() => {
    async function loadRoles() {
      try {
        setLoading(true);
        setErrorMessage("");
        setRoles(await getRoles());
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "读取角色失败。");
      } finally {
        setLoading(false);
      }
    }

    loadRoles();
  }, []);

  const columns: DataTableColumn<RoleRow>[] = [
    {
      key: "name",
      title: "角色",
      render: (role) => role.name
    },
    {
      key: "code",
      title: "编码",
      render: (role) => role.code
    },
    {
      key: "status",
      title: "状态",
      render: () => <StatusBadge status="active" label="已配置" />
    }
  ];

  return (
    <main className="pageShell modernPageShell">
      <PageHeader
        eyebrow="系统管理"
        title="角色权限"
        actions={
          <button className="primaryButton" type="button" disabled title="当前阶段未接入角色写入逻辑">
            新增角色
          </button>
        }
      />

      <div className="warningNotice">
        <strong>当前页面是权限 UI 占位。</strong>
        <p>这里不会修改登录、RLS 或真实权限。等权限底层逻辑接入后，再把保存动作接到真实接口。</p>
      </div>

      {errorMessage ? (
        <div className="debugError">
          <strong>读取失败</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <section className="rolePermissionLayout">
        <aside className="modernCard roleListCard">
          <div className="modernCardHeader">
            <div>
              <p className="eyebrow">角色列表</p>
              <h3>预设角色</h3>
            </div>
          </div>
          <div className="roleList">
            {roleNames.map((roleName) => (
              <button
                className={selectedRole === roleName ? "active" : undefined}
                key={roleName}
                type="button"
                onClick={() => setSelectedRole(roleName)}
              >
                {roleName}
              </button>
            ))}
          </div>
        </aside>

        <section className="modernCard permissionMatrixCard">
          <div className="modernCardHeader">
            <div>
              <p className="eyebrow">权限分组</p>
              <h3>{selectedRole}</h3>
            </div>
          </div>
          <div className="permissionGrid">
            {permissionGroups.map((group) => {
              const enabled = rolePermissions[selectedRole]?.includes(group);

              return (
                <div className="permissionCell" key={group}>
                  <span>{group}</span>
                  <StatusBadge
                    status={enabled ? "active" : "inactive"}
                    label={enabled ? "展示占位" : "未勾选"}
                    type={enabled ? "info" : "neutral"}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </section>

      <section className="modernCard">
        <div className="modernCardHeader">
          <div>
            <p className="eyebrow">数据库角色</p>
            <h3>当前 roles 表</h3>
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={roles}
          getRowKey={(role) => role.id}
          loading={loading}
          loadingText="正在读取角色..."
          emptyText="暂无角色"
          minWidth={640}
        />
      </section>
    </main>
  );
}
