"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/ui/field";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import { HintIcon } from "@/components/ui/hint-icon";
import type { useTrafficMasquerade } from "@/hooks/use-traffic-masquerade";
import type { UseTtlSettingsReturn } from "@/hooks/use-ttl-settings";
import { validateDomainKey } from "@/lib/validate-domain";
import { EngineEnableRow } from "./engine-enable-row";
import { BypassHotspotRow } from "./bypass-hotspot-row";
import { EngineCheckRow } from "./engine-check-row";
import { ResultAlert } from "./result-alert";

/** Fallback disguise domain when none is configured. Shared so the panel's
 *  initial value and the composer's disable-fallback can't drift. */
export const DEFAULT_SNI_DOMAIN = "speedtest.net";

interface MasqueradePanelProps {
  hook: ReturnType<typeof useTrafficMasquerade>;
  /** Composer-owned global TTL/HL hook, for the Bypass Hotspot row. */
  ttl: UseTtlSettingsReturn;
  /** Whether Masquerade owns the engine. */
  running: boolean;
  /** Whether Video Optimizer owns the engine (enabling masquerade takes over). */
  otherOwns: boolean;
  otherModeLabel: string;
  canEnable: boolean;
  /** True while any engine toggle is in flight (covers the post-save poll gap,
   *  not just this hook's own save). Keeps the switch busy until settled. */
  transitioning: boolean;
  /** Enable handler; owns the idle-vs-takeover confirm decision. */
  onEnable: (sniDomain: string) => void;
  onDisable: () => void;
}

/**
 * Traffic Masquerade panel: the enable affordance, the disguise-domain (SNI)
 * control, and an injection test. The test mirrors Video Optimizer's verify
 * check exactly (title + description + outline button + ResultAlert) so the two
 * confidence surfaces stay in lockstep.
 */
export function MasqueradePanel({
  hook,
  ttl,
  running,
  otherOwns,
  otherModeLabel,
  canEnable,
  transitioning,
  onEnable,
  onDisable,
}: MasqueradePanelProps) {
  const { t } = useTranslation("local-network");
  const { settings, isSaving, testResult, runTest } = hook;
  const busy = isSaving || transitioning;

  const [sniDomain, setSniDomain] = useState(
    settings?.sni_domain || DEFAULT_SNI_DOMAIN,
  );
  const { saved, markSaved } = useSaveFlash();

  const sniErrorKey = useMemo(() => validateDomainKey(sniDomain), [sniDomain]);
  const sniError = sniErrorKey ? t(sniErrorKey) : null;

  const sniDirty = useMemo(
    () => !!settings && sniDomain !== settings.sni_domain,
    [settings, sniDomain],
  );

  const handleSaveSni = useCallback(() => {
    if (sniError) return;
    onEnable(sniDomain);
    markSaved();
  }, [sniError, sniDomain, onEnable, markSaved]);

  const testing = testResult.status === "running";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("traffic_engine.mode_masquerade")}</CardTitle>
        <CardDescription>
          {t("traffic_engine.masquerade_tagline")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <EngineEnableRow
          label={t("traffic_engine.enable_mode", {
            mode: t("traffic_engine.mode_masquerade"),
          })}
          running={running}
          canEnable={canEnable}
          busy={busy}
          otherOwns={otherOwns}
          otherModeLabel={otherModeLabel}
          onToggle={(next) => (next ? onEnable(sniDomain) : onDisable())}
          ariaLabel={
            running
              ? t("traffic_engine.aria_disable_engine")
              : t("traffic_engine.aria_enable_engine")
          }
        />

        {/* Hotspot bypass — global TTL/HL shortcut, shared with Video Optimizer */}
        <BypassHotspotRow ttl={ttl} />

        {/* Disguise domain */}
        <div className="flex flex-col gap-2 border-t pt-5">
          <div className="flex items-center gap-1.5">
            <HintIcon
              label={t("masquerade.aria_domain_info")}
              variant="info"
              size="sm"
            >
              {t("masquerade.help_domain")}
            </HintIcon>
            <label
              htmlFor="sni-domain"
              className="text-sm font-medium text-foreground"
            >
              {t("masquerade.label_domain")}
            </label>
          </div>
          <p className="-mt-1 text-xs text-muted-foreground">
            {t("masquerade.helper_domain")}
          </p>
          <div className="flex flex-wrap items-start gap-2">
            <div className="flex-1 space-y-1.5">
              <Input
                id="sni-domain"
                type="text"
                value={sniDomain}
                onChange={(e) => setSniDomain(e.target.value)}
                disabled={busy}
                placeholder={t("masquerade.placeholder_domain")}
                className="max-w-sm"
                aria-invalid={!!sniError}
                aria-describedby={sniError ? "sni-error" : undefined}
                aria-label={t("masquerade.label_domain")}
              />
              {sniError && <FieldError id="sni-error">{sniError}</FieldError>}
            </div>
            {running && (
              <SaveButton
                type="button"
                isSaving={isSaving}
                saved={saved}
                disabled={!sniDirty || !!sniError}
                onClick={handleSaveSni}
                label={t("traffic_engine.tile_apply")}
                savingLabel={t("actions.saving", { ns: "common" })}
                savedLabel={t("actions.saved", { ns: "common" })}
              />
            )}
          </div>
        </div>

        {/* Injection test — shared layout with Video Optimizer's verify check */}
        <EngineCheckRow
          title={t("masquerade.test_title")}
          description={t("masquerade.test_description")}
          hint={t("masquerade.test_hint")}
          hintAriaLabel={t("masquerade.aria_test_hint")}
          runLabel={t("masquerade.button_run_test")}
          busyLabel={t("masquerade.state_testing")}
          running={running}
          busy={testing}
          onRun={runTest}
        >
          {testResult.status === "complete" && (
            <ResultAlert tone={testResult.injected ? "success" : "destructive"}>
              {testResult.message}
            </ResultAlert>
          )}
          {testResult.status === "error" && testResult.error && (
            <ResultAlert tone="destructive">{testResult.error}</ResultAlert>
          )}
        </EngineCheckRow>
      </CardContent>
    </Card>
  );
}
