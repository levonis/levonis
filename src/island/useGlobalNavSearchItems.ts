import { useMemo } from "react";
import { useLanguage } from "@/lib/i18n";
import { usePageSearchSection, type PageSearchItem } from "./PageSearchContext";

/**
 * Global navigation items always available in the in-page search.
 * Provides a fallback so users can quickly jump anywhere from the search bar.
 */
export const useGlobalNavSearchItems = () => {
  const { language } = useLanguage();

  const items = useMemo<PageSearchItem[]>(() => {
    const tr = (ar: string, en: string, ku: string) =>
      language === "en" ? en : language === "ku" ? ku : ar;

    return [
      { id: "nav-home", to: "/", label: tr("الرئيسية", "Home", "سەرەکی"), keywords: ["home", "main", "رئيسي"] },
      { id: "nav-cart", to: "/cart", label: tr("سلة التسوق", "Cart", "سەبەتە"), keywords: ["cart", "checkout", "سله"] },
      { id: "nav-orders", to: "/my-orders", label: tr("طلباتي", "My Orders", "داواکارییەکانم"), keywords: ["orders"] },
      { id: "nav-wishlist", to: "/wishlist", label: tr("المفضلة", "Wishlist", "خۆشەویستەکان"), keywords: ["wish", "favorites"] },
      { id: "nav-storage", to: "/storage", label: tr("مخزني", "My Storage", "مخزنم"), keywords: ["storage", "items"] },
      { id: "nav-points", to: "/points-store", label: tr("متجر النقاط", "Points Store", "بازاڕی خاڵ"), keywords: ["points", "store"] },
      { id: "nav-games", to: "/games", label: tr("الألعاب", "Games", "یارییەکان"), keywords: ["games", "play"] },
      { id: "nav-competitions", to: "/competitions", label: tr("المسابقات", "Competitions", "پێشبڕکێ"), keywords: ["lottery", "tickets"] },
      { id: "nav-community", to: "/community", label: tr("المجتمع", "Community", "کۆمەڵگا"), keywords: ["community"] },
      { id: "nav-merchants", to: "/community/merchants", label: tr("التجار", "Merchants", "بازرگانەکان"), keywords: ["merchants", "shops"] },
      { id: "nav-print", to: "/community/print-requests", label: tr("طلبات الطباعة", "Print Requests", "داواکاری چاپ"), keywords: ["3d print", "stl"] },
      { id: "nav-rewards", to: "/rewards", label: tr("بطاقات الولاء", "Loyalty Cards", "کارتی دڵسۆزی"), keywords: ["loyalty", "vip"] },
      { id: "nav-profile", to: "/profile", label: tr("ملفي الشخصي", "My Profile", "پرۆفایلم"), keywords: ["profile", "account"] },
      { id: "nav-notifications", to: "/notifications", label: tr("الإشعارات", "Notifications", "ئاگادارکردنەوەکان"), keywords: ["notifications", "alerts"] },
      { id: "nav-wallet", to: "/wallet", label: tr("المحفظة", "Wallet", "جزدان"), keywords: ["wallet", "balance"] },
      { id: "nav-about", to: "/about", label: tr("من نحن", "About Us", "دەربارەی ئێمە"), keywords: ["about", "story"] },
      { id: "nav-faq", to: "/faq", label: tr("الأسئلة الشائعة", "FAQ", "پرسیارە دووبارەکان"), keywords: ["faq", "help"] },
      { id: "nav-contact", to: "/contact", label: tr("تواصل معنا", "Contact", "پەیوەندی"), keywords: ["contact", "support"] },
      { id: "nav-terms", to: "/terms", label: tr("شروط الاستخدام", "Terms of Use", "مەرجەکان"), keywords: ["terms"] },
      { id: "nav-privacy", to: "/privacy", label: tr("سياسة الخصوصية", "Privacy Policy", "سیاسەتی تایبەتمەندی"), keywords: ["privacy"] },
    ];
  }, [language]);

  usePageSearchSection("__global_nav__", items);
};
