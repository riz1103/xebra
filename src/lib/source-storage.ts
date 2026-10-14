import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { app, auth } from "@/lib/firebase";
import type { GeneratedQuestion, ProgressCallback } from "@/lib/exam-generator";
import type { ExtractedSource } from "@/lib/source-extract";

const UPLOAD_RETRY_MS = 30_000;

/** Stores an original material file under the signed-in proctor's folder and returns its download URL. */
async function uploadSourceFile(file: File): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in");
  const storage = getStorage(app);
  storage.maxUploadRetryTime = UPLOAD_RETRY_MS;
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
  const fileRef = ref(storage, `exam-sources/${uid}/${Date.now()}_${safeName}`);
  await uploadBytes(fileRef, file, file.type ? { contentType: file.type } : undefined);
  return getDownloadURL(fileRef);
}

/**
 * Uploads the original files cited by the questions and sets each question's sourceUrl.
 * `uploaded` caches URLs by source ID so retrying a failed save doesn't upload again.
 * Failed uploads only produce a warning; those questions keep their text excerpt.
 */
export async function attachSourceUrls(
  questions: GeneratedQuestion[],
  sources: ExtractedSource[],
  uploaded: Map<string, string>,
  onProgress?: ProgressCallback
): Promise<{ questions: GeneratedQuestion[]; warnings: string[] }> {
  const cited = sources.filter((s) => s.file && !uploaded.has(s.id) && questions.some((q) => q.sourceId === s.id));
  let failed = 0;
  for (let i = 0; i < cited.length; i++) {
    onProgress?.(i, cited.length, "Uploading source files…");
    try {
      uploaded.set(cited[i].id, await uploadSourceFile(cited[i].file!));
    } catch (err) {
      console.error(`Uploading source ${cited[i].name} failed:`, err);
      failed++;
    }
  }
  const warnings =
    failed > 0
      ? [`${failed} source file(s) couldn't be uploaded, so their questions only show the text the AI read.`]
      : [];
  return {
    questions: questions.map((q) => {
      const url = q.sourceId ? uploaded.get(q.sourceId) : undefined;
      if (!url) return q;
      return { ...q, sourceUrl: q.sourcePage ? `${url}#page=${q.sourcePage}` : url };
    }),
    warnings,
  };
}
