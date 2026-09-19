import { FaceLandmarker, FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { FaceLandmarkerResult, HandLandmarkerResult } from "@mediapipe/tasks-vision";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export interface RawResults {
  face?: FaceLandmarkerResult;
  hands?: HandLandmarkerResult;
}

export class Tracker {
  private face: FaceLandmarker | null = null;
  private hands: HandLandmarker | null = null;

  async init() {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);

    const build = async (delegate: "GPU" | "CPU") => {
      const [face, hands] = await Promise.all([
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
        }),
        HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: HAND_MODEL, delegate },
          runningMode: "VIDEO",
          numHands: 2,
        }),
      ]);
      this.face = face;
      this.hands = hands;
    };

    try {
      await build("GPU");
    } catch (err) {
      console.warn("GPU delegate failed, falling back to CPU", err);
      await build("CPU");
    }
  }

  /** timestampMs must increase on every call. */
  detect(video: HTMLVideoElement, timestampMs: number): RawResults {
    return {
      face: this.face?.detectForVideo(video, timestampMs),
      hands: this.hands?.detectForVideo(video, timestampMs),
    };
  }
}
