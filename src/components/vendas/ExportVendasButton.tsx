import { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, ChevronRight, Loader2 } from "lucide-react";
import { Venda } from "@/hooks/useVendas";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import ExcelJS from "exceljs";

// ── Tipos ──────────────────────────────────────────────────────

interface Props {
  vendas: Venda[];
  dateRange?: DateRange;
}

// ── Helpers ────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function periodLabel(dateRange?: DateRange) {
  if (!dateRange?.from) return "periodo";
  if (!dateRange?.to) return format(dateRange.from, "MM-yyyy");
  return `${format(dateRange.from, "dd-MM-yyyy")}_${format(dateRange.to, "dd-MM-yyyy")}`;
}
function periodDisplay(dateRange?: DateRange) {
  if (!dateRange?.from) return "";
  if (!dateRange?.to) return format(dateRange.from, "dd/MM/yyyy", { locale: ptBR });
  return `${format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} – ${format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}`;
}

// ── XLSX Export ────────────────────────────────────────────────

async function exportToXLSX(vendas: Venda[], dateRange?: DateRange) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Descompliquei CRM";
  wb.created = new Date();

  const ws = wb.addWorksheet("Vendas", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
  });

  // ── Cores ──────────────────────────────────────────────────
  const DARK    = "0F0F0F";
  const WHITE   = "FFFFFF";
  const GREEN   = "10B981";
  const GREEN_BG= "F0FDF9";
  const GREEN_TX= "065F46";
  const ACCENT  = "6366F1";
  const LIGHT   = "F6F6F6";
  const STRIPE  = "FAFAFA";
  const BORDER  = "E5E7EB";
  const MUTED   = "6B7280";
  const HEADER_BG = "111827";

  // ── Larguras das colunas ────────────────────────────────────
  //  A         B           C                 D             E             F         G
  // Cliente | Telefone | Serviço/Produto | Val. Orçado | Val. Fechado | Data   | Pagamento
  ws.columns = [
    { key: "cliente",   width: 32 },
    { key: "telefone",  width: 20 },
    { key: "servico",   width: 36 },
    { key: "orcado",    width: 18 },
    { key: "fechado",   width: 18 },
    { key: "data",      width: 15 },
    { key: "pagamento", width: 22 },
  ];

  const COLS = 7;
  const fullRange = (row: number) => `A${row}:G${row}`;

  // ── Helper: aplicar fill sólido ─────────────────────────────
  const fill = (color: string): ExcelJS.Fill => ({
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF" + color },
  });

  const border = (color = BORDER): Partial<ExcelJS.Borders> => ({
    top:    { style: "thin", color: { argb: "FF" + color } },
    bottom: { style: "thin", color: { argb: "FF" + color } },
    left:   { style: "thin", color: { argb: "FF" + color } },
    right:  { style: "thin", color: { argb: "FF" + color } },
  });

  const bottomBorder = (color = BORDER): Partial<ExcelJS.Borders> => ({
    bottom: { style: "thin", color: { argb: "FF" + color } },
  });

  // ════════════════════════════════════════════════════════════
  // ROW 1 — Título principal
  // ════════════════════════════════════════════════════════════
  ws.mergeCells(fullRange(1));
  const titleRow = ws.getRow(1);
  titleRow.height = 36;
  const titleCell = ws.getCell("A1");
  titleCell.value = "  RELATÓRIO DE VENDAS";
  titleCell.fill  = fill(DARK);
  titleCell.font  = { name: "Arial", bold: true, size: 16, color: { argb: "FF" + WHITE } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };

  // Barra de accent no lado esquerdo (simulada com bordas coloridas não funciona bem,
  // então adicionar como célula separada não é possível em XLSX facilmente. Pulamos.)

  // ROW 2 — Período
  ws.mergeCells(fullRange(2));
  const periodRow = ws.getRow(2);
  periodRow.height = 20;
  const periodCell = ws.getCell("A2");
  periodCell.value = `  ${periodDisplay(dateRange)}   •   Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`;
  periodCell.fill  = fill(HEADER_BG);
  periodCell.font  = { name: "Arial", size: 9, color: { argb: "FFB0B0B0" } };
  periodCell.alignment = { vertical: "middle", horizontal: "left" };

  // ROW 3 — Espaçador
  const spacer1 = ws.getRow(3);
  spacer1.height = 10;
  ws.mergeCells(fullRange(3));
  ws.getCell("A3").fill = fill("F9FAFB");

  // ════════════════════════════════════════════════════════════
  // ROWS 4-5 — Cards de métricas
  // ════════════════════════════════════════════════════════════
  const totalFat   = vendas.reduce((a, v) => a + v.valor_fechado, 0);
  const ticketMed  = vendas.length > 0 ? totalFat / vendas.length : 0;
  const maiorVenda = vendas.length > 0 ? Math.max(...vendas.map(v => v.valor_fechado)) : 0;

  const metricsLabel = ws.getRow(4);
  const metricsValue = ws.getRow(5);
  metricsLabel.height = 16;
  metricsValue.height = 28;

  // Metric 1 — Faturamento (A, verde)
  ws.mergeCells("A4:A4");
  ws.mergeCells("A5:A5");

  const metricDefs = [
    { col: "A", label: "FATURAMENTO TOTAL", value: fmtBRL(totalFat),  accent: true  },
    { col: "C", label: "TICKET MÉDIO",       value: fmtBRL(ticketMed), accent: false },
    { col: "E", label: "TOTAL DE VENDAS",    value: `${vendas.length} venda${vendas.length !== 1 ? "s" : ""}`, accent: false },
    { col: "G", label: "MAIOR VENDA",        value: fmtBRL(maiorVenda),accent: false },
  ];

  // Preencher B, D, F como espaçadores
  ["B", "D", "F"].forEach(col => {
    ws.getCell(`${col}4`).fill = fill("F9FAFB");
    ws.getCell(`${col}5`).fill = fill("F9FAFB");
  });

  metricDefs.forEach(({ col, label, value, accent }) => {
    const labelCell = ws.getCell(`${col}4`);
    const valueCell = ws.getCell(`${col}5`);

    const bgColor = accent ? GREEN_BG : LIGHT;
    const txColor = accent ? GREEN_TX : DARK;
    const bColor  = accent ? GREEN    : BORDER;

    labelCell.value = label;
    labelCell.fill  = fill(bgColor);
    labelCell.font  = { name: "Arial", size: 7.5, bold: true, color: { argb: "FF" + MUTED } };
    labelCell.alignment = { vertical: "bottom", horizontal: "left", indent: 1 };
    labelCell.border = {
      top:   { style: "medium", color: { argb: "FF" + bColor } },
      left:  { style: "medium", color: { argb: "FF" + bColor } },
      right: { style: "medium", color: { argb: "FF" + bColor } },
    };

    valueCell.value = value;
    valueCell.fill  = fill(bgColor);
    valueCell.font  = { name: "Arial", size: 14, bold: true, color: { argb: "FF" + txColor } };
    valueCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    valueCell.border = {
      bottom: { style: "medium", color: { argb: "FF" + bColor } },
      left:   { style: "medium", color: { argb: "FF" + bColor } },
      right:  { style: "medium", color: { argb: "FF" + bColor } },
    };
  });

  // ROW 6 — Espaçador
  const spacer2 = ws.getRow(6);
  spacer2.height = 10;
  ws.mergeCells(fullRange(6));
  ws.getCell("A6").fill = fill("F9FAFB");

  // ════════════════════════════════════════════════════════════
  // ROW 7 — Cabeçalho da tabela
  // ════════════════════════════════════════════════════════════
  const headers = ["CLIENTE", "TELEFONE", "SERVIÇO / PRODUTO", "VALOR ORÇADO", "VALOR FECHADO", "DATA", "PAGAMENTO"];
  const headerRow = ws.getRow(7);
  headerRow.height = 22;

  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill  = fill(DARK);
    cell.font  = { name: "Arial", bold: true, size: 8, color: { argb: "FF" + WHITE } };
    cell.alignment = { vertical: "middle", horizontal: i >= 3 && i <= 4 ? "right" : "left", indent: i >= 3 && i <= 4 ? 0 : 1 };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF" + ACCENT } },
    };
  });

  // ════════════════════════════════════════════════════════════
  // ROWS 8+ — Dados
  // ════════════════════════════════════════════════════════════
  vendas.forEach((v, idx) => {
    const rowNum = 8 + idx;
    const dataRow = ws.getRow(rowNum);
    dataRow.height = 20;

    const isStripe = idx % 2 === 1;
    const rowBg    = isStripe ? STRIPE : WHITE;

    const cells = [
      { value: v.leads?.nome        ?? "—",    align: "left"  as const, color: DARK   },
      { value: v.leads?.telefone    ?? "—",    align: "left"  as const, color: DARK,  isText: true },
      { value: v.produto_servico    ?? "—",    align: "left"  as const, color: DARK   },
      { value: v.valor_orcado != null ? fmtBRL(v.valor_orcado) : "—", align: "right" as const, color: MUTED },
      { value: fmtBRL(v.valor_fechado),         align: "right" as const, color: GREEN, bold: true },
      { value: format(parseISO(v.data_fechamento), "dd/MM/yyyy", { locale: ptBR }), align: "left" as const, color: MUTED },
      { value: v.forma_pagamento    ?? "—",    align: "left"  as const, color: DARK   },
    ];

    cells.forEach((c, i) => {
      const cell = dataRow.getCell(i + 1);
      // Telefone como texto puro para evitar notação científica
      if (c.isText) {
        cell.value = { text: c.value } as any;
        cell.numFmt = "@";
        cell.value = c.value;
      } else {
        cell.value = c.value;
      }
      cell.fill  = fill(rowBg);
      cell.font  = { name: "Arial", size: 9, color: { argb: "FF" + c.color }, bold: c.bold ?? false };
      cell.alignment = { vertical: "middle", horizontal: c.align, indent: c.align === "left" ? 1 : 0 };
      cell.border = bottomBorder(BORDER);
    });
  });

  // ── Freeze panes (congela título + métricas) ────────────────
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 7, topLeftCell: "A8", activeCell: "A8" }];

  // ── Filtro automático nas colunas ───────────────────────────
  ws.autoFilter = { from: "A7", to: "G7" };

  // ── Download ────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vendas_${periodLabel(dateRange)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── PDF Export ─────────────────────────────────────────────────

