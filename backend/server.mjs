import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3001);
const MAX_REQUEST_BODY_BYTES = 1_000_000;
const KIOSK_OFFLINE_AFTER_MS = 10_000;
const KIOSK_STATUS_SWEEP_INTERVAL_MS = 1_000;
const SOCKET_HEARTBEAT_INTERVAL_MS = 30_000;
const VALID_KIOSK_RUNTIME_STATUSES = new Set([
  "locked",
  "ready",
  "connected",
  "speaking",
  "stopping",
  "reconnecting",
  "error",
]);
const VALID_NETWORK_TONES = new Set(["neutral", "good", "warn", "bad"]);

let controllerState = {
  isRobotActive: false,
  updatedAt: Date.now(),
};

let kioskStatus = {
  online: false,
  micReady: false,
  runtimeStatus: "locked",
  networkLabel: "unknown",
  networkTone: "neutral",
  lastError: null,
  updatedAt: 0,
};

const socketServer = new WebSocketServer({ noServer: true });

function getAllowedOrigins() {
  return (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin) {
  const allowedOrigins = getAllowedOrigins();

  if (!origin || allowedOrigins.length === 0) {
    return true;
  }

  return allowedOrigins.includes(origin);
}

function getCorsOrigin(origin) {
  return isOriginAllowed(origin) ? origin || "*" : "null";
}

function sendJson(response, statusCode, payload, origin) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": getCorsOrigin(origin),
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    Vary: "Origin",
  });
  response.end(JSON.stringify(payload));
}

