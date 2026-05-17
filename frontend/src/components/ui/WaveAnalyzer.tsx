// frontend/src/components/ui/WaveAnalyzer.tsx

import React, { useRef, useEffect, useCallback } from "react";
import { useAudioSettingsStore, webAudioService } from "../../lib/webAudio";

interface WaveAnalyzerProps {
  width?: number;
  height?: number;
}

const FPS = 60;
const FPS_INTERVAL = 1000 / FPS;

function setupCanvas(
  canvas: HTMLCanvasElement,
  logicalWidth: number,
  logicalHeight: number,
) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(logicalWidth * dpr);
  canvas.height = Math.round(logicalHeight * dpr);
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }
}

const WaveAnalyzer: React.FC<WaveAnalyzerProps> = ({
  width = 120,
  height = 30,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);

  const dataArrayRef = useRef<Uint8Array | null>(null);
  const lastDrawTimeRef = useRef<number>(0);

  const waveAnalyzerEnabled = useAudioSettingsStore(
    (state) => state.waveAnalyzerEnabled,
  );

  const draw = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const elapsed = timestamp - lastDrawTimeRef.current;

      animationFrameId.current = requestAnimationFrame(draw);

      if (elapsed < FPS_INTERVAL) {
        return;
      }

      lastDrawTimeRef.current = timestamp - (elapsed % FPS_INTERVAL);

      const canvasCtx = canvas.getContext("2d");
      const analyser = webAudioService.getAnalyserNode();
      const audioContext = webAudioService.getAudioContext();

      if (!canvasCtx || !analyser || !audioContext) {
        canvasCtx?.clearRect(0, 0, width, height);
        return;
      }

      canvasCtx.clearRect(0, 0, width, height);
      canvasCtx.lineWidth = 1;
      canvasCtx.strokeStyle = "#8b5cf6";
      canvasCtx.beginPath();

      if (
        audioContext.state === "suspended" ||
        audioContext.state === "closed"
      ) {
        canvasCtx.moveTo(0, height / 2);
        canvasCtx.lineTo(width, height / 2);
      } else {
        const bufferLength = analyser.fftSize;

        if (
          !dataArrayRef.current ||
          dataArrayRef.current.length !== bufferLength
        ) {
          dataArrayRef.current = new Uint8Array(bufferLength);
        }

        const dataArray = dataArrayRef.current;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        analyser.getByteTimeDomainData(dataArray as any);

        const sliceWidth = (width * 1.0) / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) {
            canvasCtx.moveTo(x, y);
          } else {
            canvasCtx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        canvasCtx.lineTo(width, height / 2);
      }

      canvasCtx.stroke();
    },
    [width, height],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const applyCanvasSize = () => setupCanvas(canvas, width, height);

    applyCanvasSize();
    window.addEventListener("resize", applyCanvasSize);

    return () => {
      window.removeEventListener("resize", applyCanvasSize);
    };
  }, [width, height]);

  useEffect(() => {
    const startAnimation = () => {
      if (!animationFrameId.current) {
        lastDrawTimeRef.current = performance.now();
        animationFrameId.current = requestAnimationFrame(draw);
      }
    };

    const stopAnimation = () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      const canvasCtx = canvasRef.current?.getContext("2d");
      if (canvasCtx) {
        canvasCtx.clearRect(0, 0, width, height);
      }
    };

    if (waveAnalyzerEnabled) {
      startAnimation();
    } else {
      stopAnimation();
    }

    return () => {
      stopAnimation();
    };
  }, [waveAnalyzerEnabled, draw, width, height]);

  if (!waveAnalyzerEnabled) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="rounded-full overflow-hidden"
      style={{
        transform: "scaleX(1.2)",
        transformOrigin: "center",
      }}
    />
  );
};

export default WaveAnalyzer;
