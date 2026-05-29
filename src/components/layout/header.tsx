"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { useMockRole } from "@/components/auth/mock-role-provider";
import { ChevronRightIcon, MenuIcon, SearchIcon, XIcon } from "@/components/ui/icons";
import { getNavigationForRole } from "@/lib/navigation";
import { roleLabels, type UserRole } from "@/types/roles";

const roleOptions = Object.entries(roleLabels) as Array<[UserRole, string]>;

type HeaderProps = {
  sidebarCollapsed: boolean;
  onOpenMobileSidebar: () => void;
  onToggleSidebar: () => void;
};

export function Header({
  sidebarCollapsed,
  onOpenMobileSidebar,
  onToggleSidebar
}: HeaderProps) {
  const { user, setRole } = useMockRole();
  const pathname = usePathname();
  const [currentUrl, setCurrentUrl] = useState(pathname);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const groups = useMemo(() => getNavigationForRole(user.role), [user.role]);

  useEffect(() => {
    setCurrentUrl(`${window.location.pathname}${window.location.search}`);
  }, [pathname]);
  const breadcrumb = useMemo(() => {
    const links = groups.flatMap((group) => {
      const own = group.href
        ? [{ group: group.section ?? group.label, label: group.label, href: group.href }]
        : [];

      return [
        ...own,
        ...group.items.map((item) => ({
          group: group.label,
          label: item.label,
          href: item.href
        }))
      ];
    });

    return (
      links
        .sort((first, second) => second.href.length - first.href.length)
        .find((item) => {
          if (item.href.includes("?")) {
            return currentUrl === item.href;
          }

          return pathname === item.href || pathname.startsWith(`${item.href}/`);
        }) ?? {
        group: "工作台",
        label: "工作台",
        href: "/dashboard"
      }
    );
  }, [currentUrl, groups, pathname]);

  return (
    <header className="topHeader">
      <div className="topHeaderLeft">
        <button
          className="iconButton headerMenuButton desktopSidebarToggle"
          type="button"
          aria-label={sidebarCollapsed ? "展开菜单" : "折叠菜单"}
          onClick={onToggleSidebar}
        >
          <MenuIcon size={18} />
        </button>
        <button
          className="iconButton headerMenuButton mobileSidebarToggle"
          type="button"
          aria-label="打开菜单"
          onClick={onOpenMobileSidebar}
        >
          <MenuIcon size={18} />
        </button>
        <nav className="breadcrumb" aria-label="当前位置">
          <span>{breadcrumb.group}</span>
          {breadcrumb.group !== breadcrumb.label ? (
            <>
              <ChevronRightIcon size={14} />
              <strong>{breadcrumb.label}</strong>
            </>
          ) : null}
        </nav>
      </div>
      <div className="topHeaderActions">
        <div className="desktopGlobalSearch">
          <GlobalSearch />
        </div>
        <div className="mobileGlobalSearch">
          <button
            className="iconButton"
            type="button"
            aria-label={mobileSearchOpen ? "关闭搜索" : "打开搜索"}
            onClick={() => setMobileSearchOpen((current) => !current)}
          >
            {mobileSearchOpen ? <XIcon size={18} /> : <SearchIcon size={18} />}
          </button>
          {mobileSearchOpen ? (
            <div className="mobileSearchOverlay">
              <GlobalSearch />
            </div>
          ) : null}
        </div>
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
