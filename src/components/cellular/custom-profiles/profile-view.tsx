"use client";

import React from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  CalendarClockIcon,
  CheckCircle2Icon,
  Loader2Icon,
  MinusCircleIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlayIcon,
  PowerIcon,
  RouteIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import EmptyProfileComponent from "./empty-profile";
import { ApplyProgressDialog } from "./apply-progress-dialog";
import type { UseSimProfilesReturn } from "@/hooks/use-sim-profiles";
import { useProfileApply } from "@/hooks/use-profile-apply";
import { useScenarioList } from "@/hooks/use-scenario-list";
import {
  formatProfileDate,
  type ProfileSummary,
  type SimProfile,
  type PdpType,
} from "@/types/sim-profile";
import { setPendingReboot } from "@/lib/reboot/pending";

// -----------------------------------------------------------------------------
// Profile view — the live "Saved Profiles" list.
// -----------------------------------------------------------------------------
// Wired to the backend via the shared `useSimProfiles` instance (passed from the
// coordinator) plus `useProfileApply` for activation. The card wraps the whole
// list (Card-Wrapped Surface Rule); profiles render as a vertical stack of
// self-contained rows, not a grid of nested cards, because this card already
// lives in one column of the page's 2-col grid.
//
// Data-shape note: list.sh returns summaries only (no APN/TTL/HL/IMEI), so each
// row lazy-loads the full profile via get.sh to populate its config pills, with
// a skeleton in the gap. SIM-mismatch is derived client-side by comparing the
// profile's stored ICCID against the live SIM ICCID — empty ICCID is
// SIM-agnostic and never mismatches.

// Cap how many rows stagger so a long roster never plays a long page-load
// cascade. Beyond this index, rows enter together at the cap delay.
const STAGGER_STEP_MS = 40;
const STAGGER_MAX_ROWS = 4;

type ProfileStatus = "active" | "mismatch" | "inactive";

// Status is derived at render time, never stored. Matches the proven
// deriveProfileState logic: a profile is only "mismatch" while it is the active
// one AND carries an ICCID that no longer matches the inserted SIM.
function deriveStatus(
  isActive: boolean,
  profileIccid: string,
  currentIccid: string | null,
): ProfileStatus {
  if (!isActive) return "inactive";
  if (profileIccid && currentIccid && profileIccid !== currentIccid) {
    return "mismatch";
  }
  return "active";
}

interface ProfileViewProps {
  sim: UseSimProfilesReturn;
  /** Live SIM ICCID from current_settings.sh, for mismatch detection. */
  currentIccid: string | null;
  /** Hand a profile to the left card for editing. */
  onEdit: (id: string) => void;
}

