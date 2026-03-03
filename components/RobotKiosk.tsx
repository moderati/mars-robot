"use client";

import {
  KioskStatus,
  useRobotKioskController,
} from "@/hooks/useRobotKioskController";

type RobotKioskProps = {
  publicKey: string;
  assistantId: string;
};

const BUTTON_BASE_CLASS =
  "w-full rounded-full px-8 py-5 text-2xl transition disabled:cursor-not-allowed disabled:opacity-40 sm:py-6 sm:text-3xl";

const STATUS_STYLES: Record<KioskStatus, string> = {
  error: "border-rose-300/50 bg-rose-300/15 text-rose-100",
  stopping: "border-orange-200/45 bg-orange-300/15 text-orange-50",
  speaking: "border-orange-200/45 bg-orange-300/15 text-orange-50",
  inCall: "border-orange-100/35 bg-black/20 text-orange-100",
  armed: "border-emerald-300/40 bg-emerald-300/10 text-emerald-100",
  locked: "border-amber-300/40 bg-amber-300/10 text-amber-100",
};

export function RobotKiosk({ publicKey, assistantId }: RobotKioskProps) {
  const {
    armed,
    inCall,
    isSpeaking,
    isStarting,
    isStopping,
    startConversation,
    status,
    statusText,
    stopConversation,
    wakeRobot,
  } = useRobotKioskController({ publicKey, assistantId });

  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <section className="glass-panel w-full max-w-3xl rounded-[2.4rem] p-6 sm:p-10">
        <header className="mb-10 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.36em] text-orange-200/80">
            Voice Kiosk
          </p>
          <h1 className="kiosk-title mt-3 text-3xl font-semibold text-orange-50 sm:text-5xl">
            Robot Concierge
          </h1>
          <p className="mt-3 text-sm text-orange-100/70 sm:text-base">
            WOULD YOU VISIT MARS
          </p>
        </header>

        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          {!armed && (
            <button
              type="button"
              onClick={wakeRobot}
              className={`glow-btn ${BUTTON_BASE_CLASS} border border-orange-200/35 bg-gradient-to-b from-orange-500 to-orange-600 font-semibold text-orange-50 hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300/45`}
            >
              Wake Robot
            </button>
          )}

          <button
            type="button"
            onClick={startConversation}
            disabled={!armed || isStarting || inCall}
            className={`${BUTTON_BASE_CLASS} border border-orange-200/40 bg-transparent font-medium text-orange-100 hover:border-orange-100 hover:bg-orange-300/10`}
          >
            {isStarting ? "Starting..." : inCall ? "Connected" : "Start"}
          </button>
          <button
            type="button"
            onClick={stopConversation}
            disabled={!inCall || isStopping}
            className={`${BUTTON_BASE_CLASS} border border-rose-300/45 bg-rose-500/15 font-medium text-rose-100 hover:bg-rose-500/25`}
          >
            {isStopping ? "Stopping..." : "Stop"}
          </button>

          {inCall && (
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
          <p className="mt-10 text-[11px] tracking-[0.3em] text-white/50 uppercase">
            © 2026 Moderati
          </p>
        </div>
      </section>
    </main>
  );
}
