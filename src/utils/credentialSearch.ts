import { CREDENTIAL_CATEGORY_LABELS } from "../constants/credentialCategories";
import { CREDENTIAL_ENVIRONMENT_LABELS } from "../constants/credentialEnvironments";
import type { CredentialEntryListItem } from "../types/credential";

export function filterCredentialEntries(
  entries: CredentialEntryListItem[],
  query: string,
): CredentialEntryListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;

  return entries.filter((entry) => {
    const haystack = [
      entry.title,
      entry.username,
      entry.url ?? "",
      entry.notes ?? "",
      CREDENTIAL_CATEGORY_LABELS[entry.category],
      CREDENTIAL_ENVIRONMENT_LABELS[entry.environment],
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
