export type MarketplaceOption = {
  value: string;
  label: string;
};

export const marketplaceOptions: MarketplaceOption[] = [
  { value: "US", label: "美国站" },
  { value: "CA", label: "加拿大站" },
  { value: "MX", label: "墨西哥站" },
  { value: "UK", label: "英国站" },
  { value: "DE", label: "德国站" },
  { value: "FR", label: "法国站" },
  { value: "IT", label: "意大利站" },
  { value: "ES", label: "西班牙站" },
  { value: "NL", label: "荷兰站" },
  { value: "SE", label: "瑞典站" },
  { value: "PL", label: "波兰站" },
  { value: "BE", label: "比利时站" },
  { value: "TR", label: "土耳其站" },
  { value: "JP", label: "日本站" },
  { value: "AU", label: "澳洲站" },
  { value: "SG", label: "新加坡站" },
  { value: "AE", label: "阿联酋站" },
  { value: "SA", label: "沙特站" },
  { value: "IN", label: "印度站" },
  { value: "BR", label: "巴西站" },
  { value: "EG", label: "埃及站" },
  { value: "ZA", label: "南非站" },
  { value: "WALMART", label: "沃尔玛" }
];

const marketplaceByValue = new Map(
  marketplaceOptions.map((option) => [option.value.toUpperCase(), option])
);

const marketplaceByLabel = new Map(
  marketplaceOptions.map((option) => [option.label, option])
);

export function normalizeMarketplaceValue(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return "";
  }

  return (
    marketplaceByLabel.get(normalized)?.value ??
    marketplaceByValue.get(normalized.toUpperCase())?.value ??
    normalized
  );
}

export function formatMarketplace(value: string | null | undefined) {
  const normalized = normalizeMarketplaceValue(value);

  if (!normalized || normalized === "-") {
    return "-";
  }

  return marketplaceByValue.get(normalized.toUpperCase())?.label ?? normalized;
}
