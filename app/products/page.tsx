"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { categories, discountPercent, products } from "@/data/products";
import ProductCard from "@/components/ProductCard";

type SortKey = "featured" | "price-asc" | "price-desc" | "rating" | "discount";

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "featured", label: "المميزة أولاً" },
  { value: "price-asc", label: "السعر: من الأقل" },
  { value: "price-desc", label: "السعر: من الأعلى" },
  { value: "rating", label: "الأعلى تقييماً" },
  { value: "discount", label: "أكبر خصم" },
];

const badgeOptions = [
  { value: "all", label: "الكل" },
  { value: "sale", label: "🔥 خصومات" },
  { value: "new", label: "✨ جديد" },
  { value: "best", label: "🏆 الأكثر مبيعاً" },
];

function ProductsContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [badge, setBadge] = useState("all");
  const [sort, setSort] = useState<SortKey>("featured");

  useEffect(() => {
    setQuery(searchParams.get("q") || "");
    setCategory(searchParams.get("category") || "all");
    setBadge(searchParams.get("badge") || "all");
  }, [searchParams]);

  const filtered = useMemo(() => {
    let list = [...products];
    if (category !== "all") list = list.filter((p) => p.category === category);
    if (badge !== "all") list = list.filter((p) => p.badge === badge);
    if (query.trim()) {
      const q = query.trim();
      list = list.filter(
        (p) => p.name.includes(q) || p.description.includes(q),
      );
    }
    switch (sort) {
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        list.sort((a, b) => b.rating - a.rating);
        break;
      case "discount":
        list.sort((a, b) => discountPercent(b) - discountPercent(a));
        break;
    }
    return list;
  }, [query, category, badge, sort]);

  const reset = () => {
    setQuery("");
    setCategory("all");
    setBadge("all");
    setSort("featured");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-black text-stone-900">جميع المنتجات</h1>
      <p className="mt-1 text-stone-500">
        {filtered.length} منتج {query && <>للبحث عن “{query}”</>}
      </p>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن منتج... (مثال: سماعات، عطر، قهوة)"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pe-10 ps-4 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
            <span className="absolute end-3 top-1/2 -translate-y-1/2 text-stone-400">🔍</span>
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory("all")}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
              category === "all"
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            كل التصنيفات
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              onClick={() => setCategory(c.slug)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
                category === c.slug
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-3">
          {badgeOptions.map((b) => (
            <button
              key={b.value}
              onClick={() => setBadge(b.value)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                badge === b.value
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-white p-16 text-center">
          <div className="text-6xl">🔍</div>
          <h2 className="mt-4 text-xl font-black text-stone-800">لا توجد نتائج مطابقة</h2>
          <p className="mt-1 text-stone-500">جرّب كلمة بحث مختلفة أو غيّر الفلاتر</p>
          <button
            onClick={reset}
            className="mt-5 rounded-xl bg-stone-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-stone-700"
          >
            مسح الفلاتر
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 text-center text-stone-400">
          جاري تحميل المنتجات...
        </div>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}
