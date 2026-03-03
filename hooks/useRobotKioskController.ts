"use client";

import Vapi from "@vapi-ai/web";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "robot_armed";
const armedStoreListeners = new Set<() => void>();

export type KioskStatus =
  | "error"
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
  isStopping: boolean;
  isSpeaking: boolean;
  inCall: boolean;
  armed: boolean;
};

const STATUS_TEXT: Record<KioskStatus, string> = {
  error: "",
  stopping: "Stopping call...",
  speaking: "Robot is talking",
  inCall: "Listening...",
  armed: "Ready - tap Start",
  locked: "Tap Wake Robot to enable microphone",
};

// Reads persisted armed state from localStorage on the client.
// This is used by useSyncExternalStore as the client snapshot.
function getArmedSnapshot() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

// SSR fallback snapshot. We always start locked during server render
// to avoid hydration mismatch with client-only localStorage state.
function getArmedServerSnapshot() {
  return false;
}

// Registers listeners for the local armed-state store.
// useSyncExternalStore requires subscribe/getSnapshot/serverSnapshot.
function subscribeArmedStore(listener: () => void) {
  armedStoreListeners.add(listener);
  return () => armedStoreListeners.delete(listener);
}

// Notifies all subscribed components that armed-state changed.
function notifyArmedStoreChange() {
  armedStoreListeners.forEach((listener) => listener());
}

// Converts raw state flags into one canonical UI status.
// This keeps rendering simple and guarantees one status at a time.
function resolveKioskStatus({ error, isStopping, isSpeaking, inCall, armed }: KioskState): KioskStatus {
  if (error) return "error";
  if (isStopping) return "stopping";
  if (isSpeaking) return "speaking";
  if (inCall) return "inCall";
  if (armed) return "armed";
  return "locked";
}

// Requests microphone permission from a user gesture.
// Prefers modern getUserMedia and falls back to webkitGetUserMedia for older Safari.
async function requestMicrophonePermission(): Promise<MediaStream> {
  const modernGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(
    navigator.mediaDevices
  );

  if (modernGetUserMedia) return modernGetUserMedia({ audio: true });
  

  const legacyGetUserMedia = (
    navigator as Navigator & {
      webkitGetUserMedia?: (
        constraints: MediaStreamConstraints,
        onSuccess: (stream: MediaStream) => void,
        onError: (error: unknown) => void
      ) => void;
    }
  ).webkitGetUserMedia;

  if (!legacyGetUserMedia) throw new Error("microphone_api_unavailable");
  

  return new Promise((resolve, reject) => {
    legacyGetUserMedia.call(
      navigator,
      { audio: true },
      (stream) => resolve(stream),
      (error) => reject(error)
    );
  });
}

// Main kiosk controller hook:
// owns Vapi lifecycle, microphone gating, call controls, and derived UI state.
export function useRobotKioskController({
  publicKey,
  assistantId,
}: UseRobotKioskControllerParams) {
  // "armed" is persisted outside React so refreshes keep kiosk unlocked.
  const armed = useSyncExternalStore(
    subscribeArmedStore,
    getArmedSnapshot,
    getArmedServerSnapshot
  );

  const vapiRef = useRef<Vapi | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resets transient call flags back to idle.
  // Used across end/error paths to avoid repeated state logic.
  function resetCallState() {
    setIsStarting(false);
    setIsStopping(false);
    setInCall(false);
    setIsSpeaking(false);
  }

  // Creates the Vapi instance and wires runtime event listeners.
  // Cleanup detaches listeners and ends any active call on unmount.
  useEffect(() => {
    const vapi = new Vapi(publicKey);
    vapiRef.current = vapi;

    const handleCallStart = () => {
      setInCall(true);
      setIsStarting(false);
      setError(null);
    };

    const handleCallEnd = () =>  resetCallState();
    

    const handleError = () => {
      resetCallState();
      setError(
        "Could not start the voice call. Verify the Vapi public key and assistant ID are from the same workspace, then refresh."
      );
    };

    const handleSpeechStart = () => setIsSpeaking(true);
    const handleSpeechEnd = () => setIsSpeaking(false);

    vapi.on("call-start", handleCallStart);
    vapi.on("call-end", handleCallEnd);
    vapi.on("speech-start", handleSpeechStart);
    vapi.on("speech-end", handleSpeechEnd);
    vapi.on("error", handleError);

    return () => {
      vapi.off("call-start", handleCallStart);
      vapi.off("call-end", handleCallEnd);
      vapi.off("speech-start", handleSpeechStart);
      vapi.off("speech-end", handleSpeechEnd);
      vapi.off("error", handleError);
      void vapi.stop();
      vapiRef.current = null;
    };
  }, [publicKey]);

  // Unlocks kiosk by requesting mic permission once, then immediately
  // stopping tracks so we're not recording outside active conversations.
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

  // Starts a Vapi call with the configured assistant.
  // Guard clauses prevent duplicate starts or invalid states.
  async function startConversation() {
    if (!armed || !vapiRef.current || isStarting || inCall) {
      return;
    }

    try {
      setError(null);
      setIsStarting(true);
      await vapiRef.current.start(assistantId);
    } catch {
      resetCallState();
      setError(
        "Could not start the call. Refresh and try again, then verify your Vapi assistant settings."
      );
    }
  }

  // Stops the active Vapi call.
  // We rely on the call-end event for final state cleanup.
  async function stopConversation() {
    if (!vapiRef.current || !inCall || isStopping) {
      return;
    }

    try {
      setIsStopping(true);
      await vapiRef.current.stop();
    } catch {
      resetCallState();
      setError("Could not stop the call cleanly. Refresh if audio continues.");
    }
  }

  // Derived presentation state consumed by RobotKiosk UI component.
  const status = resolveKioskStatus({ error, isStopping, isSpeaking, inCall, armed });
  const statusText = status === "error" ? error : STATUS_TEXT[status];

  return {
    armed,
    error,
    inCall,
    isSpeaking,
    isStarting,
    isStopping,
    startConversation,
    status,
    statusText,
    stopConversation,
    wakeRobot,
  };
}
