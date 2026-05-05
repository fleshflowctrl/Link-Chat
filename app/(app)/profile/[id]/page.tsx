import { notFound } from "next/navigation";
import { ProfileDetailView } from "@/components/profile/profile-detail-view";
import { fetchCatalogProfileByIdServer } from "@/lib/catalog/server-catalog";

type Props = { params: { id: string } };

export default async function ProfilePage({ params }: Props) {
  const profile = await fetchCatalogProfileByIdServer(params.id);
  if (!profile) notFound();
  return <ProfileDetailView profile={profile} />;
}
