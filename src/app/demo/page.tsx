import {
  ResultsExplorer,
  type SessionDocumentView,
} from "@/components/results-explorer";
import { ProductShell } from "@/components/product-shell";
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
    <ProductShell
      active="documents"
      documentsHref="/demo"
      exportBasePath="/api/demo"
      showSafetyNote
    >
      <ResultsExplorer
        documents={documents}
        displayTitle="Revisão documental"
        session={demo.session}
        exportBasePath="/api/demo"
      />
    </ProductShell>
  );
}
