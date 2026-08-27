"use client";

import { useQuery, useMutation } from "@tanstack/react-query";

const CHECK_ENDPOINT = "/cgi-bin/quecmanager/auth/check.sh";
const LOGIN_ENDPOINT = "/cgi-bin/quecmanager/auth/login.sh";
const LOGOUT_ENDPOINT = "/cgi-bin/quecmanager/auth/logout.sh";
const PASSWORD_ENDPOINT = "/cgi-bin/quecmanager/auth/password.sh";

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

export function isLoggedIn(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("qm_logged_in=1");
}

function clearIndicatorCookie() {
  document.cookie = "qm_logged_in=; Path=/; Max-Age=0";
}

// ---------------------------------------------------------------------------
// Hook for login page (setup detection + login/setup actions)
// ---------------------------------------------------------------------------

export type LoginStatus = "loading" | "ready" | "setup_required";

export function useLogin() {
  const checkQuery = useQuery<{ setup_required?: boolean }>({
    queryKey: ["auth-check"],
    queryFn: async () => {
      const r = await fetch(CHECK_ENDPOINT);
      if (!r.ok) return { setup_required: false };
      return r.json();
    },
    // Run once on mount; not re-fetched.
    staleTime: Infinity,
    retry: false,
  });

  // If already logged in, redirect to dashboard.
  const status: LoginStatus = isLoggedIn()
    ? "ready"
    : checkQuery.isLoading || checkQuery.isPending
      ? "loading"
      : checkQuery.data?.setup_required
        ? "setup_required"
        : "ready";

  const loginMutation = useMutation({
    mutationFn: async (
      password: string,
    ): Promise<{ success: boolean; error?: string; retry_after?: number }> => {
      try {
        const resp = await fetch(LOGIN_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = await resp.json();

        if (data.success) {
          // Cookie is set by the backend — just redirect
          window.location.href = "/dashboard/";
          return { success: true };
        }

        if (data.error === "setup_required") {
          return { success: false, error: "setup_required" };
        }

        return {
          success: false,
          error: data.detail || data.error || "Invalid password",
          retry_after: data.retry_after,
        };
      } catch {
        return { success: false, error: "Connection failed" };
      }
    },
  });

  const setupMutation = useMutation({
    mutationFn: async (args: {
      password: string;
      confirm: string;
      enforceStrong?: boolean;
    }): Promise<{ success: boolean; error?: string }> => {
      try {
        const resp = await fetch(LOGIN_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password: args.password,
            confirm: args.confirm,
            enforce_strong: args.enforceStrong ?? true,
          }),
        });
        const data = await resp.json();

        if (data.success) {
          window.location.href = "/dashboard/";
          return { success: true };
        }

        return {
          success: false,
          error: data.detail || data.error || "Setup failed",
        };
      } catch {
        return { success: false, error: "Connection failed" };
      }
    },
  });

  const login = (password: string) => loginMutation.mutateAsync(password);
  const setup = (
    password: string,
    confirm: string,
    enforceStrong: boolean = true,
  ) => setupMutation.mutateAsync({ password, confirm, enforceStrong });

  return { status, login, setup };
}

// ---------------------------------------------------------------------------
// Standalone setup (used by onboarding wizard — does NOT redirect on success)
// ---------------------------------------------------------------------------

export async function setupPassword(
  password: string,
  confirm: string,
  enforceStrong: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    const resp = await fetch(LOGIN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, confirm, enforce_strong: enforceStrong }),
    });
    const data = await resp.json();

    if (data.success) {
      return { success: true };
    }

    return {
      success: false,
      error: data.detail || data.error || "Setup failed",
    };
  } catch {
    return { success: false, error: "Connection failed" };
  }
}

// ---------------------------------------------------------------------------
// Actions (used by sidebar menu / change password dialog)
// ---------------------------------------------------------------------------

export async function logout(): Promise<void> {
  try {
    await fetch(LOGOUT_ENDPOINT, { method: "POST" });
  } catch {
    // Ignore network errors on logout
  } finally {
    clearIndicatorCookie();
    window.location.href = "/";
  }
}

export async function changePassword(
  current: string,
  newPassword: string,
  enforceStrong: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    const resp = await fetch(PASSWORD_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: current,
        new_password: newPassword,
        enforce_strong: enforceStrong,
      }),
    });
    const data = await resp.json();

    if (data.success) {
      clearIndicatorCookie();
      window.location.href = "/login/";
      return { success: true };
    }

    return {
      success: false,
      error: data.detail || data.error || "Password change failed",
    };
  } catch {
    return { success: false, error: "Connection failed" };
  }
}
