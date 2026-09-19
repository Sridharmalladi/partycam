import * as THREE from "three";

/**
 * Draws a chunky pixel-art sprite from a row-of-characters grid and returns it as a
 * nearest-filtered texture (no smoothing/mipmaps), so it stays crisp at any scale.
 */
export function pixelTexture(rows: string[], palette: Record<string, string>, pixelSize = 10): THREE.Texture {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const canvas = document.createElement("canvas");
  canvas.width = w * pixelSize;
  canvas.height = h * pixelSize;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const color = palette[ch];
      if (!color || ch === "." || ch === " ") continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Soft radial-gradient sprite (for flame/glow), intentionally NOT pixelated. */
export function glowTexture(size: number, stops: [number, string][]): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [stop, color] of stops) grad.addColorStop(stop, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
