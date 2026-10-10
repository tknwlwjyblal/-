export type Badge = "new" | "sale" | "best";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  category: string;
  rating: number;
  reviews: number;
  emoji: string;
  gradient: string;
  badge?: Badge;
  stock: number;
  features: string[];
}

export interface Category {
  slug: string;
  name: string;
  emoji: string;
  gradient: string;
  blurb: string;
}

export const categories: Category[] = [
  {
    slug: "electronics",
    name: "إلكترونيات",
    emoji: "📱",
    gradient: "from-sky-500 via-blue-500 to-indigo-600",
    blurb: "أحدث الأجهزة والاكسسوارات",
  },
  {
    slug: "fashion",
    name: "أزياء",
    emoji: "👕",
    gradient: "from-rose-500 via-pink-500 to-fuchsia-600",
    blurb: "موضة عصرية لكل المناسبات",
  },
  {
    slug: "home",
    name: "المنزل والمطبخ",
    emoji: "🏠",
    gradient: "from-amber-500 via-orange-500 to-red-500",
    blurb: "كل ما يجمّل بيتك",
  },
  {
    slug: "beauty",
    name: "العناية والجمال",
    emoji: "💄",
    gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
    blurb: "دلّلي نفسك بأفضل المنتجات",
  },
  {
    slug: "sports",
    name: "رياضة ولياقة",
    emoji: "🏋️",
    gradient: "from-emerald-500 via-teal-500 to-cyan-600",
    blurb: "معدات احترافية لنشاطك",
  },
];

