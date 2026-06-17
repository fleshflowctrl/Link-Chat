import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ focus?: string }>;
};

/** Legacy route — profile editing lives on `/me`. */
export default async function MeEditPage({ searchParams }: Props) {
  const params = await searchParams;
  const qs = params.focus
    ? `?focus=${encodeURIComponent(params.focus)}`
    : "";
  redirect(`/me${qs}`);
}
