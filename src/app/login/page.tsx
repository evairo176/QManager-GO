import LoginComponent from "@/components/auth/login-component";
import {
  LoginChromeFooter,
  LoginChromeHeader,
} from "@/components/auth/login-chrome";

// =============================================================================
// /login page wrapper
// =============================================================================
// Three-row viewport scaffold: chrome header (wordmark + lang/theme cluster)
// pinned top, login form centered in the middle, copyright pinned bottom.
// No Card chrome wraps the form: a one-input gate doesn't earn a container,
// and stripping it lets the hostname-led title block be the page subject
// rather than something inside a rectangle. Continuity with `/` (the
// Overview) is carried by typography, motion, and the banner pattern, not
// by a shared silhouette.
// =============================================================================

const LoginPage = () => {
  return (
    <div className="bg-background flex min-h-svh flex-col font-sans">
      <LoginChromeHeader />
      <main className="flex flex-1 items-center justify-center px-4 pb-6">
        <div className="w-full max-w-sm">
          <LoginComponent />
        </div>
      </main>
      <LoginChromeFooter />
    </div>
  );
};

export default LoginPage;
