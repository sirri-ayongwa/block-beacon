import { createFileRoute } from "@tanstack/react-router";
import { UTApi } from "uploadthing/server";

const MAX_BYTES = 3 * 1024 * 1024;

function getServerEnv(name: string) {
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

export const Route = createFileRoute("/api/public/upload-photo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = getServerEnv("UPLOADTHING_TOKEN");
        if (!token) {
          return Response.json({ error: "Photo upload is not configured" }, { status: 500 });
        }

        const form = await request.formData();
        const file = form.get("file");
        const userId = String(form.get("userId") || "");

        if (!userId) {
          return Response.json({ error: "Missing user" }, { status: 400 });
        }
        if (!(file instanceof Blob)) {
          return Response.json({ error: "Missing photo" }, { status: 400 });
        }
        if (!file.type.startsWith("image/")) {
          return Response.json({ error: "Photos must be images" }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
          return Response.json({ error: "Photo must be 3 MB or smaller" }, { status: 400 });
        }

        const uploadFile = new File(
          [file],
          `${userId}-${crypto.randomUUID()}.webp`,
          { type: file.type || "image/webp" },
        );
        const [result] = await new UTApi({ token }).uploadFiles([uploadFile]);

        if (result.error || !result.data?.url) {
          return Response.json(
            { error: result.error?.message || "Photo upload failed" },
            { status: 502 },
          );
        }

        return Response.json({
          url: result.data.url,
          key: result.data.key,
        });
      },
    },
  },
});
