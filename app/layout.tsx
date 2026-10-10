import type { Metadata } from "next";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "./globals.css";
import { StoreProvider } from "@/context/StoreContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Toasts from "@/components/Toasts";

export const metadata: Metadata = {
  title: "سوقنا | تسوّق أونلاين في السعودية",
  description:
    "سوقنا - وجهتك الأولى للتسوق أونلاين: إلكترونيات، أزياء، المنزل، العناية والرياضة. شحن سريع وإرجاع مجاني.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-screen flex-col bg-stone-50 font-sans text-stone-900 antialiased">
        <StoreProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <Toasts />
        </StoreProvider>
      </body>
    </html>
  );
}
