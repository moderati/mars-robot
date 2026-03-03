# Developer README: Robot Concierge Kiosk

This document explains the app architecture and the full runtime flow in detail.

## Tech Stack

- Next.js App Router (TypeScript)
- Tailwind CSS
- Vapi Web SDK (`@vapi-ai/web`)
- Client-only kiosk logic in a custom hook

## File Architecture

- `app/layout.tsx`
  Uses fonts, global styles, and favicon metadata.

- `app/page.tsx`
  Thin page entrypoint that reads env vars and renders `RobotKiosk`.

- `components/RobotKiosk.tsx`
  Presentation/UI layer only (buttons, labels, status bubble, styling).
  No SDK or permission internals live here now.

- `hooks/useRobotKioskController.ts`
  All behavior/state logic:
- Mic permission unlock
- Vapi instance lifecycle and event binding
- Start/stop call actions
- Derived status state for UI

- `lib/env.ts`
  Typed env access with hard failure when required env vars are missing.

## End-to-End Runtime Flow

1. App boots and renders `RobotKiosk`.
2. `useRobotKioskController` initializes persisted `armed` state from `localStorage`.
3. Hook creates `new Vapi(publicKey)` and subscribes to events (`call-start`, `call-end`, `speech-start`, `speech-end`, `error`).
4. User taps `Wake Robot`.
5. Hook requests `getUserMedia({ audio: true })`, then immediately stops tracks.
6. Hook saves `robot_armed=true` and broadcasts store update.
7. User taps `Start`.
8. Hook calls `vapi.start(assistantId)`.
9. During call:

- `speech-start` => talking indicator turns on.
- `speech-end` => listening indicator turns on.

10. User taps `Stop`.
11. Hook calls `vapi.stop()`, then `call-end` resets call state.

## Hook API Returned to UI

`useRobotKioskController` returns:

- `armed`
  Whether mic unlock has been completed and persisted.

- `inCall`
  Whether a live Vapi call is active.

- `isSpeaking`
  Whether the assistant is currently speaking.

- `isStarting`
  Transient state while call start is in progress.

- `isStopping`
  Transient state while call stop is in progress.

- `status`
  Canonical enum for UI styling: `error | stopping | speaking | inCall | armed | locked`.

- `statusText`
  Human-readable status message for the status panel.

- `wakeRobot()`
  Requests mic permission, stops tracks, persists armed state.

- `startConversation()`
  Starts Vapi session with the configured assistant.

- `stopConversation()`
  Stops current Vapi call.

## Function-by-Function: `useRobotKioskController.ts`

### Local armed state store helpers

- `getArmedSnapshot()`
  Reads `robot_armed` from `localStorage` on client.

- `getArmedServerSnapshot()`
  Returns `false` for SSR to keep server/client initial render aligned.

- `subscribeArmedStore(listener)`
  Registers subscribers for armed-state changes.

- `notifyArmedStoreChange()`
  Broadcasts armed-state updates to subscribers.

### Status helpers

- `resolveKioskStatus(state)`
  Deterministically maps raw booleans to one canonical status.
  Precedence is: error > stopping > speaking > in-call > armed > locked.

- `STATUS_TEXT`
  Maps canonical status to display copy.

### Permission helper

- `requestMicrophonePermission()`
  Primary mic request function.
  Uses modern `navigator.mediaDevices.getUserMedia`.
  Falls back to `webkitGetUserMedia` for older Safari compatibility.

### Hook internals

- `resetCallState()`
  Resets transient call flags (`isStarting`, `isStopping`, `inCall`, `isSpeaking`).
  Used by multiple event/error paths to keep logic DRY.

- `useEffect(..., [publicKey])`
  Creates Vapi instance and binds/unbinds listeners.
  Also performs cleanup `vapi.stop()` on unmount.

- `wakeRobot()`
  Unlock action behind user gesture.
  Persists `robot_armed=true` only after successful permission request.

- `startConversation()`
  Guarded start action to prevent duplicate call starts.

- `stopConversation()`
  Guarded stop action for active sessions only.

## iPad / Kiosk Notes

- Mic APIs require secure context (`https://` or localhost).
- Use Safari (not embedded in-app browsers).
- Keep Guided Access enabled for kiosk reliability.
