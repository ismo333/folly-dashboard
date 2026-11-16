import { currentProfile } from "@/lib/auth";
import { isAuthConfigured, isDatabaseConfigured } from "@/lib/config";
import { getShows } from "@/lib/shows";
import { AuthScreen } from "@/components/auth-screen";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const loginToken = typeof query.login === "string" ? query.login : "";
  const profile = await currentProfile();

  if (loginToken) {
    return <AuthScreen initialLoginToken={loginToken} />;
  }

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
