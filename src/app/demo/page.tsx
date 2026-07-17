import Link from "next/link";

import {
  ResultsExplorer,
  type SessionDocumentView,
} from "@/components/results-explorer";
import { buildSyntheticDemoData } from "@/lib/demo/synthetic-dataset";

export const dynamic = "force-static";

export default function DemoPage() {
  const demo = buildSyntheticDemoData();
  const documents: SessionDocumentView[] = demo.records.map((record, index) => ({
    id: `demo-${String(index + 1).padStart(3, "0")}`,
    fileName: record.document.fileName,
    parseStatus: record.document.status,
    encoding: record.document.encoding,
    documentType: record.document.normalized.documentType ?? "",
    documentNumber: record.document.normalized.documentNumber ?? "",
    serviceDescription: record.document.normalized.serviceDescription ?? "",
    supplierName: record.document.normalized.supplierName ?? "",
    supplierCnpj: record.document.normalized.supplierCnpjNormalized ?? "",
    grossAmount: record.document.normalized.grossAmount,
    issueDateIso: record.document.normalized.issueDateIso,
    paymentDateIso: record.document.normalized.paymentDateIso,
    invoiceIssueDateIso: record.document.normalized.invoiceIssueDateIso,
    approvedBy: record.document.normalized.approvedBy,
    destinationBank: record.document.normalized.destinationBank,
    status: record.document.normalized.status,
    verificationHash: record.document.normalized.verificationHash,
    extractionMethod: record.extractionMethod,
    modelId: record.modelId,
    promptVersion: record.promptVersion,
    processedAt: record.processedAt,
    notExtractedFields: record.document.notExtractedFields,
    fieldSources: record.document.fieldSources,
    anomalies: record.anomalies,
  }));

  return (
    <main className="forensic-shell mx-auto min-h-screen w-full max-w-[1440px] px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <section className="surface-panel mb-4 rounded-[10px] px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-kicker">Demonstração sintética · somente leitura</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
              Este caso usa dados fictícios gerados pelo próprio projeto. Ele demonstra apoio à
              revisão humana e não representa parecer, decisão ou evidência de auditoria real.
            </p>
          </div>
          <Link className="action-secondary rounded-[4px] px-4 py-2.5 text-sm font-semibold" href="/">
            Voltar ao início
          </Link>
        </div>
      </section>

      <ResultsExplorer
        documents={documents}
        displayTitle="Caso sintético"
        session={demo.session}
        exportBasePath="/api/demo"
      />
    </main>
  );
}
