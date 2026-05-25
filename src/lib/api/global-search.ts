import { getNavigationForRole, type NavigationGroup } from "@/lib/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/roles";

export type GlobalSearchType = "功能" | "单据" | "产品/SKU" | "原材料";

export type GlobalSearchResult = {
  id: string;
  type: GlobalSearchType;
  title: string;
  description: string;
  href: string;
};

type ProductSearchRow = {
  id: string;
  product_code: string;
  name: string;
  category: string | null;
};

type SkuSearchRow = {
  id: string;
  sku_code: string;
  sku_name: string;
  sku_type: string;
  specs: string | null;
};

type FbaSearchRow = {
  id: string;
  request_no: string;
  status: string;
  created_at: string;
};

type ProductionSearchRow = {
  id: string;
  production_order_no: string;
  status: string;
  created_at: string;
};

type PurchaseSearchRow = {
  id: string;
  purchase_order_no: string;
  status: string;
  created_at: string;
};

function normalizeKeyword(keyword: string) {
  return keyword.trim().replace(/[(),]/g, " ").replace(/\s+/g, " ");
}

function likePattern(keyword: string) {
  return `%${keyword.replace(/[%_]/g, "")}%`;
}

function withKeyword(href: string, keyword: string) {
  const separator = href.includes("?") ? "&" : "?";

  return `${href}${separator}keyword=${encodeURIComponent(keyword)}`;
}

function flattenNavigation(groups: NavigationGroup[], keyword: string) {
  const normalizedKeyword = keyword.toLowerCase();
  const results: GlobalSearchResult[] = [];

  groups.forEach((group) => {
    const groupMatch = group.label.toLowerCase().includes(normalizedKeyword);
    const firstChild = group.items[0];

    if (group.href && groupMatch) {
      results.push({
        id: `menu-${group.href}`,
        type: "功能",
        title: group.label,
        description: "功能菜单",
        href: group.href
      });
    } else if (!group.href && firstChild && groupMatch) {
      results.push({
        id: `menu-group-${group.label}`,
        type: "功能",
        title: group.label,
        description: `功能分组，进入 ${firstChild.label}`,
        href: firstChild.href
      });
    }

    group.items.forEach((item) => {
      const haystack = `${group.label} ${item.label}`.toLowerCase();

      if (!haystack.includes(normalizedKeyword)) {
        return;
      }

      results.push({
        id: `menu-${item.href}`,
        type: "功能",
        title: item.label,
        description: group.label,
        href: item.href
      });
    });
  });

  return results;
}

export async function searchGlobal(
  keyword: string,
  role: UserRole
): Promise<GlobalSearchResult[]> {
  const normalizedKeyword = normalizeKeyword(keyword);

  if (!normalizedKeyword) {
    return [];
  }

  const pattern = likePattern(normalizedKeyword);
  const supabase = getSupabaseClient();
  const menuResults = flattenNavigation(getNavigationForRole(role), normalizedKeyword);

  const [
    productResult,
    skuResult,
    fbaResult,
    productionResult,
    purchaseResult
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, product_code, name, category")
      .or(`product_code.ilike.${pattern},name.ilike.${pattern}`)
      .order("product_code", { ascending: true })
      .limit(6),
    supabase
      .from("skus")
      .select("id, sku_code, sku_name, sku_type, specs")
      .or(
        `sku_code.ilike.${pattern},sku_name.ilike.${pattern},amazon_sku.ilike.${pattern},fnsku.ilike.${pattern},specs.ilike.${pattern}`
      )
      .order("sku_code", { ascending: true })
      .limit(8),
    supabase
      .from("fba_replenishment_requests")
      .select("id, request_no, status, created_at")
      .ilike("request_no", pattern)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("production_orders")
      .select("id, production_order_no, status, created_at")
      .ilike("production_order_no", pattern)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("purchase_orders")
      .select("id, purchase_order_no, status, created_at")
      .ilike("purchase_order_no", pattern)
      .order("created_at", { ascending: false })
      .limit(5)
  ]);

  const productRows = (productResult.data ?? []) as ProductSearchRow[];
  const skuRows = (skuResult.data ?? []) as SkuSearchRow[];
  const fbaRows = (fbaResult.data ?? []) as FbaSearchRow[];
  const productionRows = (productionResult.data ?? []) as ProductionSearchRow[];
  const purchaseRows = (purchaseResult.data ?? []) as PurchaseSearchRow[];

  const productResults: GlobalSearchResult[] = productRows.map((product) => ({
    id: `product-${product.id}`,
    type: "产品/SKU",
    title: `${product.product_code} / ${product.name}`,
    description: product.category ? `产品 · ${product.category}` : "产品",
    href: withKeyword("/admin/products", normalizedKeyword)
  }));

  const skuResults: GlobalSearchResult[] = skuRows.map((sku) => {
    const isMaterial = sku.sku_type === "material";

    return {
      id: `sku-${sku.id}`,
      type: isMaterial ? "原材料" : "产品/SKU",
      title: `${sku.sku_code} / ${sku.sku_name}`,
      description: isMaterial ? "原材料 SKU" : "SKU",
      href: withKeyword(isMaterial ? "/admin/materials" : "/admin/skus", normalizedKeyword)
    };
  });

  const documentResults: GlobalSearchResult[] = [
    ...fbaRows.map((row) => ({
      id: `fba-${row.id}`,
      type: "单据" as const,
      title: row.request_no,
      description: `备货需求 · ${row.status}`,
      href: withKeyword("/replenishment", normalizedKeyword)
    })),
    ...productionRows.map((row) => ({
      id: `production-${row.id}`,
      type: "单据" as const,
      title: row.production_order_no,
      description: `生产任务 · ${row.status}`,
      href: withKeyword("/production/orders", normalizedKeyword)
    })),
    ...purchaseRows.map((row) => ({
      id: `purchase-${row.id}`,
      type: "单据" as const,
      title: row.purchase_order_no,
      description: `采购单 · ${row.status}`,
      href: withKeyword("/purchase/orders", normalizedKeyword)
    }))
  ];

  return [
    ...menuResults.slice(0, 8),
    ...documentResults,
    ...productResults,
    ...skuResults
  ];
}
