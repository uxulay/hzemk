import type { UserRole } from "@/types/roles";

export type NavigationItem = {
  label: string;
  href: string;
  roles: UserRole[];
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

const allRoles: UserRole[] = [
  "operations",
  "plant_manager",
  "procurement",
  "warehouse",
  "admin"
];

export const navigationGroups: NavigationGroup[] = [
  {
    label: "首页",
    items: [{ label: "后台首页", href: "/dashboard", roles: allRoles }]
  },
  {
    label: "FBA 备货",
    items: [
      {
        label: "FBA 备货需求",
        href: "/replenishment",
        roles: ["operations", "plant_manager", "admin"]
      },
      {
        label: "创建备货单",
        href: "/replenishment/new",
        roles: ["operations", "admin"]
      }
    ]
  },
  {
    label: "生产",
    items: [
      {
        label: "厂长排产",
        href: "/production/planning",
        roles: ["plant_manager", "admin"]
      },
      {
        label: "生产任务",
        href: "/production/orders",
        roles: ["plant_manager", "warehouse", "admin"]
      }
    ]
  },
  {
    label: "物料与采购",
    items: [
      {
        label: "BOM 管理",
        href: "/bom",
        roles: ["plant_manager", "procurement", "admin"]
      },
      {
        label: "物料需求",
        href: "/materials/requirements",
        roles: ["plant_manager", "procurement", "warehouse", "admin"]
      },
      {
        label: "采购单",
        href: "/purchase/orders",
        roles: ["procurement", "admin"]
      }
    ]
  },
  {
    label: "仓库",
    items: [
      {
        label: "原材料库存",
        href: "/inventory/materials",
        roles: ["warehouse", "procurement", "admin"]
      },
      {
        label: "成品库存",
        href: "/inventory/products",
        roles: ["warehouse", "operations", "admin"]
      },
      {
        label: "入库管理",
        href: "/inventory/inbound",
        roles: ["warehouse", "procurement", "plant_manager", "admin"]
      },
      {
        label: "FBA 出库",
        href: "/inventory/fba-outbound",
        roles: ["warehouse", "operations", "admin"]
      },
      {
        label: "出入库记录",
        href: "/inventory/transactions",
        roles: ["warehouse", "plant_manager", "procurement", "admin"]
      }
    ]
  },
  {
    label: "基础资料",
    items: [
      { label: "用户管理", href: "/admin/users", roles: ["admin"] },
      { label: "产品管理", href: "/admin/products", roles: ["admin"] },
      { label: "SKU 管理", href: "/admin/skus", roles: ["admin"] }
    ]
  }
];

export function getNavigationForRole(role: UserRole): NavigationGroup[] {
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(role))
    }))
    .filter((group) => group.items.length > 0);
}
