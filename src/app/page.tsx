import { currentProfile } from "@/lib/auth";
import { isAuthConfigured, isDatabaseConfigured } from "@/lib/config";
import { getShows } from "@/lib/shows";
import { AuthScreen } from "@/components/auth-screen";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const profile = await currentProfile();

  if (isAuthConfigured && !profile) {
    return <AuthScreen />;
  }

  const shows = await getShows(profile);
  return (
    <Dashboard
      initialShows={shows}
      viewer={profile}
      setupMode={!isAuthConfigured || !isDatabaseConfigured}
    />
  );
}
