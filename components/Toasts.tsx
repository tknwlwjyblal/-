"use client";

import { useStore } from "@/context/StoreContext";

export default function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-fade-up flex items-center gap-2 whitespace-nowrap rounded-full bg-stone-900 px-5 py-2.5 text-sm font-bold text-white shadow-2xl"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs">
            ✓
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
