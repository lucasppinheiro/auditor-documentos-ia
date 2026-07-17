import type { ReactNode } from "react";

import { Download, FileSearch, FileText, LayoutDashboard, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface ProductShellProps {
  active: "overview" | "documents";
  children: ReactNode;
  documentsHref?: string;
  exportBasePath?: string;
  showSafetyNote?: boolean;
}

export function ProductShell({
  active,
  children,
  documentsHref = "/demo",
  exportBasePath,
  showSafetyNote = false,
}: ProductShellProps) {
  const findingsHref = `${documentsHref}#achados`;
  const exportHref = exportBasePath
    ? `${exportBasePath}/results.xlsx`
    : `${documentsHref}#exportar`;

  return (
    <div className="product-shell">
      <aside className="product-sidebar">
        <Link className="product-brand" href="/">
          <ShieldCheck aria-hidden size={21} />
          Revisa
        </Link>

        <nav aria-label="Navegação principal" className="product-navigation">
          <Link aria-current={active === "overview" ? "page" : undefined} href="/">
            <LayoutDashboard aria-hidden size={18} />
            Visão geral
          </Link>
          <Link aria-current={active === "documents" ? "page" : undefined} href={documentsHref}>
            <FileText aria-hidden size={18} />
            Documentos
          </Link>
          <Link href={findingsHref}>
            <FileSearch aria-hidden size={18} />
            Achados
          </Link>
          <Link href={exportHref}>
            <Download aria-hidden size={18} />
            Exportar
          </Link>
        </nav>

        {showSafetyNote ? (
          <div className="product-safety-note">
            <span aria-hidden />
            <div>
              <strong>Dados de exemplo</strong>
              <small>Não envie informações reais.</small>
            </div>
          </div>
        ) : null}
      </aside>

      <section className="product-content">{children}</section>
    </div>
  );
}
