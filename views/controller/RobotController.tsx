"use client";

import {
  ErrorNotice,
  PrimaryButton,
  RealtimeBadge,
  StatusCard,
  getReadableErrorMessage,
} from "@/views/shared/KioskUi";
import { useRealtimeState } from "@/controllers/useRealtimeState";
import { setRobotActive } from "@/models/controllerApi";
import { useState } from "react";

export function RobotController() {
  const {
    data: controllerState,
    error: controllerError,
    kioskStatus,
    kioskStatusError,
    setControllerState,
    connectionStatus,
  } = useRealtimeState();
  const [isCommandPending, setIsCommandPending] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);

  async function sendRobotCommand(shouldStartRobot: boolean) {
    setIsCommandPending(true);
    setCommandError(null);

    try {
      const nextControllerState = await setRobotActive(shouldStartRobot);
      setControllerState(nextControllerState);
    } catch (error) {
      setCommandError(
        getReadableErrorMessage(
          error,
          shouldStartRobot
            ? "The Start command could not be sent. Confirm the custom Node server is running, then try again."
            : "The Stop command could not be sent. Confirm the custom Node server is running, then try again."
        )
      );
    } finally {
      setIsCommandPending(false);
    }
  }

  const isStartDisabled =
    isCommandPending ||
    controllerState?.isRobotActive === true ||
    !kioskStatus?.online ||
    !kioskStatus.micReady;
  const isStopDisabled =
    isCommandPending || controllerState?.isRobotActive === false;
  const readinessDetail = kioskStatusError
    ? "Kiosk readiness could not be loaded. Review the diagnostic below."
    : kioskStatus?.lastError
      ? "The kiosk reported an error. Review the diagnostic below."
      : kioskStatus?.online && kioskStatus.micReady
        ? "Kiosk is ready for remote control."
        : "Open the home page on the iPad and tap Wake Robot.";
  const controllerErrorMessage = controllerError
    ? getReadableErrorMessage(
        controllerError,
        "The controller could not load the current Start/Stop command. Confirm the custom Node server is running and reload this page."
      )
    : null;
  const kioskStatusErrorMessage = kioskStatusError
    ? getReadableErrorMessage(
        kioskStatusError,
        "The controller could not load the iPad kiosk readiness status. Confirm the iPad is connected to the same server and reload this page."
      )
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <section className="glass-panel w-full max-w-3xl rounded-[2.4rem] p-6 sm:p-10">
        <header className="mb-10 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.36em] text-orange-200/80">
            Voice Kiosk
          </p>
          <h1 className="kiosk-title mt-3 text-3xl font-semibold text-orange-50 sm:text-5xl">
            Controller
          </h1>
        </header>

        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          <RealtimeBadge status={connectionStatus} />

          <StatusCard
            title="iPad Kiosk Readiness"
            value={kioskStatus?.online && kioskStatus.micReady ? "Ready" : "Not Ready"}
            detail={readinessDetail}
          >
            <div className="mt-3 grid gap-2 text-sm text-orange-100/75 sm:grid-cols-2">
              <p>
                Online:{" "}
                <span className="font-semibold text-orange-50">
                  {kioskStatus?.online ? "Yes" : "No"}
                </span>
              </p>
              <p>
                Mic:{" "}
                <span className="font-semibold text-orange-50">
                  {kioskStatus?.micReady ? "Ready" : "Locked"}
                </span>
              </p>
              <p>
                Vapi:{" "}
                <span className="font-semibold text-orange-50">
                  {kioskStatus?.runtimeStatus ?? "unknown"}
                </span>
              </p>
              <p>
                Network:{" "}
                <span className="font-semibold text-orange-50">
                  {kioskStatus?.networkLabel ?? "unknown"}
                </span>
              </p>
            </div>
          </StatusCard>

          {commandError && (
            <ErrorNotice title="Command Failed" message={commandError} />
          )}

          {controllerErrorMessage && (
            <ErrorNotice
              title="Controller State Unavailable"
              message={controllerErrorMessage}
              tone="warning"
            />
          )}

          {kioskStatusErrorMessage && (
            <ErrorNotice
              title="Kiosk Readiness Unavailable"
              message={kioskStatusErrorMessage}
              tone="warning"
            />
          )}

          {kioskStatus?.lastError && (
            <ErrorNotice
              title="Kiosk Reported An Error"
              message={kioskStatus.lastError}
            />
          )}

          <PrimaryButton
            onClick={() => void sendRobotCommand(true)}
            disabled={isStartDisabled}
          >
            Start
          </PrimaryButton>

          <PrimaryButton
            tone="danger"
            onClick={() => void sendRobotCommand(false)}
            disabled={isStopDisabled}
          >
            Stop
          </PrimaryButton>
        </div>
      </section>
    </main>
  );
}