function truncateStr(doc: jsPDF, str: string, maxMm: number, fontSize: number): string {
  doc.setFontSize(fontSize);
  const scale = doc.internal.scaleFactor;
  while (str.length > 2 && (doc.getStringUnitWidth(str) * fontSize) / scale > maxMm) {
    str = str.slice(0, -2) + "…";
  }
  return str;
}

function exportToPDF(vendas: Venda[], dateRange?: DateRange) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const C = {
    dark:    [15,  15,  15]  as [number, number, number],
    white:   [255, 255, 255] as [number, number, number],
    muted:   [110, 110, 110] as [number, number, number],
    light:   [246, 246, 246] as [number, number, number],
    border:  [220, 220, 220] as [number, number, number],
    green:   [16,  185, 129] as [number, number, number],
    greenBg: [240, 253, 249] as [number, number, number],
    accent:  [99,  102, 241] as [number, number, number],
    stripe:  [250, 250, 250] as [number, number, number],
  };

  const MARGIN = 12;
  const ROW_H  = 7.5;
  const HEADER_H = 32;

  const drawPageHeader = (pageNum: number, totalPages: number) => {
    doc.setFillColor(...C.dark);
    doc.rect(0, 0, W, HEADER_H, "F");
    doc.setFillColor(...C.accent);
    doc.rect(0, 0, 4, HEADER_H, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...C.white);
    doc.text("Relatório de Vendas", MARGIN + 4, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(periodDisplay(dateRange), MARGIN + 4, 20);
    const now = format(new Date(), "'Gerado em' dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    doc.text(now, W - MARGIN, 14, { align: "right" });
    doc.setFontSize(7);
    doc.text(`Página ${pageNum} de ${totalPages}`, W - MARGIN, 20, { align: "right" });
  };

  const totalFat   = vendas.reduce((a, v) => a + v.valor_fechado, 0);
  const ticketMed  = vendas.length > 0 ? totalFat / vendas.length : 0;
  const maiorVenda = vendas.length > 0 ? Math.max(...vendas.map(v => v.valor_fechado)) : 0;

  const metrics = [
    { label: "FATURAMENTO TOTAL", value: fmtBRL(totalFat),  accent: true },
    { label: "TICKET MÉDIO",       value: fmtBRL(ticketMed), accent: false },
    { label: "TOTAL DE VENDAS",    value: `${vendas.length}`, accent: false },
    { label: "MAIOR VENDA",        value: fmtBRL(maiorVenda),accent: false },
  ];

  const drawMetrics = (startY: number) => {
    const bW = (W - MARGIN * 2 - 9) / 4;
    metrics.forEach((m, i) => {
      const x = MARGIN + i * (bW + 3);
      doc.setFillColor(...(m.accent ? C.greenBg : C.light));
      doc.roundedRect(x, startY, bW, 16, 2, 2, "F");
      doc.setFillColor(...(m.accent ? C.green : C.border));
      doc.roundedRect(x, startY, bW, 16, 2, 2, "S");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...C.muted);
      doc.text(m.label, x + 4, startY + 5.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...(m.accent ? [5, 122, 85] as [number, number, number] : C.dark));
      doc.text(m.value, x + 4, startY + 12.5);
    });
  };

  const cols = [
    { header: "CLIENTE",           w: 52 },
    { header: "SERVIÇO / PRODUTO", w: 60 },
    { header: "VALOR ORÇADO",      w: 36 },
    { header: "VALOR FECHADO",     w: 36 },
    { header: "DATA",              w: 26 },
    { header: "PAGAMENTO",         w: 40 },
  ];
  const tableW = cols.reduce((a, c) => a + c.w, 0);

  const drawTableHeader = (y: number) => {
    doc.setFillColor(...C.dark);
    doc.rect(MARGIN, y, tableW, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.white);
    let cx = MARGIN + 3;
    cols.forEach(col => {
      doc.text(col.header, cx, y + 5.5);
      cx += col.w;
    });
  };

  const drawTableRow = (v: Venda, idx: number, y: number) => {
    if (idx % 2 === 0) {
      doc.setFillColor(...C.stripe);
      doc.rect(MARGIN, y, tableW, ROW_H, "F");
    }
    doc.setDrawColor(...C.border);
    doc.line(MARGIN, y + ROW_H, MARGIN + tableW, y + ROW_H);
    const cells = [
      truncateStr(doc, v.leads?.nome ?? "—", cols[0].w - 6, 8),
      truncateStr(doc, v.produto_servico ?? "—", cols[1].w - 6, 8),
      v.valor_orcado != null ? fmtBRL(v.valor_orcado) : "—",
      fmtBRL(v.valor_fechado),
      format(parseISO(v.data_fechamento), "dd/MM/yyyy"),
      truncateStr(doc, v.forma_pagamento ?? "—", cols[5].w - 6, 8),
    ];
    let cx = MARGIN + 3;
    cells.forEach((cell, ci) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...(ci === 3 ? C.green : C.dark));
      doc.text(cell, cx, y + 5.2);
      cx += cols[ci].w;
    });
  };

  const drawFooter = () => {
    doc.setFillColor(...C.light);
    doc.rect(0, H - 10, W, 10, "F");
    doc.setDrawColor(...C.border);
    doc.line(0, H - 10, W, H - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(
      `${vendas.length} venda${vendas.length !== 1 ? "s" : ""} • Faturamento: ${fmtBRL(totalFat)} • Ticket médio: ${fmtBRL(ticketMed)}`,
      MARGIN, H - 4
    );
  };

  const METRICS_Y       = HEADER_H + 6;
  const METRICS_H       = 16;
  const TABLE_HEADER_Y  = METRICS_Y + METRICS_H + 6;
  const FIRST_ROW_Y     = TABLE_HEADER_Y + 8;
  const FOOTER_Y        = H - 10;

  const rowsPerFirstPage = Math.floor((FOOTER_Y - FIRST_ROW_Y) / ROW_H);
  const TABLE_HEADER_NEXT_Y = HEADER_H + 6;
  const FIRST_ROW_NEXT_Y    = TABLE_HEADER_NEXT_Y + 8;
  const rowsPerNextPage     = Math.floor((FOOTER_Y - FIRST_ROW_NEXT_Y) / ROW_H);

  const totalPages =
    vendas.length <= rowsPerFirstPage
      ? 1
      : 1 + Math.ceil((vendas.length - rowsPerFirstPage) / rowsPerNextPage);

  drawPageHeader(1, totalPages);
  drawMetrics(METRICS_Y);
  drawTableHeader(TABLE_HEADER_Y);
  vendas.slice(0, rowsPerFirstPage).forEach((v, i) => drawTableRow(v, i, FIRST_ROW_Y + i * ROW_H));
  drawFooter();

  let remaining = vendas.slice(rowsPerFirstPage);
  let page = 2;
  while (remaining.length > 0) {
    doc.addPage();
    drawPageHeader(page, totalPages);
    drawTableHeader(TABLE_HEADER_NEXT_Y);
    remaining.slice(0, rowsPerNextPage).forEach((v, i) => drawTableRow(v, i, FIRST_ROW_NEXT_Y + i * ROW_H));
    drawFooter();
    remaining = remaining.slice(rowsPerNextPage);
    page++;
  }

  doc.save(`vendas_${periodLabel(dateRange)}.pdf`);
}

