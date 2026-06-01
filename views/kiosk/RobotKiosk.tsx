"use client";

import {
  KioskStatus,
  useRobotKioskController,
} from "@/controllers/useRobotKioskController";
import { usePublishKioskStatus } from "@/controllers/usePublishKioskStatus";
import { useRealtimeState } from "@/controllers/useRealtimeState";
import {
  ErrorNotice,
  PillLink,
  PrimaryButton,
  StatusCard,
  getReadableErrorMessage,
} from "@/views/shared/KioskUi";
import { useEffect, useRef } from "react";

type RobotKioskProps = {
  publicKey: string;
  assistantId: string;
};

const STATUS_STYLES: Record<KioskStatus, string> = {
  error: "border-rose-300/50 bg-rose-300/15 text-rose-100",
  reconnecting: "border-orange-200/45 bg-orange-300/15 text-orange-50",
  stopping: "border-orange-200/45 bg-orange-300/15 text-orange-50",
  speaking: "border-orange-200/45 bg-orange-300/15 text-orange-50",
  connected: "border-orange-100/35 bg-black/20 text-orange-100",
  ready: "border-emerald-300/40 bg-emerald-300/10 text-emerald-100",
  locked: "border-amber-300/40 bg-amber-300/10 text-amber-100",
};

const NETWORK_BADGE_STYLES = {
  neutral: "border-white/20 bg-black/20 text-white/80",
  good: "border-emerald-300/40 bg-emerald-300/15 text-emerald-100",
  warn: "border-amber-300/40 bg-amber-300/15 text-amber-100",
  bad: "border-rose-300/40 bg-rose-300/15 text-rose-100",
} as const;

function getControllerCommandLabel(value: boolean | undefined) {
  if (value === undefined) return "Unknown";
  return value ? "Active" : "Inactive";
}

export function RobotKiosk({ publicKey, assistantId }: RobotKioskProps) {
  const {
    error,
    hasLoadedMicState,
    isCallConnected,
    isMicReady,
    isReconnecting,
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
  } = useRobotKioskController({ publicKey, assistantId });

  const {
    data: controllerState,
    error: controllerError,
    connectionStatus,
  } = useRealtimeState();

  usePublishKioskStatus({
    micReady: isMicReady,
    runtimeStatus: status,
    networkLabel,
    networkTone,
    lastError: error,
  });

  // The iPhone controller writes command state; the iPad kiosk executes it.
  const lastHandledControllerUpdateRef = useRef<number | null>(null);

  useEffect(() => {
    if (!controllerState) return;
    if (lastHandledControllerUpdateRef.current === controllerState.updatedAt) {
      return;
    }

    lastHandledControllerUpdateRef.current = controllerState.updatedAt;

    if (controllerState.isRobotActive) {
      void startRobotCall();
      return;
    }

    void stopRobotCall();
  }, [controllerState, startRobotCall, stopRobotCall]);

  const controllerCommand = getControllerCommandLabel(
    controllerState?.isRobotActive
  );

  const controllerUpdatedAt = controllerState
    ? new Date(controllerState.updatedAt).toLocaleTimeString()
    : "Waiting...";
  const vapiSessionLabel = isStarting
    ? "Starting"
    : isStopping
      ? "Stopping"
      : isReconnecting
        ? "Reconnecting"
        : isCallConnected
          ? "Connected"
          : "Idle";
  const vapiSessionDetail = isCallConnected
    ? isSpeaking
      ? "Robot is currently speaking."
      : "Robot is listening."
    : "Waiting for controller start command.";
  const controllerErrorMessage = controllerError
    ? getReadableErrorMessage(
        controllerError,
        "The kiosk could not reach the controller API. Confirm the custom Node server is running and reload this page."
      )
    : null;
  const diagnosticsDetail = controllerError
    ? "Controller connection issue detected."
    : error
      ? "Kiosk error detected."
      : "No active kiosk errors.";

  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <section className="glass-panel w-full max-w-4xl rounded-[2.4rem] p-6 sm:p-10">
        <header className="mb-10 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.36em] text-orange-200/80">
            Robot Kiosk Status
          </p>
          <h1 className="kiosk-title mt-3 text-3xl font-semibold text-orange-50 sm:text-5xl">
            Robot Concierge
          </h1>
          <p className="mt-3 text-sm text-orange-100/70 sm:text-base">
            iPad microphone and Vapi call diagnostics
          </p>
        </header>

        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
          {hasLoadedMicState && !isMicReady && (
            <PrimaryButton tone="primary" onClick={() => void wakeRobot()}>
              Wake Robot
            </PrimaryButton>
          )}

          {isCallConnected && (
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                isSpeaking
                  ? "border-orange-200/50 bg-orange-300/20 text-orange-50"
                  : "border-orange-100/30 bg-black/15 text-orange-100"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isSpeaking
                    ? "animate-pulse bg-orange-300"
                    : "bg-orange-100/75"
                }`}
              />
              {isSpeaking ? "Robot talking" : "Robot listening"}
            </div>
          )}

          <p
            className={`w-full rounded-2xl border px-4 py-3 text-base sm:text-lg ${STATUS_STYLES[status]}`}
          >
            {statusText}
          </p>

          {error && (
            <ErrorNotice title="Kiosk Needs Attention" message={error} />
          )}

          {controllerErrorMessage && (
            <ErrorNotice
              title="Controller Connection Issue"
              message={controllerErrorMessage}
              tone="warning"
            />
          )}

          <div className="grid w-full gap-3 sm:grid-cols-2">
            <StatusCard
              title="Microphone"
              value={isMicReady ? "Ready" : "Locked"}
              detail={
                isMicReady
                  ? "Permission is saved on this iPad."
                  : "Tap Wake Robot on this iPad to enable the microphone."
              }
            />

            <StatusCard
              title="Controller Command"
              value={controllerCommand}
              detail={`Last update: ${controllerUpdatedAt}`}
            >
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-100/45">
                Realtime {connectionStatus}
              </p>
            </StatusCard>

            <StatusCard
              title="Vapi Session"
              value={vapiSessionLabel}
              detail={vapiSessionDetail}
            />

            <StatusCard
              title="Diagnostics"
              value={error || controllerError ? "Attention" : "Nominal"}
              detail={diagnosticsDetail}
            />
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide ${NETWORK_BADGE_STYLES[networkTone]}`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            Network {networkLabel}
          </div>

          <PillLink href="/controller">Open Controller</PillLink>

          <p className="mt-10 text-[11px] tracking-[0.3em] text-white/50 uppercase">
            © 2026 Moderati
          </p>
        </div>
      </section>
    </main>
  );
}
