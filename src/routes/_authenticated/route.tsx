import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Resume moderator onboarding: if the user signed up choosing "moderator"
    // and hasn't finished the verification form yet, always send them back to
    // /moderator/apply — even after a logout / re-login. Cleared once they
    // have a moderator_profiles row.
    try {
      // Email verification gate — block app access until email is confirmed.
      if (!data.user.email_confirmed_at) {
        throw redirect({ to: "/verify-email" });
      }
      const intent = typeof window !== "undefined" ? window.localStorage.getItem("bb.signup_role") : null;
      if (intent === "moderator" && !location.pathname.startsWith("/moderator/apply")) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: prof } = await (supabase.from("moderator_profiles" as any) as any)
          .select("id").eq("id", data.user.id).maybeSingle();
        if (!prof) {
          throw redirect({ to: "/moderator/apply" });
        } else {
          // Onboarding complete — clear the flag so future logins don't loop.
          window.localStorage.removeItem("bb.signup_role");
        }
      }
    } catch (e) {
      // Re-throw redirects; swallow other errors (e.g. offline) to avoid blocking the app.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (e && typeof e === "object" && (e as any).isRedirect) throw e;
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});