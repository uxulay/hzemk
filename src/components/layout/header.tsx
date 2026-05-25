"use client";

import { BellIcon, SearchIcon } from "@/components/ui/icons";
import { useMockRole } from "@/components/auth/mock-role-provider";
import { roleLabels, type UserRole } from "@/types/roles";

const roleOptions = Object.entries(roleLabels) as Array<[UserRole, string]>;

export function Header() {
  const { user, setRole } = useMockRole();

  return (
    <header className="topHeader">
      <div className="topHeaderTitle">
        <strong>跨境电商工贸一体管理系统</strong>
        <span>FBA 备货、生产、采购、库存协同</span>
      </div>

      <div className="topHeaderActions">
        <label className="globalSearch">
          <SearchIcon size={18} />
          <input placeholder="搜索功能、单据、产品、SKU等" />
        </label>

        <button className="iconButton" type="button" aria-label="通知">
          <BellIcon size={18} />
          <span className="notificationDot">3</span>
        </button>

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
