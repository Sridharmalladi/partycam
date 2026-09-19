import { generatePizzaTextures } from "./textures";
import type { ItemDef } from "./types";

const textures = generatePizzaTextures(4);

export const pizza: ItemDef = {
  id: "pizza",
  label: "Pizza",
  emoji: "🍕",
  textures,
  widthInFaces: 1.1,
  anchor: "hand",
  gripPoint: [0, -0.35],
  mouthPoint: [0, 0.3],
  trigger: "bite",
  uses: 4,
  hints: {
    idle: "Pinch the slice to grab it 🤏",
    held: "Bring it to your mouth",
    ready: "Open wide and chomp! 😋",
  },

  onUse(ctx) {
    const { item } = ctx;
    ctx.setStage(item.stage + 1);
    ctx.sfx.crunch();
    ctx.fx.soft.emit({
      x: item.x,
      y: item.y + ctx.height * 0.3,
      count: 22,
      dirY: -1,
      spread: 1.6,
      speed: [60, 180],
      gravity: 500,
      life: [0.5, 1],
      size: [4, 9],
      color: ["#f2c14e", "#d9822b", "#fff1c1"],
    });
  },
};
