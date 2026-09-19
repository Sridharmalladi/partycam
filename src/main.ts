import "./style.css";
import { startCamera, isInAppBrowser } from "./camera";
import { Tracker } from "./tracking/tracker";
import { SignalBuilder } from "./tracking/signals";
import { Stage } from "./render/stage";
import { Particles } from "./render/particles";
import { ItemController } from "./items/controller";
import { Sfx } from "./audio/sfx";
import { pizza } from "./items/pizza";
import { cake } from "./items/cake";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const landing = $("landing");
const fallback = $("fallback");
const fallbackReason = $("fallback-reason");
const app = $("app");
const startBtn = $<HTMLButtonElement>("start");
const retryBtn = $<HTMLButtonElement>("retry");
const statusEl = $("status");
const inAppWarning = $("inapp-warning");
const video = $<HTMLVideoElement>("webcam");
const canvas = $<HTMLCanvasElement>("stage");
const hintEl = $("hint");
const menu = $("menu");

const ITEMS = { pizza, cake };

if (isInAppBrowser()) inAppWarning.hidden = false;

startBtn.addEventListener("click", () => void boot());
retryBtn.addEventListener("click", () => {
  fallback.hidden = true;
  landing.hidden = false;
});

async function boot() {
  startBtn.disabled = true;
  statusEl.textContent = "Starting camera…";

  try {
    await startCamera(video);
  } catch (err) {
    showFallback(cameraErrorMessage(err));
    return;
  }

  statusEl.textContent = "Loading hand & face tracking…";
  const tracker = new Tracker();
  try {
    await tracker.init();
  } catch (err) {
    console.error(err);
    showFallback("Your browser can't run the on-device tracking model. Try Chrome or Safari, latest version.");
    return;
  }

  landing.hidden = true;
  app.hidden = false;
  startApp(tracker);
}

function cameraErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === "NotAllowedError") return "Camera permission was denied. Allow camera access in your browser settings and try again.";
  if (name === "NotFoundError") return "No camera was found on this device.";
  if ((err as Error)?.message === "NO_CAMERA_API") return "This browser doesn't support camera access. Try Chrome or Safari.";
  return "Couldn't access the camera. Try again, or use a different browser.";
}

function showFallback(reason: string) {
  landing.hidden = true;
  fallback.hidden = false;
  fallbackReason.textContent = reason;
  startBtn.disabled = false;
}

function startApp(tracker: Tracker) {
  const stage = new Stage(canvas, video);
  const sfx = new Sfx();
  const soft = new Particles(400, false);
  const glow = new Particles(200, true);
  stage.scene.add(soft.points);
  stage.scene.add(glow.points);

  const signals = new SignalBuilder(stage);
  const controller = new ItemController(stage, { soft, glow }, sfx, hintEl);
  controller.select(pizza);

  menu.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-item]");
    if (!btn) return;
    const id = btn.dataset.item as keyof typeof ITEMS;
    controller.select(ITEMS[id]);
    for (const b of menu.querySelectorAll("button")) b.classList.toggle("active", b === btn);
  });

  let last = performance.now();
  function loop(now: number) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    const raw = tracker.detect(video, now);
    const sig = signals.update(raw.face, raw.hands, now / 1000);

    controller.update(sig, now / 1000, dt);
    soft.update(dt);
    glow.update(dt);
    stage.render();
  }
  requestAnimationFrame(loop);
}
