"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useState } from "react";
import { XIcon } from "@/components/admin/icons";

/** Standard form field wrapper with label, optional hint, and consistent
 * spacing. Hint sits inline with the label so vertical rhythm stays tight
 * across long forms. */
export function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-gray-800">
          {label}
          {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
        </span>
        {hint ? <span className="text-xs text-gray-400">{hint}</span> : null}
      </div>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputClasses =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClasses} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${inputClasses} font-sans leading-relaxed ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${inputClasses} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 20 20%22 fill=%22none%22 stroke=%22%239CA3AF%22 stroke-width=%221.75%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m5 7.5 5 5 5-5%22/></svg>')] bg-[right_0.75rem_center] bg-no-repeat pr-8 ${props.className ?? ""}`}
    />
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label
      className={
        "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors " +
        (checked
          ? "border-primary/50 bg-primary/5"
          : "border-gray-200 bg-white hover:border-gray-300")
      }
    >
      <span
        className={
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors " +
          (checked ? "border-primary bg-primary text-white" : "border-gray-300 bg-white")
        }
      >
        {checked ? (
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
            <path d="m2.5 6 2.5 2.5L9.5 3.5" />
          </svg>
        ) : null}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-gray-500">{description}</p> : null}
      </div>
    </label>
  );
}

/** Tag/chip input with Enter-or-comma to commit. Backspace deletes the
 * trailing chip when the input is empty (standard UX pattern). */
export function ChipList({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  const remove = (idx: number) => onChange(values.filter((_, i) => i !== idx));

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2.5 py-2 shadow-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
      {values.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-lavender px-2.5 py-0.5 text-xs font-medium text-primary"
        >
          {v}
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-primary/60 transition-colors hover:text-primary"
            aria-label={`verwijder ${v}`}
          >
            <XIcon className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
          if (e.key === "Backspace" && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={values.length === 0 ? placeholder : ""}
        className="min-w-[120px] flex-1 border-none bg-transparent py-1 text-sm placeholder:text-gray-400 focus:outline-none"
      />
    </div>
  );
}

/** Multi-select rendered as toggle pills. Two layouts:
 *   "wrap" — inline pills, used for short lists like filter-tags.
 *   "grid" — card-style options with hint, used for vibes/looking-for. */
export function MultiCheck({
  options,
  values,
  onChange,
  layout = "wrap",
}: {
  options: Array<{ id: string; label: string; hint?: string; emoji?: string }>;
  values: string[];
  onChange: (next: string[]) => void;
  layout?: "wrap" | "grid";
}) {
  const toggle = (id: string) => {
    if (values.includes(id)) onChange(values.filter((v) => v !== id));
    else onChange([...values, id]);
  };

  if (layout === "grid") {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((o) => {
          const on = values.includes(o.id);
          return (
            <button
              type="button"
              key={o.id}
              onClick={() => toggle(o.id)}
              className={
                "rounded-xl border px-3 py-2.5 text-left transition-all " +
                (on
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300")
              }
            >
              <div className={"flex items-center gap-1.5 text-sm font-medium " + (on ? "text-primary" : "text-gray-800")}>
                {o.emoji ? <span>{o.emoji}</span> : null}
                <span>{o.label}</span>
              </div>
              {o.hint ? (
                <div className={"mt-0.5 text-[11px] " + (on ? "text-primary/70" : "text-gray-500")}>
                  {o.hint}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = values.includes(o.id);
        return (
          <button
            type="button"
            key={o.id}
            onClick={() => toggle(o.id)}
            className={
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors ring-1 ring-inset " +
              (on
                ? "bg-primary text-white ring-primary"
                : "bg-white text-gray-700 ring-gray-200 hover:ring-gray-400")
            }
            title={o.hint}
          >
            {o.emoji ? <span className="mr-1">{o.emoji}</span> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
