import Link from "next/link";

import { StatusPill } from "@/components/status-pill";
import { UploadConsole } from "@/components/upload-console";
import { getAppConfig } from "@/lib/config";
import { buildSyntheticDemoData } from "@/lib/demo/synthetic-dataset";
import { loadLatestBaselineSeedSession } from "@/lib/server/sessions";

export const dynamic = "force-dynamic";

const outputItems = [
  {
    title: "Resultados do lote",
    helper: "Planilha principal com campos, achados, modelo e resumo por anomalia.",
  },
  {
    title: "Auditoria exportável",
    helper: "Log por arquivo, regra, evidência, confiança e processamento.",
  },
  {
    title: "Proveniência por campo",
    helper: "Origem registrada como parser, provedor de IA ou campo não resolvido.",
  },
] as const;

const flowItems = [
  {
    roman: "I",
    label: "Recebimento",
    helper: "Lote conferido antes da ingestão.",
  },
  {
    roman: "II",
    label: "Abertura",
    helper: "Revisão aberta, trilha iniciada.",
  },
  {
    roman: "III",
    label: "Triagem",
    helper: "Leitura, parsing e alertas.",
  },
  {
    roman: "IV",
    label: "Fechamento",
    helper: "Evidências consolidadas.",
  },
] as const;