function sendOptions(response, origin) {
  response.writeHead(204, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": getCorsOrigin(origin),
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });
  response.end();
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > MAX_REQUEST_BODY_BYTES) {
        reject(new Error("request_body_too_large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!body) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function broadcastControllerState() {
  broadcastMessage({
    type: "controller-state",
    state: controllerState,
  });
}

function broadcastKioskStatus() {
  broadcastMessage({
    type: "kiosk-status",
    state: kioskStatus,
  });
}

function broadcastMessage(payload) {
  const message = JSON.stringify(payload);

  for (const client of socketServer.clients) {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  }
}

function getRealtimeState() {
  return {
    controller: controllerState,
    kiosk: kioskStatus,
  };
}

function setControllerState(isRobotActive) {
  controllerState = {
    isRobotActive,
    updatedAt: Date.now(),
  };
  broadcastControllerState();
  return controllerState;
}

function setKioskStatus(nextStatus) {
  kioskStatus = {
    online: true,
    micReady: nextStatus.micReady,
    runtimeStatus: nextStatus.runtimeStatus,
    networkLabel: nextStatus.networkLabel,
    networkTone: nextStatus.networkTone,
    lastError: nextStatus.lastError ?? null,
    updatedAt: Date.now(),
  };
  broadcastKioskStatus();
  return kioskStatus;
}

async function handleControllerApi(request, response, origin) {
  if (request.method === "OPTIONS") {
    sendOptions(response, origin);
    return;
  }

  if (request.method === "GET") {
    sendJson(response, 200, controllerState, origin);
    return;
  }

  if (request.method !== "POST") {
    response.writeHead(405, {
      "Access-Control-Allow-Origin": getCorsOrigin(origin),
      Allow: "GET, POST, OPTIONS",
      "Content-Type": "application/json",
      Vary: "Origin",
    });
    response.end(
      JSON.stringify({
        error: "method_not_allowed",
        message:
          "The controller endpoint only supports GET and POST. Use GET to read the current Start/Stop command, or POST JSON with a boolean `isRobotActive` value to update it.",
      })
    );
    return;
  }

  let body;

  try {
    body = await readJsonBody(request);
  } catch {
    sendJson(
      response,
      400,
      {
        error: "invalid_json_body",
        message:
          "The controller request body could not be parsed as JSON, or it was larger than 1 MB. Send `Content-Type: application/json` with a body like `{ \"isRobotActive\": true }`.",
      },
      origin
    );
    return;
  }

  if (typeof body?.isRobotActive !== "boolean") {
    sendJson(
      response,
      400,
      {
        error: "invalid_controller_payload",
        message:
          "The controller payload is missing a valid `isRobotActive` value. Send `{ \"isRobotActive\": true }` to start the kiosk call or `{ \"isRobotActive\": false }` to stop it.",
      },
      origin
    );
    return;
  }

  sendJson(response, 200, setControllerState(body.isRobotActive), origin);
}

async function handleKioskStatusApi(request, response, origin) {
  if (request.method === "OPTIONS") {
    sendOptions(response, origin);
    return;
  }

  if (request.method === "GET") {
    sendJson(response, 200, kioskStatus, origin);
    return;
  }

  if (request.method !== "POST") {
    response.writeHead(405, {
      "Access-Control-Allow-Origin": getCorsOrigin(origin),
      Allow: "GET, POST, OPTIONS",
      "Content-Type": "application/json",
      Vary: "Origin",
    });
    response.end(
      JSON.stringify({
        error: "method_not_allowed",
        message:
          "The kiosk status endpoint only supports GET and POST. Use GET to read the latest kiosk heartbeat, or POST the kiosk readiness payload from the iPad.",
      })
    );
    return;
  }

  let body;

  try {
    body = await readJsonBody(request);
  } catch {
    sendJson(
      response,
      400,
      {
        error: "invalid_json_body",
        message:
          "The kiosk status request body could not be parsed as JSON, or it was larger than 1 MB. Send the iPad heartbeat with micReady, runtimeStatus, networkLabel, networkTone, and lastError fields.",
      },
      origin
    );
    return;
  }

  if (
    typeof body?.micReady !== "boolean" ||
    !VALID_KIOSK_RUNTIME_STATUSES.has(body.runtimeStatus) ||
    typeof body.networkLabel !== "string" ||
    !VALID_NETWORK_TONES.has(body.networkTone) ||
    (typeof body.lastError !== "string" && body.lastError !== null)
  ) {
    sendJson(
      response,
      400,
      {
        error: "invalid_kiosk_status_payload",
        message:
          "The kiosk status payload is incomplete or has an unsupported value. Expected micReady as a boolean, runtimeStatus as locked/ready/connected/speaking/stopping/reconnecting/error, networkLabel as text, networkTone as neutral/good/warn/bad, and lastError as text or null.",
      },
      origin
    );
    return;
  }

  sendJson(response, 200, setKioskStatus(body), origin);
}

function handleControllerSocket(socket) {
  socket.isAlive = true;

  socket.on("pong", () => {
    socket.isAlive = true;
  });

  socket.send(
    JSON.stringify({
      type: "realtime-state",
      state: getRealtimeState(),
    })
  );
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  const origin = request.headers.origin;

  if (!isOriginAllowed(origin)) {
    sendJson(
      response,
      403,
      {
        error: "origin_not_allowed",
        message:
          "This origin is not allowed to use the robot realtime backend.",
      },
      origin
    );
    return;
  }

  if (url.pathname === "/health") {
    sendJson(
      response,
      200,
      {
        ok: true,
        controller: controllerState,
        kiosk: kioskStatus,
      },
      origin
    );
    return;
  }

  if (url.pathname === "/api/controller") {
    try {
      await handleControllerApi(request, response, origin);
    } catch {
      sendJson(
        response,
        500,
        {
          error: "controller_api_failed",
          message:
            "The server failed while reading or updating the controller command. Restart the backend server if this repeats.",
        },
        origin
      );
    }
    return;
  }

  if (url.pathname === "/api/kiosk-status") {
    try {
      await handleKioskStatusApi(request, response, origin);
    } catch {
      sendJson(
        response,
        500,
        {
          error: "kiosk_status_api_failed",
          message:
            "The server failed while reading or updating the kiosk heartbeat. Restart the backend server if this repeats.",
        },
        origin
      );
    }
    return;
  }

  sendJson(
    response,
    404,
    {
      error: "not_found",
      message:
        "Robot realtime backend is running. Use /health, /api/controller, /api/kiosk-status, or /api/controller/ws.",
    },
    origin
  );
});

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  const origin = request.headers.origin;

  if (url.pathname !== "/api/controller/ws" || !isOriginAllowed(origin)) {
    socket.destroy();
    return;
  }

  socketServer.handleUpgrade(request, socket, head, (webSocket) => {
    socketServer.emit("connection", webSocket, request);
  });
});

socketServer.on("connection", handleControllerSocket);

const kioskStatusSweepInterval = setInterval(() => {
  if (
    kioskStatus.online &&
    Date.now() - kioskStatus.updatedAt > KIOSK_OFFLINE_AFTER_MS
  ) {
    kioskStatus = {
      ...kioskStatus,
      online: false,
      updatedAt: Date.now(),
    };
    broadcastKioskStatus();
  }
}, KIOSK_STATUS_SWEEP_INTERVAL_MS);

const socketHeartbeatInterval = setInterval(() => {
  for (const socket of socketServer.clients) {
    if (socket.isAlive === false) {
      socket.terminate();
      continue;
    }

    socket.isAlive = false;
    socket.ping();
  }
}, SOCKET_HEARTBEAT_INTERVAL_MS);

socketServer.on("close", () => {
  clearInterval(kioskStatusSweepInterval);
  clearInterval(socketHeartbeatInterval);
});

server.listen(port, host, () => {
  console.log(`> Robot realtime backend ready on http://${host}:${port}`);
});
