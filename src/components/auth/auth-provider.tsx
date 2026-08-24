"use client";

/**
 * Auth gate — redirects to login if the indicator cookie is missing.
 * Sync check, no API call, no loading state.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  if (typeof document !== "undefined" && !document.cookie.includes("qm_logged_in=1")) {
    // Sync redirect during render (not in an effect) is intentional: an
    // effect-based redirect would briefly flash protected content to a logged-out
    // user. Navigation unmounts immediately, so the side effect is benign.
    // eslint-disable-next-line react-hooks/immutability -- intentional sync redirect to avoid flashing protected content; navigates away immediately
    window.location.href = "/login/";
    return null;
  }
  return <>{children}</>;
}
