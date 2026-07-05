import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ModeratorProfile = {
  id: string;
  organization: string;
  gov_email: string;
  community: string;
  proof_url: string | null;
  verified: boolean;
};

// Small hook: is the current user a moderator? Are they verified?
export function useModeratorStatus() {
  const [loading, setLoading] = useState(true);
  const [isModerator, setIsModerator] = useState(false);
  const [profile, setProfile] = useState<ModeratorProfile | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) { if (alive) setLoading(false); return; }
      const [{ data: roles }, { data: prof }] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("user_roles" as any) as any).select("role").eq("user_id", uid),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("moderator_profiles" as any) as any).select("*").eq("id", uid).maybeSingle(),
      ]);
      if (!alive) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setIsModerator(Boolean((roles as any[] | null)?.some((r) => r.role === "moderator")));
      setProfile((prof as ModeratorProfile | null) ?? null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  return { loading, isModerator, profile, isVerified: !!profile?.verified };
}

// Fetch a user's moderator profile (used to badge issue actions).
export async function fetchModeratorProfile(userId: string): Promise<ModeratorProfile | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("moderator_profiles" as any) as any)
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return (data as ModeratorProfile | null) ?? null;
}