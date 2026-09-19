# PartyCam

Webcam party trick, in the browser. Pinch a slice of pizza and take a bite, or blow out the candles on a cake — tracked live from your face and hands. Nothing is uploaded: all tracking runs on-device via MediaPipe.

## Try it

Open the deployed site on your phone or laptop, tap **Start camera**, and allow camera access:

- **Pizza** — pinch with thumb and index finger near the slice to grab it, bring it to your mouth, open and close your jaw to bite.
- **Cake** — pucker or purse your lips toward the screen to blow out the candles.

Requires a real browser tab (not an app's built-in in-app browser) and camera permission.

## Run locally

```bash
npm install
npm run dev
```

Open the printed `http://localhost:5173` URL — browsers treat `localhost` as a secure context, so the camera works there. Testing over LAN on a phone needs HTTPS (browsers block camera access on plain HTTP for any non-localhost origin); the deployed GitHub Pages site is HTTPS by default and works on any device.

## Deploy

Pushing to `main` builds and deploys to GitHub Pages automatically via `.github/workflows/deploy.yml`. The site is served at `/partycam/`, matching `base` in `vite.config.ts`.
