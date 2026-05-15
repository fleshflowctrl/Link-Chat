"use client";

import { useEffect, useState, type ReactNode } from "react";

export type SectionDef = {
  id: string;
  number: number;
  label: string;
  icon: ReactNode;
};

/** Sticky left-side step-nav for long forms. Uses IntersectionObserver to
 * highlight the section currently in the viewport. Clicking an item
 * smooth-scrolls to its anchor. */
export function PersonaSectionNav({ sections }: { sections: SectionDef[] }) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const observers: IntersectionObserver[] = [];
    let mostVisible: { id: string; ratio: number } = { id: active, ratio: 0 };

    const visibility = new Map<string, number>();

    const recompute = () => {
      let topId = sections[0]?.id ?? "";
      let topRatio = -1;
      visibility.forEach((ratio, id) => {
        if (ratio > topRatio) {
          topId = id;
          topRatio = ratio;
        }
      });
      if (topRatio > 0 && topId !== mostVisible.id) {
        mostVisible = { id: topId, ratio: topRatio };
        setActive(topId);
      }
    };

    sections.forEach((s) => {
      const el = document.getElementById(`section-${s.id}`);
      if (!el) return;
      const obs = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            visibility.set(s.id, entry.intersectionRatio);
          }
          recompute();
        },
        {
          rootMargin: "-20% 0px -55% 0px",
          threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
        },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => {
      observers.forEach((o) => o.disconnect());
    };
  }, [sections, active]);

  function jump(id: string) {
    const el = document.getElementById(`section-${id}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: "smooth" });
    setActive(id);
  }

  return (
    <nav className="sticky top-6 hidden self-start lg:block">
      <ul className="space-y-1 pr-2">
        {sections.map((s) => {
          const isActive = active === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => jump(s.id)}
                className={
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors " +
                  (isActive
                    ? "bg-primary/10 text-primary"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900")
                }
              >
                <span
                  className={
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold transition-colors " +
                    (isActive
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-500")
                  }
                >
                  {s.number}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-2 font-medium">
                  <span className={isActive ? "text-primary" : "text-gray-400"}>{s.icon}</span>
                  <span className="truncate">{s.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Heading block rendered at the top of each form section. The matching
 * id="section-{id}" anchor is what the IntersectionObserver tracks. */
export function PersonaSectionCard({
  id,
  number,
  title,
  description,
  icon,
  children,
}: {
  id: string;
  number: number;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={`section-${id}`}
      className="scroll-mt-20 rounded-2xl border border-black/5 bg-white shadow-sm"
    >
      <div className="flex items-start gap-4 border-b border-black/5 px-6 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon ?? <span className="text-sm font-bold">{number}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight text-gray-900">
            <span className="mr-2 text-gray-300">{number}.</span>
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-5 px-6 py-5">{children}</div>
    </section>
  );
}
