"use client";

import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import type {
  ScenarioListResponse,
  StoredScenario,
} from "@/types/connection-scenario";

// =============================================================================
// useScenarioList — Lightweight read of selectable connection scenarios
// =============================================================================
// Provides the {id,name} options for the scenario pickers in the profile form's
// Scenario section. Decoupled from useConnectionScenarios (which carries the
// full activation/CRUD surface) so the form stays light. Built-in defaults
// (balanced/gaming/streaming) are always present; custom scenarios come from
// scenarios/list.sh.
// =============================================================================

const CGI_BASE = "/cgi-bin/quecmanager/scenarios";

export interface ScenarioOption {
  id: string;
  name: string;
  /** True for the built-in balanced/gaming/streaming scenarios. */
  isDefault: boolean;
}

export interface UseScenarioListReturn {
  scenarios: ScenarioOption[];
  isLoading: boolean;
  /** Resolve an id → display name, with a graceful fallback for stale ids. */
  nameForId: (id: string) => string;
  refresh: () => void;
}

export function useScenarioList(): UseScenarioListReturn {
  const { t } = useTranslation("cellular");

  const query = useQuery<ScenarioListResponse>({
    queryKey: ["scenario-list"],
    queryFn: async () => {
      const resp = await authFetch(`${CGI_BASE}/list.sh`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
  });

  // Keep defaults-only on failure; the picker still works.
  const custom: StoredScenario[] = query.data?.scenarios || [];

  // Memoized so the array identity is stable across renders. Without this the
  // list rebuilt every render, giving nameForId — and every value derived from
  // it (e.g. the scenario section's live-readout effect deps) — a new identity
  // each render, which drove an infinite setState loop the moment a schedule
  // rule made the readout active.
  const scenarios = useMemo<ScenarioOption[]>(
    () => [
      { id: "balanced", name: t("scenarios.default_balanced_name"), isDefault: true },
      { id: "gaming", name: t("scenarios.default_gaming_name"), isDefault: true },
      { id: "streaming", name: t("scenarios.default_streaming_name"), isDefault: true },
      ...custom.map((s) => ({ id: s.id, name: s.name, isDefault: false })),
    ],
    [custom, t],
  );

  const nameForId = useCallback(
    (id: string): string => {
      const match = scenarios.find((s) => s.id === id);
      if (match) return match.name;
      return t("custom_profiles.form.scenario.deleted_scenario");
    },
    [scenarios, t],
  );

  return {
    scenarios,
    isLoading: query.isLoading || query.isPending,
    nameForId,
    refresh: () => {
      void query.refetch();
    },
  };
}
