"use client";

import { fetchControllerState, setControllerActive } from "@/lib/controllerApi";
import { useState } from "react";
import useSWR from "swr";

const BUTTON_BASE_CLASS =
  "w-full rounded-full px-8 py-5 text-2xl transition disabled:cursor-not-allowed disabled:opacity-40 sm:py-6 sm:text-3xl";

export function RobotController() {
  const { data: controllerState, mutate: mutateControllerState } = useSWR(
    "/api/controller",
    fetchControllerState,
    {
      refreshInterval: 1000,
      revalidateOnFocus: false,
    }
  );
  const [pendingActiveState, setPendingActiveState] = useState<boolean | null>(
    null
  );

  async function updateControllerState(active: boolean) {
    setPendingActiveState(active);

    try {
      const nextControllerState = await setControllerActive(active);
      void mutateControllerState(nextControllerState, false);
    } finally {
      setPendingActiveState(null);
    }
  }

  const isStartDisabled =
    pendingActiveState !== null || controllerState?.active === true;
  const isStopDisabled =
    pendingActiveState !== null || controllerState?.active === false;

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
          <button
            type="button"
            onClick={() => void updateControllerState(true)}
            disabled={isStartDisabled}
            className={`${BUTTON_BASE_CLASS} border border-orange-200/40 bg-transparent font-medium text-orange-100 hover:border-orange-100 hover:bg-orange-300/10`}
          >
            Start
          </button>

          <button
            type="button"
            onClick={() => void updateControllerState(false)}
            disabled={isStopDisabled}
            className={`${BUTTON_BASE_CLASS} border border-rose-300/45 bg-rose-500/15 font-medium text-rose-100 hover:bg-rose-500/25`}
          >
            Stop
          </button>
        </div>
      </section>
    </main>
  );
}
