import { useState, useEffect, useRef } from "react";
import { authFetch } from "@/lib/auth-fetch";

export interface TelemetryData {
  status?: string;
  sim_status?: string;
  rsrp?: number;
  rsrq?: number;
  snr?: number;
  signal_level?: number;
  network_type?: string;
  band?: string;
  ip_address?: string;
  iccid?: string;
  uptime?: number;
  [key: string]: unknown;
}

export function useSSETelemetry(enabled = true) {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (typeof window === "undefined" || !("EventSource" in window)) {
      setError("EventSource unsupported");
      return;
    }

    const sseUrl = "/cgi-bin/quecmanager/api/stream/status";
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    es.addEventListener("telemetry", (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data);
        setData(parsed);
      } catch (err) {
        console.error("Failed to parse SSE telemetry data:", err);
      }
    });

    es.onerror = (err) => {
      setIsConnected(false);
      setError("SSE connection lost");
      es.close();

      // Fallback polling tick
      authFetch("/cgi-bin/quecmanager/at_cmd/fetch_data.sh")
        .then((res) => res.json())
        .then((fallbackData) => setData(fallbackData))
        .catch(() => {});
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [enabled]);

  return {
    data,
    isConnected,
    error,
  };
}
