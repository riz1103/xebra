/**
 * Turns study material (photos, PDFs, slide decks, Word files, pasted text) into
 * a uniform list of pages. Pages carry text when it can be read locally, or a
 * downscaled image when the content needs AI transcription (photos, scanned pages).
 */

export type SourceKind = "image" | "pdf" | "pptx" | "docx" | "text";

export interface SourceImage {
  mimeType: string;
  /** Base64 without the data URL prefix */
  data: string;
}

export interface SourcePage {
  /** Human-readable reference used in prompts and source citations, e.g. "Slide 4" */
  label: string;
  /** 1-based page number inside the original PDF, used to open the file at this page */
  page?: number;
  text?: string;
  images?: SourceImage[];
}

export interface ExtractedSource {
  id: string;
  name: string;
  kind: SourceKind;
  pages: SourcePage[];
  warnings: string[];
  /** Original upload, kept so it can be stored and linked from the questions that cite it */
  file?: File;
}

export const SOURCE_ACCEPT =
  "image/*,.pdf,.pptx,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";

const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.85;
/** Pages with less extractable text than this are treated as scanned and rendered as images */
const MIN_PAGE_TEXT_CHARS = 40;
const MAX_RENDERED_PDF_PAGES = 60;
const MAX_IMAGES_PER_SLIDE = 2;
const SLIDE_TEXT_IMAGE_THRESHOLD = 120;

