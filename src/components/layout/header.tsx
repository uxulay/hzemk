"use client";

import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { useMockRole } from "@/components/auth/mock-role-provider";
import { roleLabels, type UserRole } from "@/types/roles";

const roleOptions = Object.entries(roleLabels) as Array<[UserRole, string]>;

export function Header() {
  const { user, setRole } = useMockRole();

  return (
    <header className="topHeader">
      <div className="topHeaderActions">
        <GlobalSearch />
        <NotificationDropdown />

        <label className="roleSwitch">
          <span>模拟角色</span>
          <select
            aria-label="切换模拟角色"
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

        <div className="topUser">
          <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{user.name}</strong>
            <span>{roleLabels[user.role]}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
