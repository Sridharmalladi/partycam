import * as THREE from "three";

const SIZE = 256;

function toTexture(canvas: HTMLCanvasElement): THREE.Texture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function newCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx };
}

/** Pizza slice, drawn as shapes (no external art). Each stage removes another bite from the tip. */
export function generatePizzaTextures(bites = 4): THREE.Texture[] {
  const textures: THREE.Texture[] = [];
  const biteSpots = [
    [128, 60],
    [95, 95],
    [160, 95],
    [128, 130],
  ];

  for (let stage = 0; stage <= bites; stage++) {
    const { canvas, ctx } = newCanvas();
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Crust (bottom arc) + cheese (triangle) forming a slice pointing up
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(128, 40);
    ctx.lineTo(50, 210);
    ctx.quadraticCurveTo(128, 235, 206, 210);
    ctx.closePath();
    const cheese = ctx.createLinearGradient(0, 40, 0, 210);
    cheese.addColorStop(0, "#ffd873");
    cheese.addColorStop(1, "#ffb74d");
    ctx.fillStyle = cheese;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(50, 210);
    ctx.quadraticCurveTo(128, 235, 206, 210);
    ctx.lineTo(206, 225);
    ctx.quadraticCurveTo(128, 250, 50, 225);
    ctx.closePath();
    ctx.fillStyle = "#e8a23a";
    ctx.fill();

    // Pepperoni
    ctx.fillStyle = "#c0392b";
    for (const [px, py] of [
      [110, 110],
      [145, 135],
      [100, 160],
      [150, 175],
    ]) {
      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Bites eaten so far: punch circles out of the tip
    ctx.globalCompositeOperation = "destination-out";
    for (let b = 0; b < stage; b++) {
      const [bx, by] = biteSpots[b];
      ctx.beginPath();
      ctx.arc(bx, by, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    textures.push(toTexture(canvas));
  }
  return textures;
}

/** Birthday cake with N candles; `litMask[i]` false means that candle has been blown out. */
export function generateCakeTexture(litMask: boolean[]): THREE.Texture {
  const { canvas, ctx } = newCanvas();
  ctx.clearRect(0, 0, SIZE, SIZE);

  // Plate
  ctx.beginPath();
  ctx.ellipse(128, 220, 100, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#3a3a44";
  ctx.fill();

  // Cake body
  ctx.fillStyle = "#c97b5f";
  ctx.fillRect(48, 150, 160, 65);

  // Frosting
  ctx.fillStyle = "#fdf3e7";
  ctx.beginPath();
  ctx.moveTo(48, 150);
  for (let x = 48; x <= 208; x += 16) {
    ctx.quadraticCurveTo(x + 8, 138, x + 16, 150);
  }
  ctx.lineTo(208, 165);
  ctx.lineTo(48, 165);
  ctx.closePath();
  ctx.fill();

  // Sprinkles
  const sprinkleColors = ["#ff5d8f", "#4cc9f0", "#ffd166", "#06d6a0"];
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = sprinkleColors[i % sprinkleColors.length];
    ctx.fillRect(56 + ((i * 11) % 150), 158 + ((i * 7) % 45), 4, 8);
  }

  // Candles + flames
  const n = litMask.length;
  const startX = 128 - ((n - 1) * 28) / 2;
  for (let i = 0; i < n; i++) {
    const cx = startX + i * 28;
    ctx.fillStyle = ["#4cc9f0", "#ff5d8f", "#ffd166", "#06d6a0", "#b388ff"][i % 5];
    ctx.fillRect(cx - 4, 105, 8, 45);

    if (litMask[i]) {
      const grad = ctx.createRadialGradient(cx, 92, 1, cx, 92, 12);
      grad.addColorStop(0, "#fff7cc");
      grad.addColorStop(0.5, "#ffcf4a");
      grad.addColorStop(1, "rgba(255,140,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, 92, 8, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "#9a9aa5";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 3, 98);
      ctx.lineTo(cx + 4, 90);
      ctx.stroke();
    }
  }

  return toTexture(canvas);
}
