import { analyzeDocuments, type AnomalyType } from "@/lib/documents/anomalies";
import type { ExportableDocumentRecord } from "@/lib/documents/exports";
import {
  parseUploadedDocument,
  type ParsedUploadedDocument,
} from "@/lib/documents/parser";

const DEMO_STARTED_AT = "2026-01-15T13:00:00.000Z";
const DEMO_FINISHED_AT = "2026-01-15T13:02:00.000Z";

interface SyntheticSupplier {
  name: string;
  cnpj: string;
  bank: string;
  baseAmount: number;
}

interface SyntheticDocumentSpec {
  fileName: string;
  documentNumber: string;
  supplier: SyntheticSupplier;
  grossAmount: number;
  issueDate: string;
  paymentDate: string;
  invoiceIssueDate: string;
  approvedBy: string;
  status: string;
  verificationHash: string;
  bank?: string;
  observation?: string;
  cnpj?: string;
  omitFields?: string[];
  invalidLines?: string[];
  expectedAnomalies?: AnomalyType[];
}

export interface SyntheticFixtureSet {
  historicalDocuments: ParsedUploadedDocument[];
  reviewDocuments: ParsedUploadedDocument[];
  expectedAnomaliesByFile: Map<string, AnomalyType[]>;
}

export interface SyntheticDemoData {
  session: {
    id: string;
    status: string;
    processedFiles: number;
    totalFiles: number;
    anomalyCount: number;
    startedAt: string;
    finishedAt: string;
  };
  records: ExportableDocumentRecord[];
  baselineCount: number;
}

const suppliers: SyntheticSupplier[] = [
  {
    name: "Aurora Tecnologia Fictícia",
    cnpj: "10000000000101",
    bank: "Banco Exemplo 001",
    baseAmount: 4200,
  },
  {
    name: "Horizonte Serviços Fictícios",
    cnpj: "20000000000102",
    bank: "Banco Exemplo 002",
    baseAmount: 6500,
  },
  {
    name: "Íris Consultoria Fictícia",
    cnpj: "30000000000103",
    bank: "Banco Exemplo 003",
    baseAmount: 8800,
  },
  {
    name: "Lume Operações Fictícias",
    cnpj: "40000000000104",
    bank: "Banco Exemplo 004",
    baseAmount: 11200,
  },
  {
    name: "Vértice Dados Fictícios",
    cnpj: "50000000000105",
    bank: "Banco Exemplo 005",
    baseAmount: 14500,
  },
];

const approvers = ["Aline Rocha", "Bruno Tavares", "Carla Nunes"];

export function buildSyntheticFixtureSet(): SyntheticFixtureSet {
  const baselineSpecs = buildBaselineSpecs();
  const reviewSpecs = buildReviewSpecs();

  return {
    historicalDocuments: baselineSpecs.map(parseSyntheticSpec),
    reviewDocuments: reviewSpecs.map(parseSyntheticSpec),
    expectedAnomaliesByFile: new Map(
      reviewSpecs.map((spec) => [spec.fileName, spec.expectedAnomalies ?? []]),
    ),
  };
}

export function buildSyntheticDemoData(): SyntheticDemoData {
  const fixtures = buildSyntheticFixtureSet();
  const analysis = analyzeDocuments({
    historicalDocuments: fixtures.historicalDocuments,
    currentDocuments: fixtures.reviewDocuments,
  });
  const anomaliesByFile = new Map(
    analysis.documents.map((item) => [item.fileName, item.anomalies]),
  );
  const records = fixtures.reviewDocuments.map((document, index) => ({
    document,
    anomalies: anomaliesByFile.get(document.fileName) ?? [],
    promptVersion: "document-extractor-v2",
    processedAt: new Date(Date.parse(DEMO_STARTED_AT) + index * 4_000).toISOString(),
    extractionMethod: "parser-only",
    modelId: "parser",
  }));
  const anomalyCount = records.reduce(
    (total, record) => total + record.anomalies.length,
    0,
  );

  return {
    session: {
      id: "demo-sintetica",
      status: "finalized",
      processedFiles: records.length,
      totalFiles: records.length,
      anomalyCount,
      startedAt: DEMO_STARTED_AT,
      finishedAt: DEMO_FINISHED_AT,
    },
    records,
    baselineCount: fixtures.historicalDocuments.length,
  };
}

