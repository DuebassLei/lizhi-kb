export type CredentialEnvironment = "test" | "prod" | "local" | "public";

export type CredentialCategory = "personal" | "system" | "database" | "cloud" | "intranet" | "other";

export interface CredentialEntryListItem {
  id: string;
  title: string;
  category: CredentialCategory;
  environment: CredentialEnvironment;
  username: string;
  passwordMasked: string;
  url?: string;
  notes?: string;
  isFavorite: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface CredentialEntry extends Omit<CredentialEntryListItem, "passwordMasked"> {
  password: string;
}

export type CredentialCategoryFilter = CredentialCategory | "all" | "favorites";

export type CredentialEnvironmentFilter = CredentialEnvironment | "all";

export interface CreateCredentialInput {
  title: string;
  category?: CredentialCategory;
  environment?: CredentialEnvironment;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  isFavorite?: boolean;
}

export interface UpdateCredentialPatch {
  title?: string;
  category?: CredentialCategory;
  environment?: CredentialEnvironment;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  isFavorite?: boolean;
}

export type CredentialCopyField = "password" | "username" | "url" | "usernamePassword" | "all";
