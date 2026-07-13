import { tauriInvoke } from "../composables/useTauriCommand";
import type {
  BackupValidation,
  CreateVaultResult,
  EnableEncryptionResult,
  ImportResult,
  VaultStatus,
} from "../types/vault";

export async function getVaultStatus(): Promise<VaultStatus> {
  return tauriInvoke<VaultStatus>("get_vault_status");
}

export async function createVault(
  password: string,
  hint?: string,
  lockOnStartup?: boolean,
): Promise<CreateVaultResult> {
  return tauriInvoke<CreateVaultResult>("create_vault", {
    password,
    hint: hint ?? null,
    lockOnStartup: lockOnStartup ?? null,
  });
}

export async function unlockVault(password: string): Promise<VaultStatus> {
  return tauriInvoke<VaultStatus>("unlock_vault", { password });
}

export async function getVaultLockoutStatus(): Promise<number> {
  return tauriInvoke<number>("get_vault_lockout_status");
}

export async function lockVault(): Promise<void> {
  return tauriInvoke<void>("lock_vault");
}

export async function enableEncryption(
  password: string,
  lockOnStartup?: boolean,
): Promise<EnableEncryptionResult> {
  return tauriInvoke<EnableEncryptionResult>("enable_encryption", {
    password,
    lockOnStartup: lockOnStartup ?? null,
  });
}

export async function setLockOnStartup(
  enabled: boolean,
  password: string,
): Promise<VaultStatus> {
  return tauriInvoke<VaultStatus>("set_lock_on_startup", { enabled, password });
}

export async function exportVault(
  destPath: string,
  password?: string,
): Promise<string> {
  return tauriInvoke<string>("export_vault", {
    destPath,
    password: password ?? null,
  });
}

export async function validateVaultBackup(path: string): Promise<BackupValidation> {
  return tauriInvoke<BackupValidation>("validate_vault_backup", { path });
}

export async function importVault(
  srcPath: string,
  password: string,
  mode: "replace" | "merge" | "merge-documents" = "replace",
  recoveryPhrase?: string,
): Promise<ImportResult> {
  return tauriInvoke<ImportResult>("import_vault", {
    srcPath,
    password,
    recoveryPhrase: recoveryPhrase?.trim() || null,
    mode,
  });
}

export async function exportMarkdownFolder(
  destDir: string,
  files: Array<{ relativePath: string; content: string }>,
): Promise<{ fileCount: number; destDir: string }> {
  return tauriInvoke("export_markdown_folder", { destDir, files });
}

export async function exportObsidianVault(
  destDir: string,
  files: Array<{ relativePath: string; content: string }>,
  assetsList: Array<{ relativePath: string; assetId: string }>,
): Promise<{ fileCount: number; assetCount: number; destDir: string }> {
  return tauriInvoke("export_obsidian_vault", { destDir, files, assetsList });
}

export async function unlockVaultWithRecovery(recoveryPhrase: string): Promise<VaultStatus> {
  return tauriInvoke<VaultStatus>("unlock_vault_with_recovery", {
    recoveryPhrase: recoveryPhrase.trim(),
  });
}

export async function resetPasswordWithRecovery(
  recoveryPhrase: string,
  newPassword: string,
): Promise<VaultStatus> {
  return tauriInvoke<VaultStatus>("reset_password_with_recovery", {
    recoveryPhrase: recoveryPhrase.trim(),
    newPassword,
  });
}

export async function relaunchApp(): Promise<void> {
  const { relaunch, exit } = await import("@tauri-apps/plugin-process");
  await relaunch();
  await exit(0);
}

export function isTauriRuntime(): boolean {
  return !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}
