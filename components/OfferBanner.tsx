"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function OfferBanner() {
  const [target] = useState(() => Date.now() + (2 * 86400 + 11 * 3600 + 23 * 60) * 1000);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const diff = Math.max(0, target - (now ?? target));
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  const units = [
    { v: pad(d), l: "يوم" },
    { v: pad(h), l: "ساعة" },
    { v: pad(m), l: "دقيقة" },
    { v: pad(s), l: "ثانية" },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-rose-600 via-red-500 to-orange-500 p-8 text-white shadow-xl sm:p-12">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.7) 1.2px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="absolute -start-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -end-10 h-64 w-64 rounded-full bg-black/15 blur-3xl" />
        <div className="relative flex flex-col items-center justify-between gap-8 lg:flex-row">
          <div className="text-center lg:text-start">
            <span className="mb-3 inline-block rounded-full bg-white/20 px-4 py-1.5 text-sm font-bold backdrop-blur">
              🔥 عرض لفترة محدودة
            </span>
            <h2 className="text-3xl font-black sm:text-4xl">
              خصومات تصل إلى 40% على الإلكترونيات
            </h2>
            <p className="mt-2 text-white/85">
              الحق العرض قبل ما يخلص — الكمية محدودة!
            </p>
            <Link
              href="/products?badge=sale"
              className="mt-6 inline-block rounded-xl bg-white px-8 py-3 font-extrabold text-rose-600 shadow-lg transition-all hover:scale-105 active:scale-95"
            >
              تسوّق العروض الآن
            </Link>
          </div>
          <div className="flex items-center gap-3" dir="ltr">
            {units.map((u) => (
              <div key={u.l} className="flex flex-col items-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-black/25 text-3xl font-black tabular-nums backdrop-blur">
                  {now === null ? "--" : u.v}
                </div>
                <span className="mt-2 text-sm font-semibold text-white/90">{u.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
