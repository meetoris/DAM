"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  text: string;
  onClose: () => void;
}

export default function Teleprompter({ text, onClose }: Props) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(55); // px per second
  const [fontSize, setFontSize] = useState(42);
  const [mirrored, setMirrored] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(speed);

  playingRef.current = playing;
  speedRef.current = speed;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const el = scrollRef.current;
      if (el && playingRef.current) {
        offsetRef.current = Math.min(
          offsetRef.current + speedRef.current * dt,
          el.scrollHeight - el.clientHeight
        );
        el.scrollTop = offsetRef.current;
        if (offsetRef.current >= el.scrollHeight - el.clientHeight) setPlaying(false);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      if (e.code === "Escape") onClose();
      if (e.code === "ArrowUp") setSpeed((s) => Math.min(s + 5, 200));
      if (e.code === "ArrowDown") setSpeed((s) => Math.max(s - 5, 10));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function restart() {
    offsetRef.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setPlaying(false);
  }

  return (
    <div className="prompter-wrap">
      <div className="prompter-controls">
        <button className="btn btn-primary btn-sm" onClick={() => setPlaying((p) => !p)}>
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <button className="btn btn-sm" onClick={restart}>⟲ Restart</button>
        <label>
          Speed
          <input type="range" min={10} max={200} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
          <span className="mono">{speed}</span>
        </label>
        <label>
          Size
          <input type="range" min={24} max={80} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
          <span className="mono">{fontSize}px</span>
        </label>
        <label style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={mirrored} onChange={(e) => setMirrored(e.target.checked)} />
          Mirror (for beamsplitter rigs)
        </label>
        <span className="small muted">Space = play/pause · ↑↓ = speed · Esc = exit</span>
        <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={onClose}>✕ Close</button>
      </div>
      <div className="prompter-scroll" ref={scrollRef}>
        <div className={`prompter-text${mirrored ? " mirrored" : ""}`} style={{ fontSize }}>
          {text}
        </div>
        <div className="prompter-midline" />
      </div>
    </div>
  );
}
