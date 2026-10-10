"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  badgeLabels,
  discountPercent,
  formatPrice,
  getCategory,
  getProduct,
  products,
} from "@/data/products";
import { useStore } from "@/context/StoreContext";
import ProductCard from "@/components/ProductCard";
import ProductImage from "@/components/ProductImage";
import Stars from "@/components/Stars";

export default function ProductDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  const product = getProduct(id);
  const { addToCart, pushToast, toggleFavorite, isFavorite } = useStore();
  const [qty, setQtyLocal] = useState(1);

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <div className="text-7xl">😕</div>
        <h1 className="mt-4 text-2xl font-black">المنتج غير موجود</h1>
        <Link
          href="/products"
          className="mt-6 inline-block rounded-xl bg-emerald-600 px-8 py-3 font-bold text-white hover:bg-emerald-700"
        >
          تصفح المنتجات
        </Link>
      </div>
    );
  }

  const category = getCategory(product.category);
  const fav = isFavorite(product.id);
  const related = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="text-sm text-stone-400">
        <Link href="/" className="hover:text-emerald-700">الرئيسية</Link>
        {" / "}
        <Link href="/products" className="hover:text-emerald-700">المنتجات</Link>
        {" / "}
        <span className="font-bold text-stone-700">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="group relative overflow-hidden rounded-3xl border border-stone-200 shadow-sm">
          <ProductImage
            emoji={product.emoji}
            gradient={product.gradient}
            size="xl"
            className="aspect-square sm:aspect-[4/3]"
          />
          {product.badge && (
            <span className="absolute start-4 top-4 rounded-full bg-stone-900/85 px-4 py-1.5 text-sm font-bold text-white backdrop-blur">
              {product.badge === "sale"
                ? `🔥 خصم ${discountPercent(product)}%`
                : badgeLabels[product.badge]}
            </span>
          )}
        </div>

        <div>
          {category && (
            <Link
              href={`/products?category=${category.slug}`}
              className="inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
            >
              {category.emoji} {category.name}
            </Link>
          )}
          <h1 className="mt-3 text-3xl font-black leading-snug text-stone-900">
            {product.name}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <Stars rating={product.rating} className="text-base" />
            <span className="font-bold text-stone-700">{product.rating}</span>
            <span className="text-sm text-stone-400">({product.reviews} تقييم)</span>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-4xl font-black text-emerald-700">
              {formatPrice(product.price)}
            </span>
            {product.oldPrice && (
              <span className="text-xl text-stone-400 line-through">
                {formatPrice(product.oldPrice)}
              </span>
            )}
          </div>

          <p className="mt-4 leading-8 text-stone-600">{product.description}</p>

          <ul className="mt-5 space-y-2">
            {product.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm font-semibold text-stone-700">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-700">
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-5 text-sm font-bold">
            {product.stock < 20 ? (
              <span className="text-rose-600">⚡ بقي {product.stock} فقط في المخزون!</span>
            ) : (
              <span className="text-emerald-600">✅ متوفر في المخزون</span>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-xl border border-stone-200 bg-white">
              <button
                onClick={() => setQtyLocal(Math.max(1, qty - 1))}
                className="px-4 py-3 text-lg font-bold text-stone-500 hover:text-stone-900"
                aria-label="إنقاص"
              >
                −
              </button>
              <span className="w-8 text-center font-black">{qty}</span>
              <button
                onClick={() => setQtyLocal(Math.min(product.stock, qty + 1))}
                className="px-4 py-3 text-lg font-bold text-stone-500 hover:text-stone-900"
                aria-label="زيادة"
              >
                +
              </button>
            </div>
            <button
              onClick={() => {
                addToCart(product.id, qty);
                pushToast("تمت الإضافة إلى السلة 🛒");
              }}
              className="flex-1 rounded-xl bg-emerald-600 px-6 py-3.5 font-extrabold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-95 sm:flex-none sm:px-10"
            >
              🛒 أضف إلى السلة
            </button>
            <button
              onClick={() => {
                toggleFavorite(product.id);
                pushToast(fav ? "أُزيل من المفضلة" : "أُضيف إلى المفضلة 🤍");
              }}
              aria-label="مفضلة"
              className={`flex h-[52px] w-[52px] items-center justify-center rounded-xl border text-2xl transition-all active:scale-90 ${
                fav
                  ? "border-rose-200 bg-rose-50 text-rose-500"
                  : "border-stone-200 bg-white text-stone-400 hover:text-rose-500"
              }`}
            >
              {fav ? "♥" : "♡"}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border border-stone-200 bg-white p-4 text-center text-xs font-bold text-stone-600">
            <div>🚚 شحن سريع<br /><span className="font-normal text-stone-400">2-4 أيام</span></div>
            <div>↩️ إرجاع مجاني<br /><span className="font-normal text-stone-400">خلال 14 يوم</span></div>
            <div>🔒 دفع آمن<br /><span className="font-normal text-stone-400">100% مضمون</span></div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-14">
          <h2 className="text-2xl font-black text-stone-900">قد يعجبك أيضاً</h2>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
