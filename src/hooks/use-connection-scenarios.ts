"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type {
  ScenarioListResponse,
  ScenarioActivateResponse,
  ScenarioApiResponse,
  ScenarioConfig,
  StoredScenario,
} from "@/types/connection-scenario";

// =============================================================================
// useConnectionScenarios — Active Scenario State, Activation & CRUD Hook
// =============================================================================
// Manages the full lifecycle: list custom scenarios, track which scenario is
// active, handle activation (AT commands), and CRUD for custom scenarios.
//
// All custom scenario definitions are stored on the modem (not localStorage)
// so they persist across browsers/devices.
//
// Backend endpoints:
//   GET  /cgi-bin/quecmanager/scenarios/list.sh      → custom scenarios + active ID
//   POST /cgi-bin/quecmanager/scenarios/activate.sh   → apply scenario
//   POST /cgi-bin/quecmanager/scenarios/save.sh       → save custom scenario
//   POST /cgi-bin/quecmanager/scenarios/delete.sh     → delete custom scenario
// =============================================================================

const CGI_BASE = "/cgi-bin/quecmanager/scenarios";

export interface UseConnectionScenariosReturn {
  /** Currently active scenario ID (defaults to "balanced") */
  activeScenarioId: string;
  /** Custom scenarios loaded from backend */
  customScenarios: StoredScenario[];
  /** True during initial fetch of scenarios + active state */
  isLoading: boolean;
  /** True while an activation request is in flight */
  isActivating: boolean;
  /** Error message from the last operation */
  error: string | null;
  /**
   * Activate a scenario by ID.
   * For custom scenarios, pass the config so mode + bands are sent to backend.
   * Returns success boolean.
   */
  activateScenario: (id: string, config?: ScenarioConfig) => Promise<boolean>;
  /**
   * Save a custom scenario definition to the backend.
   * Pass an id to update, omit id for create.
   * Returns the scenario ID on success, null on failure.
   */
  saveCustomScenario: (scenario: Omit<StoredScenario, "id"> & { id?: string }) => Promise<string | null>;
  /**
   * Delete a custom scenario by ID.
   * Returns success boolean.
   */
  deleteCustomScenario: (id: string) => Promise<boolean>;
  /** Manually refresh all data (scenarios list + active state) */
  refresh: () => void;
}

export function useConnectionScenarios(): UseConnectionScenariosReturn {
  const { t } = useTranslation("errors");

  const query = useQuery<ScenarioListResponse>({
    queryKey: ["connection-scenarios"],
    queryFn: async () => {
      const resp = await authFetch(`${CGI_BASE}/list.sh`);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      return resp.json() as Promise<ScenarioListResponse>;
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (args: { id: string; config?: ScenarioConfig }): Promise<boolean> => {
      const { id, config } = args;
      // Build POST body — default scenarios only need id,
      // custom scenarios include full config for backend to apply
      const body: Record<string, string> = { id };

      if (config && id.startsWith("custom-")) {
        body.mode = config.atModeValue;
        if (config.lte_bands) body.lte_bands = config.lte_bands;
        if (config.nsa_nr_bands) body.nsa_nr_bands = config.nsa_nr_bands;
        if (config.sa_nr_bands) body.sa_nr_bands = config.sa_nr_bands;
      }

      const resp = await authFetch(`${CGI_BASE}/activate.sh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: ScenarioActivateResponse = await resp.json();

      if (!data.success) {
        throw new Error(
          resolveErrorMessage(t, data.error, data.detail, "Failed to activate scenario")
        );
      }

      return true;
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (
      scenario: Omit<StoredScenario, "id"> & { id?: string }
    ): Promise<string | null> => {
      const resp = await authFetch(`${CGI_BASE}/save.sh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scenario),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: ScenarioApiResponse = await resp.json();

      if (!data.success) {
        throw new Error(
          resolveErrorMessage(t, data.error, data.detail, "Failed to save scenario")
        );
      }

      return data.id || null;
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<boolean> => {
      const resp = await authFetch(`${CGI_BASE}/delete.sh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: ScenarioApiResponse = await resp.json();

      if (!data.success) {
        throw new Error(
          resolveErrorMessage(t, data.error, data.detail, "Failed to delete scenario")
        );
      }

      return true;
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  const activateScenario = async (
    id: string,
    config?: ScenarioConfig
  ): Promise<boolean> => {
    try {
      return await activateMutation.mutateAsync({ id, config });
    } catch {
      return false;
    }
  };

  const saveCustomScenario = async (
    scenario: Omit<StoredScenario, "id"> & { id?: string }
  ): Promise<string | null> => {
    try {
      return await saveMutation.mutateAsync(scenario);
    } catch {
      return null;
    }
  };

  const deleteCustomScenario = async (id: string): Promise<boolean> => {
    try {
      return await deleteMutation.mutateAsync(id);
    } catch {
      return false;
    }
  };

  return {
    activeScenarioId: query.data?.active_scenario_id || "balanced",
    customScenarios: query.data?.scenarios || [],
    isLoading: query.isLoading || query.isPending,
    isActivating: activateMutation.isPending,
    error:
      query.error?.message ??
      activateMutation.error?.message ??
      saveMutation.error?.message ??
      deleteMutation.error?.message ??
      null,
    activateScenario,
    saveCustomScenario,
    deleteCustomScenario,
    refresh: () => {
      void query.refetch();
    },
  };
}
