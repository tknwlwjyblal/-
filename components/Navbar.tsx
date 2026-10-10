"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/context/StoreContext";

const links = [
  { href: "/", label: "الرئيسية" },
  { href: "/products", label: "المنتجات" },
  { href: "/products?badge=sale", label: "العروض 🔥" },
  { href: "/favorites", label: "المفضلة" },
];

export default function Navbar() {
  const { cartCount, favorites } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    router.push(q.trim() ? `/products?q=${encodeURIComponent(q.trim())}` : "/products");
  };

  return (
    <header className="sticky top-0 z-50">
      <div className="bg-emerald-800 px-4 py-1.5 text-center text-xs font-semibold text-emerald-50 sm:text-sm">
        🚚 شحن مجاني للطلبات فوق 200 ر.س — إرجاع مجاني خلال 14 يوم
      </div>
      <nav className="border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-2xl font-black text-emerald-700">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-xl shadow">
              🛍️
            </span>
            سوقنا
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  pathname === l.href
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          <form onSubmit={submit} className="ms-auto hidden min-w-0 flex-1 max-w-xs items-center lg:flex">
            <div className="relative w-full">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="دوّر على منتج..."
                className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pe-10 ps-4 text-sm outline-none transition-all placeholder:text-stone-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
              <button
                type="submit"
                aria-label="بحث"
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-stone-400 hover:text-emerald-600"
              >
                🔍
              </button>
            </div>
          </form>

          <div className="ms-auto flex items-center gap-2 lg:ms-0">
            <Link
              href="/favorites"
              aria-label="المفضلة"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-colors hover:bg-stone-100"
            >
              🤍
              {favorites.length > 0 && (
                <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
                  {favorites.length}
                </span>
              )}
            </Link>
            <Link
              href="/cart"
              aria-label="السلة"
              className="relative flex h-10 items-center gap-2 rounded-xl bg-stone-900 px-4 text-sm font-bold text-white transition-colors hover:bg-stone-700"
            >
              🛒
              <span className="hidden sm:inline">السلة</span>
              {cartCount > 0 && (
                <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[11px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => setOpen(!open)}
              aria-label="القائمة"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-xl hover:bg-stone-100 md:hidden"
            >
              {open ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-stone-100 bg-white px-4 py-3 md:hidden">
            <form onSubmit={submit} className="relative mb-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="دوّر على منتج..."
                className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pe-10 ps-4 text-sm outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                aria-label="بحث"
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-stone-400"
              >
                🔍
              </button>
            </form>
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${
                    pathname === l.href
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
