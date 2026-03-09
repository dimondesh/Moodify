// frontend/src/components/ui/WaveAnalyzer.tsx

import React, { useRef, useEffect, useCallback } from "react";
import { useAudioSettingsStore, webAudioService } from "../../lib/webAudio";

interface WaveAnalyzerProps {
  width?: number;
  height?: number;
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
  const analyzerSmoothness = useAudioSettingsStore(
    (state) => state.analyzerSmoothness,
  );

  const draw = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let fpsInterval = 1000 / 60; // Default High (60 FPS)

      if (analyzerSmoothness === "low") {
        fpsInterval = 1000 / 30; // Low (30 FPS)
      } else if (analyzerSmoothness === "medium") {
        fpsInterval = 1000 / 60; // Medium (60 FPS)
      } else {
        fpsInterval = 1000 / 120; // High (120 FPS)
      }

      const elapsed = timestamp - lastDrawTimeRef.current;

      animationFrameId.current = requestAnimationFrame(draw);

      if (elapsed < fpsInterval) {
        return;
      }

      lastDrawTimeRef.current = timestamp - (elapsed % fpsInterval);

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
    [width, height, analyzerSmoothness],
  );

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
      width={width}
      height={height}
      className="rounded-full overflow-hidden"
      style={{
        transform: "scaleX(1.2)",
        transformOrigin: "center",
      }}
    />
  );
};

export default WaveAnalyzer;
