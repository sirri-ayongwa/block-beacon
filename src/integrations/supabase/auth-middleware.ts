import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { supabase } from "./client";

function decodeJwtPayload(token: string) {
  const payload = token.split(".")[1];
  if (!payload) return null;
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const json = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return JSON.parse(json) as { sub?: string; user_id?: string; [key: string]: unknown };
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Unauthorized: No Firebase ID token provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const claims = decodeJwtPayload(token);
    const userId = claims?.sub ?? claims?.user_id;
    if (!userId) throw new Error("Unauthorized: Invalid Firebase ID token");

    return next({
      context: {
        supabase,
        userId,
        claims,
      },
    });
  },
);
