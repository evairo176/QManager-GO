"use client";

import { useQuery } from "@tanstack/react-query";
import { useLiveInterval } from "@/components/realtime-provider";
import { authFetch } from "@/lib/auth-fetch";

// =============================================================================
// useDataUsage — accumulated cellular quota usage.
// =============================================================================
// Reads /cgi-bin/quecmanager/system/data_usage.sh (backend accumulates
// /proc/net/dev deltas into a persisted file, surviving reboots). Returns
// lifetime + today's download/upload in bytes.
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/system/data_usage.sh";
const POLL_INTERVAL = 15_000;

export interface DataUsage {
  downloadBytes: number;
  uploadBytes: number;
  totalBytes: number;
  day: string;
  dayDownloadBytes: number;
  dayUploadBytes: number;
}

interface DataUsageResponse {
  success?: boolean;
  download_bytes?: number;
  upload_bytes?: number;
  total_bytes?: number;
  day?: string;
  day_download_bytes?: number;
  day_upload_bytes?: number;
}

export function useDataUsage(): {
  data: DataUsage | null;
  isLoading: boolean;
} {
  const live = useLiveInterval(POLL_INTERVAL);

  const query = useQuery<DataUsage>({
    queryKey: ["data-usage"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json: DataUsageResponse = await resp.json();
      return {
        downloadBytes: json.download_bytes ?? 0,
        uploadBytes: json.upload_bytes ?? 0,
        totalBytes: json.total_bytes ?? 0,
        day: json.day ?? "",
        dayDownloadBytes: json.day_download_bytes ?? 0,
        dayUploadBytes: json.day_upload_bytes ?? 0,
      };
    },
    refetchInterval: live,
    retry: false,
  });

  return { data: query.data ?? null, isLoading: query.isLoading || query.isPending };
}

// formatBytes — human-friendly byte size (e.g. 8.20 MB, 1.35 GB).
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / 1024 ** i;
  return `${val.toFixed(val >= 100 ? 0 : val >= 10 ? 1 : 2)} ${units[i]}`;
}
