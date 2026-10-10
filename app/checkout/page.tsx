"use client";

import Link from "next/link";
import { useState } from "react";
import {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_COST,
  formatPrice,
} from "@/data/products";
import { useStore, type CartDetailed } from "@/context/StoreContext";
import ProductImage from "@/components/ProductImage";

const cities = [
  "الرياض",
  "جدة",
  "مكة المكرمة",
  "المدينة المنورة",
  "الدمام",
  "الخبر",
  "أبها",
  "تبوك",
  "بريدة",
  "مدينة أخرى",
];

const payments = [
  { value: "mada", label: "💳 مدى / بطاقة ائتمانية" },
  { value: "applepay", label: "🍏 Apple Pay" },
  { value: "cod", label: "💵 الدفع عند الاستلام" },
];

export default function CheckoutPage() {
  const { cartDetailed, cartTotal, clearCart } = useStore();
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{ items: CartDetailed[]; total: number; shipping: number } | null>(null);
  const [payment, setPayment] = useState("mada");

  const shipping = cartTotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSnapshot({ items: cartDetailed, total: cartTotal, shipping });
    setOrderNumber(`SQ-${Math.floor(100000 + Math.random() * 900000)}`);
    clearCart();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (orderNumber && snapshot) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="animate-fade-up rounded-3xl border border-emerald-200 bg-white p-10 shadow-xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">
            ✅
          </div>
          <h1 className="mt-5 text-3xl font-black text-stone-900">شكراً لك! تم استلام طلبك</h1>
          <p className="mt-2 text-stone-500">
            رقم الطلب: <span className="font-black text-emerald-700" dir="ltr">{orderNumber}</span>
          </p>
          <p className="mt-1 text-sm text-stone-500">
            سنرسل لك تحديثات الشحن على جوالك. التوصيل المتوقع خلال 2-4 أيام عمل.
          </p>
          <div className="mt-6 rounded-2xl bg-stone-50 p-4 text-start text-sm">
            {snapshot.items.map(({ product, qty }) => (
              <div key={product.id} className="flex items-center justify-between py-1.5">
                <span className="font-semibold text-stone-700">
                  {product.emoji} {product.name} × {qty}
                </span>
                <span className="font-bold">{formatPrice(product.price * qty)}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-stone-200 pt-2 font-black">
              <span>الإجمالي المدفوع</span>
              <span className="text-emerald-700">
                {formatPrice(snapshot.total + snapshot.shipping)}
              </span>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/products"
              className="flex-1 rounded-xl bg-emerald-600 py-3 font-extrabold text-white hover:bg-emerald-700"
            >
              مواصلة التسوق
            </Link>
            <Link
              href="/"
              className="flex-1 rounded-xl border border-stone-200 py-3 font-bold text-stone-600 hover:bg-stone-50"
            >
              الرئيسية
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (cartDetailed.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <div className="text-7xl">🧾</div>
        <h1 className="mt-4 text-2xl font-black">لا يوجد طلب لإتمامه</h1>
        <p className="mt-2 text-stone-500">سلتك فارغة، أضف منتجات أولاً</p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded-xl bg-emerald-600 px-8 py-3 font-bold text-white hover:bg-emerald-700"
        >
          تصفح المنتجات
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-black text-stone-900">إتمام الطلب</h1>

      <div className="mt-4 flex items-center gap-2 text-sm font-bold">
        <Link href="/cart" className="flex items-center gap-1 text-emerald-600 hover:underline">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">✓</span>
          السلة
        </Link>
        <span className="h-px w-8 bg-stone-300" />
        <span className="flex items-center gap-1 text-stone-900">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-900 text-xs text-white">2</span>
          التوصيل والدفع
        </span>
        <span className="h-px w-8 bg-stone-300" />
        <span className="flex items-center gap-1 text-stone-400">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-xs">3</span>
          التأكيد
        </span>
      </div>

      <form onSubmit={submit} className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="text-lg font-black">📍 عنوان التوصيل</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-stone-700">الاسم الكامل *</label>
                <input
                  required
                  placeholder="مثال: محمد عبدالله"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold text-stone-700">رقم الجوال *</label>
                <input
                  required
                  type="tel"
                  pattern="0[0-9]{9}"
                  title="أدخل رقم جوال صحيح يبدأ بـ 05 (10 أرقام)"
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-right text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold text-stone-700">المدينة *</label>
                <select
                  required
                  defaultValue=""
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white"
                >
                  <option value="" disabled>اختر المدينة</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold text-stone-700">الحي / الشارع *</label>
                <input
                  required
                  placeholder="مثال: حي النرجس، شارع الملك فهد"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-bold text-stone-700">
                  ملاحظات إضافية <span className="font-normal text-stone-400">(اختياري)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="أي تفاصيل تساعد مندوب التوصيل..."
                  className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="text-lg font-black">💳 طريقة الدفع</h2>
            <div className="mt-4 flex flex-col gap-3">
              {payments.map((p) => (
                <label
                  key={p.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 text-sm font-bold transition-all ${
                    payment === p.value
                      ? "border-emerald-500 bg-emerald-50 text-stone-900"
                      : "border-stone-100 bg-stone-50 text-stone-600 hover:border-stone-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={p.value}
                    checked={payment === p.value}
                    onChange={() => setPayment(p.value)}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="h-fit rounded-2xl border border-stone-200 bg-white p-6 lg:sticky lg:top-32">
          <h2 className="text-lg font-black">ملخص الطلب ({cartDetailed.length})</h2>
          <div className="mt-4 max-h-64 space-y-3 overflow-y-auto">
            {cartDetailed.map(({ product, qty }) => (
              <div key={product.id} className="flex items-center gap-3">
                <ProductImage
                  emoji={product.emoji}
                  gradient={product.gradient}
                  size="sm"
                  className="h-14 w-14 shrink-0 rounded-lg text-2xl"
                />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-sm font-bold text-stone-700">{product.name}</div>
                  <div className="text-xs text-stone-400">الكمية: {qty}</div>
                </div>
                <div className="text-sm font-black">{formatPrice(product.price * qty)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t border-stone-100 pt-4 text-sm">
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
            <div className="flex justify-between pt-1 text-base font-black">
              <span>الإجمالي</span>
              <span className="text-emerald-700">{formatPrice(cartTotal + shipping)}</span>
            </div>
          </div>
          <button
            type="submit"
            className="mt-5 w-full rounded-xl bg-emerald-600 py-3.5 font-extrabold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-95"
          >
            تأكيد الطلب ✅
          </button>
          <p className="mt-3 text-center text-xs text-stone-400">
            🔒 معلوماتك محمية ومشفرة بالكامل
          </p>
        </div>
      </form>
    </div>
  );
}
