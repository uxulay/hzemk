export type BrandSummary = {
  id: string;
  brand_code: string;
  name: string;
  english_name: string | null;
  logo_url?: string | null;
  status?: string;
};

export function getBrandName(brand: BrandSummary | null | undefined) {
  if (!brand) {
    return "无品牌";
  }

  return brand.english_name
    ? `${brand.name} / ${brand.english_name}`
    : brand.name;
}

export function getBrandCodeName(brand: BrandSummary | null | undefined) {
  if (!brand) {
    return "无品牌";
  }

  return `${brand.brand_code} / ${getBrandName(brand)}`;
}

export function getSkuBrandLabel(input: {
  skuType?: string | null;
  product?: {
    brand?: BrandSummary | null;
  } | null;
}) {
  if (input.skuType === "material") {
    return "无品牌 / 辅料";
  }

  return getBrandName(input.product?.brand);
}
