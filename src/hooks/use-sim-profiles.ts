"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import i18next from "i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type {
  SimProfile,
  ProfileSummary,
  ProfileListResponse,
  ProfileApiResponse,
  ProfileScenarioBinding,
} from "@/types/sim-profile";

// =============================================================================
// useSimProfiles — CRUD Hook for QManager Custom SIM Profiles
// =============================================================================
// Manages the full profile lifecycle: list, create, update, delete.
// Reads from /cgi-bin/quecmanager/profiles/ endpoints.
//
// No modem interaction — all operations read/write flash only.
// Apply operations are handled by the separate useProfileApply hook.
//
// Usage:
//   const {
//     profiles, activeProfileId, isLoading, error,
//     createProfile, updateProfile, deleteProfile, refresh
//   } = useSimProfiles();
// =============================================================================

const CGI_BASE = "/cgi-bin/quecmanager/profiles";

export interface UseSimProfilesReturn {
  /** Array of profile summaries (for list view) */
  profiles: ProfileSummary[];
  /** Currently active profile ID, or null */
  activeProfileId: string | null;
  /** True during initial fetch */
  isLoading: boolean;
  /** Error message from the last operation */
  error: string | null;
  /** Create a new profile. Returns the new profile ID on success. */
  createProfile: (data: ProfileFormData) => Promise<string | null>;
  /** Update an existing profile. Returns success boolean. */
  updateProfile: (id: string, data: ProfileFormData) => Promise<boolean>;
  /** Delete a profile by ID. Returns success boolean. */
  deleteProfile: (id: string) => Promise<boolean>;
  /** Fetch a single profile by ID (full data for edit form). */
  getProfile: (id: string) => Promise<SimProfile | null>;
  /** Deactivate the current active profile (clears marker only, no modem changes). */
  deactivateProfile: () => Promise<{ success: boolean; requiresReboot: boolean }>;
  /** Manually refresh the profile list */
  refresh: () => void;
}

/**
 * Flat form data shape that the backend save.sh endpoint expects.
 * This matches the jq field keys in profile_mgr.sh's profile_save().
 */
export interface ProfileFormData {
  name: string;
  mno: string;
  sim_iccid: string;
  /** APN context ID (1-15) */
  cid: number;
  /** APN name */
  apn_name: string;
  pdp_type: string;
  imei: string;
  ttl: number;
  hl: number;
  /**
   * Connection-scenario binding (nested object the backend save.sh accepts).
   * Always sent — defaults to {@link DEFAULT_SCENARIO_BINDING} in the form.
   */
  scenario: ProfileScenarioBinding;
}

export function useSimProfiles(): UseSimProfilesReturn {
  const [localError, setLocalError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch profile list
  // ---------------------------------------------------------------------------

  const query = useQuery<ProfileListResponse>({
    queryKey: ["sim-profiles"],
    queryFn: async () => {
      const resp = await authFetch(`${CGI_BASE}/list.sh`);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      return resp.json();
    },
  });

  const profiles = query.data?.profiles || [];
  const activeProfileId = query.data?.active_profile_id || null;

  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : "Failed to load profiles"
    : localError;

  // ---------------------------------------------------------------------------
  // Create profile
  // ---------------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: async (data: ProfileFormData): Promise<string | null> => {
      const resp = await authFetch(`${CGI_BASE}/save.sh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const result: ProfileApiResponse = await resp.json();

      if (!result.success) {
        throw new Error(result.detail || result.error || "Failed to create profile");
      }

      return result.id || null;
    },
    onSuccess: () => {
      // Refresh the list to pick up the new profile
      void query.refetch();
    },
  });

  const createProfile = async (data: ProfileFormData): Promise<string | null> => {
    setLocalError(null);
    try {
      return await createMutation.mutateAsync(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create profile";
      setLocalError(msg);
      return null;
    }
  };

  // ---------------------------------------------------------------------------
  // Update profile
  // ---------------------------------------------------------------------------

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: ProfileFormData;
    }): Promise<boolean> => {
      // Include the existing ID so profile_save() knows it's an update
      const payload = { ...data, id };
      const resp = await authFetch(`${CGI_BASE}/save.sh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const result: ProfileApiResponse = await resp.json();

      if (!result.success) {
        throw new Error(result.detail || result.error || "Failed to update profile");
      }

      return true;
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  const updateProfile = async (id: string, data: ProfileFormData): Promise<boolean> => {
    setLocalError(null);
    try {
      return await updateMutation.mutateAsync({ id, data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      setLocalError(msg);
      return false;
    }
  };

  // ---------------------------------------------------------------------------
  // Delete profile
  // ---------------------------------------------------------------------------

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

      const result: ProfileApiResponse = await resp.json();

      if (!result.success) {
        throw new Error(result.detail || result.error || "Failed to delete profile");
      }

      return true;
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  const deleteProfile = async (id: string): Promise<boolean> => {
    setLocalError(null);
    try {
      return await deleteMutation.mutateAsync(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete profile";
      setLocalError(msg);
      return false;
    }
  };

  // ---------------------------------------------------------------------------
  // Deactivate active profile
  // ---------------------------------------------------------------------------

  const deactivateMutation = useMutation({
    mutationFn: async (): Promise<{
      success: boolean;
      requiresReboot: boolean;
    }> => {
      const resp = await authFetch(`${CGI_BASE}/deactivate.sh`, {
        method: "POST",
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const result: ProfileApiResponse & { requires_reboot?: boolean } =
        await resp.json();

      if (!result.success) {
        throw new Error(
          resolveErrorMessage(
            i18next.t.bind(i18next),
            result.error,
            result.detail,
            "Failed to deactivate profile",
          ),
        );
      }

      return { success: true, requiresReboot: result.requires_reboot === true };
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  const deactivateProfile = async (): Promise<{
    success: boolean;
    requiresReboot: boolean;
  }> => {
    setLocalError(null);
    try {
      return await deactivateMutation.mutateAsync();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to deactivate profile";
      setLocalError(msg);
      return { success: false, requiresReboot: false };
    }
  };

  // ---------------------------------------------------------------------------
  // Get single profile (for edit form)
  // ---------------------------------------------------------------------------

  const getProfile = async (id: string): Promise<SimProfile | null> => {
    try {
      const resp = await authFetch(`${CGI_BASE}/get.sh?id=${encodeURIComponent(id)}`);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data = await resp.json();

      // The get endpoint returns the full profile on success,
      // or { success: false, error: "..." } on failure.
      if (data.success === false) {
        const msg = data.detail || data.error || "Profile not found";
        setLocalError(msg);
        return null;
      }

      return data as SimProfile;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load profile";
      setLocalError(msg);
      return null;
    }
  };

  // ---------------------------------------------------------------------------
  // Manual refresh
  // ---------------------------------------------------------------------------

  const refresh = () => {
    void query.refetch();
  };

  return {
    profiles,
    activeProfileId,
    isLoading: query.isLoading || query.isPending,
    error,
    createProfile,
    updateProfile,
    deleteProfile,
    deactivateProfile,
    getProfile,
    refresh,
  };
}