// ── Component ──────────────────────────────────────────────────

export function ExportVendasButton({ vendas, dateRange }: Props) {
  const [open, setOpen]       = useState(false);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleExport = async (type: "xlsx" | "pdf") => {
    setExporting(type);
    setOpen(false);
    try {
      if (type === "xlsx") await exportToXLSX(vendas, dateRange);
      else exportToPDF(vendas, dateRange);
    } finally {
      setTimeout(() => setExporting(null), 1500);
    }
  };

  const isEmpty = vendas.length === 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !isEmpty && setOpen(v => !v)}
        disabled={isEmpty}
        className={cn(
          "h-9 flex items-center gap-2 px-4 rounded-lg border text-xs font-semibold transition-all",
          "bg-card border-border/60 text-foreground hover:bg-muted/60 hover:border-border",
          open && "bg-muted/60 border-border",
          isEmpty && "opacity-40 cursor-not-allowed",
          !isEmpty && "cursor-pointer"
        )}
      >
        {exporting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        Exportar
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-border/60 bg-card shadow-[0_12px_40px_rgba(0,0,0,0.14)] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">

          {/* Header */}
          <div className="px-4 py-3.5 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted">
                <Download className="h-3 w-3 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-foreground">Exportar dados</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {vendas.length} venda{vendas.length !== 1 ? "s" : ""} no período selecionado
                </p>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="p-2 space-y-1">
            {/* XLSX */}
            <button
              onClick={() => handleExport("xlsx")}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/50 active:bg-muted/80 transition-colors text-left group"
            >
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/50 shrink-0 group-hover:bg-emerald-100/70 transition-colors">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-foreground">Planilha Excel (XLSX)</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  Design completo com métricas, cores e filtros
                </p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
            </button>

            {/* PDF */}
            <button
              onClick={() => handleExport("pdf")}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/50 active:bg-muted/80 transition-colors text-left group"
            >
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200/50 shrink-0 group-hover:bg-rose-100/70 transition-colors">
                <FileText className="h-4 w-4 text-rose-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-foreground">Relatório PDF</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  Métricas + tabela formatada, pronto para imprimir
                </p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
            </button>
          </div>

          {/* Footer note */}
          <div className="px-4 py-2.5 border-t border-border/40 bg-muted/[0.03]">
            <p className="text-[9px] text-muted-foreground/40 text-center">
              Exporta os dados do período selecionado
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
