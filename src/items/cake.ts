import { generateCakeTexture } from "./textures";
import type { ItemDef } from "./types";

const CANDLES = 5;
const CONFETTI = ["#ff5d8f", "#ffd166", "#06d6a0", "#4cc9f0", "#b388ff"];
const initialTexture = generateCakeTexture(new Array(CANDLES).fill(true));

export const cake: ItemDef = {
  id: "cake",
  label: "Birthday cake",
  emoji: "🎂",
  textures: [initialTexture],
  widthInFaces: 2.6,
  anchor: "screen",
  screenAnchor: [0.5, 0.8],
  gripPoint: [0, 0],
  mouthPoint: [0, 0.15],
  trigger: "blow",
  uses: 0,
  hints: { idle: "", ready: "Blow toward the candles 💨" },

  init(ctx) {
    ctx.item.data.lit = new Array(CANDLES).fill(true);
  },

  onUpdate(ctx) {
    if (ctx.trigger.level <= 0) return;
    const lit = ctx.item.data.lit as boolean[];
    const litCount = lit.filter(Boolean).length;
    if (litCount === 0) return;
    // Each sustained blow has a chance to snuff out one more candle.
    if (Math.random() < ctx.trigger.level * ctx.dt * 3) {
      const idx = lit.findIndex((v) => v);
      if (idx >= 0) {
        lit[idx] = false;
        ctx.setTexture(generateCakeTexture([...lit]));
        ctx.fx.glow.emit({
          x: ctx.item.x,
          y: ctx.item.y + ctx.height * 0.15,
          count: 8,
          dirY: 1,
          spread: 1.2,
          speed: [30, 70],
          gravity: -60,
          life: [0.3, 0.6],
          size: [5, 10],
          color: ["#ffcf4a", "#fff1c1"],
        });
        if (lit.every((v) => !v)) {
          ctx.fx.soft.emit({
            x: ctx.item.x,
            y: ctx.item.y + ctx.height * 0.3,
            count: 60,
            dirY: 1,
            spread: Math.PI * 2,
            speed: [80, 220],
            gravity: 260,
            life: [0.8, 1.4],
            size: [5, 10],
            color: CONFETTI,
          });
          ctx.finish({ respawnAfter: 4 });
        }
      }
    }
  },
};
