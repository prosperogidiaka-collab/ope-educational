export const MAX_INLINE_ATTACHMENT_BYTES = 2 * 1024 * 1024;

export interface InlineAttachmentPayload {
  label: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

export async function buildInlineAttachmentPayload(file: File): Promise<InlineAttachmentPayload> {
  if (file.size > MAX_INLINE_ATTACHMENT_BYTES) {
    throw new Error("Attachment is too large. Keep files at or below 2 MB.");
  }

  const url = await readFileAsDataUrl(file);

  return {
    label: file.name,
    url,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };
}
