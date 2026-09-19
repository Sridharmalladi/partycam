import type * as THREE from "three";
import type { FaceSignals, FrameSignals } from "../tracking/signals";
import type { TriggerKind, TriggerResult } from "../gestures/triggers";
import type { Particles } from "../render/particles";
import type { Sfx } from "../audio/sfx";

export type ItemState = "IDLE" | "HELD" | "AT_MOUTH" | "READY" | "FINISHED";

export interface ItemInstance {
  def: ItemDef;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  state: ItemState;
  x: number;
  y: number;
  usesLeft: number;
  stage: number;
  data: Record<string, unknown>;
  respawnAt: number;
}

export interface ItemContext {
  item: ItemInstance;
  signals: FrameSignals;
  face: FaceSignals | null;
  trigger: TriggerResult;
  fx: { soft: Particles; glow: Particles };
  sfx: Sfx;
  size: number;
  height: number;
  now: number;
  dt: number;
  setStage(n: number): void;
  setTexture(tex: THREE.Texture): void;
  hint(text: string): void;
  finish(opts?: { respawnAfter?: number }): void;
}

export interface ItemDef {
  id: string;
  label: string;
  emoji: string;
  textures: THREE.Texture[];
  widthInFaces: number;
  anchor: "hand" | "screen";
  screenAnchor?: [number, number];
  gripPoint: [number, number];
  mouthPoint: [number, number];
  trigger: TriggerKind;
  uses: number; // auto-finish after this many uses (0 = item decides via finish())
  hints: { idle: string; held?: string; ready: string };
  init?(ctx: ItemContext): void;
  onUse?(ctx: ItemContext): void;
  onUpdate?(ctx: ItemContext): void;
}
