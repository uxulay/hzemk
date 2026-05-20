"use client";

import { useMockRole } from "@/components/auth/mock-role-provider";
import { roleLabels, type UserRole } from "@/types/roles";

const roleOptions = Object.entries(roleLabels) as Array<[UserRole, string]>;

export function Header() {
  const { user, setRole } = useMockRole();

  return (
    <header className="header">
      <div>
        <p className="eyebrow">当前阶段：基础结构</p>
        <h1>FBA 备货生产管理后台</h1>
      </div>

      <div className="headerActions">
        <label className="roleSwitch">
          <span>模拟角色</span>
          <select
            value={user.role}
            onChange={(event) => setRole(event.target.value as UserRole)}
          >
            {roleOptions.map(([role, label]) => (
              <option key={role} value={role}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="userBadge">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>
      </div>
    </header>
  );
}
