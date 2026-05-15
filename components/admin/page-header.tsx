import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "@/components/admin/icons";

export type Crumb = { href?: string; label: string };

/** Standard admin page header: breadcrumbs + title + subtitle + actions. */
export function AdminPageHeader({
  crumbs,
  title,
  description,
  actions,
}: {
  crumbs?: Crumb[];
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8">
      {crumbs && crumbs.length > 0 ? (
        <nav className="mb-3 flex items-center gap-1 text-xs text-gray-500">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {c.href ? (
                <Link href={c.href} className="hover:text-gray-900">
                  {c.label}
                </Link>
              ) : (
                <span className="text-gray-700">{c.label}</span>
              )}
              {i < crumbs.length - 1 ? (
                <ChevronRightIcon className="h-3.5 w-3.5 text-gray-300" />
              ) : null}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-gray-900">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 text-sm text-gray-600">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
