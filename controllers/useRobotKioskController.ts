"use client";

import Vapi from "@vapi-ai/web";
import {
  VAPI_ASSISTANT_OVERRIDES,
  VAPI_START_OPTIONS,
} from "@/models/vapiConfig";
import { useRobotMicPermission } from "@/controllers/useRobotMicPermission";
import { useEffect, useRef, useState } from "react";

const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_ATTEMPTS = 2;

export type KioskStatus =
  | "error"
  | "reconnecting"
  | "stopping"
  | "speaking"
  | "connected"
  | "ready"
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
  isCallConnected: boolean;
  isMicReady: boolean;
};

type NetworkBadgeTone = "neutral" | "good" | "warn" | "bad";

const STATUS_TEXT: Record<Exclude<KioskStatus, "error">, string> = {
  reconnecting: "Connection dropped. Reconnecting...",
  stopping: "Stopping call...",
  speaking: "Robot is talking",
  connected: "Listening...",
  ready: "Ready - Open Controller to Start",
  locked: "Tap Wake Robot to enable microphone",
};

function getNetworkStateFromEvent(event: unknown): {
  label: string;
  tone: NetworkBadgeTone;
} | null {
  const rawLabel =
    typeof event === "string"
      ? event
      : typeof event === "number"
        ? String(event)
        : event && typeof event === "object"
          ? String(
              (event as Record<string, unknown>).quality ??
                (event as Record<string, unknown>).status ??
                ""
            )
          : "";
  const label = rawLabel.toLowerCase();

  if (!label) return null;
  if (["excellent", "good", "3", "4", "5", "connected"].includes(label)) {
    return { label: "connected", tone: "good" };
  }
  if (["poor", "bad", "low", "0", "1", "disconnected"].includes(label)) {
    return { label: "poor", tone: "bad" };
  }
  return { label: "fair", tone: "warn" };
}

// Collapses raw flags to one canonical status for UI rendering.
function resolveKioskStatus({
  error,
  isReconnecting,
  isStopping,
  isSpeaking,
  isCallConnected,
  isMicReady,
}: KioskState): KioskStatus {
  if (error) return "error";
  if (isReconnecting) return "reconnecting";
  if (isStopping) return "stopping";
  if (isSpeaking) return "speaking";
  if (isCallConnected) return "connected";
  if (isMicReady) return "ready";
  return "locked";
}