function genSourceId() {
  return `src_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function detectSourceKind(file: File): SourceKind | null {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif|bmp)$/.test(name)) return "image";
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (name.endsWith(".pptx")) return "pptx";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) return "text";
  return null;
}

// ============ Images ============

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(blob);
  });
}

function canvasToImage(canvas: HTMLCanvasElement): SourceImage {
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return { mimeType: "image/jpeg", data: dataUrl.slice(dataUrl.indexOf(",") + 1) };
}

/**
 * Downscales an image so its longest edge is at most MAX_IMAGE_EDGE and re-encodes it as JPEG.
 * Falls back to the original bytes for formats the browser cannot decode (e.g. HEIC outside Safari),
 * which Gemini can still read directly.
 */
export async function prepareImage(blob: Blob, fallbackMimeType = "image/jpeg"): Promise<SourceImage> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvasToImage(canvas);
  } catch {
    return { mimeType: blob.type || fallbackMimeType, data: await blobToBase64(blob) };
  }
}

// ============ PDF ============

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadPdf(file: File): Promise<any> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  const arrayBuffer = await file.arrayBuffer();
  return pdfjsLib.getDocument({ data: arrayBuffer }).promise;
}

/** Reads a PDF page's text, keeping the line breaks pdf.js reports via `hasEOL`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readPdfPageText(page: any): Promise<string> {
  const content = await page.getTextContent();
  let text = "";
  for (const item of content.items) {
    if (!("str" in item)) continue;
    text += String(item.str);
    text += item.hasEOL ? "\n" : " ";
  }
  return text
    .replace(/ +\n/g, "\n")
    .replace(/ {2,}/g, " ")
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function renderPdfPage(page: any): Promise<SourceImage> {
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(3, MAX_IMAGE_EDGE / Math.max(baseViewport.width, baseViewport.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  return canvasToImage(canvas);
}

/** Plain text of a whole PDF with line breaks preserved (used by the exam importer). */
export async function extractPdfText(file: File): Promise<string> {
  const pdf = await loadPdf(file);
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    parts.push(await readPdfPageText(await pdf.getPage(i)));
  }
  return parts.join("\n");
}

async function extractPdf(file: File, warnings: string[]): Promise<SourcePage[]> {
  const pdf = await loadPdf(file);
  const pages: SourcePage[] = [];
  let rendered = 0;
  let skipped = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const text = await readPdfPageText(page);
    const label = `Page ${i}`;
    if (text.replace(/\s/g, "").length >= MIN_PAGE_TEXT_CHARS) {
      pages.push({ label, page: i, text });
      continue;
    }
    if (rendered >= MAX_RENDERED_PDF_PAGES) {
      skipped++;
      continue;
    }
    pages.push({ label, page: i, text: text || undefined, images: [await renderPdfPage(page)] });
    rendered++;
  }
  if (skipped > 0) {
    warnings.push(
      `${skipped} scanned page(s) were skipped (limit is ${MAX_RENDERED_PDF_PAGES} scanned pages per PDF). Split the file to include them.`
    );
  }
  return pages;
}

// ============ PowerPoint (.pptx) ============

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, "application/xml");
}

/** Collects slide/notes text paragraph by paragraph from DrawingML (<a:p>/<a:t>). */
function drawingMlText(doc: Document): string {
  const paragraphs = Array.from(doc.getElementsByTagName("a:p"));
  return paragraphs
    .map((p) =>
      Array.from(p.getElementsByTagName("a:t"))
        .filter((t) => t.parentElement?.parentElement?.tagName !== "a:fld")
        .map((t) => t.textContent ?? "")
        .join("")
        .trim()
    )
    .filter(Boolean)
    .join("\n");
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

async function extractPptx(file: File, warnings: string[]): Promise<SourcePage[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));

  const pages: SourcePage[] = [];
  let unsupportedImages = 0;

  for (let i = 0; i < slidePaths.length; i++) {
    const slidePath = slidePaths[i];
    const slideXml = await zip.file(slidePath)!.async("string");
    const slideText = drawingMlText(parseXml(slideXml));

    const relsPath = slidePath.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels");
    const relsXml = await zip.file(relsPath)?.async("string");
    let notesText = "";
    const imagePaths: string[] = [];
    if (relsXml) {
      const rels = Array.from(parseXml(relsXml).getElementsByTagName("Relationship"));
      for (const rel of rels) {
        const type = rel.getAttribute("Type") ?? "";
        const target = rel.getAttribute("Target") ?? "";
        if (type.endsWith("/notesSlide")) {
          const notesXml = await zip.file(resolveZipPath("ppt/slides", target))?.async("string");
          if (notesXml) notesText = drawingMlText(parseXml(notesXml));
        } else if (type.endsWith("/image")) {
          imagePaths.push(resolveZipPath("ppt/slides", target));
        }
      }
    }

    const images: SourceImage[] = [];
    if (slideText.length < SLIDE_TEXT_IMAGE_THRESHOLD) {
      for (const path of imagePaths) {
        if (images.length >= MAX_IMAGES_PER_SLIDE) break;
        if (!/\.(png|jpe?g|gif|webp|bmp)$/i.test(path)) {
          unsupportedImages++;
          continue;
        }
        const blob = await zip.file(path)?.async("blob");
        if (blob) images.push(await prepareImage(blob));
      }
    }

    const text = [slideText, notesText && `Speaker notes:\n${notesText}`].filter(Boolean).join("\n\n");
    if (!text && images.length === 0) continue;
    pages.push({
      label: `Slide ${i + 1}`,
      text: text || undefined,
      images: images.length > 0 ? images : undefined,
    });
  }

  if (unsupportedImages > 0) {
    warnings.push(`${unsupportedImages} slide image(s) in vector formats (EMF/WMF) could not be read.`);
  }
  return pages;
}

// ============ Word (.docx) ============

async function extractDocx(file: File): Promise<SourcePage[]> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return splitTextIntoPages(result.value, "Section");
}

// ============ Plain text ============

const TEXT_PAGE_CHARS = 6000;

/** Splits long text into labelled chunks at paragraph boundaries so topics can cite where they came from. */
export function splitTextIntoPages(text: string, labelPrefix: string): SourcePage[] {
  const paragraphs = text.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  const pages: SourcePage[] = [];
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

export function sourceFromText(text: string, name = "Pasted text"): ExtractedSource {
  return { id: genSourceId(), name, kind: "text", pages: splitTextIntoPages(text, "Part"), warnings: [] };
}

// ============ Entry point ============

export async function extractSource(file: File): Promise<ExtractedSource> {
  const kind = detectSourceKind(file);
  if (!kind) {
    if (/\.(ppt|doc)$/i.test(file.name)) {
      throw new Error(`${file.name}: legacy Office formats aren't supported. Save it as .pptx or .docx first.`);
    }
    throw new Error(`${file.name}: unsupported file type.`);
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(`${file.name} is larger than ${MAX_SOURCE_BYTES / 1024 / 1024}MB.`);
  }

  const warnings: string[] = [];
  let pages: SourcePage[];
  switch (kind) {
    case "image":
      pages = [{ label: "Photo", images: [await prepareImage(file)] }];
      break;
    case "pdf":
      pages = await extractPdf(file, warnings);
      break;
    case "pptx":
      pages = await extractPptx(file, warnings);
      break;
    case "docx":
      pages = await extractDocx(file);
      break;
    case "text":
      pages = splitTextIntoPages(await file.text(), "Part");
      break;
  }

  if (pages.length === 0) throw new Error(`${file.name}: no readable content was found.`);
  return { id: genSourceId(), name: file.name, kind, pages, warnings, file };
}

export function sourceNeedsTranscription(source: ExtractedSource): boolean {
  return source.pages.some((p) => p.images && p.images.length > 0);
}
