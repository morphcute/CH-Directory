"use client";

import { useEffect, useState, useRef } from "react";

export interface LiveViewerInfo {
  id: string;
  name: string;
  isParticipant: boolean;
  isOrganizer: boolean;
  joinedAt?: number;
  lastSeen?: number;
}

const HEARTBEAT_INTERVAL_MS = 10_000; // Pulse every 10s while tab is active
const HIDDEN_PAUSE_MS = 45_000; // Pause heartbeat after 45s of tab being hidden/minimized

function getOrCreateDeviceViewerId(): string {
  if (typeof window === "undefined") return "";
  try {
    const key = "ch_wheel_viewer_token";
    let token = localStorage.getItem(key);
    if (!token || token.length < 10) {
      token = "v_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36);
      localStorage.setItem(key, token);
    }
    return token;
  } catch {
    return "v_temp_" + Math.random().toString(36).slice(2, 10);
  }
}

function getStoredDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem("ch_raffle_device_id") || "";
  } catch {
    return "";
  }
}

export function useRafflePresence(options?: {
  entryName?: string;
  deviceId?: string;
  onCountChange?: (count: number) => void;
  onListChange?: (viewers: LiveViewerInfo[]) => void;
}) {
  const [viewerCount, setViewerCount] = useState<number>(1);
  const [viewersList, setViewersList] = useState<LiveViewerInfo[]>([]);
  const hiddenTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedRef = useRef<boolean>(false);
  const viewerIdRef = useRef<string>("");

  const entryName = options?.entryName;
  const deviceId = options?.deviceId || (typeof window !== "undefined" ? getStoredDeviceId() : "");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const viewerId = getOrCreateDeviceViewerId();
    viewerIdRef.current = viewerId;

    let isMounted = true;

    const sendPulse = async () => {
      if (isPausedRef.current) return;
      try {
        const res = await fetch("/api/raffle/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            viewerId,
            action: "pulse",
            entryName: entryName || undefined,
            deviceId: deviceId || undefined,
          }),
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          if (typeof data.viewerCount === "number") {
            setViewerCount(data.viewerCount);
            options?.onCountChange?.(data.viewerCount);
          }
          if (Array.isArray(data.viewers)) {
            setViewersList(data.viewers);
            options?.onListChange?.(data.viewers);
          }
        }
      } catch {
        // Network drop; retry on next heartbeat cycle
      }
    };

    const sendLeave = () => {
      const payload = JSON.stringify({ viewerId, action: "leave" });
      const url = `/api/raffle/heartbeat?action=leave&viewerId=${encodeURIComponent(viewerId)}`;

      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(url, payload);
      } else {
        void fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };

    // Immediate initial pulse
    void sendPulse();

    // Regular interval
    const interval = setInterval(() => {
      void sendPulse();
    }, HEARTBEAT_INTERVAL_MS);

    // Tab visibility handling
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (hiddenTimeoutRef.current) {
          clearTimeout(hiddenTimeoutRef.current);
          hiddenTimeoutRef.current = null;
        }
        if (isPausedRef.current) {
          isPausedRef.current = false;
          void sendPulse(); // Wake up immediately
        }
      } else {
        // If tab is hidden for > 45s, pause heartbeats
        hiddenTimeoutRef.current = setTimeout(() => {
          isPausedRef.current = true;
          sendLeave();
        }, HIDDEN_PAUSE_MS);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", sendLeave);
    window.addEventListener("beforeunload", sendLeave);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (hiddenTimeoutRef.current) clearTimeout(hiddenTimeoutRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", sendLeave);
      window.removeEventListener("beforeunload", sendLeave);
      sendLeave();
    };
  }, [entryName, deviceId]);

  return { viewerCount, setViewerCount, viewersList, setViewersList };
}