function buildBaselineSpecs(): SyntheticDocumentSpec[] {
  return Array.from({ length: 40 }, (_, index) => {
    const supplier = suppliers[index % suppliers.length] ?? suppliers[0]!;
    const day = String((index % 20) + 1).padStart(2, "0");
    const sequence = String(index + 1).padStart(3, "0");

    return {
      fileName: `AUD_BASE_${sequence}.txt`,
      documentNumber: `NF-AUD-${sequence}`,
      supplier,
      grossAmount: supplier.baseAmount + ((index % 3) - 1) * 200,
      issueDate: `${day}/01/2025`,
      invoiceIssueDate: `${day}/01/2025`,
      paymentDate: `${String((index % 20) + 2).padStart(2, "0")}/01/2025`,
      approvedBy: approvers[index % approvers.length] ?? approvers[0]!,
      status: "PAGO",
      verificationHash: `AUD-B-${sequence}`,
    };
  });
}

function buildReviewSpecs(): SyntheticDocumentSpec[] {
  const [aurora, horizonte, iris, lume, vertice] = suppliers as [
    SyntheticSupplier,
    SyntheticSupplier,
    SyntheticSupplier,
    SyntheticSupplier,
    SyntheticSupplier,
  ];
  const common = {
    issueDate: "10/02/2025",
    invoiceIssueDate: "10/02/2025",
    paymentDate: "12/02/2025",
    approvedBy: "Aline Rocha",
    status: "PAGO",
  };

  return [
    reviewSpec(1, aurora, { ...common, grossAmount: 4200 }),
    reviewSpec(2, horizonte, { ...common, grossAmount: 6500 }),
    reviewSpec(3, iris, { ...common, grossAmount: 8800 }),
    reviewSpec(4, lume, { ...common, grossAmount: 11200 }),
    reviewSpec(5, vertice, { ...common, grossAmount: 14500 }),
    reviewSpec(6, aurora, {
      ...common,
      documentNumber: "NF-AUD-001",
      grossAmount: 4200,
      expectedAnomalies: ["DUPLICATE_DOCUMENT"],
    }),
    reviewSpec(7, horizonte, {
      ...common,
      grossAmount: 6500,
      cnpj: "99999999999999",
      expectedAnomalies: ["CNPJ_DIVERGENT"],
    }),
    reviewSpec(8, iris, {
      ...common,
      grossAmount: 8800,
      invoiceIssueDate: "20/02/2025",
      paymentDate: "12/02/2025",
      expectedAnomalies: ["INVOICE_AFTER_PAYMENT"],
    }),
    reviewSpec(9, lume, {
      ...common,
      grossAmount: 11200,
      approvedBy: "Pessoa Não Cadastrada",
      expectedAnomalies: ["APPROVER_UNRECOGNIZED"],
    }),
    reviewSpec(10, vertice, {
      ...common,
      grossAmount: 14500,
      status: "CANCELADO",
      expectedAnomalies: ["STATUS_INCONSISTENT"],
    }),
    reviewSpec(11, aurora, {
      ...common,
      grossAmount: 4200,
      status: "EM_ANALISE",
      expectedAnomalies: ["FILE_UNPROCESSABLE", "STATUS_MALFORMED"],
    }),
    reviewSpec(12, horizonte, {
      ...common,
      grossAmount: 6500,
      verificationHash: "HASH-INVALIDO",
      expectedAnomalies: ["FILE_UNPROCESSABLE", "HASH_MALFORMED"],
    }),
    reviewSpec(13, iris, {
      ...common,
      fileName: "AUD_REVIEW_013_v2.txt",
      grossAmount: 8800,
      expectedAnomalies: ["FILENAME_VERSIONED"],
    }),
    reviewSpec(14, lume, {
      ...common,
      grossAmount: 11200,
      observation: "Documento revisado sem contrato associado.",
      expectedAnomalies: ["OBSERVATION_SUSPICIOUS"],
    }),
    reviewSpec(15, vertice, {
      ...common,
      grossAmount: 90000,
      expectedAnomalies: ["VALUE_OUTLIER"],
    }),
    reviewSpec(16, aurora, {
      ...common,
      grossAmount: 4200,
      status: "CANCELADO",
      bank: "Banco Exemplo 999",
      expectedAnomalies: ["STATUS_INCONSISTENT", "BANK_ATYPICAL"],
    }),
    reviewSpec(17, horizonte, {
      ...common,
      grossAmount: 6500,
      omitFields: ["HASH_VERIFICACAO"],
      expectedAnomalies: ["FILE_UNPROCESSABLE"],
    }),
    reviewSpec(18, iris, {
      ...common,
      grossAmount: 8800,
      observation: "Reprocessamento solicitado para conferência.",
      expectedAnomalies: ["OBSERVATION_SUSPICIOUS"],
    }),
    reviewSpec(19, lume, {
      ...common,
      grossAmount: 11200,
      expectedAnomalies: [],
    }),
    {
      ...reviewSpec(20, vertice, { ...common, grossAmount: 14500 }),
      supplier: {
        name: "Fornecedor Novo Fictício",
        cnpj: "60000000000106",
        bank: "Banco Exemplo 006",
        baseAmount: 5200,
      },
      grossAmount: 5200,
      expectedAnomalies: ["SUPPLIER_WITHOUT_HISTORY"],
    },
  ];
}

