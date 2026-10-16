"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { ArrowLeft, Printer } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

export default function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["certificate", id],
    queryFn: () => api.issueCertificate(id),
    retry: false,
    staleTime: Infinity,
  });
  const certificate = data?.data;
  const verifyUrl = certificate && typeof window !== "undefined" ? `${window.location.origin}/verify/${certificate.code}` : null;

  useEffect(() => {
    if (!verifyUrl) return;
    let cancelled = false;
    QRCode.toDataURL(verifyUrl, { margin: 1, width: 240, errorCorrectionLevel: "M" })
      .then((url) => !cancelled && setQrDataUrl(url))
      .catch(() => !cancelled && setQrDataUrl(null));
    return () => {
      cancelled = true;
    };
  }, [verifyUrl]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="aspect-[1.414] w-full" />
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg font-medium">Certificate unavailable</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {apiErrorMessage(error, "A certificate could not be issued for this result.")}
        </p>
        <Button asChild className="mt-4">
          <Link href={`/dashboard/my-results/${id}`}>Back to result</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <style>{`@media print { @page { size: A4 landscape; margin: 12mm; } }`}</style>
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/my-results/${id}`}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print or save as PDF
        </Button>
      </div>

      <article className="relative flex aspect-[1.414] w-full flex-col items-center justify-between overflow-hidden rounded-lg border-[6px] border-double border-amber-600/70 bg-white p-6 text-center text-neutral-900 shadow-sm sm:p-10 print:rounded-none print:shadow-none">
        <header className="flex flex-col items-center gap-2">
          <Image src="/xevra-logo.png" alt="Xevra" width={44} height={44} className="rounded-lg" />
          <p className="text-xs font-semibold tracking-[0.3em] text-neutral-500">XEVRA</p>
          <h1 className="font-serif text-2xl font-bold tracking-wide sm:text-4xl">Certificate of Achievement</h1>
        </header>

        <section className="flex flex-col items-center gap-2 sm:gap-3">
          <p className="text-xs text-neutral-500 sm:text-sm">This certifies that</p>
          <p className="break-words font-serif text-2xl font-semibold text-amber-800 sm:text-4xl">{certificate.examineeName}</p>
          <p className="text-xs text-neutral-500 sm:text-sm">has successfully passed</p>
          <p className="max-w-xl break-words text-lg font-semibold sm:text-2xl">{certificate.examTitle}</p>
          <p className="text-xs text-neutral-600 sm:text-sm">
            {certificate.percentage != null && <>with a score of <strong>{certificate.percentage}%</strong> </>}
            {certificate.completedAt && <>on {formatDate(certificate.completedAt)}</>}
          </p>
        </section>

        <footer className="flex w-full items-end justify-between gap-4 text-left text-[10px] text-neutral-500 sm:text-xs">
          <div className="space-y-0.5">
            {certificate.issuerName && (
              <p>
                Issued by <span className="font-medium text-neutral-800">{certificate.issuerName}</span>
              </p>
            )}
            {certificate.issuedAt && <p>Issued {formatDate(certificate.issuedAt)}</p>}
            <p>
              Certificate ID <span className="font-mono font-medium text-neutral-800">{certificate.code}</span>
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QR code to verify this certificate" className="h-16 w-16 sm:h-24 sm:w-24" />
            ) : (
              <div className="h-16 w-16 sm:h-24 sm:w-24" />
            )}
            <p className="max-w-[12rem] break-all text-center">{verifyUrl?.replace(/^https?:\/\//, "")}</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
