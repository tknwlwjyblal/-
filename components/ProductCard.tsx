"use client";

import Link from "next/link";
import { badgeLabels, discountPercent, formatPrice, type Product } from "@/data/products";
import { useStore } from "@/context/StoreContext";
import ProductImage from "./ProductImage";
import Stars from "./Stars";

const badgeStyles: Record<string, string> = {
  new: "bg-emerald-500",
  sale: "bg-rose-500",
  best: "bg-amber-500 text-stone-900",
};

export default function ProductCard({ product }: { product: Product }) {
  const { addToCart, pushToast, toggleFavorite, isFavorite } = useStore();
  const fav = isFavorite(product.id);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-stone-200">
      <Link href={`/products/${product.id}`} className="relative block">
        <ProductImage
          emoji={product.emoji}
          gradient={product.gradient}
          size="md"
          className="aspect-square"
        />
        {product.badge && (
          <span
            className={`absolute start-3 top-3 rounded-full px-3 py-1 text-xs font-bold text-white shadow ${badgeStyles[product.badge]}`}
          >
            {product.badge === "sale"
              ? `خصم ${discountPercent(product)}%`
              : badgeLabels[product.badge]}
          </span>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            toggleFavorite(product.id);
            pushToast(fav ? "أُزيل من المفضلة" : "أُضيف إلى المفضلة 🤍");
          }}
          aria-label="مفضلة"
          className={`absolute end-3 top-3 flex h-9 w-9 items-center justify-center rounded-full shadow transition-all active:scale-90 ${
            fav ? "bg-rose-500 text-white" : "bg-white/90 text-stone-500 hover:text-rose-500"
          }`}
        >
          {fav ? "♥" : "♡"}
        </button>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={`/products/${product.id}`}>
          <h3 className="line-clamp-1 font-bold text-stone-800 transition-colors hover:text-emerald-700">
            {product.name}
          </h3>
        </Link>
        <div className="flex items-center gap-2">
          <Stars rating={product.rating} />
          <span className="text-xs text-stone-400">({product.reviews})</span>
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <div className="text-lg font-extrabold text-emerald-700">
              {formatPrice(product.price)}
            </div>
            {product.oldPrice && (
              <div className="text-sm text-stone-400 line-through">
                {formatPrice(product.oldPrice)}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              addToCart(product.id);
              pushToast("تمت الإضافة إلى السلة 🛒");
            }}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"
          >
            أضف للسلة
          </button>
        </div>
      </div>
    </div>
  );
}
