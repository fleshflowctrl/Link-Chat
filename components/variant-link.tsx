"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { withVariantPath } from "@/lib/app-variant";
import { useAppVariant } from "@/components/app-variant-provider";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

/** In-app link that respects the current A/B variant base path. */
export function VariantLink({ href, ...rest }: Props) {
  const { variant } = useAppVariant();
  return <Link href={withVariantPath(href, variant)} {...rest} />;
}
