import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";

import { ProductShell } from "@/components/product-shell";
import { UploadConsole } from "@/components/upload-console";
import { getAppConfig } from "@/lib/config";
import { buildSyntheticDemoData } from "@/lib/demo/synthetic-dataset";
import { loadLatestBaselineSeedSession } from "@/lib/server/sessions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const config = getAppConfig();
  const isDemoMode = config.appMode === "demo";
  const demo = isDemoMode ? buildSyntheticDemoData() : null;
  const environmentReady =
    isDemoMode ||
    Boolean(
      config.databaseUrl &&
        ((config.aiProvider === "gemini" && config.geminiApiKey) ||
          (config.aiProvider === "openai" && config.openAiApiKey) ||
          (config.aiProvider === "auto" && (config.geminiApiKey || config.openAiApiKey))),
    );

  let latestBaseline = null;
  if (!isDemoMode && config.databaseUrl) {
    try {
      latestBaseline = await loadLatestBaselineSeedSession();
    } catch {
      latestBaseline = null;
    }
  }

  if (!demo) {
    return (
      <ProductShell active="overview" documentsHref="#nova-revisao">
        <header className="product-topbar">
          <div>
            <span>Auditoria e conformidade</span>
            <strong>Central de revisão documental</strong>
          </div>
        </header>
        <div className="product-main">
          <section className="product-hero product-hero-compact">
            <div>
              <p>Nova revisão</p>
              <h1>Organize documentos e acompanhe cada achado.</h1>
              <span>Carregue o lote, confira a extração e revise as evidências identificadas.</span>
            </div>
          </section>
          <section className="product-upload-section" id="nova-revisao">
            <UploadConsole
              environmentReady={environmentReady}
              latestBaseline={latestBaseline}
              maxSessionFiles={config.maxSessionFiles}
            />
          </section>
        </div>
      </ProductShell>
    );
  }

  const documentsWithFindings = demo.records.filter(
    (record) => record.anomalies.length > 0,
  ).length;
  const pendingDocuments = demo.records.filter(
    (record) => record.document.status !== "parsed",
  ).length;
  const highlightedDocuments = [...demo.records]
    .sort((left, right) => right.anomalies.length - left.anomalies.length)
    .slice(0, 3);

  return (
    <ProductShell
      active="overview"
      documentsHref="/demo"
      exportBasePath="/api/demo"
      showSafetyNote
    >
      <header className="product-topbar">
        <div>
          <span>Auditoria e conformidade</span>
          <strong>Central de revisão documental</strong>
        </div>
        <Link className="product-primary-action" href="/demo">
          Acessar documentos
        </Link>
      </header>

      <div className="product-main">
        <section className="product-hero">
          <div>
            <p>Revisão documental assistida</p>
            <h1>Priorize achados e revise evidências com clareza.</h1>
            <span>
              Organize documentos, confira divergências e exporte resultados em um fluxo único.
            </span>
          </div>
          <Link className="product-primary-action" href="/demo">
            Abrir revisão <ArrowRight aria-hidden size={17} />
          </Link>
        </section>

        <section className="product-metrics" aria-label="Resumo da revisão">
          <Metric label="Documentos" value={demo.records.length} helper="na revisão atual" />
          <Metric label="Com achados" value={documentsWithFindings} helper="requerem análise" />
          <Metric label="Pendentes" value={pendingDocuments} helper="aguardam confirmação" />
        </section>

        <section className="product-recent-review">
          <div className="product-section-heading">
            <div>
              <h2>Revisão atual</h2>
              <p>Documentos priorizados pela quantidade de achados.</p>
            </div>
            <Link href="/demo">
              Ver documentos <ChevronRight aria-hidden size={16} />
            </Link>
          </div>

          <div className="product-table-wrap">
            <table aria-label="Documentos prioritários">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Fornecedor</th>
                  <th>Valor</th>
                  <th>Achados</th>
                  <th aria-label="Abrir" />
                </tr>
              </thead>
              <tbody>
                {highlightedDocuments.map((record) => (
                  <tr key={record.document.fileName}>
                    <td>
                      <strong>{record.document.fileName}</strong>
                      <small>{record.document.normalized.documentNumber ?? "Sem número"}</small>
                    </td>
                    <td>{record.document.normalized.supplierName ?? "Não identificado"}</td>
                    <td>{formatCurrency(record.document.normalized.grossAmount)}</td>
                    <td>
                      <span className="product-status">
                        {record.anomalies.length === 1
                          ? "1 achado"
                          : `${record.anomalies.length} achados`}
                      </span>
                    </td>
                    <td>
                      <ChevronRight aria-hidden size={16} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </ProductShell>
  );
}

function Metric({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <article>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{helper}</span>
    </article>
  );
}

function formatCurrency(value: number | null) {
  if (typeof value !== "number") {
    return "Não identificado";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
