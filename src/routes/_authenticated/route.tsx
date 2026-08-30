import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { waitForFirebaseUser } from "@/integrations/firebase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const user = await waitForFirebaseUser();
    if (!user) throw redirect({ to: "/auth", search: { role: "neighbor" } });

    if (!user.emailVerified) {
      throw redirect({ to: "/verify-email" });
    }

    const intent = typeof window !== "undefined" ? window.localStorage.getItem("bb.signup_role") : null;
    if (intent === "moderator" && !location.pathname.startsWith("/moderator/apply")) {
      throw redirect({ to: "/moderator/apply" });
    }

    return { user };
  },
  component: () => <Outlet />,
});
