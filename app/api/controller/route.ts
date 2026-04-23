import { NextResponse } from "next/server";

type ControllerState = {
  active: boolean;
  updatedAt: number;
};

const globalControllerState = globalThis as typeof globalThis & {
  robotControllerState?: ControllerState;
};

function getControllerState() {
  globalControllerState.robotControllerState ??= {
    active: false,
    updatedAt: Date.now(),
  };

  return globalControllerState.robotControllerState;
}

function setControllerState(active: boolean) {
  const state = {
    active,
    updatedAt: Date.now(),
  };

  globalControllerState.robotControllerState = state;
  return state;
}

export function GET() {
  return NextResponse.json(getControllerState());
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    active?: unknown;
  } | null;

  if (typeof body?.active !== "boolean") {
    return NextResponse.json(
      { error: "Expected boolean `active` value." },
      { status: 400 }
    );
  }

  return NextResponse.json(setControllerState(body.active));
}
