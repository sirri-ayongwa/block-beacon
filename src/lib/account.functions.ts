import { createServerFn } from "@tanstack/react-start";

export const deleteMyAccount = createServerFn({ method: "POST" }).handler(async () => {
  throw new Error("Server-side account deletion requires Firebase Admin credentials. Sign out and delete the Firebase user from the client instead.");
});
