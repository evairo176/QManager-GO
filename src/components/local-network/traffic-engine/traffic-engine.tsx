"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation, Trans } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, RefreshCcwIcon } from "lucide-react";

import { useVideoOptimizer } from "@/hooks/use-video-optimizer";
import { useTrafficMasquerade } from "@/hooks/use-traffic-masquerade";
import { useTtlSettings } from "@/hooks/use-ttl-settings";

import { EngineStatusCard } from "./engine-status-card";
import { VideoOptimizerPanel } from "./video-optimizer-panel";
import { MasqueradePanel, DEFAULT_SNI_DOMAIN } from "./masquerade-panel";
import { CdnHostlistCard, HostlistSkeleton } from "./cdn-hostlist-card";
import { EngineOnboarding } from "./engine-onboarding";
import { EngineRemoveRow } from "./engine-advanced";

export type ViewMode = "video" | "masquerade";

/**
 * An in-flight engine toggle. `start` = idle → on, `stop` = on → idle,
 * `switch` = takeover (stop one mode, start the other). Drives the status
 * card's busy badge and suppresses the remove row through the poll gap so the
 * destructive affordance never flashes mid-transition.
 */
export type EngineTransition = "start" | "stop" | "switch";

type Pending = { kind: EngineTransition; target: ViewMode | null } | null;

/**
 * Tracks per-poll deltas of a cumulative counter to derive a live pkt/s rate.
 * Resets cleanly when the engine stops. 1s poll cadence means each delta ≈
 * packets/second. Uses adjust-state-during-render (no effect, no ref) so the
 * React compiler lint passes and there is no update loop.
 */
function usePacketRate(packets: number | undefined, running: boolean) {
  const [last, setLast] = useState(0);
  const [prev, setPrev] = useState<{ packets: number | null; running: boolean }>(
    { packets: null, running: false },
  );

  if (running !== prev.running) {
    setPrev({ packets: running ? packets ?? null : null, running });
    if (!running && last) setLast(0);
  } else if (running && packets !== undefined && packets !== prev.packets) {
    const base = prev.packets;
    setPrev({ packets, running });
    if (base !== null) setLast(Math.max(0, packets - base));
  }

  return last;
}

/**
 * Page-level loading placeholder. Mirrors the LOADED layout's grid exactly
 * (`@3xl/main:grid-cols-2 items-stretch`) — column 1 stacks status / tabs /
 * panel, column 2 reserves the hostlist card. Without the matching grid the
 * skeleton paints one column and the content snaps into two on every load at
 * width. `showHostlist` follows the initial mode so a Masquerade deep-link
 * doesn't flash a column it won't render.
 */
function StackSkeleton({ showHostlist }: { showHostlist: boolean }) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-6 @3xl/main:grid-cols-2">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-9 w-full rounded-lg" />
        {/* Panel block: enable row + Bypass Hotspot row + the mode's input +
            check row. Bumped from h-72 when the Bypass row was added so the
            skeleton->content swap doesn't jump. */}
        <Skeleton className="h-[22rem] w-full rounded-xl" />
      </div>
      {showHostlist && <HostlistSkeleton />}
    </div>
  );
}

/**
 * Returns true only once `active` has held for `delayMs`. Suppresses the
 * flash-of-skeleton on fast loads — and this app runs ON the modem, so loads
 * are routinely sub-100ms. setState lives only in the timer callback and the
 * cleanup (never synchronously in the effect body) to stay clear of the
 * React-compiler setState-in-effect rule.
 */
function useDelayedFlag(active: boolean, delayMs = 160) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setShown(true), delayMs);
    return () => {
      clearTimeout(id);
      setShown(false);
    };
  }, [active, delayMs]);
  return active && shown;
}

type PendingTakeover = { target: ViewMode; apply: () => void } | null;

