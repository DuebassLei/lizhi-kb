import type { CredentialEnvironment, CredentialEnvironmentFilter } from "../types/credential";

export interface CredentialEnvironmentOption {
  value: CredentialEnvironment;
  label: string;
  badgeClass: string;
}

export const CREDENTIAL_ENVIRONMENTS: CredentialEnvironmentOption[] = [
  { value: "test", label: "测试", badgeClass: "credential-env--test" },
  { value: "prod", label: "生产", badgeClass: "credential-env--prod" },
  { value: "local", label: "本地", badgeClass: "credential-env--local" },
  { value: "public", label: "公网", badgeClass: "credential-env--public" },
];

export const CREDENTIAL_ENVIRONMENT_LABELS: Record<CredentialEnvironment, string> = {
  test: "测试",
  prod: "生产",
  local: "本地",
  public: "公网",
};

export const CREDENTIAL_ENVIRONMENT_FILTERS: { value: CredentialEnvironmentFilter; label: string }[] =
  [{ value: "all", label: "全部" }, ...CREDENTIAL_ENVIRONMENTS.map((e) => ({ value: e.value, label: e.label }))];

export function getEnvironmentOption(env: CredentialEnvironment): CredentialEnvironmentOption {
  return CREDENTIAL_ENVIRONMENTS.find((e) => e.value === env) ?? CREDENTIAL_ENVIRONMENTS[2];
}
