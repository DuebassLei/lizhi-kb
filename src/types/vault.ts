/** 与 Rust VaultService 对齐的 DTO */

export interface VaultStatus {
  exists: boolean;
  isLocked: boolean;
  encryptionEnabled: boolean;
  lockOnStartup: boolean;
  vaultId: string | null;
  schemaVersion: number | null;
}

export interface VaultMeta {
  vaultId: string;
  schemaVersion: number;
  encryptionEnabled: boolean;
  lockOnStartup?: boolean | null;
  createdAt: number;
  hint?: string;
}

export interface CreateVaultResult {
  meta: VaultMeta;
  recoveryPhrase: string;
}

export interface EnableEncryptionResult {
  meta: VaultMeta;
  recoveryPhrase: string;
}

export interface BackupValidation {
  valid: boolean;
  vaultId: string | null;
  encryptionEnabled: boolean;
  fileCount: number;
  error: string | null;
}

export interface ImportResult {
  success: boolean;
  requiresRestart: boolean;
  vaultId: string;
  mergedDocuments?: number;
  mergedAssets?: number;
}

export interface LockState {
  isLocked: boolean;
  failCount: number;
  lockCountdownSec: number | null;
}

export type VaultErrorCode =
  | "VAULT_LOCKED"
  | "WRONG_PASSWORD"
  | "INVALID_RECOVERY_PHRASE"
  | "IO_ERROR"
  | "VAULT_NOT_FOUND";
