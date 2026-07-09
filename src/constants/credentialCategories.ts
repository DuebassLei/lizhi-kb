import type { CredentialCategory, CredentialCategoryFilter } from "../types/credential";

export interface CredentialCategoryOption {
  value: CredentialCategory;
  label: string;
}

export const CREDENTIAL_CATEGORIES: CredentialCategoryOption[] = [
  { value: "personal", label: "个人" },
  { value: "system", label: "系统" },
  { value: "database", label: "数据库" },
  { value: "cloud", label: "云服务" },
  { value: "intranet", label: "内网" },
  { value: "other", label: "其他" },
];

export const CREDENTIAL_CATEGORY_LABELS: Record<CredentialCategory, string> = {
  personal: "个人",
  system: "系统",
  database: "数据库",
  cloud: "云服务",
  intranet: "内网",
  other: "其他",
};

export const CREDENTIAL_CATEGORY_FILTERS: { value: CredentialCategoryFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "favorites", label: "收藏" },
  { value: "personal", label: "个人" },
  ...CREDENTIAL_CATEGORIES.filter((c) => c.value !== "personal"),
];

export function getCategoryLabel(category: CredentialCategory): string {
  return CREDENTIAL_CATEGORY_LABELS[category] ?? category;
}