// Main kiosk controller hook.
// Owns Vapi lifecycle, call controls, mic unlock, and derived status.
export function useRobotKioskController({
  publicKey,
  assistantId,
}: UseRobotKioskControllerParams) {
  const {
    error: micPermissionError,
    hasLoadedMicState,
    isMicReady,
    wakeRobot,
  } = useRobotMicPermission();

  const vapiRef = useRef<Vapi | null>(null);
  const webCallRef = useRef<Parameters<Vapi["reconnect"]>[0] | null>(null);
  const stopRequestedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [isStarting, setIsStarting] = useState(false);
  const [isCallConnected, setIsCallConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkLabel, setNetworkLabel] = useState("unknown");
  const [networkTone, setNetworkTone] = useState<NetworkBadgeTone>("neutral");

  function resetCallState() {
    setIsStarting(false);
    setIsStopping(false);
    setIsCallConnected(false);
    setIsSpeaking(false);
    setIsReconnecting(false);
  }

  function clearReconnectTimer() {
    if (!reconnectTimeoutRef.current) return;
    clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = null;
  }

  useEffect(() => {
    const vapi = new Vapi(publicKey);
    vapiRef.current = vapi;

    const scheduleReconnect = (
      savedWebCall: NonNullable<typeof webCallRef.current>
    ) => {
      if (stopRequestedRef.current) return;

      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        resetCallState();
        setNetworkLabel("disconnected");
        setNetworkTone("bad");
        setError(
          "The Vapi call disconnected and the automatic reconnect attempts did not succeed. Use the Controller to stop the robot, wait a few seconds, and press Start again. If this keeps happening, check the iPad network connection before restarting the call."
        );
        reconnectAttemptsRef.current = 0;
        return;
      }

      reconnectAttemptsRef.current += 1;
      setIsReconnecting(true);
      setIsCallConnected(false);
      setIsSpeaking(false);
      setError(null);

      const delayMs =
        BASE_RECONNECT_DELAY_MS * 2 ** (reconnectAttemptsRef.current - 1);

      clearReconnectTimer();
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;

        if (stopRequestedRef.current) return;

        void vapi.reconnect(savedWebCall).catch(() => {
          scheduleReconnect(savedWebCall);
        });
      }, delayMs);
    };

    const handleCallStart = () => {
      clearReconnectTimer();
      setIsCallConnected(true);
      setIsStarting(false);
      setIsReconnecting(false);
      setNetworkLabel("connected");
      setNetworkTone("good");
      setError(null);
      reconnectAttemptsRef.current = 0;
    };

    const handleCallEnd = () => {
      const shouldAttemptReconnect =
        !stopRequestedRef.current &&
        webCallRef.current != null;

      if (!shouldAttemptReconnect) {
        clearReconnectTimer();
        resetCallState();
        setNetworkLabel("disconnected");
        setNetworkTone("bad");
        stopRequestedRef.current = false;
        reconnectAttemptsRef.current = 0;
        return;
      }

      const savedWebCall = webCallRef.current;

      if (!savedWebCall) {
        resetCallState();
        return;
      }

      scheduleReconnect(savedWebCall);
    };

    const handleError = () => {
      resetCallState();
      setError(
        "Vapi reported an error before the voice session became usable. Confirm the public key and assistant ID belong to the same Vapi workspace. Verify the assistant is enabled, then refresh the kiosk and start again from the Controller."
      );
    };

    const handleSpeechStart = () => {
      setIsSpeaking(true);
    };

    const handleSpeechEnd = () => {
      setIsSpeaking(false);
    };

    const updateNetworkStateFromEvent = (event: unknown) => {
      const networkState = getNetworkStateFromEvent(event);
      if (!networkState) return;
      setNetworkLabel(networkState.label);
      setNetworkTone(networkState.tone);
    };

    vapi.on("call-start", handleCallStart);
    vapi.on("call-end", handleCallEnd);
    vapi.on("speech-start", handleSpeechStart);
    vapi.on("speech-end", handleSpeechEnd);
    vapi.on("network-quality-change", updateNetworkStateFromEvent);
    vapi.on("network-connection", updateNetworkStateFromEvent);
    vapi.on("error", handleError);

    return () => {
      clearReconnectTimer();
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

  async function startRobotCall() {
    // Only the iPad can start Vapi because it owns the microphone.
    if (
      !isMicReady ||
      !vapiRef.current ||
      isStarting ||
      isCallConnected ||
      isReconnecting
    ) {
      return;
    }

    try {
      clearReconnectTimer();
      stopRequestedRef.current = false;
      reconnectAttemptsRef.current = 0;
      setError(null);
      setIsStarting(true);

      const webCall = await vapiRef.current.start(
        assistantId,
        VAPI_ASSISTANT_OVERRIDES,
        undefined,
        undefined,
        undefined,
        VAPI_START_OPTIONS
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
        "The kiosk could not start a Vapi call after receiving the Controller start command. Refresh the iPad kiosk and confirm microphone permission is still allowed. If the problem continues, verify the Vapi assistant configuration and public key."
      );
    }
  }

  async function stopRobotCall() {
    // Stop is safe to call from controller updates or local cleanup.
    if (
      !vapiRef.current ||
      isStopping ||
      (!isCallConnected && !isStarting && !isReconnecting)
    ) {
      return;
    }

    try {
      clearReconnectTimer();
      stopRequestedRef.current = true;
      setIsStopping(true);
      await vapiRef.current.stop();
      resetCallState();
      setNetworkLabel("disconnected");
      setNetworkTone("bad");
    } catch {
      resetCallState();
      setError(
        "The kiosk asked Vapi to stop the call, but the SDK did not confirm a clean shutdown. Refresh the iPad if audio continues. Send Stop from the Controller before starting a new call."
      );
    }
  }

  const status = resolveKioskStatus({
    error: error ?? micPermissionError,
    isReconnecting,
    isStopping,
    isSpeaking,
    isCallConnected,
    isMicReady,
  });
  const statusText =
    status === "error"
      ? "Attention needed - review diagnostics"
      : STATUS_TEXT[status];

  return {
    error: error ?? micPermissionError,
    hasLoadedMicState,
    isCallConnected,
    isReconnecting,
    isMicReady,
    isSpeaking,
    isStarting,
    isStopping,
    networkLabel,
    networkTone,
    startRobotCall,
    status,
    statusText,
    stopRobotCall,
    wakeRobot,
  };
}