export default async function Home() {
  const config = getAppConfig();
  const isDemoMode = config.appMode === "demo";
  const demo = isDemoMode ? buildSyntheticDemoData() : null;
  const providerLabel = isDemoMode ? "Sem chamadas externas" : resolveProviderLabel(config);
  const aiModeLabel = isDemoMode
    ? "Somente leitura"
    : config.forceAiExtraction
      ? "IA forçada"
      : "IA híbrida";
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

  const seededCorpusLabel = demo
    ? `${demo.baselineCount} referências sintéticas`
    : latestBaseline
      ? `${latestBaseline.processedFiles} arquivos`
      : "Sem baseline";
  const seededCorpusOrigin =
    demo
      ? "Gerador determinístico de dados fictícios"
      : latestBaseline
        ? `${latestBaseline.processedFiles} documentos consolidados`
        : "Referência ainda não consolidada";
  const referenceDocumentCount = demo?.baselineCount ?? latestBaseline?.processedFiles ?? 0;
  const referenceFindingCount = demo?.session.anomalyCount ?? latestBaseline?.anomalyCount ?? 0;
  const referenceFinishedAt = demo?.session.finishedAt ?? latestBaseline?.finishedAt ?? null;

  const folioNumber = buildFolioNumber(referenceDocumentCount);

  return (
    <main className="control-shell mx-auto min-h-screen w-full max-w-[1520px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
      <div className="stagger-group space-y-5">
        <header className="surface-command rounded-[10px] px-6 py-7 sm:px-8 sm:py-8">
          <div className="flex items-start justify-between gap-4">
            <p className="folio-mark">Dossiê IA · PT-BR</p>
            <p className="folio-mark">{folioNumber}</p>
          </div>

          <div className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-4">
              <p className="section-kicker">Mesa de revisão documental</p>
              <h1 className="display-title text-[2.5rem] sm:text-[3.1rem] xl:text-[3.6rem]">
                Central de revisão documental
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-[var(--command-muted)]">
                {isDemoMode
                  ? "Explore dados fictícios, evidências e proveniência em uma demonstração segura."
                  : "Receba o lote, acompanhe a leitura e revise achados com uma trilha clara para auditoria e exportação."}
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 xl:items-end">
              <span
                aria-hidden
                className="rule-line w-20"
                style={{ color: "var(--accent-strong)", opacity: 0.7 }}
              />
              <div className="flex flex-wrap gap-2 xl:justify-end">
                <StatusPill surface="dark" tone={environmentReady ? "success" : "warning"}>
                  {isDemoMode ? "Demonstração segura" : environmentReady ? "Ambiente validado" : "Ambiente pendente"}
                </StatusPill>
                <StatusPill surface="dark" tone="neutral">
                  {providerLabel}
                </StatusPill>
                <StatusPill surface="dark" tone={!isDemoMode && config.forceAiExtraction ? "warning" : "neutral"}>
                  {aiModeLabel}
                </StatusPill>
                <StatusPill surface="dark" tone="neutral">
                  Baseline {seededCorpusLabel}
                </StatusPill>
                <StatusPill surface="dark" tone={demo || latestBaseline ? "success" : "warning"}>
                  {demo || latestBaseline ? "Referência ativa" : "Referência pendente"}
                </StatusPill>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          {isDemoMode ? (
            <DemoConsole
              baselineCount={demo?.baselineCount ?? 0}
              reviewCount={demo?.session.processedFiles ?? 0}
            />
          ) : (
            <UploadConsole
              environmentReady={environmentReady}
              maxSessionFiles={config.maxSessionFiles}
              latestBaseline={latestBaseline}
            />
          )}

          <div className="space-y-5">
            <section className="dossier-surface rounded-[4px] px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="section-kicker section-kicker-dossier">
                    Referência histórica
                  </p>
                  <p className="dossier-ink-muted mt-2 text-[14px] leading-6 italic" style={{ fontFamily: "var(--font-display)" }}>
                    Base usada para comparar fornecedores, documentos e histórico do lote.
                  </p>
                </div>
                <StatusPill surface="dossier" tone={demo || latestBaseline ? "success" : "warning"}>
                  {demo || latestBaseline ? "Ativa" : "Pendente"}
                </StatusPill>
              </div>

              <div className="mt-6 flex items-baseline gap-3">
                <span className="dossier-value-number text-[3.4rem] leading-none">
                  {referenceDocumentCount}
                </span>
                <span className="dossier-label">documentos</span>
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <span
                  className="dossier-value-number text-[1.5rem] leading-none"
                  style={{ color: "var(--stamp-red)" }}
                >
                  {referenceFindingCount}
                </span>
                <span className="dossier-label">achados registrados</span>
              </div>

              <div
                aria-hidden
                className="mt-6 h-px"
                style={{ background: "var(--dossier-rule)", opacity: 0.55 }}
              />

              <dl className="mt-5 space-y-3">
                <DossierRow label="Origem" value={seededCorpusOrigin} />
                <DossierRow
                  label="Limite"
                  value={isDemoMode ? "20 casos de revisão" : `${config.maxSessionFiles} arquivos por lote`}
                />
                <DossierRow
                  label="Atualizada"
                  value={
                    referenceFinishedAt
                      ? formatTimestamp(referenceFinishedAt)
                      : "Sem registro"
                  }
                />
              </dl>
            </section>

            <section className="surface-panel rounded-[10px] px-5 py-5">
              <p className="section-kicker">Saídas da revisão</p>
              <div className="mt-4 space-y-2">
                {outputItems.map((item) => (
                  <article
                    key={item.title}
                    className="surface-subtle rounded-[6px] px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                      {item.helper}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="surface-panel rounded-[10px] px-6 py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-kicker">Fluxo do lote</p>
              <p
                className="mt-2 text-sm italic text-[var(--text-muted)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Quatro etapas, uma trilha rastreável.
              </p>
            </div>
            <span className="folio-mark">Fluxo IV-STG</span>
          </div>

          <div
            className="flow-rail mt-6"
            style={{ ["--flow-count" as string]: flowItems.length }}
          >
            {flowItems.map((item) => (
              <div key={item.roman} className="flow-step">
                <span className="flow-step-marker">{item.roman}</span>
                <div className="space-y-1">
                  <p className="flow-step-label">{item.label}</p>
                  <p className="flow-step-helper">{item.helper}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function DossierRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-baseline gap-3">
      <dt className="dossier-label">{label}</dt>
      <dd className="dossier-value text-[13px] leading-5">{value}</dd>
    </div>
  );
}

function DemoConsole({
  baselineCount,
  reviewCount,
}: {
  baselineCount: number;
  reviewCount: number;
}) {
  return (
    <section className="surface-panel rounded-[10px] px-6 py-6 sm:px-7 sm:py-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-kicker">Demonstração pública</p>
          <h2 className="display-title mt-3 text-[2rem]">Explorar caso sintético.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            Consulte achados, evidências e proveniência sem enviar arquivos, usar chaves de IA
            ou gravar dados em banco. Nenhum dado real deve ser usado nesta aplicação.
          </p>
        </div>
        <StatusPill tone="success">Somente leitura</StatusPill>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <DemoMetric label="Referências" value={baselineCount} />
        <DemoMetric label="Casos de revisão" value={reviewCount} />
        <DemoMetric label="Dados reais" value={0} />
      </div>

      <div className="surface-subtle mt-6 flex flex-col gap-4 rounded-[8px] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">Caso reproduzível e auditável</p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
            O gabarito sintético cobre regras de duplicidade, divergência, datas, valores e rastreabilidade.
          </p>
        </div>
        <Link className="action-seal shrink-0" href="/demo">
          Explorar demonstração sintética
        </Link>
      </div>
    </section>
  );
}

function DemoMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-subtle rounded-[6px] px-4 py-4">
      <p className="dossier-label">{label}</p>
      <p className="dossier-value-number mt-2 text-[2rem] leading-none">{value}</p>
    </div>
  );
}

function resolveProviderLabel(config: ReturnType<typeof getAppConfig>) {
  if (config.aiProvider === "gemini") {
    return "Gemini 2.5 Flash-Lite";
  }

  if (config.aiProvider === "openai") {
    return "OpenAI Responses";
  }

  if (config.geminiApiKey) {
    return "Gemini automático";
  }

  if (config.openAiApiKey) {
    return "OpenAI automático";
  }

  return "Sem provedor";
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildFolioNumber(sequence: number) {
  const year = new Date().getFullYear();
  return `DOS-${year}/${String(sequence).padStart(4, "0")}`;
}
