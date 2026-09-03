import { useEffect, useRef } from "react";

export function useLaserScanner(onScan, isEnabled = true) {
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e) => {
      if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        const code = bufferRef.current.trim().toUpperCase();
        bufferRef.current = "";
        if (code.length >= 2 && onScan) {
          onScan(code);
        }
        return;
      }

      if (e.key.length === 1) {
        if (timeDiff > 250) {
          bufferRef.current = e.key;
        } else {
          bufferRef.current += e.key;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onScan, isEnabled]);
}