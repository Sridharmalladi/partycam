export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("NO_CAMERA_API");

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: 960 },
      height: { ideal: 720 },
    },
  });

  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();

  if (!video.videoWidth) {
    await new Promise<void>((resolve) =>
      video.addEventListener("loadedmetadata", () => resolve(), { once: true }),
    );
  }
  return stream;
}

export function isInAppBrowser(): boolean {
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|TikTok/i.test(ua);
}
