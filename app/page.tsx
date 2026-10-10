import Link from "next/link";
import { categories, products } from "@/data/products";
import ProductCard from "@/components/ProductCard";
import ProductImage from "@/components/ProductImage";
import OfferBanner from "@/components/OfferBanner";
import Newsletter from "@/components/Newsletter";
import Stars from "@/components/Stars";

const marqueeItems = [
  "🚚 شحن مجاني للطلبات فوق 200 ر.س",
  "↩️ إرجاع مجاني خلال 14 يوم",
  "🔒 دفع آمن 100%",
  "⭐ منتجات أصلية مضمونة",
  "🎧 دعم على مدار الساعة",
];

const perks = [
  { emoji: "🚚", title: "شحن سريع", desc: "توصيل خلال 2-4 أيام لجميع المدن" },
  { emoji: "🔒", title: "دفع آمن", desc: "مدى، فيزا، Apple Pay والدفع عند الاستلام" },
  { emoji: "↩️", title: "إرجاع مجاني", desc: "استرجاع سهل خلال 14 يوم بدون أسئلة" },
  { emoji: "🎧", title: "دعم متواصل", desc: "فريقنا جاهز لخدمتك على مدار الساعة" },
];

const testimonials = [
  {
    name: "نورة العتيبي",
    city: "الرياض",
    text: "تجربة تسوق رائعة! الطلب وصلني ثاني يوم والتغليف كان ممتاز. أكيد بطلب مرة ثانية.",
    rating: 5,
  },
  {
    name: "محمد الشمري",
    city: "جدة",
    text: "أسعار منافسة ومنتجات أصلية. خدمة العملاء ردت عليّ بسرعة وساعدوني في اختيار السماعات.",
    rating: 5,
  },
  {
    name: "سارة القحطاني",
    city: "الدمام",
    text: "أحب قسم العطور عندهم، العود الملكي صار عطري المفضل. التوصيل سريع والتعامل راقي.",
    rating: 4,
  },
];

export default function Home() {
  const featured = [...products].sort((a, b) => b.rating - a.rating).slice(0, 8);
  const heroProduct = products[0];

  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* البطل الرئيسي */}
      <section className="bg-gradient-to-b from-emerald-950 via-emerald-900 to-stone-50">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-12 lg:grid-cols-2 lg:pt-20">
          <div className="text-center lg:text-start">
            <span className="inline-block rounded-full border border-emerald-700 bg-emerald-800/60 px-4 py-1.5 text-sm font-bold text-emerald-100">
              🛒 تسوق أونلاين بكل سهولة
            </span>
            <h1 className="mt-5 text-4xl font-black leading-[1.3] text-white sm:text-5xl sm:leading-[1.35]">
              كل اللي تحتاجه،
              <br />
              <span className="text-amber-400">يوصلك لباب البيت 🏠</span>
            </h1>
            <p className="mx-auto mt-4 max-w-md leading-8 text-emerald-100/80 lg:mx-0">
              اكتشف آلاف المنتجات الأصلية من الإلكترونيات والأزياء وأكثر — بأسعار منافسة وتوصيل
              سريع لجميع مدن المملكة.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link
                href="/products"
                className="rounded-xl bg-amber-400 px-8 py-3.5 font-extrabold text-stone-900 shadow-lg shadow-amber-400/20 transition-all hover:scale-105 hover:bg-amber-300 active:scale-95"
              >
                تسوّق الآن
              </Link>
              <Link
                href="/products?badge=sale"
                className="rounded-xl border border-emerald-700 bg-emerald-800/50 px-8 py-3.5 font-extrabold text-white transition-all hover:bg-emerald-800 active:scale-95"
              >
                🔥 العروض
              </Link>
            </div>
            <div className="mt-8 flex items-center justify-center gap-8 lg:justify-start">
              {[
                { v: "+5000", l: "منتج" },
                { v: "+50 ألف", l: "عميل سعيد" },
                { v: "4.9", l: "تقييم عملائنا" },
              ].map((s) => (
                <div key={s.l} className="text-center lg:text-start">
                  <div className="text-2xl font-black text-white">{s.v}</div>
                  <div className="text-sm text-emerald-100/70">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="group overflow-hidden rounded-3xl shadow-2xl">
              <ProductImage
                emoji={heroProduct.emoji}
                gradient={heroProduct.gradient}
                size="xl"
                className="aspect-[4/3.4]"
              />
            </div>
            <div className="animate-float absolute -start-4 top-6 rounded-2xl bg-white/95 px-4 py-3 shadow-xl backdrop-blur">
              <div className="text-sm font-extrabold text-stone-800">🚚 شحن مجاني</div>
              <div className="text-xs text-stone-500">للطلبات فوق 200 ر.س</div>
            </div>
            <div
              className="animate-float absolute -end-3 bottom-8 rounded-2xl bg-white/95 px-4 py-3 shadow-xl backdrop-blur"
              style={{ animationDelay: "1.5s" }}
            >
              <div className="flex items-center gap-1">
                <Stars rating={5} />
                <span className="text-sm font-extrabold text-stone-800">4.9</span>
              </div>
              <div className="mt-1 text-xs text-stone-500">من +12 ألف تقييم</div>
            </div>
            <div
              className="animate-float absolute start-8 -bottom-5 rounded-2xl bg-amber-400 px-4 py-2.5 font-extrabold text-stone-900 shadow-xl"
              style={{ animationDelay: "3s" }}
            >
              🔥 خصم حتى 40%
            </div>
          </div>
        </div>
      </section>

      {/* شريط متحرك */}
      <div className="overflow-hidden border-y border-amber-300 bg-amber-300 py-3" dir="ltr">
        <div className="animate-marquee flex w-max">
          {[0, 1].map((n) => (
            <div key={n} className="flex" dir="rtl">
              {marqueeItems.map((t) => (
                <span key={`${n}-${t}`} className="mx-6 whitespace-nowrap text-sm font-extrabold text-stone-900">
                  {t} <span className="ms-6 text-stone-700">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* التصنيفات */}
      <section className="mx-auto w-full max-w-7xl px-4">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black text-stone-900 sm:text-3xl">تسوّق حسب التصنيف</h2>
            <p className="mt-1 text-stone-500">اختر القسم اللي يعجبك واكتشف منتجاته</p>
          </div>
          <Link href="/products" className="hidden font-bold text-emerald-700 hover:underline sm:block">
            عرض الكل ←
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => {
            const count = products.filter((p) => p.category === c.slug).length;
            return (
              <Link
                key={c.slug}
                href={`/products?category=${c.slug}`}
                className="group overflow-hidden rounded-2xl border border-stone-200 bg-white transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <ProductImage emoji={c.emoji} gradient={c.gradient} size="sm" className="aspect-[16/10]" />
                <div className="p-3 text-center">
                  <div className="font-extrabold text-stone-800">{c.name}</div>
                  <div className="text-xs text-stone-400">{count} منتجات</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* منتجات مميزة */}
      <section className="mx-auto w-full max-w-7xl px-4">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black text-stone-900 sm:text-3xl">⭐ منتجات مميزة</h2>
            <p className="mt-1 text-stone-500">الأعلى تقييماً من عملائنا</p>
          </div>
          <Link href="/products" className="font-bold text-emerald-700 hover:underline">
            عرض الكل ←
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <OfferBanner />

      {/* المزايا */}
      <section className="mx-auto w-full max-w-7xl px-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map((perk) => (
            <div
              key={perk.title}
              className="flex items-start gap-4 rounded-2xl border border-stone-200 bg-white p-5"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-2xl">
                {perk.emoji}
              </span>
              <div>
                <div className="font-extrabold text-stone-800">{perk.title}</div>
                <div className="mt-1 text-sm leading-6 text-stone-500">{perk.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* آراء العملاء */}
      <section className="mx-auto w-full max-w-7xl px-4">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-black text-stone-900 sm:text-3xl">💬 وش قالوا عملاؤنا؟</h2>
          <p className="mt-1 text-stone-500">ثقة آلاف العملاء هي سر نجاحنا</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
            >
              <Stars rating={t.rating} />
              <p className="mt-3 flex-1 leading-8 text-stone-600">“{t.text}”</p>
              <div className="mt-4 flex items-center gap-3 border-t border-stone-100 pt-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 font-black text-white">
                  {t.name[0]}
                </span>
                <div>
                  <div className="font-extrabold text-stone-800">{t.name}</div>
                  <div className="text-xs text-stone-400">{t.city} ✓ مشترٍ موثّق</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Newsletter />
    </div>
  );
}
