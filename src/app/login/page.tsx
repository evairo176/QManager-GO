import LoginComponent from "@/components/auth/login-component";
import {
  LoginChromeFooter,
  LoginChromeHeader,
} from "@/components/auth/login-chrome";
import { AuroraBackdrop } from "@/components/aurora-backdrop";

// =============================================================================
// /login page wrapper
// =============================================================================
// Three-row viewport scaffold: chrome header (wordmark + lang/theme cluster)
// pinned top, login form centered in the middle, copyright pinned bottom.
// AuroraBackdrop supplies a GSAP-web living gradient + dot grid behind the
// glass card, so the gate feels like a boutique product, not a form.
// =============================================================================

const LoginPage = () => {
  return (
    <div className="bg-background relative flex min-h-svh flex-col font-sans overflow-hidden">
      <AuroraBackdrop />
      <LoginChromeHeader />
      <main className="flex flex-1 items-center justify-center px-4 pb-6">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-border/60 bg-background/70 backdrop-blur-xl shadow-2xl shadow-primary/5 px-6 py-8">
            <LoginComponent />
          </div>
        </div>
      </main>
      <LoginChromeFooter />
    </div>
  );
};

export default LoginPage;
