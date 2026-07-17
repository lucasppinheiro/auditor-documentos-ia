"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";

import { ChevronRight, Download, FileSearch, Inbox, Search } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import type { FieldSources } from "@/lib/documents/parser";

export interface SessionDocumentView {
  id: string;
  fileName: string;
  parseStatus: string;
  encoding: string;
  documentType: string;
  documentNumber: string;
  serviceDescription: string;
  supplierName: string;
  supplierCnpj: string;
  grossAmount: number | null;
  issueDateIso: string | null;
  paymentDateIso: string | null;
  invoiceIssueDateIso: string | null;
  approvedBy: string | null;
  destinationBank: string | null;
  status: string | null;
  verificationHash: string | null;
  extractionMethod: string;
  modelId: string;
  promptVersion: string;
  processedAt: string;
  notExtractedFields: string[];
  fieldSources: FieldSources;
  anomalies: Array<{
    type: string;
    severity: string;
    confidence: string;
    message: string;
    evidence: Record<string, unknown>;
  }>;
}

interface SessionOverview {
  id: string;
  status: string;
  processedFiles: number;
  totalFiles: number;
  anomalyCount: number;
  startedAt: string;
  finishedAt: string | null;
}

interface AnomalySummary {
  type: string;
  count: number;
  severity: "high" | "medium" | "low";
}

const severityRank = {
  high: 3,
  medium: 2,
  low: 1,
} as const;

const ANOMALY_LABELS: Record<string, string> = {
  APPROVER_UNRECOGNIZED: "Aprovador não reconhecido",
  BANK_ATYPICAL: "Banco atípico",
  CNPJ_CHECKSUM_INVALID: "CNPJ com dígitos inválidos",
  CNPJ_DIVERGENT: "CNPJ divergente",
  DOCUMENT_NUMBER_PREFIX_MISMATCH: "Prefixo de documento incompatível",
  DUPLICATE_DOCUMENT: "Documento já existente",
  FILE_UNPROCESSABLE: "Arquivo não processável",
  FILENAME_VERSIONED: "Arquivo versionado",
  HASH_MALFORMED: "Hash malformado",
  INVOICE_AFTER_PAYMENT: "NF emitida após pagamento",
  OBSERVATION_SUSPICIOUS: "Observação suspeita",
  STATUS_INCONSISTENT: "Status inconsistente",
  STATUS_MALFORMED: "Status fora do padrão",
  SUPPLIER_WITHOUT_HISTORY: "Fornecedor sem histórico",
  VALUE_OUTLIER: "Valor fora da faixa",
};

const FIELD_LABELS: Record<string, string> = {
  documentType: "Tipo",
  documentNumber: "Número",
  serviceDescription: "Serviço",
  supplierName: "Fornecedor",
  supplierCnpjNormalized: "CNPJ",
  grossAmount: "Valor",
  issueDateIso: "Emissão",
  paymentDateIso: "Pagamento",
  invoiceIssueDateIso: "Emissão da NF",
  status: "Status",
  verificationHash: "Hash",
  approvedBy: "Aprovador",
  destinationBank: "Banco",
  observation: "Observação",
};

const DOCUMENTS_PAGE_SIZE = 25;

