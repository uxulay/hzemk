"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMockRole } from "@/components/auth/mock-role-provider";
import { getNavigationForRole } from "@/lib/navigation";

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useMockRole();
  const groups = getNavigationForRole(user.role);

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
        {groups.map((group) => (
          <section className="navGroup" key={group.label}>
            <p>{group.label}</p>
            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={isActive ? "navItem active" : "navItem"}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </section>
        ))}
      </nav>
    </aside>
  );
}
