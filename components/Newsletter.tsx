"use client";

import { useState } from "react";
import { useStore } from "@/context/StoreContext";

export default function Newsletter() {
  const { pushToast } = useStore();
  const [email, setEmail] = useState("");

  return (
    <section className="mx-auto max-w-7xl px-4">
      <div className="rounded-3xl bg-emerald-950 p-8 text-center text-white sm:p-12">
        <div className="text-4xl">📬</div>
        <h2 className="mt-3 text-2xl font-black sm:text-3xl">
          اشترك واحصل على خصم 15% على أول طلب
        </h2>
        <p className="mx-auto mt-2 max-w-md text-emerald-100/80">
          انضم لنشرتنا البريدية وكن أول من يعرف عن المنتجات الجديدة والعروض الحصرية.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim()) return;
            pushToast("تم الاشتراك بنجاح 🎉");
            setEmail("");
          }}
          className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="بريدك الإلكتروني"
            className="flex-1 rounded-xl border border-emerald-800 bg-emerald-900 px-4 py-3 text-sm text-white outline-none placeholder:text-emerald-200/50 focus:border-emerald-400"
          />
          <button
            type="submit"
            className="rounded-xl bg-amber-400 px-6 py-3 text-sm font-extrabold text-stone-900 transition-all hover:bg-amber-300 active:scale-95"
          >
            اشترك الآن
          </button>
        </form>
      </div>
    </section>
  );
}
