import { inngest } from "@/lib/inngest/client";

/**
 * Stub. Milestone 8 replaces the body with the real Claude extraction
 * pipeline (classify → OCR fallback → structured extraction → persist
 * to extraction_runs).
 *
 * For now the function just marks the upload as `completed` so we can
 * exercise the /api/uploads → Inngest → DB round-trip end-to-end.
 */
export const extractionFileProcess = inngest.createFunction(
  {
    id: "extraction-file-process",
    triggers: [{ event: "extraction.file.process" }],
  },
  async ({ event, step }) => {
    const { uploadId, workspaceId } = event.data as {
      uploadId: string;
      workspaceId: string;
    };

    await step.run("mark-processing", async () => {
      const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
      const admin = createSupabaseAdminClient();
      await admin
        .from("uploads")
        .update({ status: "processing" })
        .eq("id", uploadId)
        .eq("workspace_id", workspaceId);
    });

    await step.run("mark-completed-stub", async () => {
      const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
      const admin = createSupabaseAdminClient();
      await admin
        .from("uploads")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
        })
        .eq("id", uploadId)
        .eq("workspace_id", workspaceId);
    });

    return { uploadId, status: "completed (stub — real extraction lands in milestone 8)" };
  },
);
