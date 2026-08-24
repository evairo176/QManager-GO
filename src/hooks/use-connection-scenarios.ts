"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  const [activeScenarioId, setActiveScenarioId] = useState("balanced");
  const [customScenarios, setCustomScenarios] = useState<StoredScenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch scenarios list + active scenario from backend
  // ---------------------------------------------------------------------------
  const fetchScenarios = useCallback(async () => {
    try {
      const resp = await authFetch(`${CGI_BASE}/list.sh`);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: ScenarioListResponse = await resp.json();
      if (!mountedRef.current) return;

      setCustomScenarios(data.scenarios || []);
      setActiveScenarioId(data.active_scenario_id || "balanced");
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error ? err.message : "Failed to load scenarios",
      );
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  // ---------------------------------------------------------------------------
  // Activate a scenario
  // ---------------------------------------------------------------------------
  const activateScenario = useCallback(
    async (id: string, config?: ScenarioConfig): Promise<boolean> => {
      setError(null);
      setIsActivating(true);

      try {
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
        if (!mountedRef.current) return false;

        if (!data.success) {
          setError(resolveErrorMessage(t, data.error, data.detail, "Failed to activate scenario"));
          return false;
        }

        // Optimistic update — backend confirmed success
        setActiveScenarioId(id);
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to activate scenario",
        );
        return false;
      } finally {
        if (mountedRef.current) {
          setIsActivating(false);
        }
      }
    },
    [t],
  );

  // ---------------------------------------------------------------------------
  // Save a custom scenario (create or update)
  // ---------------------------------------------------------------------------
  const saveCustomScenario = useCallback(
    async (scenario: Omit<StoredScenario, "id"> & { id?: string }): Promise<string | null> => {
      setError(null);

      try {
        const resp = await authFetch(`${CGI_BASE}/save.sh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scenario),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }

        const data: ScenarioApiResponse = await resp.json();
        if (!mountedRef.current) return null;

        if (!data.success) {
          setError(resolveErrorMessage(t, data.error, data.detail, "Failed to save scenario"));
          return null;
        }

        // Refresh the list from backend to pick up the new/updated scenario
        await fetchScenarios();
        return data.id || null;
      } catch (err) {
        if (!mountedRef.current) return null;
        setError(
          err instanceof Error ? err.message : "Failed to save scenario",
        );
        return null;
      }
    },
    [fetchScenarios, t],
  );

  // ---------------------------------------------------------------------------
  // Delete a custom scenario
  // ---------------------------------------------------------------------------
  const deleteCustomScenario = useCallback(
    async (id: string): Promise<boolean> => {
      setError(null);

      try {
        const resp = await authFetch(`${CGI_BASE}/delete.sh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }

        const data: ScenarioApiResponse = await resp.json();
        if (!mountedRef.current) return false;

        if (!data.success) {
          setError(resolveErrorMessage(t, data.error, data.detail, "Failed to delete scenario"));
          return false;
        }

        // Refresh the list from backend
        await fetchScenarios();
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(
          err instanceof Error ? err.message : "Failed to delete scenario",
        );
        return false;
      }
    },
    [fetchScenarios, t],
  );

  // ---------------------------------------------------------------------------
  // Manual refresh
  // ---------------------------------------------------------------------------
  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchScenarios();
  }, [fetchScenarios]);

  return {
    activeScenarioId,
    customScenarios,
    isLoading,
    isActivating,
    error,
    activateScenario,
    saveCustomScenario,
    deleteCustomScenario,
    refresh,
  };
}