const ProfileViewComponent = ({ sim, currentIccid, onEdit }: ProfileViewProps) => {
  const { t } = useTranslation("cellular");
  const { profiles, activeProfileId, isLoading, getProfile } = sim;
  const { deleteProfile, deactivateProfile, refresh } = sim;
  const { nameForId } = useScenarioList();

  const { applyProfile, applyState, error: applyError, reset } =
    useProfileApply();
  // The progress dialog is the apply surface now: opening it on Activate means
  // the user always sees step-by-step progress instead of an indefinite button
  // spinner. The dialog itself only allows close on a terminal state.
  const [applyOpen, setApplyOpen] = React.useState(false);

  const [pendingDelete, setPendingDelete] = React.useState<ProfileSummary | null>(
    null,
  );

  const handleActivate = (id: string) => {
    setApplyOpen(true);
    applyProfile(id);
  };

  // On dialog close: refresh the list if the apply landed, and defer the
  // IMEI-change reboot. Read requires_reboot BEFORE reset() clears applyState.
  const handleApplyClose = () => {
    const finished = applyState?.status;
    const needsReboot = applyState?.requires_reboot === true;
    const succeeded = finished === "complete" || finished === "partial";

    setApplyOpen(false);
    reset();

    if (succeeded) {
      refresh();
      if (needsReboot) setPendingReboot("imei");
    }
  };

  // A terminal apply state means the dialog's close affordance is live; until
  // then the Activate button shows a small spinner for affordance only.
  const applyTerminal =
    applyState?.status === "complete" ||
    applyState?.status === "partial" ||
    applyState?.status === "failed";

  const handleDeactivate = async (profile: ProfileSummary) => {
    const { success, requiresReboot } = await deactivateProfile();
    if (success) {
      toast.success(
        t("custom_profiles.view.toast.deactivated", { name: profile.name }),
      );
      if (requiresReboot) setPendingReboot("verizon_revert");
    } else {
      toast.error(
        sim.error || t("custom_profiles.view.toast.deactivate_error"),
      );
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    const ok = await deleteProfile(target.id);
    if (ok)
      toast.success(
        t("custom_profiles.view.toast.deleted", { name: target.name }),
      );
    else
      toast.error(sim.error || t("custom_profiles.view.toast.delete_error"));
  };

  // ---- Detail hydration -----------------------------------------------------
  // list.sh returns summaries only (no APN/CID/PDP/TTL/HL/IMEI). Letting each
  // row lazy-load its own config produced a SECOND shimmer after the list
  // skeleton had already cleared. Instead we prefetch every profile's full
  // config up front and hold the single list skeleton until they are all in —
  // one loading state on page load, and rows arrive fully populated. The effect
  // re-runs whenever the backend hands back a fresh `profiles` array (initial
  // load, create, edit, delete, activate); since `detailsHydrated` is only ever
  // set true, those later runs refresh in the background without re-flashing
  // the skeleton. Keyed on `profiles` (not a roster-signature ref) so React
  // StrictMode's mount/cleanup/mount cycle always lands on a run that resolves.
  const [details, setDetails] = React.useState<Record<string, SimProfile>>({});
  const [detailsHydrated, setDetailsHydrated] = React.useState(false);

  React.useEffect(() => {
    // Don't hydrate until the summary fetch has actually returned. While the
    // initial list is still loading, `profiles` is transiently [] — treating
    // that as "hydrated" would clear the skeleton early and let the pills pop
    // in a beat after the rows. Keep the skeleton up until isLoading settles.
    if (isLoading) return;

    if (profiles.length === 0) {
      setDetails({});
      setDetailsHydrated(true);
      return;
    }

    let cancelled = false;
    Promise.all(profiles.map((p) => getProfile(p.id))).then((results) => {
      if (cancelled) return;
      const next: Record<string, SimProfile> = {};
      profiles.forEach((p, i) => {
        if (results[i]) next[p.id] = results[i] as SimProfile;
      });
      setDetails(next);
      setDetailsHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [profiles, getProfile, isLoading]);

  // One skeleton, gated on BOTH the summary fetch and the detail prefetch.
  const showSkeleton =
    (isLoading && profiles.length === 0) ||
    (profiles.length > 0 && !detailsHydrated);

  // Active profile leads; the rest keep backend order.
  const ordered = React.useMemo(() => {
    return [...profiles].sort((a, b) => {
      const aActive = a.id === activeProfileId ? 0 : 1;
      const bActive = b.id === activeProfileId ? 0 : 1;
      return aActive - bActive;
    });
  }, [profiles, activeProfileId]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("custom_profiles.view.title")}</CardTitle>
        <CardDescription>
          {t("custom_profiles.view.subtitle")}
        </CardDescription>
        {profiles.length > 0 && (
          <CardAction>
            <Badge
              variant="outline"
              className="text-muted-foreground tabular-nums"
            >
              {profiles.length}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {showSkeleton ? (
          <ListSkeleton />
        ) : profiles.length === 0 ? (
          <EmptyProfileComponent />
        ) : (
          // Cap the list height so a long roster scrolls instead of stretching
          // the card past its sibling. The active profile is sorted to the top,
          // so it stays in view; the -mr/pr pair gives the scrollbar a gutter
          // without nudging the rows. Below the cap, height is natural (no
          // scrollbar appears until the rows actually overflow).
          <div className="-mr-2 max-h-128 overflow-x-hidden overflow-y-auto pr-2 [scrollbar-width:thin]">
            <div className="flex flex-col gap-3">
              {ordered.map((profile, i) => (
                <ProfileRow
                  key={profile.id}
                  summary={profile}
                  status={deriveStatus(
                    profile.id === activeProfileId,
                    profile.sim_iccid,
                    currentIccid,
                  )}
                  index={i}
                  scenarioName={nameForId(profile.scenario.default)}
                  busy={
                    applyOpen &&
                    !applyTerminal &&
                    applyState?.profile_id === profile.id
                  }
                  full={details[profile.id] ?? null}
                  onActivate={() => handleActivate(profile.id)}
                  onDeactivate={() => handleDeactivate(profile)}
                  onEdit={() => onEdit(profile.id)}
                  onDelete={() => setPendingDelete(profile)}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Delete confirmation — destructive, so it always asks first. */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("custom_profiles.view.delete_title", {
                name: pendingDelete?.name ?? "",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("custom_profiles.view.delete_description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("custom_profiles.view.delete_keep")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20"
            >
              {t("custom_profiles.table.actions_menu.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Apply pipeline progress — the restored Sequenced Pipeline Dialog. */}
      <ApplyProgressDialog
        open={applyOpen}
        applyState={applyState}
        error={applyError}
        onClose={handleApplyClose}
      />
    </Card>
  );
};

// -----------------------------------------------------------------------------
// Profile row — one self-contained panel in the stacked list.
// -----------------------------------------------------------------------------
const ProfileRow = ({
  summary,
  status,
  index,
  scenarioName,
  busy,
  full,
  onActivate,
  onDeactivate,
  onEdit,
  onDelete,
}: {
  summary: ProfileSummary;
  status: ProfileStatus;
  index: number;
  scenarioName: string;
  busy: boolean;
  /** Full config, prefetched by the view so the row arrives populated. */
  full: SimProfile | null;
  onActivate: () => void;
  onDeactivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const { t } = useTranslation("cellular");
  const isActive = status !== "inactive";
  const scheduled = summary.scenario.schedule.enabled;

  const verizonMpdn = summary.mno === "Verizon";

  return (
    <div
      style={{
        animationDelay: `${Math.min(index, STAGGER_MAX_ROWS) * STAGGER_STEP_MS}ms`,
        animationDuration: "300ms",
        animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3",
        "transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
        "animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both motion-reduce:animate-none",
        status === "active" && "border-success/40 bg-success/5",
        status === "mismatch" && "border-warning/40 bg-warning/5",
        status === "inactive" && "bg-muted/20",
      )}
    >
      {/* Identity + status + overflow */}
      <div className="flex items-start justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <div className="flex items-center gap-1.5">
            {status === "active" && (
              // Live-ping: a solid dot with a pulsing halo behind it (the
              // system pulse-ring keyframe, disabled under reduced motion).
              // Calmer and more "alive" than a hard opacity blink.
              <span className="relative flex size-1.5 shrink-0" aria-hidden>
                <span className="bg-success/50 animate-pulse-ring absolute inline-flex size-full rounded-full" />
                <span className="bg-success relative inline-flex size-1.5 rounded-full" />
              </span>
            )}
            <span className="truncate text-sm font-semibold">
              {summary.name}
            </span>
          </div>
          <span className="text-muted-foreground truncate text-xs">
            {summary.mno}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge status={status} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground size-7"
                aria-label={t("custom_profiles.table.actions_menu.open_menu")}
              >
                <MoreVerticalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onEdit}>
                <PencilIcon className="size-4" />
                {t("custom_profiles.table.actions_menu.edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2Icon className="size-4" />
                {t("custom_profiles.table.actions_menu.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Scenario binding line */}
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {scheduled ? (
          <CalendarClockIcon className="size-3.5 shrink-0" />
        ) : (
          <RouteIcon className="size-3.5 shrink-0" />
        )}
        <span className="truncate">
          {scheduled
            ? t("custom_profiles.view.scenario_scheduled", {
                scenario: scenarioName,
              })
            : t("custom_profiles.view.scenario_always_on", {
                scenario: scenarioName,
              })}
        </span>
      </div>

      {/* Config readout — prefetched by the view, so the pills arrive with the
          row as part of its entrance rather than as a second loading state. */}
      {full && <ConfigPills profile={full} verizonMpdn={verizonMpdn} />}

      {/* SIM mismatch note — only when the active profile no longer matches the SIM */}
      {status === "mismatch" && (
        <div className="text-warning bg-warning/10 flex items-start gap-2 rounded-md p-2 text-xs">
          <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
          <span>{t("custom_profiles.view.mismatch_note")}</span>
        </div>
      )}

      {/* Action */}
      <div className="flex items-center justify-between gap-3 pt-0.5">
        <span className="text-muted-foreground text-[11px]">
          {t("custom_profiles.card.label_updated")}{" "}
          {formatProfileDate(summary.updated_at)}
        </span>
        {isActive ? (
          <Button variant="secondary" size="sm" onClick={onDeactivate}>
            <PowerIcon className="size-4" />
            {t("custom_profiles.table.actions_menu.deactivate")}
          </Button>
        ) : (
          <Button size="sm" onClick={onActivate} disabled={busy}>
            {busy ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <PlayIcon className="size-4" />
            )}
            {busy
              ? t("custom_profiles.view.activating")
              : t("custom_profiles.table.actions_menu.activate")}
          </Button>
        )}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Status badge — outline pattern per DESIGN.md (bg/15 text border/30 + size-3).
// -----------------------------------------------------------------------------
const StatusBadge = ({ status }: { status: ProfileStatus }) => {
  if (status === "active") {
    return (
      <Badge
        variant="outline"
        className="border-success/30 bg-success/15 text-success"
      >
        <CheckCircle2Icon className="size-3" />
        Active
      </Badge>
    );
  }
  if (status === "mismatch") {
    return (
      <Badge
        variant="outline"
        className="border-warning/30 bg-warning/15 text-warning"
      >
        <TriangleAlertIcon className="size-3" />
        SIM Mismatch
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-muted-foreground/30 bg-muted/50 text-muted-foreground"
    >
      <MinusCircleIcon className="size-3" />
      Inactive
    </Badge>
  );
};

// -----------------------------------------------------------------------------
// Config pills — dense outline tags describing what a profile does.
// -----------------------------------------------------------------------------
// neutral = routine settings; info = settings that carry consequence (an IMEI
// rewrite reboots the modem on activation, Verizon MPDN locks data routing).
const Pill = ({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "info";
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium tabular-nums",
      tone === "info"
        ? "border-info/30 bg-info/10 text-info"
        : "border-border bg-muted/40 text-muted-foreground",
    )}
  >
    {children}
  </span>
);

const PDP_PILL_KEY: Record<PdpType, string> = {
  IP: "custom_profiles.pills.ip_v4",
  IPV6: "custom_profiles.pills.ip_v6",
  IPV4V6: "custom_profiles.pills.ip_dual",
};

const ConfigPills = ({
  profile,
  verizonMpdn,
}: {
  profile: SimProfile;
  verizonMpdn: boolean;
}) => {
  const { t } = useTranslation("cellular");
  const { apn, imei, ttl, hl } = profile.settings;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Pill>
        {apn.name.trim()
          ? t("custom_profiles.pills.apn", { name: apn.name })
          : t("custom_profiles.pills.apn_default")}
      </Pill>
      <Pill>{t("custom_profiles.pills.cid", { cid: apn.cid })}</Pill>
      <Pill>
        {PDP_PILL_KEY[apn.pdp_type] ? t(PDP_PILL_KEY[apn.pdp_type]) : apn.pdp_type}
      </Pill>
      {ttl > 0 && <Pill>{t("custom_profiles.pills.ttl", { value: ttl })}</Pill>}
      {hl > 0 && <Pill>{t("custom_profiles.pills.hl", { value: hl })}</Pill>}
      {imei.trim() !== "" && (
        <Pill tone="info">{t("custom_profiles.pills.imei_override")}</Pill>
      )}
      {verizonMpdn && (
        <Pill tone="info">{t("custom_profiles.pills.mpdn_locked")}</Pill>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Loading affordance — built from the shared Skeleton primitive (the app-wide
// loading standard), shaped to the populated row so there is no reflow when
// content lands. Reduced motion is handled by the Skeleton component itself.
// -----------------------------------------------------------------------------
const SkeletonRow = () => (
  <div className="flex flex-col gap-3 rounded-lg border p-3">
    {/* Identity + status + overflow */}
    <div className="flex items-start justify-between gap-3">
      <div className="grid gap-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="size-7" />
      </div>
    </div>
    {/* Scenario binding line */}
    <div className="flex items-center gap-1.5">
      <Skeleton className="size-3.5 shrink-0 rounded-full" />
      <Skeleton className="h-3 w-40" />
    </div>
    {/* Config pills */}
    <div className="flex flex-wrap items-center gap-1.5">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-5 w-12" />
      <Skeleton className="h-5 w-16" />
    </div>
    {/* Action */}
    <div className="flex items-center justify-between pt-0.5">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-8 w-24" />
    </div>
  </div>
);

const ListSkeleton = () => (
  <div className="flex flex-col gap-3">
    {[0, 1].map((i) => (
      <SkeletonRow key={i} />
    ))}
  </div>
);

export default ProfileViewComponent;
