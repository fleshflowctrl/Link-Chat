import { EditProfileView } from "@/components/me/edit-profile-view";
import { fetchUserEditProfileServer } from "@/lib/me/server-profile";

export default async function MeEditPage() {
  const { profile, syncToken } = await fetchUserEditProfileServer();
  return (
    <EditProfileView initialProfile={profile} syncToken={syncToken} />
  );
}
