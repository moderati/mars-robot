# Split Deployment

This app runs as two deployments:

- Vercel: Next frontend only.
- Render: Node realtime backend for REST state and WebSockets.

## Render Backend

Create a Render Web Service from this repo.

- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm run start:backend`
- Health Check Path: `/health`

Environment variables:

```env
CORS_ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
```

Leave `CORS_ALLOWED_ORIGINS` empty only while testing. When it is empty, any
browser origin can reach the backend endpoints.

Render will provide `PORT`; do not set it manually unless you know you need to.

## Vercel Frontend

Deploy the same repo to Vercel with the default Next.js settings.

Environment variables:

```env
NEXT_PUBLIC_VAPI_PUBLIC_KEY=your_vapi_public_key
NEXT_PUBLIC_VAPI_ASSISTANT_ID=your_vapi_assistant_id
NEXT_PUBLIC_BACKEND_HTTP_URL=https://your-render-service.onrender.com
NEXT_PUBLIC_BACKEND_WS_URL=wss://your-render-service.onrender.com/api/controller/ws
```

`NEXT_PUBLIC_BACKEND_WS_URL` is optional if the WebSocket URL is the same host as
`NEXT_PUBLIC_BACKEND_HTTP_URL`; the frontend can derive it automatically.

## Local Development

Run the backend:

```bash
npm run dev:backend
```

Run the frontend in another terminal:

```bash
npm run dev
```

Use these local env values:

```env
NEXT_PUBLIC_BACKEND_HTTP_URL=http://localhost:3001
NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:3001/api/controller/ws
CORS_ALLOWED_ORIGINS=http://localhost:3000
```
