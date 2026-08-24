"use client";

import { useEffect, useMemo, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { SignalStormEngine, type GamePalette, type GameCallbacks } from "./signal-storm-engine";
import { buildGameLabels, type GameLabels } from "./signal-storm-labels";

function readPalette(el: HTMLElement): GamePalette {
  const style = getComputedStyle(el);
  const get = (prop: string, fallback: string) => {
    const val = style.getPropertyValue(prop).trim();
    return val || fallback;
  };
  return {
    player: get("--success", "#4ade80"),
    beam: get("--success", "#4ade80"),
    enemy: get("--destructive", "#ef4444"),
    jammer: get("--warning", "#eab308"),
    powerUp: get("--primary", "#6366f1"),
    shield: get("--info", "#06b6d4"),
    spread: get("--chart-6", "#f97316"),
    text: get("--foreground", "#0a0a0a"),
    textMuted: get("--muted-foreground", "#737373"),
    background: get("--card", "#ffffff"),
  };
}

export default function SignalStormGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SignalStormEngine | null>(null);
  const animFrameRef = useRef<number>(0);

  const { t } = useTranslation("system-settings");
  const labels = useMemo<GameLabels>(() => buildGameLabels(t), [t]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const palette = readPalette(wrapper);
    const callbacks: GameCallbacks = { onExit };

    // Dispose any prior engine (language swap re-runs this effect).
    engineRef.current?.dispose?.();
    engineRef.current = null;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
        if (engineRef.current) {
          engineRef.current.resize(width, height);
        } else {
          engineRef.current = new SignalStormEngine(ctx, width, height, palette, callbacks, labels);
        }
      }
    });

    observer.observe(wrapper);

    const loop = (timestamp: number) => {
      engineRef.current?.tick(timestamp);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    wrapperRef.current?.focus();

    return () => {
      engineRef.current?.dispose?.();
      engineRef.current = null;
      cancelAnimationFrame(animFrameRef.current);
      observer.disconnect();
    };
  }, [onExit, labels]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.preventDefault();
    engineRef.current?.handleKeyDown(e.key);
  }, []);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    engineRef.current?.handleKeyUp(e.key);
  }, []);

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      className="max-h-[clamp(12rem,50vh,60vh)] min-h-48 outline-none focus:outline-none"
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
