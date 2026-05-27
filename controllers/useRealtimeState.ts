"use client";

import {
  ControllerState,
  ControllerConnectionStatus,
  KioskStatusSnapshot,
  fetchControllerState,
  fetchKioskStatus,
  subscribeRealtimeState,
} from "@/models/controllerApi";
import { useEffect, useState } from "react";

// Keeps the iPad kiosk and iPhone controller synced.
export function useRealtimeState() {
  const [controllerState, setControllerState] =
    useState<ControllerState | null>(null);
  const [controllerError, setControllerError] = useState<unknown>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ControllerConnectionStatus>("connecting");
  const [kioskStatus, setKioskStatus] = useState<KioskStatusSnapshot | null>(
    null
  );
  const [kioskStatusError, setKioskStatusError] = useState<unknown>(null);

  useEffect(() => {
    let socketIsOpen = false;

    async function loadFallbackState() {
      // Used on first load and whenever WebSocket is unavailable.
      try {
        setControllerState(await fetchControllerState());
        setControllerError(null);
      } catch (error) {
        setControllerError(error);
      }

      try {
        setKioskStatus(await fetchKioskStatus());
        setKioskStatusError(null);
      } catch (error) {
        setKioskStatusError(error);
      }
    }

    const unsubscribe = subscribeRealtimeState({
      onControllerState: setControllerState,
      onKioskStatus: setKioskStatus,
      onStatus: (status) => {
        socketIsOpen = status === "open";
        setConnectionStatus(status);
      },
    });

    void loadFallbackState();

    // HTTP polling is the backup path when WebSocket is not open.
    const fallbackInterval = window.setInterval(() => {
      if (!socketIsOpen) {
        void loadFallbackState();
      }
    }, 1000);

    return () => {
      unsubscribe();
      window.clearInterval(fallbackInterval);
    };
  }, []);

  return {
    data: controllerState,
    error: controllerError,
    setControllerState,
    connectionStatus,
    kioskStatus,
    kioskStatusError,
  };
}
