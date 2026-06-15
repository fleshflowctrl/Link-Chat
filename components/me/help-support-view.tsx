"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  HelpCircle,
  Lock,
  Mail,
  MessageCircle,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { StatusBarMock } from "@/components/messages/status-bar-mock";
import { SITE_DOMAIN, SITE_NAME, SUPPORT_EMAIL } from "@/lib/brand";

/* ─────────────────── data ─────────────────── */

type CategoryKey = "account" | "safety" | "payments" | "profile" | "messages";

type HelpCategory = {
  key: CategoryKey;
  title: string;
  description: string;
  icon: typeof ShieldCheck;
  iconBg: string;
  iconColor: string;
};

const helpCategories: HelpCategory[] = [
  {
    key: "account",
    title: "Account",
    description: "Inloggen, e-mail en gegevens",
    icon: User,
    iconBg: "bg-[#EDE7FF]",
    iconColor: "text-[#7C5CFF]",
  },
  {
    key: "safety",
    title: "Veiligheid",
    description: "Verifiëren, blokkeren en melden",
    icon: ShieldCheck,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    key: "payments",
    title: "Betalingen",
    description: "Berichtenbundels, kaarten en facturen",
    icon: CreditCard,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    key: "profile",
    title: "Profiel",
    description: "Foto's, bio en zichtbaarheid",
    icon: Sparkles,
    iconBg: "bg-pink-50",
    iconColor: "text-pink-600",
  },
  {
    key: "messages",
    title: "Berichten",
    description: "Chats, geschenken en reads",
    icon: MessageCircle,
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
  },
];

type FaqItem = {
  id: string;
  category: CategoryKey;
  question: string;
  answer: string;
};

const faqs: FaqItem[] = [
  {
    id: "credits-what",
    category: "payments",
    question: "Wat zijn Berichtenbundels en waar gebruik ik ze voor?",
    answer:
      "Berichtenbundels gebruik je voor chats en exclusieve content. Je kunt een bundel kopen op de Berichtenbundels-pagina of gratis berichten verdienen via Sparkles verdienen op je profiel.",
  },
  {
    id: "credits-refund",
    category: "payments",
    question: "Kan ik mijn Berichtenbundel terugkrijgen?",
    answer:
      "Aangekochte Berichtenbundels zijn niet-restitueerbaar zodra ze zijn opgewaardeerd. Bij een betalingsfout of dubbele afschrijving nemen we contact op met onze betaalprovider — neem dan contact op via support.",
  },
  {
    id: "card-safety",
    category: "payments",
    question: "Worden mijn kaartgegevens veilig opgeslagen?",
    answer:
      "We slaan alleen het kaartmerk en de laatste 4 cijfers op om je kaarten te tonen. Het volledige kaartnummer en de CVC worden nooit op onze servers bewaard.",
  },
  {
    id: "verify-account",
    category: "account",
    question: "Hoe verifieer ik mijn account?",
    answer:
      "Open je profiel en tik op 'Profiel bewerken'. Volg de stappen voor een korte selfie-verificatie. Geverifieerde accounts krijgen een blauw vinkje en meer matches.",
  },
  {
    id: "change-email",
    category: "account",
    question: "Hoe wijzig ik mijn e-mailadres?",
    answer:
      "Ga naar Profiel → Account → E-mailadres. Voer je nieuwe adres in en bevestig via de bevestigingsmail die je van ons ontvangt.",
  },
  {
    id: "delete-account",
    category: "account",
    question: "Hoe verwijder ik mijn account?",
    answer:
      "Profiel → Account → Account verwijderen. Je profiel, foto's en chats worden definitief verwijderd. Resterende berichten in je bundel vervallen — gebruik ze dus eerst.",
  },
  {
    id: "report-user",
    category: "safety",
    question: "Hoe meld of blokkeer ik iemand?",
    answer:
      "Open de chat of het profiel van de persoon en tik rechtsboven op het menu. Kies 'Blokkeren' om alle interactie te stoppen of 'Melden' als iemand de regels overtreedt.",
  },
  {
    id: "scam-warning",
    category: "safety",
    question: "Iemand vraagt om geld of persoonlijke gegevens — wat nu?",
    answer:
      "Stuur nooit geld, kaartgegevens of intieme foto's buiten het platform. Meld het profiel direct via de meldknop. Ons moderatieteam onderzoekt elke melding binnen 24 uur.",
  },
  {
    id: "photo-rules",
    category: "profile",
    question: "Welke foto's zijn toegestaan?",
    answer:
      "Gebruik recente foto's waarop jij duidelijk te zien bent. Geen naaktfoto's, kinderen, of foto's van andere personen zonder toestemming. Foto's die de regels overtreden worden verwijderd.",
  },
  {
    id: "hide-profile",
    category: "profile",
    question: "Kan ik mijn profiel tijdelijk verbergen?",
    answer:
      "Ja — Profiel → Privacyinstellingen → Profiel verbergen. Je matches blijven bestaan, maar nieuwe gebruikers zien je profiel niet meer in de discover-feed.",
  },
  {
    id: "no-replies",
    category: "messages",
    question: "Waarom krijg ik geen antwoorden op mijn berichten?",
    answer:
      "Een goed openingsbericht is persoonlijk en stelt een vraag. Tik op 'Profiel bewerken' om je bio en foto's te verbeteren — een sterker profiel verhoogt je antwoordratio aanzienlijk.",
  },
  {
    id: "gift-meaning",
    category: "messages",
    question: "Wat is het effect van een geschenk in een chat?",
    answer:
      "Geschenken laten je interesse zien en duwen je bericht hoger in de inbox van de ontvanger. Dat verhoogt de kans op een snel antwoord, vooral bij populaire profielen.",
  },
];

