"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import { HintIcon } from "@/components/ui/hint-icon";
import type { useVideoOptimizer } from "@/hooks/use-video-optimizer";
import type { UseTtlSettingsReturn } from "@/hooks/use-ttl-settings";
import { EngineEnableRow } from "./engine-enable-row";
import { BypassHotspotRow } from "./bypass-hotspot-row";
import { EngineCheckRow } from "./engine-check-row";
import { ResultAlert } from "./result-alert";

interface VideoOptimizerPanelProps {
  hook: ReturnType<typeof useVideoOptimizer>;
  /** Composer-owned global TTL/HL hook, for the Bypass Hotspot row. */
  ttl: UseTtlSettingsReturn;
  /** Whether Video Optimizer owns the engine. */
  running: boolean;
  /** Whether Masquerade owns the engine (enabling video takes over). */
  otherOwns: boolean;
  otherModeLabel: string;
  canEnable: boolean;
  /** True while any engine toggle is in flight (covers the post-save poll gap,
   *  not just this hook's own save). Keeps the switch busy until settled. */
  transitioning: boolean;
  /** Enable handler; owns the idle-vs-takeover confirm decision. */
  onEnable: (desyncRepeats: number) => void;
  onDisable: () => void;
}

/**
 * Video Optimizer panel: the enable affordance, the desync-strength control,
 * and a compact verify check, all inside one grouped card. The CDN domain list
 * is a separate sibling card mounted by the composer.
 */
export function VideoOptimizerPanel({
  hook,
  ttl,
  running,
  otherOwns,
  otherModeLabel,
  canEnable,
  transitioning,
  onEnable,
  onDisable,
}: VideoOptimizerPanelProps) {
  const { t } = useTranslation("local-network");
  const { settings, isSaving, verifyResult, runVerification } = hook;
  const busy = isSaving || transitioning;

  const [repeatsText, setRepeatsText] = useState<string>(
    String(settings?.desync_repeats ?? 1),
  );
  const { saved, markSaved } = useSaveFlash();

  const repeatsValid = useMemo(() => {
    if (!/^\d+$/.test(repeatsText)) return false;
    const n = parseInt(repeatsText, 10);
    return n >= 1 && n <= 10;
  }, [repeatsText]);

  const repeatsDirty = useMemo(() => {
    if (!settings) return false;
    const typed = repeatsValid ? parseInt(repeatsText, 10) : NaN;
    return typed !== settings.desync_repeats;
  }, [settings, repeatsText, repeatsValid]);

  // Re-applying desync while running is a no-takeover re-apply; routed through
  // onEnable so the composer keeps the single save+refresh path.
  const handleSaveDesync = useCallback(() => {
    if (!repeatsValid) {
      toast.error(t("invalid_repeats", { ns: "errors" }));
      return;
    }
    onEnable(parseInt(repeatsText, 10));
    markSaved();
  }, [repeatsValid, repeatsText, onEnable, markSaved, t]);

  const verifying = verifyResult.status === "running";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("traffic_engine.mode_video")}</CardTitle>
        <CardDescription>
          {t("traffic_engine.video_tagline")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <EngineEnableRow
          label={t("traffic_engine.enable_mode", {
            mode: t("traffic_engine.mode_video"),
          })}
          running={running}
          canEnable={canEnable}
          busy={busy}
          otherOwns={otherOwns}
          otherModeLabel={otherModeLabel}
          onToggle={(next) =>
            next
              ? onEnable(repeatsValid ? parseInt(repeatsText, 10) : 1)
              : onDisable()
          }
          ariaLabel={
            running
              ? t("traffic_engine.aria_disable_engine")
              : t("traffic_engine.aria_enable_engine")
          }
        />

        {/* Hotspot bypass — global TTL/HL shortcut, shared with Masquerade */}
        <BypassHotspotRow ttl={ttl} />

        {/* Desync strength */}
        <div className="flex flex-col gap-2 border-t pt-5">
          <div className="flex items-center gap-1.5">
            <HintIcon
              label={t("video_optimizer.aria_desync_repeats_info")}
              variant="info"
              size="sm"
            >
              {t("video_optimizer.help_desync_repeats")}
            </HintIcon>
            <label
              htmlFor="dpi-desync-repeats"
              className="text-sm font-medium text-foreground"
            >
              {t("video_optimizer.label_desync_repeats")}
            </label>
          </div>
          <p className="-mt-1 text-xs text-muted-foreground">
            {t("video_optimizer.helper_desync_repeats")}
          </p>
          <div className="flex items-center gap-2">
            <Input
              id="dpi-desync-repeats"
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              step={1}
              value={repeatsText}
              onChange={(e) => setRepeatsText(e.target.value)}
              disabled={busy}
              aria-invalid={!repeatsValid}
              aria-label={t("video_optimizer.label_desync_repeats")}
              className="h-9 w-20 tabular-nums"
            />
            {running && (
              <SaveButton
                type="button"
                isSaving={isSaving}
                saved={saved}
                disabled={!repeatsDirty || !repeatsValid}
                onClick={handleSaveDesync}
                label={t("traffic_engine.tile_apply")}
                savingLabel={t("actions.saving", { ns: "common" })}
                savedLabel={t("actions.saved", { ns: "common" })}
              />
            )}
          </div>
        </div>

        {/* Verify check — shared layout with Masquerade's Test Injection */}
        <EngineCheckRow
          title={t("video_optimizer.verify_title")}
          description={t("video_optimizer.verify_description")}
          hint={t("video_optimizer.verify_hint")}
          hintAriaLabel={t("video_optimizer.aria_verify_hint")}
          runLabel={t("video_optimizer.button_verify_service")}
          busyLabel={t("video_optimizer.state_verifying")}
          running={running}
          busy={verifying}
          onRun={runVerification}
        >
          {verifyResult.status === "complete" &&
            verifyResult.passed === true && (
              <ResultAlert tone="success">{verifyResult.message}</ResultAlert>
            )}
          {verifyResult.status === "complete" &&
            verifyResult.passed === false && (
              <ResultAlert tone="warning">{verifyResult.message}</ResultAlert>
            )}
          {verifyResult.status === "error" && verifyResult.error && (
            <ResultAlert tone="destructive">{verifyResult.error}</ResultAlert>
          )}
        </EngineCheckRow>
      </CardContent>
    </Card>
  );
}
