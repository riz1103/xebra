"use client";

import { use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { BadgeCheck, ShieldAlert, ShieldX } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed py-2 last:border-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{value}</dd>
    </div>
  );
}

export default function VerifyCertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { data, isLoading, error } = useQuery({
    queryKey: ["verify-certificate", code],
    queryFn: () => api.verifyCertificate(code),
    retry: false,
  });
  const certificate = data?.data;
  const notFound = axios.isAxiosError(error) && error.response?.status === 404;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-4">
        <Link href="/" className="flex items-center justify-center gap-2">
          <Image src="/xevra-logo.png" alt="Xevra" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-bold tracking-tight">XEVRA</span>
        </Link>
        <Card>
          <CardContent className="space-y-4 py-6">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="mx-auto h-12 w-12 rounded-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : certificate ? (
              <>
                <div className="flex flex-col items-center gap-2 text-center">
                  {certificate.valid ? (
                    <BadgeCheck className="h-12 w-12 text-emerald-600" />
                  ) : (
                    <ShieldAlert className="h-12 w-12 text-amber-600" />
                  )}
                  <h1 className="text-xl font-bold">{certificate.valid ? "Valid certificate" : "Certificate no longer valid"}</h1>
                  {!certificate.valid && certificate.reason && (
                    <p className="text-sm text-muted-foreground">{certificate.reason}</p>
                  )}
                </div>
                <dl className="text-sm">
                  <Row label="Awarded to" value={certificate.examineeName || "—"} />
                  <Row label="Exam" value={certificate.examTitle || "—"} />
                  {certificate.percentage != null && <Row label="Score" value={`${certificate.percentage}%`} />}
                  {certificate.completedAt && <Row label="Completed" value={formatDate(certificate.completedAt)} />}
                  {certificate.issuerName && <Row label="Issued by" value={certificate.issuerName} />}
                  {certificate.issuedAt && <Row label="Issued" value={formatDate(certificate.issuedAt)} />}
                  <Row label="Certificate ID" value={<span className="font-mono">{certificate.code}</span>} />
                </dl>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <ShieldX className="h-12 w-12 text-red-600" />
                <h1 className="text-xl font-bold">{notFound ? "Certificate not found" : "Could not verify"}</h1>
                <p className="text-sm text-muted-foreground">
                  {notFound
                    ? `No certificate matches the ID "${code}". Check the ID printed on the certificate.`
                    : "The verification service could not be reached. Please try again later."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