export const products: Product[] = [
  {
    id: "p1",
    name: "سماعات لاسلكية بعزل ضوضاء",
    description:
      "سماعات بلوتوث فاخرة بخاصية إلغاء الضوضاء النشط، بطارية تدوم 30 ساعة، وصوت محيطي نقي مع علبة شحن سريع.",
    price: 349,
    oldPrice: 499,
    category: "electronics",
    rating: 4.8,
    reviews: 1243,
    emoji: "🎧",
    gradient: "from-sky-500 via-blue-500 to-indigo-600",
    badge: "best",
    stock: 42,
    features: ["إلغاء ضوضاء نشط", "بطارية 30 ساعة", "مقاومة للماء والعرق", "بلوتوث 5.3"],
  },
  {
    id: "p2",
    name: "ساعة ذكية ألترا",
    description:
      "ساعة ذكية بشاشة أموليد كبيرة، تتبع صحي متكامل، مقاومة للماء حتى 100 متر، وبطارية تدوم 14 يوم.",
    price: 899,
    oldPrice: 1099,
    category: "electronics",
    rating: 4.9,
    reviews: 856,
    emoji: "⌚",
    gradient: "from-slate-600 via-slate-700 to-zinc-900",
    badge: "sale",
    stock: 25,
    features: ["شاشة أموليد", "قياس نبض وأكسجين الدم", "GPS مدمج", "مقاومة للماء 100م"],
  },
  {
    id: "p3",
    name: "شاحن سريع متنقل 20000mAh",
    description:
      "باور بانك بسعة ضخمة وشحن سريع 65W يشحن جوالك ولابتوبك، مع شاشة عرض لنسبة البطارية ومنفذي USB-C.",
    price: 149,
    category: "electronics",
    rating: 4.6,
    reviews: 2104,
    emoji: "🔋",
    gradient: "from-lime-500 via-green-500 to-emerald-600",
    badge: "new",
    stock: 120,
    features: ["سعة 20000mAh", "شحن سريع 65W", "منفذا USB-C", "شاشة عرض ذكية"],
  },
  {
    id: "p4",
    name: "مكبر صوت بلوتوث محمول",
    description:
      "سبيكر محمول بصوت 360 درجة وباس عميق، مقاوم للماء والغبار، وبطارية تشغّل حتى 20 ساعة متواصلة.",
    price: 229,
    category: "electronics",
    rating: 4.5,
    reviews: 634,
    emoji: "🔊",
    gradient: "from-orange-500 via-red-500 to-rose-600",
    stock: 58,
    features: ["صوت 360 درجة", "مقاومة للماء IPX7", "بطارية 20 ساعة", "إمكانية ربط سماعتين"],
  },
  {
    id: "p5",
    name: "عطر العود الملكي",
    description:
      "عطر شرقي فاخر بمزيج العود الكمبودي والعنبر والزعفران، ثبات يدوم طوال اليوم وفوحان يلفت الأنظار.",
    price: 459,
    oldPrice: 599,
    category: "fashion",
    rating: 4.9,
    reviews: 1876,
    emoji: "🌸",
    gradient: "from-amber-600 via-yellow-600 to-amber-700",
    badge: "best",
    stock: 33,
    features: ["عود كمبودي أصلي", "ثبات 12+ ساعة", "زجاجة 100مل فاخرة", "تغليف هدايا مجاني"],
  },
  {
    id: "p6",
    name: "حقيبة يد جلدية أنيقة",
    description:
      "حقيبة يد نسائية من الجلد الطبيعي الفاخر، تصميم إيطالي عصري، بجيوب متعددة وحزام كتف قابل للتعديل.",
    price: 329,
    category: "fashion",
    rating: 4.7,
    reviews: 423,
    emoji: "👜",
    gradient: "from-rose-500 via-pink-500 to-fuchsia-600",
    badge: "new",
    stock: 47,
    features: ["جلد طبيعي 100%", "تصميم إيطالي", "جيوب متعددة", "تشمل حزام كتف"],
  },
  {
    id: "p7",
    name: "نظارة شمسية كلاسيكية",
    description:
      "نظارة شمسية بعدسات مستقطبة تحمي من الأشعة فوق البنفسجية، إطار خفيف متين وتصميم يناسب الجميع.",
    price: 189,
    category: "fashion",
    rating: 4.4,
    reviews: 289,
    emoji: "🕶️",
    gradient: "from-cyan-500 via-sky-500 to-blue-600",
    stock: 85,
    features: ["عدسات مستقطبة", "حماية UV400", "إطار خفيف", "علبة ومنديل مجاناً"],
  },
  {
    id: "p8",
    name: "ساعة يد جلدية فاخرة",
    description:
      "ساعة يد رجالية بحركة أوتوماتيكية يابانية، حزام جلد إيطالي وزجاج ياقوتي مقاوم للخدش.",
    price: 549,
    oldPrice: 699,
    category: "fashion",
    rating: 4.8,
    reviews: 512,
    emoji: "🕐",
    gradient: "from-stone-500 via-stone-600 to-stone-800",
    badge: "sale",
    stock: 19,
    features: ["حركة أوتوماتيكية", "زجاج ياقوتي", "حزام جلد إيطالي", "مقاومة للماء 50م"],
  },
  {
    id: "p9",
    name: "ماكينة قهوة مختصة",
    description:
      "ماكينة إسبريسو منزلية بضغط 19 بار، تحضّر قهوتك المفضلة بلمسة زر مع مبخرة حليب احترافية.",
    price: 749,
    oldPrice: 949,
    category: "home",
    rating: 4.9,
    reviews: 967,
    emoji: "☕",
    gradient: "from-amber-700 via-yellow-800 to-stone-900",
    badge: "best",
    stock: 21,
    features: ["ضغط 19 بار", "مبخرة حليب", "خزان 1.5 لتر", "ضمان سنتين"],
  },
  {
    id: "p10",
    name: "مصباح ليلي ذكي",
    description:
      "مصباح ذكي بـ16 مليون لون يتحكم به بالجوال أو الصوت، مع مؤقت نوم وأوضاع إضاءة مريحة للعين.",
    price: 129,
    category: "home",
    rating: 4.5,
    reviews: 731,
    emoji: "💡",
    gradient: "from-yellow-400 via-amber-400 to-orange-500",
    badge: "new",
    stock: 94,
    features: ["16 مليون لون", "تحكم بالجوال والصوت", "مؤقت نوم", "توفير الطاقة"],
  },
  {
    id: "p11",
    name: "طقم أواني طبخ جرانيت",
    description:
      "طقم طبخ جرانيت من 10 قطع بتوزيع حرارة متساوٍ، مقابض عازلة للحرارة ومناسب لجميع أنواع الأفران.",
    price: 499,
    oldPrice: 649,
    category: "home",
    rating: 4.7,
    reviews: 542,
    emoji: "🍳",
    gradient: "from-red-500 via-orange-500 to-amber-500",
    badge: "sale",
    stock: 28,
    features: ["10 قطع متكاملة", "طلاء جرانيت صحي", "توزيع حرارة متساوٍ", "مقابض عازلة"],
  },
  {
    id: "p12",
    name: "مجموعة العناية بالبشرة",
    description:
      "روتين عناية متكامل بمكونات طبيعية: غسول، تونر، سيروم فيتامين C، ومرطب — لبشرة مشرقة وصحية.",
    price: 259,
    oldPrice: 329,
    category: "beauty",
    rating: 4.8,
    reviews: 1533,
    emoji: "💆",
    gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
    badge: "best",
    stock: 66,
    features: ["مكونات طبيعية", "مناسب لكل البشرات", "4 خطوات متكاملة", "خالٍ من العطور"],
  },
  {
    id: "p13",
    name: "مجفف شعر احترافي",
    description:
      "سشوار بقوة 2200W وتقنية الأيونات لتجفيف سريع بدون تقصف، مع 3 سرعات وملحقات تصفيف متعددة.",
    price: 279,
    category: "beauty",
    rating: 4.6,
    reviews: 418,
    emoji: "💇‍♀️",
    gradient: "from-pink-500 via-rose-400 to-orange-300",
    stock: 52,
    features: ["قوة 2200W", "تقنية الأيونات", "3 سرعات وحرارات", "ملحقات تصفيف"],
  },
  {
    id: "p14",
    name: "سجادة يوغا احترافية",
    description:
      "سجادة يوغا سميكة مضادة للانزلاق بخامة صديقة للبيئة، مع حزام حمل وسماكة مريحة للمفاصل.",
    price: 99,
    category: "sports",
    rating: 4.5,
    reviews: 356,
    emoji: "🧘",
    gradient: "from-emerald-500 via-teal-500 to-cyan-600",
    badge: "new",
    stock: 110,
    features: ["سماكة 6مم", "مضادة للانزلاق", "خامة صديقة للبيئة", "تشمل حزام حمل"],
  },
  {
    id: "p15",
    name: "دمبل قابل للتعديل",
    description:
      "دمبل ذكي قابل للتعديل من 2.5 إلى 24 كجم بتدوير واحد، يغنيك عن 15 دمبل ويوفر مساحة بيتك.",
    price: 449,
    oldPrice: 549,
    category: "sports",
    rating: 4.7,
    reviews: 289,
    emoji: "🏋️",
    gradient: "from-zinc-600 via-neutral-700 to-stone-900",
    badge: "sale",
    stock: 16,
    features: ["2.5 إلى 24 كجم", "تعديل بتدوير واحد", "قبضة مريحة", "قاعدة تخزين"],
  },
  {
    id: "p16",
    name: "حقيبة رياضية متعددة الاستخدام",
    description:
      "شنطة رياضية بجيب مخصص للحذاء وجيب مقاوم للماء، خامة متينة وخفيفة بسعة 40 لتر.",
    price: 159,
    category: "sports",
    rating: 4.4,
    reviews: 198,
    emoji: "🎒",
    gradient: "from-blue-600 via-indigo-600 to-violet-700",
    stock: 73,
    features: ["سعة 40 لتر", "جيب مخصص للحذاء", "خامة مقاومة للماء", "حزام كتف مبطن"],
  },
];

export const FREE_SHIPPING_THRESHOLD = 200;
export const SHIPPING_COST = 25;

export function formatPrice(n: number): string {
  return new Intl.NumberFormat("ar-SA-u-nu-latn", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function discountPercent(p: Product): number {
  if (!p.oldPrice) return 0;
  return Math.round((1 - p.price / p.oldPrice) * 100);
}

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export const badgeLabels: Record<Badge, string> = {
  new: "جديد",
  sale: "خصم",
  best: "الأكثر مبيعاً",
};
