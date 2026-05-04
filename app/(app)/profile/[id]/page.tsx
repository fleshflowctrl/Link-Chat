import { notFound } from "next/navigation";
import { ProfileDetailView } from "@/components/profile/profile-detail-view";
import { getProfileById } from "@/data/profiles";

type Props = { params: { id: string } };

export default function ProfilePage({ params }: Props) {
  const profile = getProfileById(params.id);
  if (!profile) notFound();
  return <ProfileDetailView profile={profile} />;
}
