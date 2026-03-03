# Robot Concierge Kiosk (Next.js + Custom Vapi Controls)

A barebones iPad-friendly kiosk web app built with Next.js App Router, Tailwind CSS, and TypeScript.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` in the project root:

```env
NEXT_PUBLIC_VAPI_PUBLIC_KEY="...public key from Vapi..."
NEXT_PUBLIC_VAPI_ASSISTANT_ID="...assistant id..."
```

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Production Build

```bash
npm run build
npm run start
```

## Kiosk Behavior

- `Wake Robot` requests microphone permission from a user gesture.
- On success, tracks are stopped immediately and kiosk state is persisted in `localStorage` (`robot_armed=true`).
- `Start` begins a voice session using Vapi Web SDK (`@vapi-ai/web`) with your assistant ID.
- No embedded widget UI. Controls are custom and centered for kiosk layout.

## iPad Kiosk Tips

- Use Safari for reliable microphone permission prompts.
- Turn on **Guided Access** in iPad settings to lock to kiosk mode.
- Set **Auto-Lock** to Never (or longest available duration) while on kiosk power.
- Keep device plugged in and disable low power mode.

## Mic Permission Troubleshooting

- If mic permission is denied, tap the browser/site settings and allow microphone.
- In iPad settings, check `Safari > Microphone` (or browser microphone settings) and set to **Allow**.
- If state is stuck, clear local storage key `robot_armed` and refresh.
