"use client";

import {
  KioskRuntimeStatus,
  KioskStatusSnapshot,
  publishKioskStatus,
} from "@/models/controllerApi";
import { useEffect, useEffectEvent, useRef } from "react";

type PublishKioskStatusParams = {
  micReady: boolean;
  runtimeStatus: KioskRuntimeStatus;
  networkLabel: string;
  networkTone: KioskStatusSnapshot["networkTone"];
  lastError: string | null;
};

// Publishes iPad readiness so the iPhone controller can enable Start safely.
export function usePublishKioskStatus(status: PublishKioskStatusParams) {
  const latestStatusRef = useRef(status);
  const {
    lastError,
    micReady,
    networkLabel,
    networkTone,
    runtimeStatus,
  } = status;

  const publishLatestStatus = useEffectEvent(async () => {
    try {
      await publishKioskStatus(latestStatusRef.current);
    } catch {
      // The dashboard already shows controller connectivity; avoid noisy loops.
    }
  });

  useEffect(() => {
    latestStatusRef.current = {
      lastError,
      micReady,
      networkLabel,
      networkTone,
      runtimeStatus,
    };

    // Push important changes immediately; the interval below is just heartbeat.
    void publishLatestStatus();
  }, [
    lastError,
    micReady,
    networkLabel,
    networkTone,
    runtimeStatus,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      void publishLatestStatus();
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, []);
}
