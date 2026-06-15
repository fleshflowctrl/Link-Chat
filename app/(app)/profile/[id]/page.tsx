import { notFound } from "next/navigation";
import { ProfileDetailView } from "@/components/profile/profile-detail-view";
import { getViewerIsPermanentServer } from "@/lib/auth/viewer-server";
import { fetchCatalogProfileByIdServer } from "@/lib/catalog/server-catalog";

type Props = { params: { id: string } };

export default async function ProfilePage({ params }: Props) {
  const [profile, viewerIsPermanent] = await Promise.all([
    fetchCatalogProfileByIdServer(params.id),
    getViewerIsPermanentServer(),
  ]);
  if (!profile) notFound();
  return (
    <ProfileDetailView
      profile={profile}
      initialViewerIsPermanent={viewerIsPermanent}
    />
  );
}
