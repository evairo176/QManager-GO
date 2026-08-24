// =============================================================================
// ssh-password.ts — Types for the SSH Password change endpoint
// =============================================================================
// Mirrors the contract of /cgi-bin/quecmanager/system/ssh_password.sh.
// =============================================================================

export interface SshPasswordChangeRequest {
  current_password: string;
  new_password: string;
  enforce_strong: boolean;
}

export type SshPasswordErrorCode =
  | "method_not_allowed"
  | "missing_fields"
  | "password_weak"
  | "invalid_password"
  | "shadow_unreadable"
  | "hash_parse_failed"
  | "chpasswd_failed";

export interface SshPasswordChangeSuccess {
  success: true;
}

export interface SshPasswordChangeFailure {
  success: false;
  error: SshPasswordErrorCode | string;
  detail?: string;
}

export type SshPasswordChangeResponse =
  | SshPasswordChangeSuccess
  | SshPasswordChangeFailure;
