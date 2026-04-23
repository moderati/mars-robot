export type ControllerState = {
  active: boolean;
  updatedAt: number;
};

export async function fetchControllerState() {
  const response = await fetch("/api/controller", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("controller_state_fetch_failed");
  }

  return (await response.json()) as ControllerState;
}

export async function setControllerActive(active: boolean) {
  const response = await fetch("/api/controller", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ active }),
  });

  if (!response.ok) {
    throw new Error("controller_state_update_failed");
  }

  return (await response.json()) as ControllerState;
}
