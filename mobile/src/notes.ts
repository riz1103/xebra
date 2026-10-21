import { File } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import JSZip from "jszip";

export interface NoteImage {
  mimeType: string;
  data: string;
}

export interface NotePage {
  label: string;
  text?: string;
  images?: NoteImage[];
  file?: NoteImage;
}

export interface NoteSource {
  id: string;
  name: string;
  pages: NotePage[];
  warnings: string[];
}

const MAX_BYTES = 20 * 1024 * 1024;
const TEXT_PAGE_CHARS = 6000;

function sourceId() {
  return `src_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function splitTextIntoPages(text: string, labelPrefix: string): NotePage[] {
  const paragraphs = text.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  const pages: NotePage[] = [];
  let current = "";
  for (const para of paragraphs) {
    if (current && current.length + para.length > TEXT_PAGE_CHARS) {
      pages.push({ label: `${labelPrefix} ${pages.length + 1}`, text: current.trim() });
      current = "";
    }
    current += `${para}\n\n`;
  }
  if (current.trim()) pages.push({ label: `${labelPrefix} ${pages.length + 1}`, text: current.trim() });
  return pages;
}

export function sourceFromText(text: string, name: string): NoteSource {
  return { id: sourceId(), name, pages: splitTextIntoPages(text, "Part"), warnings: [] };
}

async function readBase64(uri: string): Promise<string> {
  const data = await new File(uri).base64();
  return data.replace(/\s/g, "");
}

async function readText(uri: string): Promise<string> {
  return new File(uri).text();
}

function xmlText(xml: string, tag: string): string {
  return [...xml.matchAll(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "g"))].map((match) => decodeXml(match[1])).join("");
}

async function extractDocx(uri: string): Promise<NotePage[]> {
  const zip = await JSZip.loadAsync(await readBase64(uri), { base64: true });
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return [];
  const text = xml
    .split(/<\/w:p>/)
    .map((paragraph) => xmlText(paragraph, "w:t").trim())
    .filter(Boolean)
    .join("\n");
  return splitTextIntoPages(text, "Section");
}

function resolveZipPath(baseDir: string, target: string): string {
  const parts = `${baseDir}/${target}`.split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") out.pop();
    else if (part && part !== ".") out.push(part);
  }
  return out.join("/");
}

async function extractPptx(uri: string): Promise<{ pages: NotePage[]; warnings: string[] }> {
  const zip = await JSZip.loadAsync(await readBase64(uri), { base64: true });
  const slides = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)?.[1]) - Number(b.match(/(\d+)\.xml$/)?.[1]));
  const pages: NotePage[] = [];
  let unsupportedImages = 0;
  for (let i = 0; i < slides.length; i++) {
    const slidePath = slides[i];
    const xml = await zip.file(slidePath)?.async("string");
    const text = xml
      ? xml
          .split(/<\/a:p>/)
          .map((paragraph) => xmlText(paragraph, "a:t").trim())
          .filter(Boolean)
          .join("\n")
      : "";
    const images: NoteImage[] = [];
    if (text.length < 120) {
      const relsPath = slidePath.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels");
      const rels = (await zip.file(relsPath)?.async("string")) ?? "";
      for (const match of rels.matchAll(/Type="[^"]*\/image"\s+Target="([^"]+)"/g)) {
        if (images.length >= 2) break;
        const path = resolveZipPath("ppt/slides", match[1]);
        const ext = path.toLowerCase();
        const mime = ext.endsWith(".png") ? "image/png" : ext.endsWith(".gif") ? "image/gif" : ext.endsWith(".webp") ? "image/webp" : /\.jpe?g$/.test(ext) ? "image/jpeg" : "";
        if (!mime) {
          unsupportedImages += 1;
          continue;
        }
        const data = await zip.file(path)?.async("base64");
        if (data) images.push({ mimeType: mime, data: data.replace(/\s/g, "") });
      }
    }
    if (!text && images.length === 0) continue;
    pages.push({ label: `Slide ${i + 1}`, text: text || undefined, images: images.length ? images : undefined });
  }
  const warnings = unsupportedImages > 0 ? [`${unsupportedImages} slide image(s) in vector formats (EMF/WMF) could not be read.`] : [];
  return { pages, warnings };
}

function kindOf(name: string, mime: string | undefined): "image" | "pdf" | "pptx" | "docx" | "text" | "legacy" | null {
  const lower = name.toLowerCase();
  if (mime?.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif|bmp)$/.test(lower)) return "image";
  if (lower.endsWith(".pdf") || mime === "application/pdf") return "pdf";
  if (lower.endsWith(".pptx")) return "pptx";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".txt") || lower.endsWith(".md") || mime?.startsWith("text/")) return "text";
  if (/\.(ppt|doc)$/.test(lower)) return "legacy";
  return null;
}

async function sourceFromFile(uri: string, name: string, mime: string | undefined, size: number | undefined): Promise<NoteSource> {
  const kind = kindOf(name, mime);
  if (kind === "legacy") throw new Error(`${name}: legacy Office formats aren't supported. Save it as .pptx or .docx first.`);
  if (!kind) throw new Error(`${name}: unsupported file type.`);
  if (size && size > MAX_BYTES) throw new Error(`${name} is larger than ${MAX_BYTES / 1024 / 1024}MB.`);

  let pages: NotePage[];
  let warnings: string[] = [];
  if (kind === "image") pages = [{ label: "Photo", images: [{ mimeType: mime?.startsWith("image/") ? mime : "image/jpeg", data: await readBase64(uri) }] }];
  else if (kind === "pdf") pages = [{ label: "PDF", file: { mimeType: "application/pdf", data: await readBase64(uri) } }];
  else if (kind === "docx") pages = await extractDocx(uri);
  else if (kind === "pptx") {
    const extracted = await extractPptx(uri);
    pages = extracted.pages;
    warnings = extracted.warnings;
  } else pages = splitTextIntoPages(await readText(uri), "Part");

  if (pages.length === 0) throw new Error(`${name}: no readable content was found.`);
  return { id: sourceId(), name, pages, warnings };
}

export async function pickNotePhotos(): Promise<NoteSource[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    quality: 0.7,
    base64: true,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => {
    const data = (asset.base64 ?? "").replace(/\s/g, "");
    if (!data) throw new Error(`${asset.fileName || "Photo"}: no readable content was found.`);
    return {
      id: sourceId(),
      name: asset.fileName || "Photo",
      pages: [{ label: "Photo", images: [{ mimeType: asset.mimeType || "image/jpeg", data }] }],
      warnings: [],
    };
  });
}

export async function pickNoteFiles(): Promise<NoteSource[]> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: [
      "image/*",
      "text/plain",
      "text/markdown",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
  });
  if (result.canceled) return [];
  const sources: NoteSource[] = [];
  for (const asset of result.assets) {
    sources.push(await sourceFromFile(asset.uri, asset.name, asset.mimeType, asset.size));
  }
  return sources;
}
