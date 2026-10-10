"use client";

import Link from "next/link";
import { products } from "@/data/products";
import { useStore } from "@/context/StoreContext";
import ProductCard from "@/components/ProductCard";

export default function FavoritesPage() {
  const { favorites } = useStore();
  const items = products.filter((p) => favorites.includes(p.id));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-black text-stone-900">🤍 المفضلة</h1>
      <p className="mt-1 text-stone-500">{items.length} منتج محفوظ</p>

      {items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white p-16 text-center">
          <div className="text-6xl">🤍</div>
          <h2 className="mt-4 text-xl font-black text-stone-800">لا توجد منتجات في المفضلة</h2>
          <p className="mt-1 text-stone-500">اضغط على القلب لحفظ المنتجات التي تعجبك</p>
          <Link
            href="/products"
            className="mt-5 inline-block rounded-xl bg-stone-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-stone-700"
          >
            تصفح المنتجات
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
