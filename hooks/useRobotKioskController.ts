"use client";

import Vapi from "@vapi-ai/web";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "robot_armed";
const armedStoreListeners = new Set<() => void>();

export type KioskStatus =
  | "error"
  | "reconnecting"
  | "stopping"
  | "speaking"
  | "inCall"
  | "armed"
  | "locked";

type UseRobotKioskControllerParams = {
  publicKey: string;
  assistantId: string;
};

type KioskState = {
  error: string | null;
  isReconnecting: boolean;
  isStopping: boolean;
  isSpeaking: boolean;
  inCall: boolean;
  armed: boolean;
};

type NetworkBadgeTone = "neutral" | "good" | "warn" | "bad";

const STATUS_TEXT: Record<KioskStatus, string> = {
  error: "",
  reconnecting: "Connection dropped. Reconnecting...",
  stopping: "Stopping call...",
  speaking: "Robot is talking",
  inCall: "Listening...",
  armed: "Ready - tap Start",
  locked: "Tap Wake Robot to enable microphone",
};

const BACKGROUND_SPEECH_DENOISING_PLAN: NonNullable<
  Parameters<Vapi["start"]>[1]
>["backgroundSpeechDenoisingPlan"] = {
  smartDenoisingPlan: {
    enabled: true,
  },
  fourierDenoisingPlan: {
      enabled: true,
      mediaDetectionEnabled: true,
      baselineOffsetDb: -10, // Aggressive filtering
      windowSizeMs: 2000,    // Fast adaptation
      baselinePercentile: 90 // Focus on clear speech
  },
};

const ASSISTANT_OVERRIDES: NonNullable<Parameters<Vapi["start"]>[1]> = {
  backgroundSpeechDenoisingPlan: BACKGROUND_SPEECH_DENOISING_PLAN,
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function mapNumericQuality(value: number): string {
  if (value >= 3) return "good";
  if (value >= 2) return "fair";
  if (value >= 1) return "poor";
  return "bad";
}

function getNetworkLabelFromEvent(event: unknown): string | null {
  if (typeof event === "string") {
    return normalizeText(event);
  }

  if (typeof event === "number") {
    return mapNumericQuality(event);
  }

  if (!event || typeof event !== "object") return null;

  const asRecord = event as Record<string, unknown>;
  const candidates = [
    asRecord.quality,
    asRecord.networkQuality,
    asRecord.connectionQuality,
    asRecord.threshold,
    asRecord.level,
    asRecord.state,
    asRecord.status,
    asRecord.network,
    asRecord.connection,
    asRecord.current,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number") {
      return mapNumericQuality(candidate);
    }
    const value = normalizeText(candidate);
    if (value) return value;

    if (candidate && typeof candidate === "object") {
      const nested = candidate as Record<string, unknown>;
      const nestedValue =
        normalizeText(nested.quality) ||
        normalizeText(nested.status) ||
        normalizeText(nested.state) ||
        normalizeText(nested.level) ||
        normalizeText(nested.value);
      if (nestedValue) return nestedValue;

      if (typeof nested.value === "number") {
        return mapNumericQuality(nested.value);
      }
      if (typeof nested.level === "number") {
        return mapNumericQuality(nested.level);
      }
    }
  }

  return null;
}

function getNetworkTone(label: string): NetworkBadgeTone {
  if (["excellent", "good", "great", "high", "connected", "online"].includes(label)) {
    return "good";
  }
  if (["fair", "ok", "medium", "recovering", "reconnecting"].includes(label)) {
    return "warn";
  }
  if (
    ["poor", "low", "bad", "offline", "disconnected", "failed", "error"].includes(
      label
    )
  ) {
    return "bad";
  }
  return "neutral";
}

// Reads persisted armed state from localStorage on the client.
function getArmedSnapshot() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

// SSR fallback snapshot to prevent hydration mismatches.
function getArmedServerSnapshot() {
  return false;
}

function subscribeHydration() {
  return () => {};
}

function getHydratedSnapshot() {
  return true;
}

function getHydratedServerSnapshot() {
  return false;
}

// Subscription API required by useSyncExternalStore.
function subscribeArmedStore(listener: () => void) {
  armedStoreListeners.add(listener);
  return () => armedStoreListeners.delete(listener);
}

// Broadcasts local armed-state changes to subscribers.
function notifyArmedStoreChange() {
  armedStoreListeners.forEach((listener) => listener());
}

// Collapses raw flags to one canonical status for UI rendering.
function resolveKioskStatus({
  error,
  isReconnecting,
  isStopping,
  isSpeaking,
  inCall,
  armed,
}: KioskState): KioskStatus {
  if (error) return "error";
  if (isReconnecting) return "reconnecting";
  if (isStopping) return "stopping";
  if (isSpeaking) return "speaking";
  if (inCall) return "inCall";
  if (armed) return "armed";
  return "locked";
}

// Requests microphone permission from a user gesture.
// Includes webkit fallback for older Safari versions.
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