export function ResultsExplorer({
  session,
  documents,
  displayTitle,
  exportBasePath,
}: {
  session: SessionOverview;
  documents: SessionDocumentView[];
  displayTitle?: string;
  exportBasePath?: string;
}) {
  const [search, setSearch] = useState("");
  const [selectedAnomaly, setSelectedAnomaly] = useState("ALL");
  const [selectedSeverity, setSelectedSeverity] = useState("ALL");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    documents[0]?.id ?? null,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const anomalyBreakdown = useMemo(() => {
    const counts = new Map<string, AnomalySummary>();

    for (const document of documents) {
      for (const anomaly of document.anomalies) {
        const current = counts.get(anomaly.type);
        const nextSeverity = normalizeSeverity(anomaly.severity);

        if (!current) {
          counts.set(anomaly.type, { type: anomaly.type, count: 1, severity: nextSeverity });
          continue;
        }

        counts.set(anomaly.type, {
          type: anomaly.type,
          count: current.count + 1,
          severity:
            severityRank[nextSeverity] > severityRank[current.severity]
              ? nextSeverity
              : current.severity,
        });
      }
    }

    return Array.from(counts.values()).sort(
      (left, right) => right.count - left.count || left.type.localeCompare(right.type),
    );
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((document) => {
      const matchesSearch =
        deferredSearch.length === 0 ||
        [
          document.fileName,
          document.documentNumber,
          document.supplierName,
          document.approvedBy ?? "",
          document.supplierCnpj,
        ]
          .join(" ")
          .toLowerCase()
          .includes(deferredSearch);
      const matchesAnomaly =
        selectedAnomaly === "ALL" ||
        document.anomalies.some((anomaly) => anomaly.type === selectedAnomaly);
      const matchesSeverity =
        selectedSeverity === "ALL" ||
        document.anomalies.some(
          (anomaly) => normalizeSeverity(anomaly.severity).toUpperCase() === selectedSeverity,
        );

      return matchesSearch && matchesAnomaly && matchesSeverity;
    });
  }, [deferredSearch, documents, selectedAnomaly, selectedSeverity]);

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / DOCUMENTS_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartOffset = (safeCurrentPage - 1) * DOCUMENTS_PAGE_SIZE;
  const paginatedDocuments = filteredDocuments.slice(
    pageStartOffset,
    pageStartOffset + DOCUMENTS_PAGE_SIZE,
  );
  const pageEndOffset = Math.min(
    filteredDocuments.length,
    pageStartOffset + paginatedDocuments.length,
  );
  const selectedDocument =
    filteredDocuments.find((document) => document.id === selectedDocumentId) ??
    filteredDocuments[0] ??
    null;
  const partialDocuments = documents.filter(
    (document) => document.parseStatus !== "parsed",
  ).length;
  const documentsWithFindings = documents.filter(
    (document) => document.anomalies.length > 0,
  ).length;
  const resolvedExportBasePath = exportBasePath ?? `/api/sessions/${session.id}`;
  const closeDateLabel = formatTimestamp(session.finishedAt, "short") ?? "Em andamento";

  return (
    <div className="product-results">
      <header className="product-topbar" id="exportar">
        <div>
          <span>Auditoria documental</span>
          <strong>{displayTitle ?? `Revisão ${session.id.slice(0, 8)}`}</strong>
        </div>
        <div className="product-export-actions">
          <Link href={`${resolvedExportBasePath}/results.xlsx`}>
            <Download aria-hidden size={16} /> Resultados
          </Link>
          <Link href={`${resolvedExportBasePath}/audit.xlsx`}>Trilha de auditoria</Link>
        </div>
      </header>

      <div className="product-main product-results-main">
        <section className="product-results-heading">
          <div>
            <p>Documentos</p>
            <h1>Revisão do lote</h1>
          </div>
          <span>
            {session.status === "finalized"
              ? `Concluída em ${closeDateLabel}`
              : "Em andamento"}
          </span>
        </section>

        <section className="product-metrics" aria-label="Resumo da revisão">
          <ResultMetric
            label="Documentos"
            value={session.processedFiles}
            helper="na revisão atual"
          />
          <ResultMetric
            label="Com achados"
            value={documentsWithFindings}
            helper="requerem análise"
          />
          <ResultMetric
            label="Pendentes"
            value={partialDocuments}
            helper="aguardam confirmação"
          />
        </section>

        <section className="product-filter-bar" aria-label="Filtros dos documentos">
          <label className="product-search-field">
            <Search aria-hidden size={17} />
            <span className="sr-only">Buscar documento ou fornecedor</span>
            <input
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar documento ou fornecedor"
              type="search"
              value={search}
            />
          </label>

          <label className="product-select-field">
            <span className="sr-only">Filtrar por achado</span>
            <select
              aria-label="Filtrar por achado"
              onChange={(event) => {
                setSelectedAnomaly(event.target.value);
                setCurrentPage(1);
              }}
              value={selectedAnomaly}
            >
              <option value="ALL">Todos os achados</option>
              {anomalyBreakdown.map((item) => (
                <option key={item.type} value={item.type}>
                  {formatAnomalyType(item.type)} ({item.count})
                </option>
              ))}
            </select>
          </label>

          <label className="product-select-field">
            <span className="sr-only">Filtrar por severidade</span>
            <select
              aria-label="Filtrar por severidade"
              onChange={(event) => {
                setSelectedSeverity(event.target.value);
                setCurrentPage(1);
              }}
              value={selectedSeverity}
            >
              <option value="ALL">Todas as severidades</option>
              <option value="HIGH">Alta</option>
              <option value="MEDIUM">Média</option>
              <option value="LOW">Baixa</option>
            </select>
          </label>
        </section>

        <section className="product-review-grid">
          <div className="product-documents-card">
            {documents.length === 0 ? (
              <EmptyState
                icon={<Inbox className="size-6" />}
                title="Nenhum documento disponível"
                helper="Adicione documentos para iniciar a revisão."
              />
            ) : filteredDocuments.length === 0 ? (
              <EmptyState
                icon={<FileSearch className="size-6" />}
                title="Nenhum documento encontrado"
                helper="Altere a busca ou os filtros para ver outros documentos."
                action={
                  <button
                    className="product-secondary-action"
                    onClick={() => {
                      setSearch("");
                      setSelectedAnomaly("ALL");
                      setSelectedSeverity("ALL");
                      setCurrentPage(1);
                    }}
                    type="button"
                  >
                    Limpar filtros
                  </button>
                }
              />
            ) : (
              <div className="product-table-wrap">
                <table aria-label="Documentos revisados no lote">
                  <caption className="sr-only">
                    Selecione um documento para consultar os campos e os achados.
                  </caption>
                  <thead>
                    <tr>
                      <th>Arquivo</th>
                      <th>Fornecedor</th>
                      <th>Valor</th>
                      <th>Leitura</th>
                      <th>Achados</th>
                      <th aria-label="Abrir" />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDocuments.map((document) => {
                      const selected = selectedDocument?.id === document.id;

                      return (
                        <tr
                          key={document.id}
                          aria-label={`Inspecionar documento ${document.fileName}`}
                          aria-selected={selected}
                          data-selected={selected}
                          onClick={() =>
                            startTransition(() => {
                              setSelectedDocumentId(document.id);
                            })
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              startTransition(() => {
                                setSelectedDocumentId(document.id);
                              });
                            }
                          }}
                          tabIndex={0}
                        >
                          <td>
                            <strong>{document.fileName}</strong>
                            <small>{document.documentNumber || "Sem número"}</small>
                          </td>
                          <td>{document.supplierName || "Não identificado"}</td>
                          <td>{formatCurrency(document.grossAmount)}</td>
                          <td>
                            <span className="product-status">
                              {formatParseStatus(document.parseStatus)}
                            </span>
                          </td>
                          <td>{formatFindingCount(document.anomalies.length)}</td>
                          <td>
                            <ChevronRight aria-hidden size={16} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <footer className="product-pagination">
                  <span>
                    {pageStartOffset + 1}–{pageEndOffset} de {filteredDocuments.length}
                  </span>
                  <div>
                    <button
                      disabled={safeCurrentPage === 1}
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      type="button"
                    >
                      Página anterior
                    </button>
                    <button
                      disabled={safeCurrentPage === totalPages}
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      type="button"
                    >
                      Próxima página
                    </button>
                  </div>
                </footer>
              </div>
            )}
          </div>

          <aside className="product-inspector" id="achados">
            {selectedDocument ? (
              <>
                <div className="product-inspector-heading">
                  <span className="product-status">
                    {formatFindingCount(selectedDocument.anomalies.length)}
                  </span>
                  <h2>{selectedDocument.fileName}</h2>
                  <p>{selectedDocument.supplierName || "Fornecedor não identificado"}</p>
                </div>

                <dl className="product-summary-list">
                  <div>
                    <dt>Documento</dt>
                    <dd>{selectedDocument.documentNumber || "Sem número"}</dd>
                  </div>
                  <div>
                    <dt>Valor</dt>
                    <dd>{formatCurrency(selectedDocument.grossAmount)}</dd>
                  </div>
                  <div>
                    <dt>Origem</dt>
                    <dd>{formatExtractionMethod(selectedDocument.extractionMethod)}</dd>
                  </div>
                </dl>

                <section className="product-findings">
                  <h3>O que revisar</h3>
                  {selectedDocument.anomalies.length > 0 ? (
                    selectedDocument.anomalies.map((anomaly) => (
                      <article key={`${selectedDocument.id}-${anomaly.type}`}>
                        <strong>{formatAnomalyType(anomaly.type)}</strong>
                        <span>{anomaly.message}</span>
                        {describeAnomalyEvidence(anomaly, selectedDocument.fileName).map((line) => (
                          <small key={`${selectedDocument.id}-${anomaly.type}-${line}`}>{line}</small>
                        ))}
                      </article>
                    ))
                  ) : (
                    <p>Nenhum achado associado ao documento.</p>
                  )}
                </section>

                <details className="product-detail-group">
                  <summary>Campos e rastreabilidade</summary>
                  <dl className="product-detail-list">
                    <DetailItem
                      label="Serviço"
                      value={selectedDocument.serviceDescription || "Não identificado"}
                    />
                    <DetailItem
                      label="Emissão"
                      value={formatCalendarDate(selectedDocument.issueDateIso) || "Não identificada"}
                    />
                    <DetailItem
                      label="Pagamento"
                      value={formatCalendarDate(selectedDocument.paymentDateIso) || "Não identificado"}
                    />
                    <DetailItem
                      label="Emissão da NF"
                      value={formatCalendarDate(selectedDocument.invoiceIssueDateIso) || "Não identificada"}
                    />
                    <DetailItem
                      label="Aprovador"
                      value={selectedDocument.approvedBy || "Não identificado"}
                    />
                    <DetailItem
                      label="Banco"
                      value={selectedDocument.destinationBank || "Não identificado"}
                    />
                    <DetailItem label="Status" value={selectedDocument.status || "Não identificado"} />
                    <DetailItem label="Encoding" value={selectedDocument.encoding} />
                    <DetailItem label="Prompt" value={selectedDocument.promptVersion} />
                    <DetailItem label="Modelo" value={selectedDocument.modelId} />
                    <DetailItem
                      label="Hash"
                      value={selectedDocument.verificationHash || "Não identificado"}
                    />
                    <DetailItem
                      label="Processado"
                      value={formatTimestamp(selectedDocument.processedAt, "full") ?? "Sem registro"}
                    />
                  </dl>
                  <div className="product-missing-fields">
                    <strong>Campos não extraídos</strong>
                    <span>
                      {selectedDocument.notExtractedFields.length > 0
                        ? selectedDocument.notExtractedFields.join(", ")
                        : "Nenhum"}
                    </span>
                  </div>
                </details>

                <details className="product-detail-group">
                  <summary>Proveniência dos campos</summary>
                  <div className="product-provenance-grid">
                    {Object.entries(selectedDocument.fieldSources).map(([field, source]) => (
                      <div key={field}>
                        <strong>{formatFieldName(field)}</strong>
                        <span>{formatFieldSource(source)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </>
            ) : (
              <p className="product-inspector-empty">
                Selecione um documento para consultar os detalhes.
              </p>
            )}
          </aside>
        </section>
      </div>
    </div>
  );
}

function ResultMetric({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <article>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{helper}</span>
    </article>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function normalizeSeverity(severity: string): "high" | "medium" | "low" {
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
}

function formatCurrency(value: number | null) {
  if (typeof value !== "number") return "Não identificado";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatTimestamp(value: string | null, mode: "full" | "short" = "full") {
  if (!value) return null;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: mode === "short" ? "short" : "medium",
    timeStyle: mode === "short" ? undefined : "short",
  }).format(new Date(value));
}

function formatCalendarDate(value: string | null) {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return formatTimestamp(value, "short");

  const [, year, month, day] = match;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
    new Date(Number(year), Number(month) - 1, Number(day)),
  );
}

function formatParseStatus(value: string) {
  if (value === "parsed") return "Validado";
  if (value === "partial") return "Parcial";
  if (value === "unprocessable") return "Não processável";
  return value;
}

function formatExtractionMethod(value: string) {
  if (value === "parser-only") return "Parser";
  if (value === "gemini+parser") return "Gemini + parser";
  if (value === "openai+parser") return "OpenAI + parser";
  if (value === "parser-fallback") return "Fallback do parser";
  return value;
}

function formatFindingCount(value: number) {
  return value === 1 ? "1 achado" : `${value} achados`;
}

function formatAnomalyType(value: string) {
  return ANOMALY_LABELS[value] ?? value;
}

function formatFieldName(field: string) {
  return FIELD_LABELS[field] ?? field;
}

function formatFieldSource(source: string) {
  if (source === "parser") return "Parser determinístico";
  if (source === "gemini") return "Gemini";
  if (source === "openai") return "OpenAI";
  return "Não resolvido";
}

function describeAnomalyEvidence(
  anomaly: SessionDocumentView["anomalies"][number],
  currentFileName: string,
) {
  if (anomaly.type === "DUPLICATE_DOCUMENT") {
    const relatedCurrentFiles = readEvidenceList(anomaly.evidence.relatedCurrentFiles);
    const relatedHistoricalFiles = readEvidenceList(anomaly.evidence.relatedHistoricalFiles);
    const supplierName = formatEvidenceValue(anomaly.evidence.supplierName);
    const documentNumber = formatEvidenceValue(anomaly.evidence.documentNumber);
    const lines: string[] = [`Registro atual: ${currentFileName}`];

    if (supplierName && documentNumber) {
      lines.push(`Critério usado: ${supplierName} + ${documentNumber}`);
    }
    if (relatedCurrentFiles.length > 0) {
      lines.push(`Duplicado no mesmo lote: ${relatedCurrentFiles.join(", ")}`);
    }

    const selfInHistory = relatedHistoricalFiles.includes(currentFileName);
    const otherHistoricalFiles = relatedHistoricalFiles.filter(
      (fileName) => fileName !== currentFileName,
    );

    if (otherHistoricalFiles.length > 0) {
      lines.push(`Comparado com referência histórica: ${otherHistoricalFiles.join(", ")}`);
    }
    if (selfInHistory && otherHistoricalFiles.length === 0) {
      lines.push("Registro atual já constava na referência histórica.");
    } else if (selfInHistory) {
      lines.push("O mesmo arquivo também já constava na referência histórica.");
    }

    return lines;
  }

  if (anomaly.type === "VALUE_OUTLIER") {
    const amount = formatEvidenceValue(anomaly.evidence.grossAmount);
    const median = formatEvidenceValue(anomaly.evidence.historicalMedian);
    const upperBound = formatEvidenceValue(anomaly.evidence.upperBound);
    const lowerBound = formatEvidenceValue(anomaly.evidence.lowerBound);
    const historicalSize = formatEvidenceValue(anomaly.evidence.historicalSize);
    const lines: string[] = [];

    if (amount) lines.push(`Valor atual: R$ ${amount}`);
    if (median && historicalSize) {
      lines.push(`Faixa histórica: mediana R$ ${median} em ${historicalSize} documentos`);
    }
    if (lowerBound && upperBound) {
      lines.push(`Intervalo esperado: R$ ${lowerBound} a R$ ${upperBound}`);
    }
    return lines;
  }

  if (anomaly.type === "INVOICE_AFTER_PAYMENT") {
    const issue = formatEvidenceValue(anomaly.evidence.invoiceIssueDateIso);
    const payment = formatEvidenceValue(anomaly.evidence.paymentDateIso);
    const lines: string[] = [];
    if (issue) lines.push(`Emissão da NF: ${issue}`);
    if (payment) lines.push(`Pagamento registrado: ${payment}`);
    lines.push("A emissão fiscal ocorreu depois do pagamento.");
    return lines;
  }

  if (anomaly.type === "STATUS_INCONSISTENT") {
    const status = formatEvidenceValue(anomaly.evidence.status);
    const payment = formatEvidenceValue(anomaly.evidence.paymentDateIso);
    const lines: string[] = [];
    if (status) lines.push(`Status atual: ${status}`);
    if (payment) lines.push(`Pagamento preenchido: ${payment}`);
    return lines;
  }

  const labelByKey: Record<string, string> = {
    approvedBy: "Aprovador",
    destinationBank: "Banco",
    grossAmount: "Valor",
    verificationHash: "Hash",
    supplierName: "Fornecedor",
    documentNumber: "Documento",
    status: "Status",
    observation: "Observação",
    canonicalCnpj: "CNPJ histórico",
    currentCnpj: "CNPJ atual",
  };
  const lines: string[] = [];

  for (const [key, rawValue] of Object.entries(anomaly.evidence)) {
    const label = labelByKey[key];
    const value = formatEvidenceValue(rawValue);
    if (label && value) lines.push(`${label}: ${value}`);
  }

  return lines;
}

function readEvidenceList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
}

function formatEvidenceValue(value: unknown) {
  if (Array.isArray(value)) {
    const list = value
      .filter(
        (item): item is string | number =>
          typeof item === "string" || typeof item === "number",
      )
      .map(String);
    return list.length > 0 ? list.join(", ") : null;
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "string" && value.length > 0) return value;
  return null;
}
