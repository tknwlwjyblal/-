"use client";

import Link from "next/link";
import {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_COST,
  formatPrice,
} from "@/data/products";
import { useStore } from "@/context/StoreContext";
import ProductImage from "@/components/ProductImage";

export default function CartPage() {
  const { cartDetailed, cartCount, cartTotal, setQty, removeFromCart, clearCart, pushToast } =
    useStore();

  const shipping = cartTotal >= FREE_SHIPPING_THRESHOLD || cartTotal === 0 ? 0 : SHIPPING_COST;
  const remaining = FREE_SHIPPING_THRESHOLD - cartTotal;
  const progress = Math.min(100, (cartTotal / FREE_SHIPPING_THRESHOLD) * 100);

  if (cartDetailed.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <div className="text-7xl">🛒</div>
        <h1 className="mt-4 text-2xl font-black text-stone-900">سلتك فارغة</h1>
        <p className="mt-2 text-stone-500">اكتشف منتجاتنا وأضف ما يعجبك إلى السلة</p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded-xl bg-emerald-600 px-8 py-3 font-bold text-white hover:bg-emerald-700"
        >
          ابدأ التسوق
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-stone-900">
          سلة التسوق <span className="text-lg font-bold text-stone-400">({cartCount})</span>
        </h1>
        <button
          onClick={() => {
            clearCart();
            pushToast("تم إفراغ السلة");
          }}
          className="text-sm font-bold text-rose-500 hover:underline"
        >
          إفراغ السلة
        </button>
      </div>

      {remaining > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-800">
            أضف منتجات بقيمة {formatPrice(remaining)} واحصل على <span className="text-emerald-700">شحن مجاني 🚚</span>
          </p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-amber-100">
            <div
              className="h-full rounded-full bg-gradient-to-l from-amber-400 to-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          🎉 مبروك! حصلت على الشحن المجاني
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {cartDetailed.map(({ product, qty }) => (
            <div
              key={product.id}
              className="flex gap-4 rounded-2xl border border-stone-200 bg-white p-4"
            >
              <Link href={`/products/${product.id}`} className="shrink-0">
                <ProductImage
                  emoji={product.emoji}
                  gradient={product.gradient}
                  size="sm"
                  className="h-24 w-24 rounded-xl sm:h-28 sm:w-28"
                />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={`/products/${product.id}`}
                  className="line-clamp-1 font-extrabold text-stone-800 hover:text-emerald-700"
                >
                  {product.name}
                </Link>
                <div className="mt-1 text-sm font-bold text-emerald-700">
                  {formatPrice(product.price)}
                </div>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="flex items-center rounded-lg border border-stone-200">
                    <button
                      onClick={() => setQty(product.id, qty - 1)}
                      className="px-3 py-1.5 font-bold text-stone-500 hover:text-stone-900"
                      aria-label="إنقاص"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm font-black">{qty}</span>
                    <button
                      onClick={() => setQty(product.id, qty + 1)}
                      className="px-3 py-1.5 font-bold text-stone-500 hover:text-stone-900"
                      aria-label="زيادة"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      removeFromCart(product.id);
                      pushToast("تم حذف المنتج من السلة");
                    }}
                    className="text-sm font-bold text-stone-400 hover:text-rose-500"
                  >
                    🗑️ حذف
                  </button>
                </div>
              </div>
              <div className="hidden text-start font-black text-stone-800 sm:block">
                {formatPrice(product.price * qty)}
              </div>
            </div>
          ))}
        </div>

        <div className="h-fit rounded-2xl border border-stone-200 bg-white p-6 lg:sticky lg:top-32">
          <h2 className="text-lg font-black text-stone-900">ملخص الطلب</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between text-stone-600">
              <span>المجموع الفرعي</span>
              <span className="font-bold">{formatPrice(cartTotal)}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>الشحن</span>
              <span className={`font-bold ${shipping === 0 ? "text-emerald-600" : ""}`}>
                {shipping === 0 ? "مجاني 🎉" : formatPrice(shipping)}
              </span>
            </div>
            <div className="flex justify-between border-t border-stone-100 pt-3 text-base font-black text-stone-900">
              <span>الإجمالي</span>
              <span className="text-emerald-700">{formatPrice(cartTotal + shipping)}</span>
            </div>
          </div>
          <Link
            href="/checkout"
            className="mt-5 block rounded-xl bg-emerald-600 py-3.5 text-center font-extrabold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-95"
          >
            إتمام الطلب ←
          </Link>
          <Link
            href="/products"
            className="mt-2 block rounded-xl border border-stone-200 py-3 text-center text-sm font-bold text-stone-600 hover:bg-stone-50"
          >
            مواصلة التسوق
          </Link>
        </div>
      </div>
    </div>
  );
}
