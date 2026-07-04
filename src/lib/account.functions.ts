import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Permanently deletes the signed-in user's account.
// Uses the admin client server-side so RLS/auth-tenant restrictions don't
// block the deletion. Related rows (issues, votes, profile) cascade via FK.
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Best-effort clean-up of app rows the user directly owns.
    await supabaseAdmin.from("issue_votes").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("issues").delete().eq("reporter_id", context.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", context.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });