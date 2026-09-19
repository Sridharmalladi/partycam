import type * as THREE from "three";
import { pixelTexture, glowTexture } from "./pixelArt";

const CIG_PALETTE: Record<string, string> = {
  w: "#f4efe3",
  g: "#ddd6c6",
  f: "#caa06a",
  d: "#8a5a2b",
  a: "#8f8f8f",
  e: "#ff7b1f",
};

const FULL_PAPER_ROWS = 16;
const FILTER_ROWS = 8;
export const CIGARETTE_STAGES = 6; // number of burn-down steps before it's finished

/** A hand-rolled pixel cigarette. `burnLevel` 0..CIGARETTE_STAGES shortens the paper as it's smoked. */
export function generateCigaretteTexture(lit: boolean, burnLevel: number): THREE.Texture {
  const paperRows = Math.max(3, FULL_PAPER_ROWS - burnLevel * 2);
  const rows: string[] = [];

  rows.push(lit ? ".eee." : ".aaa.");
  rows.push(lit ? "eeeee" : "aaaaa");
  for (let i = 0; i < paperRows; i++) rows.push(i % 5 === 2 ? "wgwgw" : "wwwww");
  for (let i = 0; i < FILTER_ROWS; i++) rows.push(i === 0 ? "ddddd" : i % 3 === 0 ? "fdfdf" : "fffff");

  return pixelTexture(rows, CIG_PALETTE, 10);
}

const LIGHTER_PALETTE: Record<string, string> = {
  c: "#1c1c1c",
  m: "#b8bec7",
  h: "#2b2b2b",
  b: "#e0483f",
};

const LIGHTER_ROWS = [
  ".ccccc.",
  "cmmmmmc",
  "cmhhhmc",
  "cmhhhmc",
  "cmmmmmc",
  "cbbbbbc",
  "cbbbbbc",
  "cbbbbbc",
  "cbbbbbc",
  "cbbbbbc",
  "cbbbbbc",
  "cbbbbbc",
  "cbbbbbc",
  ".ccccc.",
];

let lighterTexCache: THREE.Texture | null = null;
export function generateLighterTexture(): THREE.Texture {
  if (!lighterTexCache) lighterTexCache = pixelTexture(LIGHTER_ROWS, LIGHTER_PALETTE, 10);
  return lighterTexCache;
}

let flameTexCache: THREE.Texture | null = null;
export function generateFlameTexture(): THREE.Texture {
  if (!flameTexCache) {
    flameTexCache = glowTexture(64, [
      [0, "rgba(255,246,190,0.95)"],
      [0.35, "rgba(255,170,50,0.85)"],
      [0.7, "rgba(255,110,20,0.45)"],
      [1, "rgba(255,110,20,0)"],
    ]);
  }
  return flameTexCache;
}

let emberGlowCache: THREE.Texture | null = null;
export function generateEmberGlowTexture(): THREE.Texture {
  if (!emberGlowCache) {
    emberGlowCache = glowTexture(48, [
      [0, "rgba(255,200,120,0.9)"],
      [0.5, "rgba(255,120,40,0.5)"],
      [1, "rgba(255,120,40,0)"],
    ]);
  }
  return emberGlowCache;
}