/* ─────────────────── component ─────────────────── */

export function HelpSupportView() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryKey | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredFaqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqs.filter((f) => {
      if (activeCategory && f.category !== activeCategory) return false;
      if (!q) return true;
      return (
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q)
      );
    });
  }, [query, activeCategory]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2400);
  }

  function handleCategoryToggle(key: CategoryKey) {
    setActiveCategory((prev) => (prev === key ? null : key));
    setOpenId(null);
  }

  function handleEmail() {
    const subject = encodeURIComponent(`Hulp nodig met ${SITE_NAME}`);
    const body = encodeURIComponent(
      "Hoi support team,\n\nIk heb hulp nodig met:\n\n",
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <div className="min-h-full overflow-x-hidden bg-canvas pb-[max(3rem,env(safe-area-inset-bottom))]">
      <StatusBarMock />

      <header className="flex items-center gap-3 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link
          href="/me"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/[0.05] transition active:scale-95"
          aria-label="Terug naar profiel"
        >
          <ChevronLeft className="h-5 w-5 text-ink" strokeWidth={2.25} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[clamp(18px,5.2vw,22px)] font-bold leading-tight tracking-tight text-ink">
            Hulp &amp; ondersteuning
          </h1>
          <p className="truncate text-[12px] text-gray-500">
            Vind antwoorden of neem contact met ons op
          </p>
        </div>
      </header>

      {/* Hero / search */}
      <div className="px-5 pb-5">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#7C5CFF] to-[#9B7BFF] p-[clamp(16px,4.5vw,20px)] text-white shadow-md">
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-white/10"
            aria-hidden
          />
          <div className="relative">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/30">
                <HelpCircle className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[clamp(15px,4.4vw,18px)] font-bold leading-tight">
                  Waar kunnen we mee helpen?
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-white/80">
                  Doorzoek de veelgestelde vragen of stuur ons een bericht.
                </p>
              </div>
            </div>
            <label className="mt-4 flex items-center gap-2 rounded-2xl bg-white/95 px-3.5 shadow-sm ring-1 ring-white/40 focus-within:ring-2 focus-within:ring-white">
              <Search className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zoek bv. berichtenbundel, foto, blokkeren…"
                aria-label="Zoek in hulp & ondersteuning"
                className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-gray-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="shrink-0 text-[11px] font-bold text-[#7C5CFF] active:scale-95"
                >
                  Wis
                </button>
              )}
            </label>
          </div>
        </div>
      </div>

      {/* Categorie chips */}
      <div className="px-5 pb-4">
        <div className="-mx-5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2 pr-1">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-[12px] font-bold transition active:scale-95 ${
                activeCategory === null
                  ? "bg-ink text-white shadow-sm"
                  : "bg-white text-ink ring-1 ring-black/[0.05]"
              }`}
            >
              Alles
            </button>
            {helpCategories.map((c) => {
              const Icon = c.icon;
              const active = activeCategory === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => handleCategoryToggle(c.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold transition active:scale-95 ${
                    active
                      ? "bg-ink text-white shadow-sm"
                      : "bg-white text-ink ring-1 ring-black/[0.05]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  {c.title}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Categorie-grid (alleen wanneer geen actieve filter en geen query) */}
      {!activeCategory && !query && (
        <div className="px-5 pb-6">
          <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Onderwerpen
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {helpCategories.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => handleCategoryToggle(c.key)}
                  className="flex min-w-0 items-start gap-2.5 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-black/[0.04] transition active:scale-[0.98]"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c.iconBg} ${c.iconColor}`}
                    aria-hidden
                  >
                    <Icon className="h-[17px] w-[17px]" strokeWidth={2.25} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold leading-tight text-ink">
                      {c.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-gray-500">
                      {c.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* FAQ accordion */}
      <div className="px-5 pb-6">
        <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
          {activeCategory
            ? `Vragen over ${helpCategories.find((c) => c.key === activeCategory)?.title.toLowerCase()}`
            : "Veelgestelde vragen"}
        </h2>

        {filteredFaqs.length === 0 ? (
          <div className="rounded-2xl bg-white p-7 text-center shadow-sm ring-1 ring-black/[0.04]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F4EFFF] text-[#7C5CFF]">
              <Search className="h-6 w-6" strokeWidth={2.25} aria-hidden />
            </div>
            <p className="text-[15px] font-bold text-ink">Geen resultaten</p>
            <p className="mx-auto mt-1.5 max-w-[260px] text-[12.5px] leading-relaxed text-gray-500">
              We konden niets vinden voor &ldquo;{query}&rdquo;. Probeer een ander woord of stuur ons een bericht.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
            {filteredFaqs.map((f, i) => {
              const open = openId === f.id;
              return (
                <div
                  key={f.id}
                  className={i > 0 ? "border-t border-gray-100" : ""}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : f.id)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-black/[0.02]"
                  >
                    <span className="min-w-0 flex-1 break-words text-[14px] font-bold leading-snug text-ink">
                      {f.question}
                    </span>
                    <motion.span
                      animate={{ rotate: open ? 180 : 0 }}
                      transition={{ duration: 0.18 }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                      aria-hidden
                    >
                      <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        key={`${f.id}-body`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <p className="px-4 pb-4 text-[13px] leading-relaxed text-gray-700">
                          {f.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contact opties */}
      <div className="px-5 pb-6">
        <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
          Nog steeds vastgelopen?
        </h2>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
          <button
            type="button"
            onClick={handleEmail}
            className="flex w-full min-h-[60px] items-center gap-3 px-4 py-3.5 text-left transition active:bg-black/[0.02]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EDE7FF] text-[#7C5CFF] ring-1 ring-primary/10">
              <Mail className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-bold text-ink">E-mail support</p>
              <p className="break-words text-[12px] leading-snug text-gray-500">
                Antwoord binnen 24 uur ·{" "}
                <span className="break-all">{SUPPORT_EMAIL}</span>
              </p>
            </div>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-gray-300"
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
          <button
            type="button"
            onClick={() =>
              showToast("Live chat is beschikbaar op werkdagen van 9.00 tot 17.00")
            }
            className="flex w-full min-h-[60px] items-center gap-3 border-t border-gray-100 px-4 py-3.5 text-left transition active:bg-black/[0.02]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-bold text-ink">Live chat</p>
              <p className="text-[12px] leading-snug text-gray-500">
                Chat met een teamlid · ma–vr 9.00–17.00
              </p>
            </div>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-gray-300"
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {/* Veiligheid / juridisch */}
      <div className="px-5 pb-8">
        <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
          Veiligheid &amp; voorwaarden
        </h2>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
          <Link
            href="/me/privacy"
            className="flex min-h-[52px] items-center gap-3 px-4 py-3 transition active:bg-black/[0.02]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDE7FF] text-[#7C5CFF] ring-1 ring-primary/10">
              <Lock className="h-[16px] w-[16px]" strokeWidth={2} />
            </span>
            <p className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">
              Privacyinstellingen
            </p>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-gray-300"
              strokeWidth={2.25}
              aria-hidden
            />
          </Link>
          <button
            type="button"
            onClick={() => showToast("Community-richtlijnen openen binnenkort")}
            className="flex w-full min-h-[52px] items-center gap-3 border-t border-gray-100 px-4 py-3 text-left transition active:bg-black/[0.02]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <Shield className="h-[16px] w-[16px]" strokeWidth={2} />
            </span>
            <p className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">
              Community-richtlijnen
            </p>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-gray-300"
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
          <Link
            href="/terms"
            className="flex min-h-[52px] items-center gap-3 border-t border-gray-100 px-4 py-3 transition active:bg-black/[0.02]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-100">
              <ShieldCheck className="h-[16px] w-[16px]" strokeWidth={2} />
            </span>
            <p className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">
              Algemene voorwaarden
            </p>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-gray-300"
              strokeWidth={2.25}
              aria-hidden
            />
          </Link>
          <Link
            href="/privacy"
            className="flex min-h-[52px] items-center gap-3 border-t border-gray-100 px-4 py-3 transition active:bg-black/[0.02]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 ring-1 ring-sky-100">
              <Shield className="h-[16px] w-[16px]" strokeWidth={2} />
            </span>
            <p className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">
              Privacybeleid
            </p>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-gray-300"
              strokeWidth={2.25}
              aria-hidden
            />
          </Link>
          <Link
            href="/cookies"
            className="flex min-h-[52px] items-center gap-3 border-t border-gray-100 px-4 py-3 transition active:bg-black/[0.02]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200">
              <Lock className="h-[16px] w-[16px]" strokeWidth={2} />
            </span>
            <p className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">
              Cookiebeleid
            </p>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-gray-300"
              strokeWidth={2.25}
              aria-hidden
            />
          </Link>
        </div>

        <p className="mt-4 text-center text-[11px] text-gray-500">
          {SITE_NAME} · v1.0
        </p>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-none fixed bottom-24 left-1/2 z-[400] max-w-[min(90vw,360px)] -translate-x-1/2 rounded-full bg-ink/95 px-5 py-3 text-center text-[13px] font-semibold text-white shadow-lg backdrop-blur-sm"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