function reviewSpec(
  index: number,
  supplier: SyntheticSupplier,
  overrides: Partial<SyntheticDocumentSpec> & Pick<SyntheticDocumentSpec, "grossAmount">,
): SyntheticDocumentSpec {
  const sequence = String(index).padStart(3, "0");
  return {
    fileName: `AUD_REVIEW_${sequence}.txt`,
    documentNumber: `NF-REV-${sequence}`,
    supplier,
    issueDate: "10/02/2025",
    paymentDate: "12/02/2025",
    invoiceIssueDate: "10/02/2025",
    approvedBy: "Aline Rocha",
    status: "PAGO",
    verificationHash: `AUD-R-${sequence}`,
    ...overrides,
  };
}

function parseSyntheticSpec(spec: SyntheticDocumentSpec) {
  return parseUploadedDocument(spec.fileName, new TextEncoder().encode(renderSyntheticSpec(spec)));
}

function renderSyntheticSpec(spec: SyntheticDocumentSpec) {
  const fields: Array<[string, string]> = [
    ["TIPO_DOCUMENTO", "NOTA_FISCAL"],
    ["NUMERO_DOCUMENTO", spec.documentNumber],
    ["DATA_EMISSAO", spec.issueDate],
    ["FORNECEDOR", spec.supplier.name],
    ["CNPJ_FORNECEDOR", spec.cnpj ?? spec.supplier.cnpj],
    ["DESCRICAO_SERVICO", "Serviço sintético para demonstração"],
    ["VALOR_BRUTO", formatBrazilianCurrency(spec.grossAmount)],
    ["DATA_PAGAMENTO", spec.paymentDate],
    ["DATA_EMISSAO_NF", spec.invoiceIssueDate],
    ["APROVADO_POR", spec.approvedBy],
    ["BANCO_DESTINO", spec.bank ?? spec.supplier.bank],
    ["STATUS", spec.status],
    ["HASH_VERIFICACAO", spec.verificationHash],
  ];

  if (spec.observation) {
    fields.push(["OBSERVACAO", spec.observation]);
  }

  const omitted = new Set(spec.omitFields ?? []);
  return [
    ...fields.filter(([key]) => !omitted.has(key)).map(([key, value]) => `${key}: ${value}`),
    ...(spec.invalidLines ?? []),
  ].join("\n");
}

function formatBrazilianCurrency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
