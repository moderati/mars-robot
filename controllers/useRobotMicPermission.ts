"use client";

import { useEffect, useState } from "react";

const MIC_READY_STORAGE_KEY = "robot_armed";

// Safari still needs the legacy fallback on some iPadOS versions.
async function requestMicrophonePermission(): Promise<MediaStream> {
  const modernGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(
    navigator.mediaDevices
  );

  if (modernGetUserMedia) {
    return modernGetUserMedia({ audio: true });
  }

  const legacyGetUserMedia = (
    navigator as Navigator & {
      webkitGetUserMedia?: (
        constraints: MediaStreamConstraints,
        onSuccess: (stream: MediaStream) => void,
        onError: (error: unknown) => void
      ) => void;
    }
  ).webkitGetUserMedia;

  if (!legacyGetUserMedia) {
    throw new Error("microphone_api_unavailable");
  }

  return new Promise((resolve, reject) => {
    legacyGetUserMedia.call(
      navigator,
      { audio: true },
      (stream) => resolve(stream),
      (error) => reject(error)
    );
  });
}

export function useRobotMicPermission() {
  const [isMicReady, setIsMicReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedMicState, setHasLoadedMicState] = useState(false);

  useEffect(() => {
    const loadSavedPermission = window.setTimeout(() => {
      // Mic permission is browser/device-local, so the iPad stores this itself.
      setIsMicReady(window.localStorage.getItem(MIC_READY_STORAGE_KEY) === "true");
      setHasLoadedMicState(true);
    }, 0);

    return () => {
      window.clearTimeout(loadSavedPermission);
    };
  }, []);

  async function wakeRobot() {
    // Browser mic permission must come from a real user tap on the iPad.
    setError(null);

    try {
      const stream = await requestMicrophonePermission();
      // We only need to unlock permission here. Vapi opens the mic during calls.
      stream.getTracks().forEach((track) => track.stop());
      window.localStorage.setItem(MIC_READY_STORAGE_KEY, "true");
      setIsMicReady(true);
    } catch {
      const mustUseSecureContext = !window.isSecureContext;

      setError(
        mustUseSecureContext
          ? "Microphone access is blocked because this page is not running in a secure browser context. Open this app over HTTPS, or use localhost while testing. Then return to the kiosk and tap Wake Robot again."
          : "Microphone permission is required before the controller can start a Vapi call. The browser denied access or the permission prompt could not open. Open this page in Safari, allow microphone permission for this site, and confirm iPad Settings > Safari > Microphone is set to Allow."
      );
    }
  }

  return {
    error,
    hasLoadedMicState,
    isMicReady,
    wakeRobot,
  };
}
