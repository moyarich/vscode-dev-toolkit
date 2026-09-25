import { writeFile } from "node:fs/promises";
import path from "node:path";
import { runProcess } from "../process.mjs";

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function ensureVideoEncoder() {
  await runProcess("ffmpeg", ["-version"]);
}

export function createFrameRecorder({ page, framesDirectory, frameRate }) {
  let running = false;
  let frameNumber = 0;
  let session;
  let startedAt = 0;
  let lastFrameData;
  let writeQueue = Promise.resolve();
  let resolveFirstFrame;
  const firstFrame = new Promise((resolve) => {
    resolveFirstFrame = resolve;
  });

  function enqueueFrames(data, targetFrameCount) {
    while (frameNumber < targetFrameCount) {
      const fileName = `${String(frameNumber).padStart(6, "0")}.png`;

      writeQueue = writeQueue.then(() =>
        writeFile(path.join(framesDirectory, fileName), data, "base64"),
      );
      frameNumber += 1;
    }
  }

  return {
    async start() {
      if (running) {
        throw new Error("Frame recorder is already running.");
      }

      running = true;
      startedAt = 0;
      session = await page.context().newCDPSession(page);

      session.on("Page.screencastFrame", ({ data, sessionId }) => {
        void session
          ?.send("Page.screencastFrameAck", { sessionId })
          .catch(() => undefined);

        if (!running) {
          return;
        }

        if (startedAt === 0) {
          startedAt = Date.now();
        }

        lastFrameData = data;
        const elapsed = Date.now() - startedAt;
        const targetFrameCount = Math.max(
          1,
          Math.floor((elapsed * frameRate) / 1000) + 1,
        );

        enqueueFrames(data, targetFrameCount);
        resolveFirstFrame?.();
        resolveFirstFrame = undefined;
      });

      await session.send("Page.startScreencast", {
        format: "png",
        everyNthFrame: 1,
        maxWidth: 1280,
        maxHeight: 900,
      });

      await Promise.race([
        firstFrame,
        delay(5_000).then(() => {
          throw new Error("Timed out waiting for the first screencast frame.");
        }),
      ]);
    },

    async stop() {
      if (!session) {
        return;
      }

      running = false;
      const elapsed = startedAt === 0 ? 0 : Date.now() - startedAt;

      if (lastFrameData) {
        enqueueFrames(
          lastFrameData,
          Math.max(1, Math.ceil((elapsed * frameRate) / 1000)),
        );
      }

      await session.send("Page.stopScreencast").catch(() => undefined);
      await writeQueue;
      await session.detach().catch(() => undefined);
      session = undefined;
    },
  };
}

export async function encodeRecording({
  framesDirectory,
  recordingPath,
  frameRate,
}) {
  await runProcess("ffmpeg", [
    "-y",
    "-framerate",
    String(frameRate),
    "-i",
    path.join(framesDirectory, "%06d.png"),
    "-c:v",
    "libvpx-vp9",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "30",
    "-b:v",
    "0",
    recordingPath,
  ]);
}
