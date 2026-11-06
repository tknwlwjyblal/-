import { useRef, useState } from "react";
import {
  Currency,
  SavingsCircle,
  UserProfile,
  ActiveView,
  PaymentSubmission,
  canUserSeeCircle,
  getMemberInstallmentProgress,
} from "../types";
import { auth } from "../firebase";

interface Props {
  circles: SavingsCircle[];
  pendingConfirmationCount?: number;
  payments?: PaymentSubmission[];
  userProfile: UserProfile;
  onNavigate: (view: ActiveView) => void;
  onSelectCircle: (circle: SavingsCircle) => void;
  onPayDue: (circle: SavingsCircle) => void;
  onOpenAdminApprovals?: (circle?: SavingsCircle) => void;
  selectedCurrency: Currency | "ALL";
  onSelectCurrency: (currency: Currency | "ALL") => void;
  toastMessage?: string | null;
  onDismissToast?: () => void;
  showOverview?: boolean;
}

export function HomeView({
  circles: allCircles,
  pendingConfirmationCount = 0,
  payments = [],
  userProfile,
  onNavigate,
  onSelectCircle,
  onPayDue,
  onOpenAdminApprovals,
  selectedCurrency,
  onSelectCurrency,
  toastMessage,
  onDismissToast,
  showOverview = true,
}: Props) {
  const uid = userProfile.id || auth.currentUser?.uid;
  const email = userProfile.email || auth.currentUser?.email;
  const circles = allCircles.filter((circle) =>
    canUserSeeCircle(circle, uid, email),
  );
  const managed = circles.filter(
    (circle) =>
      circle.creatorId === uid ||
      circle.organizer?.creatorId === uid ||
      Boolean(
        email && circle.creatorEmail?.toLowerCase() === email.toLowerCase(),
      ),
  );
  const pendingReceipts = payments.filter(
    (payment) =>
      managed.some((circle) => circle.id === payment.circleId) &&
      payment.status === "under_review",
  ).length;
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [activeCard, setActiveCard] = useState(0);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const slider = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const currencies: { id: Currency; name: string; symbol: string }[] = [
    { id: "YER", name: "ريال يمني", symbol: "ر.ي" },
    { id: "SAR", name: "ريال سعودي", symbol: "ر.س" },
    { id: "USD", name: "دولار أمريكي", symbol: "$" },
  ];
  const matching = circles.filter(
    (circle) =>
      circle.status === tab &&
      (selectedCurrency === "ALL" || circle.currency === selectedCurrency),
  );
  const shown = showOverview ? matching.slice(0, 3) : matching;
  const actions = [
    {
      label: "جمعياتي",
      icon: "diversity_3",
      action: () => onNavigate("my-circles"),
      badge: circles.length,
    },
    managed.length
      ? {
          label: "لوحة التعميد",
          icon: "fact_check",
          action: () =>
            onOpenAdminApprovals
              ? onOpenAdminApprovals()
              : onNavigate("admin-approvals"),
          badge: pendingReceipts,
        }
      : {
          label: "سداد الأقساط",
          icon: "payments",
          action: () => {
            const circle = circles.find((item) => item.status === "active");
            circle ? onPayDue(circle) : onNavigate("my-circles");
          },
          badge: 0,
        },
    {
      label: "انضمام لجمعية",
      icon: "login",
      action: () => onNavigate("join-circle"),
      badge: 0,
    },
    {
      label: "إنشاء جمعية",
      icon: "add_circle",
      action: () => onNavigate("create-circle"),
      badge: 0,
    },
    {
      label: "التنبيهات",
      icon: "notifications",
      action: () => onNavigate("notifications"),
      badge: 0,
    },
    {
      label: "حسابي",
      icon: "person_outline",
      action: () => onNavigate("profile"),
      badge: 0,
    },
  ];
  function moveCard(index: number) {
    const container = slider.current,
      card = cards.current[index];
    if (!container || !card) return;
    const area = container.getBoundingClientRect(),
      bounds = card.getBoundingClientRect();
    container.scrollBy({
      left: bounds.left + bounds.width / 2 - area.left - area.width / 2,
      behavior: "smooth",
    });
    setActiveCard(index);
  }
  return (
    <div className="compact-home w-full px-4 pt-2 pb-24" dir="rtl">
      {toastMessage && (
        <div
          role="status"
          className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-[#d4c3b7] bg-white p-3 text-xs"
        >
          <span>{toastMessage}</span>
          <button
            onClick={onDismissToast}
            aria-label="إغلاق التنبيه"
            className="min-h-9 min-w-9"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
      {showOverview && (
        <>
          <p className="text-center text-[10px] text-[#8b8074] mb-2">
            مدخراتك، خطوة أقرب لأهدافك
          </p>
          <div
            ref={slider}
            className="balance-carousel"
            aria-label="ملخص المدخرات حسب العملة"
            onScroll={() => {
              if (!slider.current) return;
              const bounds = slider.current.getBoundingClientRect(),
                center = bounds.left + bounds.width / 2;
              let nearest = 0,
                distance = Infinity;
              cards.current.forEach((card, index) => {
                if (!card) return;
                const rect = card.getBoundingClientRect(),
                  next = Math.abs(rect.left + rect.width / 2 - center);
                if (next < distance) {
                  nearest = index;
                  distance = next;
                }
              });
              setActiveCard(nearest);
            }}
          >
            {currencies.map((currency, index) => {
              const entries = circles.filter(
                (circle) =>
                  circle.currency === currency.id && circle.status === "active",
              );
              const total = entries.reduce(
                (sum, circle) =>
                  sum +
                  (circle.myTurnReceived
                    ? 0
                    : (getMemberInstallmentProgress(
                        circle,
                        uid,
                        email,
                        payments,
                      ).sharesCount ||
                        circle.mySharesCount ||
                        1) * (circle.monthlyPayout || circle.totalPool)),
                0,
              );
              return (
                <article
                  ref={(element) => {
                    cards.current[index] = element;
                  }}
                  key={currency.id}
                  className={`balance-card ${selectedCurrency === currency.id ? "balance-card-selected" : ""}`}
                  aria-label={`بطاقة ${currency.name}`}
                >
                  <div className="flex justify-between items-start gap-3 relative z-10">
                    <div>
                      <p className="text-[10px] text-white/75">
                        إجمالي المدخرات
                      </p>
                      <h2 className="text-sm font-bold mt-1">
                        {currency.name}
                      </h2>
                    </div>
                    <img
                      src="/assets/aistudio/image_94928b82.png"
                      alt="هيا نجمعها"
                      className="w-10 h-10 object-contain rounded-xl bg-white/90 p-1"
                    />
                  </div>
                  <div className="relative z-10 flex items-center gap-2 mt-2">
                    <strong
                      className="text-[25px] leading-tight font-bold tabular-nums"
                      aria-label="قيمة المدخرات"
                    >
                      {balanceVisible ? total.toLocaleString("ar-YE") : "•••••"}
                    </strong>
                    <span className="text-[10px] text-[#ffdeae]">
                      {currency.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-center relative z-10 mt-auto pt-2">
                    <button
                      onClick={() =>
                        onSelectCurrency(
                          selectedCurrency === currency.id
                            ? "ALL"
                            : currency.id,
                        )
                      }
                      className="text-[10px] text-white/85 min-h-8"
                    >
                      {entries.length} جمعيات نشطة{" "}
                      <span aria-hidden="true">←</span>
                    </button>
                    <button
                      onClick={() => setBalanceVisible((value) => !value)}
                      aria-label={
                        balanceVisible ? "إخفاء الرصيد" : "إظهار الرصيد"
                      }
                      className="w-8 h-8 flex justify-center items-center rounded-full bg-white/10"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {balanceVisible ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <div
            className="flex justify-center gap-1.5 my-2"
            aria-label="اختيار بطاقة العملة"
          >
            {currencies.map((currency, index) => (
              <button
                key={currency.id}
                aria-label={`عرض بطاقة ${currency.name}`}
                aria-pressed={activeCard === index}
                onClick={() => moveCard(index)}
                className="w-6 h-6 flex items-center justify-center"
              >
                <span
                  className={`h-1.5 rounded-full transition-all ${activeCard === index ? "w-4 bg-[#714a23]" : "w-1.5 bg-[#d4c3b7]"}`}
                />
              </button>
            ))}
          </div>
          <div className="saving-banner mb-3 flex items-center gap-3 px-3 py-2.5 rounded-2xl">
            <span className="material-symbols-outlined text-3xl text-[#8c6239]">
              savings
            </span>
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-[#714a23]">
                نجمّعها اليوم، ونحققها بكرة
              </h2>
              <p className="text-[10px] text-[#746657] mt-1">
                جمعياتك وادخارك في مكان واحد
              </p>
            </div>
          </div>
          <section
            className="grid grid-cols-3 gap-2 mb-5"
            aria-label="خدمات الجمعيات"
          >
            {actions.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="service-tile relative flex flex-col items-center justify-center gap-2 rounded-2xl bg-white border border-[#eee7dd] px-1 py-3 min-h-[78px] active:scale-[.97] transition-transform"
              >
                <span className="material-symbols-outlined text-[25px] text-[#714a23]">
                  {item.icon}
                </span>
                <span className="text-[11px] font-semibold text-[#3f352b]">
                  {item.label}
                </span>
                {item.badge > 0 && (
                  <span className="absolute top-2 left-2 min-w-4 h-4 rounded-full px-1 text-[9px] bg-[#f1e6d6] text-[#714a23] flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </section>
        </>
      )}
      <section aria-label="قائمة الجمعيات">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-bold">جمعياتي</h2>
          {showOverview && (
            <button
              onClick={() => onNavigate("my-circles")}
              className="text-[10px] text-[#8c6239] min-h-8"
            >
              عرض الكل ←
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <div className="flex gap-1 rounded-xl bg-[#eee8df] p-1">
            {(["active", "completed"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                aria-pressed={tab === value}
                className={`rounded-lg px-3 min-h-8 text-[10px] font-semibold ${tab === value ? "bg-white text-[#714a23] shadow-xs" : "text-[#81715e]"}`}
              >
                {value === "active" ? "النشطة" : "المكتملة"} (
                {circles.filter((circle) => circle.status === value).length})
              </button>
            ))}
          </div>
          {selectedCurrency !== "ALL" && (
            <button
              onClick={() => onSelectCurrency("ALL")}
              className="text-[10px] text-[#714a23] min-h-8 px-2"
            >
              كل العملات ×
            </button>
          )}
        </div>
        {pendingConfirmationCount > 0 && (
          <p className="rounded-xl bg-[#f3e9d7] p-3 text-[11px] text-[#714a23] mb-2">
            {pendingConfirmationCount} جمعية بانتظار اعتماد انضمامك
          </p>
        )}
        <div className="flex flex-col gap-2">
          {shown.length ? (
            shown.map((circle) => {
              const progress = getMemberInstallmentProgress(
                circle,
                uid,
                email,
                payments,
              );
              const member = circle.members.find(
                (item) =>
                  item.id === uid ||
                  Boolean(
                    email && item.email?.toLowerCase() === email.toLowerCase(),
                  ),
              );
              const monthly =
                (circle.sharePrice || circle.monthlyShare || 1000) *
                (member?.sharesCount || circle.mySharesCount || 1);
              const paid =
                progress.isCompleted || circle.myPaymentStatus === "paid";
              const review = circle.myPaymentStatus === "under_review";
              const closed = circle.status === "completed";
              return (
                <article
                  key={circle.id}
                  className="mini-circle bg-white border border-[#eee7dd] rounded-2xl p-3"
                >
                  <button
                    onClick={() => onSelectCircle(circle)}
                    className="flex items-center gap-2.5 w-full text-right"
                  >
                    <span className="w-9 h-9 rounded-xl bg-[#f4ede3] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-xl text-[#8c6239]">
                        diversity_3
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-bold truncate">
                        {circle.title}
                      </h3>
                      <p className="text-[10px] text-[#8b7e6e] mt-1 truncate">
                        {managed.some((item) => item.id === circle.id)
                          ? "أنت المنظّم · "
                          : ""}
                        دورك:{" "}
                        {member?.payoutMonth ||
                          circle.myTurnMonth ||
                          "قيد التحديد"}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[#714a23] shrink-0">
                      {monthly.toLocaleString("ar-YE")}{" "}
                      <small className="text-[9px] font-normal">
                        {circle.currencySymbol}
                      </small>
                    </span>
                  </button>
                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[#f5f0e9]">
                    <span
                      className={`text-[9px] ${paid ? "text-[#2D6A4F]" : "text-[#8c6239]"}`}
                    >
                      {closed
                        ? "الجمعية مكتملة"
                        : paid
                          ? "القسط مسدّد"
                          : review
                            ? "الإيصال قيد التعميد"
                            : "القسط بانتظار السداد"}{" "}
                      · {progress.paidInstallmentsCount}/
                      {progress.totalRequiredInstallments}
                    </span>
                    <button
                      onClick={() =>
                        paid || review || closed
                          ? onSelectCircle(circle)
                          : onPayDue(circle)
                      }
                      className="text-[10px] font-semibold text-[#714a23] min-h-8 px-2 rounded-lg bg-[#f5eee5]"
                    >
                      {paid || review || closed ? "التفاصيل" : "سداد القسط"}
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="bg-white border border-dashed border-[#ded2c1] rounded-2xl p-5 text-center">
              <span className="material-symbols-outlined text-2xl text-[#a48a6a]">
                savings
              </span>
              <p className="text-xs text-[#796b5b] mt-2">
                لا توجد جمعيات {tab === "active" ? "نشطة" : "مكتملة"} حاليًا
              </p>
              <button
                onClick={() => onNavigate("join-circle")}
                className="min-h-9 mt-2 text-[11px] text-[#714a23] font-semibold"
              >
                انضم لجمعية برمز الدعوة ←
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
