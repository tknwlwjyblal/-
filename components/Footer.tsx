import Link from "next/link";
import { categories } from "@/data/products";

export default function Footer() {
  return (
    <footer className="bg-stone-950 text-stone-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="mb-4 flex items-center gap-2 text-2xl font-black text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-xl">
              🛍️
            </span>
            سوقنا
          </div>
          <p className="text-sm leading-7 text-stone-400">
            وجهتك الأولى للتسوق أونلاين في السعودية. منتجات أصلية، أسعار منافسة، وتوصيل سريع لباب
            بيتك.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["مدى", "VISA", "Mastercard", "Apple Pay", "تمارا"].map((p) => (
              <span
                key={p}
                className="rounded-lg border border-stone-700 bg-stone-900 px-3 py-1.5 text-xs font-bold text-stone-300"
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-4 font-extrabold text-white">روابط سريعة</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/" className="hover:text-emerald-400">الرئيسية</Link></li>
            <li><Link href="/products" className="hover:text-emerald-400">جميع المنتجات</Link></li>
            <li><Link href="/products?badge=sale" className="hover:text-emerald-400">العروض والخصومات</Link></li>
            <li><Link href="/cart" className="hover:text-emerald-400">سلة التسوق</Link></li>
            <li><Link href="/favorites" className="hover:text-emerald-400">المفضلة</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-extrabold text-white">التصنيفات</h4>
          <ul className="space-y-2.5 text-sm">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/products?category=${c.slug}`} className="hover:text-emerald-400">
                  {c.emoji} {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-extrabold text-white">تواصل معنا</h4>
          <ul className="space-y-3 text-sm text-stone-400">
            <li>📍 الرياض، المملكة العربية السعودية</li>
            <li dir="ltr" className="text-end">📞 ‎+966 11 234 5678</li>
            <li dir="ltr" className="text-end">✉️ ‎hello@souqna.sa</li>
            <li>🕐 يومياً من 9 صباحاً حتى 11 مساءً</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-stone-800">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-stone-500 sm:flex-row">
          <span>© 2026 سوقنا. جميع الحقوق محفوظة.</span>
          <span>صُنع بـ ♥ في السعودية</span>
        </div>
      </div>
    </footer>
  );
}
