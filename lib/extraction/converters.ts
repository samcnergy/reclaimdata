/**
 * Turns raw upload bytes into content blocks Claude can read.
 *
 * Strategy:
 * - PDFs and images → sent as native document/image blocks (Claude reads
 *   them directly with vision).
 * - Word (.docx) → extract plain text via mammoth, send as text block.
 * - Excel / CSV → convert to CSV text via xlsx, send as text block.
 * - Plain text / markdown → passthrough as text block.
 *
 * Legacy .doc (Word 97-2003 binary) is NOT supported — surface a clear
 * error up to the caller; most users can save-as .docx.
 */

import type Anthropic from "@anthropic-ai/sdk";

export type ConverterResult = {
  block: Anthropic.ContentBlockParam;
  notes?: string;
};

const PREVIEW_HEADER = (filename: string) =>
  `Below is the complete extracted contents of ${filename}.`;

export async function toClaudeContent(args: {
  mimeType: string;
  filename: string;
  bytes: Buffer;
}): Promise<ConverterResult | null> {
  const { mimeType, filename, bytes } = args;

  if (mimeType === "application/pdf") {
    return {
      block: {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: bytes.toString("base64"),
        },
      },
    };
  }

  if (mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/webp") {
    return {
      block: {
        type: "image",
        source: { type: "base64", media_type: mimeType, data: bytes.toString("base64") },
      },
    };
  }

  if (mimeType === "image/gif") {
    return {
      block: {
        type: "image",
        source: { type: "base64", media_type: "image/gif", data: bytes.toString("base64") },
      },
    };
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const { default: mammoth } = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: bytes });
    return {
      block: {
        type: "text",
        text: `${PREVIEW_HEADER(filename)}\n\n${value.trim()}`,
      },
      notes: "Converted from .docx via mammoth (raw text).",
    };
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "text/csv"
  ) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(bytes, { type: "buffer" });
    const sheetTexts: string[] = [];
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
      sheetTexts.push(`## Sheet: ${name}\n${csv.trim()}`);
    }
    return {
      block: {
        type: "text",
        text: `${PREVIEW_HEADER(filename)}\n\n${sheetTexts.join("\n\n")}`,
      },
      notes: `Converted from ${mimeType} via xlsx (${wb.SheetNames.length} sheet(s)).`,
    };
  }

  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return {
      block: {
        type: "text",
        text: `${PREVIEW_HEADER(filename)}\n\n${bytes.toString("utf8").trim()}`,
      },
    };
  }

  if (mimeType === "application/msword") {
    throw new Error(
      "Legacy .doc files are not supported. Please save as .docx and re-upload.",
    );
  }

  return null;
}
