"use client";
import { useEffect, useState } from "react";

const listeners = new Set<(m: string) => void>();
export const toast = (m: string) => listeners.forEach((l) => l(m));

/** Every message to the visitor, errors included, shows here. */
export function Toaster() {
  const [items, setItems] = useState<{ id: number; m: string }[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (m: string) => {
      const id = ++n;
      setItems((x) => [...x, { id, m }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 5200);
    };
    listeners.add(on);
    return () => void listeners.delete(on);
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((i) => (
        <div key={i.id} className="toast">
          {i.m}
        </div>
      ))}
    </div>
  );
}
