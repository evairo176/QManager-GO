"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import type {
  ApnSetting,
  CidContext,
  ApnSettingsResponse,
  ApnSaveRequest,
  ApnSaveResponse,
} from "@/types/apn-settings";

// =============================================================================
// useApnSettings — Single-APN Settings Hook
// =============================================================================
// Fetches the single stored APN setting + the modem's live PDP contexts on
// mount. save() POSTs action:"save" and triggers a COPS detach/attach cycle
// (brief WAN drop). deactivate() POSTs action:"deactivate" and reverts the
// modem to the carrier-default APN (active=0).
//
// Backend endpoint: GET/POST /cgi-bin/quecmanager/cellular/apn.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/cellular/apn.sh";

// save() runs AT+COPS=2 → AT+CGDCONT → AT+COPS=0 so the new APN is negotiated
// at re-attach. AT+COPS=0 returns OK before the attach fully completes, so the
// fresh active_cid/cids state isn't readable immediately — a short delayed
// silent refresh reconciles the optimistic patch.
const RECONCILE_DELAY_MS = 1500;

export interface UseApnSettingsReturn {
  /** The stored single APN setting (null before first fetch). */
  apn: ApnSetting | null;
  /** The modem's live PDP contexts (1-6), tagged for the CID picker. */
  cids: CidContext[] | null;
  /** 1 = custom APN live, 0 = carrier default, null before first fetch. */
  active: number | null;
  /** The live WAN-bearing CID, or null before first fetch. */
  activeCid: number | null;
  /** True while initial fetch is in progress. */
  isLoading: boolean;
  /** True while a save/deactivate operation is in progress. */
  isSaving: boolean;
  /** Error message if fetch or a mutation failed. */
  error: string | null;
  /** Persist the APN configuration and apply it. Returns true on success. */
  save: (request: ApnSaveRequest) => Promise<boolean>;
  /** Revert to carrier-default APN (active=0). Returns true on success. */
  deactivate: () => Promise<boolean>;
  /** Re-fetch the APN setting + CID contexts. */
  refresh: () => void;
}

const QUERY_KEY = ["apn-settings"] as const;

export function useApnSettings(): UseApnSettingsReturn {
  const queryClient = useQueryClient();

  const query = useQuery<ApnSettingsResponse>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: ApnSettingsResponse = await resp.json();

      if (!data.success) {
        throw new Error(data.error ?? "Failed to fetch APN settings");
      }

      return data;
    },
  });

  // Shared POST wrapper. Returns the parsed body on HTTP success, or throws.
  const postAction = async (
    body: Record<string, unknown>
  ): Promise<ApnSaveResponse> => {
    const resp = await authFetch(CGI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    return (await resp.json()) as ApnSaveResponse;
  };

  // Optimistically reflect a just-applied APN on its live CID so the honest
  // badge doesn't flash "Not live" against a stale cids[] snapshot during the
  // ~1.5s before the reconcile confirms. The reconcile is the source of truth —
  // if the carrier overrode the APN, it flips back to "Not live" with the real
  // value.
  const scheduleReconcile = () => {
    setTimeout(() => {
      void query.refetch();
    }, RECONCILE_DELAY_MS);
  };

  const saveMutation = useMutation({
    mutationFn: async (request: ApnSaveRequest) => {
      const data = await postAction({ action: "save", ...request });
      if (!data.success) {
        throw new Error(data.error ?? "Failed to save APN");
      }
      return request;
    },
    onSuccess: (request) => {
      // Optimistic update: reflect the stored setting immediately.
      queryClient.setQueryData<ApnSettingsResponse>(QUERY_KEY, (prev) =>
        prev
          ? {
              ...prev,
              apn: request,
              active: 1,
              cids: prev.cids?.map((c) =>
                c.cid === request.cid ? { ...c, apn: request.apn } : c
              ),
            }
          : prev
      );
      scheduleReconcile();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      const data = await postAction({ action: "deactivate" });
      if (!data.success) {
        throw new Error(data.error ?? "Failed to use carrier default");
      }
      return true;
    },
    onSuccess: () => {
      queryClient.setQueryData<ApnSettingsResponse>(QUERY_KEY, (prev) =>
        prev ? { ...prev, active: 0 } : prev
      );
      scheduleReconcile();
    },
  });

  const save = async (request: ApnSaveRequest): Promise<boolean> => {
    try {
      await saveMutation.mutateAsync(request);
      return true;
    } catch {
      return false;
    }
  };

  const deactivate = async (): Promise<boolean> => {
    try {
      await deactivateMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  };

  const data = query.data;

  return {
    apn: data?.apn ?? null,
    cids: data?.cids ?? [],
    active: typeof data?.active === "number" ? data.active : null,
    activeCid: typeof data?.active_cid === "number" ? data.active_cid : null,
    isLoading: query.isLoading || query.isPending,
    isSaving: saveMutation.isPending || deactivateMutation.isPending,
    error:
      query.error?.message ??
      saveMutation.error?.message ??
      deactivateMutation.error?.message ??
      null,
    save,
    deactivate,
    refresh: () => {
      void query.refetch();
    },
  };
}
