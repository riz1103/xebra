import { NextResponse } from "next/server";
import { buildExamImportTemplateDocx } from "@/lib/exam-import-template";

export const dynamic = "force-dynamic";

/**
 * GET /api/template/exam
 * Returns a Word (.docx) template for proctors to use when preparing exams for import.
 */
export async function GET() {
  try {
    const buffer = await buildExamImportTemplateDocx();
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="XEVRA-Exam-Import-Template.docx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Failed to build exam import template:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate template",
      },
      { status: 500 }
    );
  }
}