// Main kiosk controller hook.
// Owns Vapi lifecycle, call controls, mic unlock, and derived status.
export function useRobotKioskController({
  publicKey,
  assistantId,
}: UseRobotKioskControllerParams) {
  const armed = useSyncExternalStore(
    subscribeArmedStore,
    getArmedSnapshot,
    getArmedServerSnapshot
  );
  const isHydrated = useSyncExternalStore(
    subscribeHydration,
    getHydratedSnapshot,
    getHydratedServerSnapshot
  );

  const vapiRef = useRef<Vapi | null>(null);
  const webCallRef = useRef<Parameters<Vapi["reconnect"]>[0] | null>(null);
  const stopRequestedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);

  const [isStarting, setIsStarting] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkLabel, setNetworkLabel] = useState("unknown");
  const [networkTone, setNetworkTone] = useState<NetworkBadgeTone>("neutral");

  function resetCallState() {
    setIsStarting(false);
    setIsStopping(false);
    setInCall(false);
    setIsSpeaking(false);
    setIsReconnecting(false);
  }

  useEffect(() => {
    const vapi = new Vapi(publicKey);
    vapiRef.current = vapi;

    const handleCallStart = () => {
      setInCall(true);
      setIsStarting(false);
      setIsReconnecting(false);
      setNetworkLabel("connected");
      setNetworkTone("good");
      setError(null);
    };

    const handleCallEnd = () => {
      const shouldAttemptReconnect =
        !stopRequestedRef.current &&
        reconnectAttemptsRef.current < 1 &&
        webCallRef.current != null;

      if (!shouldAttemptReconnect) {
        resetCallState();
        setNetworkLabel("disconnected");
        setNetworkTone("bad");
        stopRequestedRef.current = false;
        reconnectAttemptsRef.current = 0;
        return;
      }

      reconnectAttemptsRef.current += 1;
      setIsReconnecting(true);
      setInCall(false);
      setIsSpeaking(false);
      const savedWebCall = webCallRef.current;

      if (!savedWebCall) {
        resetCallState();
        return;
      }

      void vapi.reconnect(savedWebCall).catch(() => {
        resetCallState();
        setError("Connection dropped and reconnect failed. Tap Start to begin a new call.");
      });
    };

    const handleError = () => {
      resetCallState();
      setError(
        "Could not start the voice call. Verify the Vapi public key and assistant ID are from the same workspace, then refresh."
      );
    };

    const handleSpeechStart = () => {
      setIsSpeaking(true);
    };

    const handleSpeechEnd = () => {
      setIsSpeaking(false);
    };

    const updateNetworkStateFromEvent = (event: unknown) => {
      const label = getNetworkLabelFromEvent(event);
      if (!label) return;
      setNetworkLabel(label);
      setNetworkTone(getNetworkTone(label));
    };

    vapi.on("call-start", handleCallStart);
    vapi.on("call-end", handleCallEnd);
    vapi.on("speech-start", handleSpeechStart);
    vapi.on("speech-end", handleSpeechEnd);
    vapi.on("network-quality-change", updateNetworkStateFromEvent);
    vapi.on("network-connection", updateNetworkStateFromEvent);
    vapi.on("error", handleError);

    return () => {
      vapi.off("call-start", handleCallStart);
      vapi.off("call-end", handleCallEnd);
      vapi.off("speech-start", handleSpeechStart);
      vapi.off("speech-end", handleSpeechEnd);
      vapi.off("network-quality-change", updateNetworkStateFromEvent);
      vapi.off("network-connection", updateNetworkStateFromEvent);
      vapi.off("error", handleError);
      void vapi.stop();
      vapiRef.current = null;
    };
  }, [publicKey]);

  async function wakeRobot() {
    setError(null);

    try {
      const stream = await requestMicrophonePermission();
      stream.getTracks().forEach((track) => track.stop());
      window.localStorage.setItem(STORAGE_KEY, "true");
      notifyArmedStoreChange();
    } catch {
      const mustUseSecureContext = !window.isSecureContext;

      setError(
        mustUseSecureContext
          ? "Microphone requires a secure site. Open this app over HTTPS (or localhost), then try Wake Robot again."
          : "Could not access microphone. Open in Safari (not an in-app browser), allow mic permission, and verify iPad Settings > Safari > Microphone is set to Allow."
      );
    }
  }

  async function startConversation() {
    if (!armed || !vapiRef.current || isStarting || inCall || isReconnecting) {
      return;
    }

    try {
      stopRequestedRef.current = false;
      reconnectAttemptsRef.current = 0;
      setError(null);
      setIsStarting(true);

      const webCall = await vapiRef.current.start(
        assistantId,
        ASSISTANT_OVERRIDES,
        undefined,
        undefined,
        undefined,
        { roomDeleteOnUserLeaveEnabled: false }
      );

      if (webCall) {
        const reconnectPayload = webCall as unknown as {
          webCallUrl?: string;
          transport?: { callUrl?: string };
          id?: string;
          artifactPlan?: { videoRecordingEnabled?: boolean };
          assistant?: { voice?: { provider?: string } };
        };

        const webCallUrl =
          reconnectPayload.webCallUrl ?? reconnectPayload.transport?.callUrl;

        if (webCallUrl) {
          webCallRef.current = {
            webCallUrl,
            id: reconnectPayload.id,
            artifactPlan: reconnectPayload.artifactPlan,
            assistant: reconnectPayload.assistant,
          };
        }
      }
    } catch {
      resetCallState();
      setError(
        "Could not start the call. Refresh and try again, then verify your Vapi assistant settings."
      );
    }
  }

  async function stopConversation() {
    if (!vapiRef.current || !inCall || isStopping) {
      return;
    }

    try {
      stopRequestedRef.current = true;
      setIsStopping(true);
      await vapiRef.current.stop();
    } catch {
      resetCallState();
      setError("Could not stop the call cleanly. Refresh if audio continues.");
    }
  }

  const status = resolveKioskStatus({
    error,
    isReconnecting,
    isStopping,
    isSpeaking,
    inCall,
    armed,
  });
  const statusText = status === "error" ? error : STATUS_TEXT[status];

  return {
    armed,
    error,
    inCall,
    isHydrated,
    isReconnecting,
    isSpeaking,
    isStarting,
    isStopping,
    networkLabel,
    networkTone,
    startConversation,
    status,
    statusText,
    stopConversation,
    wakeRobot,
  };
}
