/**
 * Upload path conventions and constraints.
 *
 * Path layout: `{workspaceId}/{uploadId}-{sanitizedFilename}`
 *   - leading segment IS the workspaceId (enforced by bucket RLS)
 *   - uploadId prefix prevents collisions when users upload the same
 *     filename twice
 */

export const STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET ?? "reclaimdata-uploads";

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

// Accepted MIME types. The extraction pipeline classifies by content
// in later milestones; this gate is just a sanity check at upload time.
export const ACCEPTED_MIME_TYPES = new Set<string>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
  "image/tiff",
]);

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[\x00-\x1f<>:"/\\|?*]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(-200);
}

export function buildStoragePath(
  workspaceId: string,
  uploadId: string,
  filename: string,
): string {
  return `${workspaceId}/${uploadId}-${sanitizeFilename(filename)}`;
}
