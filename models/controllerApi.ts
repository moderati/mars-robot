export type ControllerState = {
  isRobotActive: boolean;
  updatedAt: number;
};

export type KioskRuntimeStatus =
  | "locked"
  | "ready"
  | "connected"
  | "speaking"
  | "stopping"
  | "reconnecting"
  | "error";

export type KioskStatusSnapshot = {
  online: boolean;
  micReady: boolean;
  runtimeStatus: KioskRuntimeStatus;
  networkLabel: string;
  networkTone: "neutral" | "good" | "warn" | "bad";
  lastError: string | null;
  updatedAt: number;
};

export type RealtimeState = {
  controller: ControllerState;
  kiosk: KioskStatusSnapshot;
};

export type ControllerConnectionStatus =
  | "connecting"
  | "open"
  | "closed"
  | "error";

type ControllerStateMessage = {
  type: "controller-state";
  state: ControllerState;
};

type KioskStatusMessage = {
  type: "kiosk-status";
  state: KioskStatusSnapshot;
};

type RealtimeStateMessage = {
  type: "realtime-state";
  state: RealtimeState;
};

type ControllerSocketMessage =
  | ControllerStateMessage
  | KioskStatusMessage
  | RealtimeStateMessage;

type RealtimeStateSubscription = {
  onControllerState?: (state: ControllerState) => void;
  onKioskStatus?: (state: KioskStatusSnapshot) => void;
  onStatus?: (status: ControllerConnectionStatus) => void;
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

async function readApiErrorPayload(response: Response) {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return null;
  }
}

async function createApiErrorMessage(
  response: Response,
  fallbackMessage: string
) {
  const payload = await readApiErrorPayload(response);
  const serverMessage =
    typeof payload?.message === "string"
      ? payload.message
      : typeof payload?.error === "string"
        ? payload.error
        : null;
  const statusLabel = response.statusText
    ? `${response.status} ${response.statusText}`
    : String(response.status);

  return serverMessage
    ? `${fallbackMessage} Server responded with ${statusLabel}: ${serverMessage}`
    : `${fallbackMessage} Server responded with ${statusLabel}, but did not include a readable error message.`;
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  failureMessage: string
) {
  let response: Response;

  try {
    response = await fetch(path, init);
  } catch {
    throw new Error(
      `${failureMessage} The browser could not reach ${path}. Confirm the custom Node server is running and that the kiosk and controller are on the same network.`
    );
  }

  if (!response.ok) {
    throw new Error(await createApiErrorMessage(response, failureMessage));
  }

  return (await response.json()) as T;
}

function getBackendHttpUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_BACKEND_HTTP_URL?.trim();

  if (!configuredUrl) {
    return "";
  }

  return configuredUrl.replace(/\/$/, "");
}

function getBackendPath(path: string) {
  return `${getBackendHttpUrl()}${path}`;
}

export async function fetchControllerState() {
  return requestJson<ControllerState>(
    getBackendPath("/api/controller"),
    {
      cache: "no-store",
    },
    "Could not load the current controller command."
  );
}

export async function fetchKioskStatus() {
  return requestJson<KioskStatusSnapshot>(
    getBackendPath("/api/kiosk-status"),
    {
      cache: "no-store",
    },
    "Could not load the latest iPad kiosk readiness status."
  );
}

// iPhone controller writes this; iPad kiosk reacts to it.
export async function setRobotActive(isRobotActive: boolean) {
  return requestJson<ControllerState>(
    getBackendPath("/api/controller"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isRobotActive }),
    },
    isRobotActive
      ? "Could not send the Start command to the kiosk."
      : "Could not send the Stop command to the kiosk."
  );
}

// iPad publishes this; iPhone controller displays it as readiness.
export async function publishKioskStatus(
  status: Omit<KioskStatusSnapshot, "updatedAt" | "online">
) {
  return requestJson<KioskStatusSnapshot>(
    getBackendPath("/api/kiosk-status"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(status),
    },
    "Could not publish the iPad kiosk heartbeat."
  );
}

function getControllerSocketUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL?.trim();

  if (configuredUrl) {
    return configuredUrl;
  }

  const backendHttpUrl = getBackendHttpUrl();

  if (backendHttpUrl) {
    return `${backendHttpUrl.replace(/^http/, "ws")}/api/controller/ws`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/controller/ws`;
}

// WebSocket is the fast path for cross-device state updates.
export function subscribeRealtimeState({
  onControllerState,
  onKioskStatus,
  onStatus,
}: RealtimeStateSubscription) {
  if (typeof window === "undefined") {
    return () => {};
  }

  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  let manuallyClosed = false;

  function clearTimers() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect() {
    if (manuallyClosed || reconnectTimer) return;

    const delayMs = Math.min(500 * 2 ** reconnectAttempts, 5000);
    reconnectAttempts += 1;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delayMs);
  }

  function connect() {
    if (manuallyClosed) return;

    onStatus?.("connecting");
    socket = new WebSocket(getControllerSocketUrl());

    socket.addEventListener("open", () => {
      reconnectAttempts = 0;
      onStatus?.("open");
    });

    socket.addEventListener("message", (event) => {
      let message: ControllerSocketMessage;

      try {
        message = JSON.parse(event.data as string) as ControllerSocketMessage;
      } catch {
        return;
      }

      switch (message.type) {
        case "controller-state":
          onControllerState?.(message.state);
          break;
        case "kiosk-status":
          onKioskStatus?.(message.state);
          break;
        case "realtime-state":
          onControllerState?.(message.state.controller);
          onKioskStatus?.(message.state.kiosk);
          break;
      }
    });

    socket.addEventListener("error", () => {
      onStatus?.("error");
    });

    socket.addEventListener("close", () => {
      if (manuallyClosed) return;
      onStatus?.("closed");
      scheduleReconnect();
    });
  }

  connect();

  return () => {
    manuallyClosed = true;
    clearTimers();
    socket?.close();
    socket = null;
  };
}
