"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMockRole } from "@/components/auth/mock-role-provider";
import {
  BoxIcon,
  CartIcon,
  DashboardIcon,
  DatabaseIcon,
  FactoryIcon,
  SearchIcon,
  SettingsIcon,
  WarehouseIcon
} from "@/components/ui/icons";
import {
  getNavigationForRole,
  type NavigationGroup
} from "@/lib/navigation";

function classNames(...names: Array<string | false | undefined>) {
  return names.filter(Boolean).join(" ");
}

function stripQuery(href: string) {
  return href.split("?")[0];
}

function isRouteMatch(currentUrl: string, pathname: string, href: string) {
  if (href.includes("?")) {
    return currentUrl === href;
  }

  const hrefPath = stripQuery(href);
  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

function findActiveHref(currentUrl: string, pathname: string, groups: NavigationGroup[]) {
  const links = groups.flatMap((group) => [
    ...(group.href ? [group.href] : []),
    ...group.items.map((item) => item.href)
  ]);

  return (
    links
      .sort((first, second) => second.length - first.length)
      .find((href) => isRouteMatch(currentUrl, pathname, href)) ?? null
  );
}

function getGroupIcon(label: string) {
  if (label.includes("工作台")) {
    return <DashboardIcon size={18} />;
  }
  if (label.includes("数据") || label.includes("AI")) {
    return <SearchIcon size={18} />;
  }
  if (label.includes("备货")) {
    return <BoxIcon size={18} />;
  }
  if (label.includes("生产")) {
    return <FactoryIcon size={18} />;
  }
  if (label.includes("采购")) {
    return <CartIcon size={18} />;
  }
  if (label.includes("库存") || label.includes("仓库")) {
    return <WarehouseIcon size={18} />;
  }
  if (label.includes("基础")) {
    return <DatabaseIcon size={18} />;
  }
  if (label.includes("系统") || label.includes("角色") || label.includes("用户")) {
    return <SettingsIcon size={18} />;
  }

  return <BoxIcon size={18} />;
}

type SidebarProps = {
  collapsed?: boolean;
};

export function Sidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const [currentUrl, setCurrentUrl] = useState(pathname);
  const { user } = useMockRole();
  const groups = useMemo(() => getNavigationForRole(user.role), [user.role]);
  const activeHref = useMemo(
    () => findActiveHref(currentUrl, pathname, groups),
    [currentUrl, groups, pathname]
  );
  const activeGroupLabel = useMemo(() => {
    if (!activeHref) {
      return null;
    }

    return (
      groups.find(
        (group) =>
          group.href === activeHref ||
          group.items.some((item) => item.href === activeHref)
      )?.label ?? null
    );
  }, [activeHref, groups]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(activeGroupLabel ? [activeGroupLabel] : [])
  );

  useEffect(() => {
    setCurrentUrl(`${window.location.pathname}${window.location.search}`);
  }, [pathname]);

  useEffect(() => {
    if (!activeGroupLabel) {
      return;
    }

    const activeGroup = groups.find((group) => group.label === activeGroupLabel);

    if (!activeGroup?.items.length) {
      return;
    }

    setExpandedGroups((current) => {
      if (current.has(activeGroupLabel)) {
        return current;
      }

      const next = new Set(current);
      next.add(activeGroupLabel);
      return next;
    });
  }, [activeGroupLabel, groups]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);

      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }

      return next;
    });
  };

  return (
    <aside className={classNames("sidebar", collapsed && "sidebarCollapsed")}>
      <div className="brand">
        <img
          className="brandLogo"
          src="https://wrxqiaphfxihjclqnged.supabase.co/storage/v1/object/public/public-assets/emk_logo.png"
          alt="公司 Logo"
        />
      </div>

      <nav className="navList" aria-label="后台菜单">
        {groups.map((group, index) => {
          const showSection =
            !collapsed &&
            group.section &&
            groups.findIndex((item) => item.section === group.section) === index;
          const groupIsActive = group.label === activeGroupLabel;

          if (group.href) {
            return (
              <div className="navBlock" key={`${group.section}-${group.label}-${group.href}`}>
                {showSection ? <p className="navSectionLabel">{group.section}</p> : null}
                <Link
                  aria-current={groupIsActive ? "page" : undefined}
                  aria-label={collapsed ? group.label : undefined}
                  className={classNames(
                    "navGroupButton",
                    "navGroupLink",
                    group.variant === "primary" && "navItemPrimaryAction",
                    groupIsActive && "active"
                  )}
                  href={group.href}
                  title={collapsed ? group.label : undefined}
                >
                  <span className="navIcon">{getGroupIcon(group.label)}</span>
                  <span className="navGroupText">{group.label}</span>
                </Link>
              </div>
            );
          }

          const isExpanded = expandedGroups.has(group.label);
          const panelId = `nav-group-${index}`;

          return (
            <section className="navGroup" key={`${group.section}-${group.label}`}>
              {showSection ? <p className="navSectionLabel">{group.section}</p> : null}
              <button
                aria-controls={panelId}
                aria-expanded={isExpanded}
                aria-label={collapsed ? group.label : undefined}
                className={classNames(
                  "navGroupButton",
                  isExpanded && "expanded"
                )}
                onClick={() => toggleGroup(group.label)}
                title={collapsed ? group.label : undefined}
                type="button"
              >
                <span className="navIcon">{getGroupIcon(group.label)}</span>
                <span className="navGroupText">{group.label}</span>
                <span className="navGroupMeta">
                  <span className="navChevron" aria-hidden="true" />
                </span>
              </button>

              <div className="navChildren" hidden={collapsed || !isExpanded} id={panelId}>
                {group.items.map((item) => {
                  const isActive = activeHref === item.href;
                  const itemKey = `${group.label}-${item.label}-${item.href}`;

                  return (
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={classNames("navItem", isActive && "active")}
                      href={item.href}
                      key={itemKey}
                    >
                      <span className="navChildDot" aria-hidden="true" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </nav>
    </aside>
  );
}
