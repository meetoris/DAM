import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

/**
 * Turn an uploaded file into plain text for the scriptwriter.
 * Supports PDF, DOCX, and anything text-based (txt, md, csv, html, json…).
 */
export async function fileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }

  if (
    name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }

  return file.text();
}