export default function TrafficEngine() {
  const { t } = useTranslation("local-network");
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  const vo = useVideoOptimizer();
  const masq = useTrafficMasquerade();
  // Owned here (not in the row) so it survives tab switches — the row's panel
  // unmounts on every Video<->Masquerade flip, which would otherwise refetch
  // TTL and flash a spinner mid-card. Folded into the page skeleton below.
  const ttl = useTtlSettings();

  const initialMode: ViewMode =
    searchParams.get("mode") === "masquerade" ? "masquerade" : "video";
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [pendingTakeover, setPendingTakeover] = useState<PendingTakeover>(null);
  // Slide direction for the tab crossfade: +1 entering Masquerade (right tab),
  // -1 entering Video (left tab). Video is index 0, Masquerade index 1.
  const [dir, setDir] = useState(0);
  // In-flight engine toggle (start / stop / switch), or null when settled.
  // Optimistic: set the instant the user acts and held until the next poll
  // confirms the destination state, closing the ~1s gap where a connection-
  // affecting toggle was flipped but the poll hadn't caught up. Drives the busy
  // badge, the switch spinner, and remove-row suppression off one source.
  const [pending, setPending] = useState<Pending>(null);

  const setViewModeAndUrl = useCallback(
    (mode: string) => {
      if (mode !== "video" && mode !== "masquerade") return;
      setDir(mode === "masquerade" ? 1 : -1);
      setViewMode(mode);
      const params = new URLSearchParams(searchParams.toString());
      if (mode === "masquerade") params.set("mode", "masquerade");
      else params.delete("mode");
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  // --- Derived engine truth (mutex guarantees at most one running) ---
  const voRunning = vo.settings?.status === "running";
  const masqRunning = masq.settings?.status === "running";
  const activeMode: ViewMode | null = voRunning
    ? "video"
    : masqRunning
      ? "masquerade"
      : null;

  const installed = vo.settings?.binary_installed ?? false;
  const kernelOk = vo.settings?.kernel_module_loaded ?? false;
  const canEnable = installed && kernelOk;

  const engineSaving = vo.isSaving || masq.isSaving;

  // Clear the pending transition once the poll confirms the destination state:
  // start/switch settle when the target mode owns the engine; stop settles when
  // the engine is idle and no save is still in flight. Adjust-during-render —
  // no effect, no loop — so the React-compiler setState-in-effect rule passes.
  if (pending) {
    const settled =
      pending.kind === "stop"
        ? activeMode === null && !engineSaving
        : activeMode === pending.target;
    if (settled) setPending(null);
  }

  const engineBusy = pending !== null;

  const voRate = usePacketRate(vo.settings?.packets_processed, voRunning);
  const masqRate = usePacketRate(masq.settings?.packets_processed, masqRunning);

  const refreshBoth = useCallback(() => {
    vo.refresh(true);
    masq.refresh(true);
  }, [vo, masq]);

  // --- Save handlers (single call; backend auto-takes-over) ---
  const saveVideo = useCallback(
    async (enabled: boolean, desyncRepeats: number) => {
      setPending(
        enabled
          ? { kind: masqRunning ? "switch" : "start", target: "video" }
          : { kind: "stop", target: null },
      );
      const ok = await vo.saveSettings({ enabled, desync_repeats: desyncRepeats });
      if (ok) {
        toast.success(
          enabled
            ? t("traffic_engine.toast_video_enabled")
            : t("traffic_engine.toast_video_disabled"),
        );
        refreshBoth();
      } else {
        setPending(null);
        toast.error(vo.error || t("video_optimizer.toast_error_apply"));
      }
    },
    [vo, refreshBoth, t, masqRunning],
  );

  const saveMasq = useCallback(
    async (enabled: boolean, sni: string) => {
      setPending(
        enabled
          ? { kind: voRunning ? "switch" : "start", target: "masquerade" }
          : { kind: "stop", target: null },
      );
      const ok = await masq.saveSettings(enabled, sni);
      if (ok) {
        toast.success(
          enabled
            ? t("traffic_engine.toast_masquerade_enabled")
            : t("traffic_engine.toast_masquerade_disabled"),
        );
        refreshBoth();
      } else {
        setPending(null);
        toast.error(masq.error || t("masquerade.toast_error_apply"));
      }
    },
    [masq, refreshBoth, t, voRunning],
  );

  // Enabling a mode while the OTHER mode owns the engine requires confirm.
  const requestEnableVideo = useCallback(
    (desyncRepeats: number) => {
      if (masqRunning) {
        setPendingTakeover({
          target: "video",
          apply: () => saveVideo(true, desyncRepeats),
        });
        return;
      }
      saveVideo(true, desyncRepeats);
    },
    [masqRunning, saveVideo],
  );

  const requestEnableMasq = useCallback(
    (sni: string) => {
      if (voRunning) {
        setPendingTakeover({
          target: "masquerade",
          apply: () => saveMasq(true, sni),
        });
        return;
      }
      saveMasq(true, sni);
    },
    [voRunning, saveMasq],
  );

  // Safety net: if the poll never confirms (backend hiccup), don't strand the
  // status card on a busy badge forever. setState only in the timer callback, so
  // the React-compiler setState-in-effect rule is satisfied.
  useEffect(() => {
    if (pending === null) return;
    const id = setTimeout(() => setPending(null), 8000);
    return () => clearTimeout(id);
  }, [pending]);

  const videoLabel = t("traffic_engine.mode_video");
  const masqueradeLabel = t("traffic_engine.mode_masquerade");

  // --- State machine ---
  // Gate on ttl too so the Bypass Hotspot row's first fetch is covered by the
  // page skeleton — same treatment vo/masq already get; all three are fast
  // local CGI fired in parallel on mount.
  const isLoading = vo.isLoading || masq.isLoading || ttl.isLoading;
  const showSkeleton = useDelayedFlag(isLoading);
  const loadError = (vo.error && !vo.settings) || (masq.error && !masq.settings);
  const anyRunning = voRunning || masqRunning;

  // Buttery tab switch: the outgoing panel slides + fades one way while the
  // incoming panel slides in from the other side (direction from `dir`). The
  // panel and the CDN column share one duration + easing so the two timelines
  // read as a single gesture. Transforms only — no layout-property animation,
  // and the column is NOT wrapped in `layout` so routine 1s polls and result
  // alerts don't trigger unsolicited height re-eases.
  const EXPO = [0.16, 1, 0.3, 1] as const;
  const panelVariants = {
    enter: (d: number) => ({ opacity: 0, x: reduceMotion ? 0 : d * 24 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: reduceMotion ? 0 : d * -24 }),
  };
  const panelTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.32, ease: EXPO };
  const hostlistTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.32, ease: EXPO };

  return (
    <div className="@container/main mx-auto p-2">
      {/* Header spans full width; content sits in a left-aligned 2-col grid
          below it (System-Settings shape). */}
      <header className="mb-6">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">
          {t("traffic_engine.page_title")}
        </h1>
        <p className="text-muted-foreground">
          {t("traffic_engine.page_description")}
        </p>
      </header>

      {isLoading ? (
        showSkeleton ? (
          <StackSkeleton showHostlist={initialMode === "video"} />
        ) : null
      ) : loadError ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertTriangle className="size-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{t("traffic_engine.error_load_failed")}</span>
            <Button variant="outline" size="sm" onClick={() => refreshBoth()}>
              <RefreshCcwIcon className="size-3.5" />
              {t("actions.retry", { ns: "common" })}
            </Button>
          </AlertDescription>
        </Alert>
      ) : !installed ? (
        <EngineOnboarding
          installResult={vo.installResult}
          onInstall={vo.runInstall}
          onRefresh={() => vo.refresh()}
        />
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-6 @3xl/main:grid-cols-2">
          {/* Column 1: engine status, mode controls, danger zone. */}
          <div className="flex flex-col gap-6">
            <EngineStatusCard
              activeMode={activeMode}
              transition={pending?.kind}
              uptime={
                voRunning
                  ? vo.settings?.uptime ?? "0s"
                  : masq.settings?.uptime ?? "0s"
              }
              packets={
                voRunning
                  ? vo.settings?.packets_processed ?? 0
                  : masq.settings?.packets_processed ?? 0
              }
              rate={voRunning ? voRate : masqRate}
              sniDomain={masq.settings?.sni_domain}
              footer={
                // Only in the settled-idle state — never during a transition,
                // whose poll gap briefly reads as idle and would flash the
                // destructive remove row in and back out.
                !anyRunning && !engineBusy ? (
                  <EngineRemoveRow
                    isUninstalling={vo.isUninstalling}
                    onUninstall={vo.runUninstall}
                    onUninstalled={refreshBoth}
                    errorMessage={vo.error}
                  />
                ) : undefined
              }
            />

            {!kernelOk && (
              <Alert aria-live="polite">
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  <Trans
                    i18nKey="traffic_engine.alert_kernel_module_missing"
                    ns="local-network"
                    components={{
                      code: (
                        <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono" />
                      ),
                    }}
                  />
                </AlertDescription>
              </Alert>
            )}

            <Tabs value={viewMode} onValueChange={setViewModeAndUrl}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="video">
                  {videoLabel}
                  {voRunning && (
                    // Make this pulse
                    <span
                      className="ml-1.5 size-2.5 rounded-full bg-success animate-pulse"
                      aria-hidden="true"
                    />
                  )}
                </TabsTrigger>
                <TabsTrigger value="masquerade">
                  {masqueradeLabel}
                  {masqRunning && (
                    <span
                      className="ml-1.5 size-2.5 rounded-full bg-success animate-pulse"
                      aria-hidden="true"
                    />
                  )}
                </TabsTrigger>
              </TabsList>

              {/* One keyed panel crossfades over the other (relative wrapper so
                  the popLayout exit can overlay). role=tabpanel preserves the
                  tab semantics Radix's TabsContent would otherwise provide. */}
              <div className="relative mt-4">
                <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                  <motion.div
                    key={viewMode}
                    role="tabpanel"
                    custom={dir}
                    variants={panelVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={panelTransition}
                    className="flex flex-col gap-6"
                  >
                    {viewMode === "video" ? (
                      <VideoOptimizerPanel
                        hook={vo}
                        ttl={ttl}
                        running={voRunning}
                        otherOwns={masqRunning}
                        otherModeLabel={masqueradeLabel}
                        canEnable={canEnable}
                        transitioning={engineBusy}
                        onEnable={requestEnableVideo}
                        onDisable={() =>
                          saveVideo(false, vo.settings?.desync_repeats ?? 1)
                        }
                      />
                    ) : (
                      <MasqueradePanel
                        hook={masq}
                        ttl={ttl}
                        running={masqRunning}
                        otherOwns={voRunning}
                        otherModeLabel={videoLabel}
                        canEnable={canEnable}
                        transitioning={engineBusy}
                        onEnable={requestEnableMasq}
                        onDisable={() =>
                          saveMasq(
                            false,
                            masq.settings?.sni_domain ?? DEFAULT_SNI_DOMAIN,
                          )
                        }
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </Tabs>
          </div>

          {/* Column 2: the CDN hostlist is a companion to Video Optimizer; on
              the Masquerade tab this column is intentionally empty space. It
              stretches to column 1's height (h-full) so its bottom edge lines
              up instead of floating short. */}
          <AnimatePresence mode="wait" initial={false}>
            {viewMode === "video" && (
              <motion.div
                key="hostlist"
                className="h-full"
                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                transition={hostlistTransition}
              >
                <CdnHostlistCard />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Takeover confirm: switching which mode owns the single engine */}
      <AlertDialog
        open={pendingTakeover !== null}
        onOpenChange={(open) => !open && setPendingTakeover(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingTakeover &&
                t("traffic_engine.takeover_title", {
                  mode:
                    pendingTakeover.target === "video"
                      ? videoLabel
                      : masqueradeLabel,
                })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingTakeover &&
                t("traffic_engine.takeover_desc", {
                  enabling:
                    pendingTakeover.target === "video"
                      ? videoLabel
                      : masqueradeLabel,
                  stopping:
                    pendingTakeover.target === "video"
                      ? masqueradeLabel
                      : videoLabel,
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("actions.cancel", { ns: "common" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                pendingTakeover?.apply();
                setPendingTakeover(null);
              }}
            >
              {pendingTakeover &&
                t("traffic_engine.takeover_confirm", {
                  mode:
                    pendingTakeover.target === "video"
                      ? videoLabel
                      : masqueradeLabel,
                })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
