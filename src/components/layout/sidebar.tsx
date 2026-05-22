"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMockRole } from "@/components/auth/mock-role-provider";
import {
  getNavigationForRole,
  type NavigationGroup
} from "@/lib/navigation";

function classNames(...names: Array<string | false | undefined>) {
  return names.filter(Boolean).join(" ");
}

function isRouteMatch(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function findActiveHref(pathname: string, groups: NavigationGroup[]) {
  const links = groups.flatMap((group) => [
    ...(group.href ? [group.href] : []),
    ...group.items.map((item) => item.href)
  ]);

  return (
    links
      .sort((first, second) => second.length - first.length)
      .find((href) => isRouteMatch(pathname, href)) ?? null
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useMockRole();
  const groups = useMemo(() => getNavigationForRole(user.role), [user.role]);
  const activeHref = useMemo(
    () => findActiveHref(pathname, groups),
    [groups, pathname]
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
    <aside className="sidebar">
      <div className="brand">
        <div className="brandMark">FBA</div>
        <div>
          <strong>备货生产系统</strong>
          <span>内部管理后台</span>
        </div>
      </div>

      <nav className="navList" aria-label="后台菜单">
        {groups.map((group, index) => {
          const groupIsActive = group.label === activeGroupLabel;

          if (group.href) {
            return (
              <Link
                aria-current={groupIsActive ? "page" : undefined}
                className={classNames(
                  "navGroupButton",
                  "navGroupLink",
                  groupIsActive && "active"
                )}
                href={group.href}
                key={group.label}
              >
                <span className="navGroupText">{group.label}</span>
              </Link>
            );
          }

          const isExpanded = expandedGroups.has(group.label);
          const panelId = `nav-group-${index}`;

          return (
            <section
              className={classNames("navGroup", groupIsActive && "active")}
              key={group.label}
            >
              <button
                aria-controls={panelId}
                aria-expanded={isExpanded}
                className={classNames(
                  "navGroupButton",
                  isExpanded && "expanded",
                  groupIsActive && "active"
                )}
                onClick={() => toggleGroup(group.label)}
                type="button"
              >
                <span className="navGroupText">{group.label}</span>
                <span className="navGroupMeta">
                  {group.items.length}
                  <span className="navChevron" aria-hidden="true" />
                </span>
              </button>

              <div className="navChildren" hidden={!isExpanded} id={panelId}>
                {group.items.map((item) => {
                  const isActive = activeHref === item.href;

                  return (
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={classNames("navItem", isActive && "active")}
                      href={item.href}
                      key={item.href}
                    >
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
