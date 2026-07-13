import { cn } from "@/lib/utils";

// Parser de markdown leve para as respostas do Athos — extraído de
// DescompliqueiOS.tsx pra ser a ÚNICA fonte de verdade de como uma mensagem
// do Athos é renderizada, em qualquer superfície (chat principal, painéis
// embutidos como o de Notas, Athos CS, etc). Não mexer na lógica aqui sem
// atualizar todos os consumidores — é intencional que sejam idênticos.

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="bg-muted/60 px-1.5 py-0.5 rounded-md text-[11px] font-mono text-foreground/80">$1</code>');
}

type MDBlock =
  | { type: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; items: string[]; ordered: boolean }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "code"; lines: string[] }
  | { type: "hr" };

function parseBlocks(content: string): MDBlock[] {
  const lines = content.split("\n");
  const blocks: MDBlock[] = [];
  let i = 0;

  const isListItem = (l: string) =>
    /^[\-\*•]\s+/.test(l.trim()) || /^\d+\.\s+/.test(l.trim());

  while (i < lines.length) {
    const line = lines[i];

    // blank
    if (!line.trim()) { i++; continue; }

    // HR
    if (/^[-*_]{3,}$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++; continue;
    }

    // Heading
    const hm = line.match(/^(#{1,4})\s+(.+)/);
    if (hm) {
      blocks.push({ type: "heading", level: Math.min(hm[1].length, 4) as 1|2|3|4, text: hm[2] });
      i++; continue;
    }

    // Code block
    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: "code", lines: codeLines });
      continue;
    }

    // Table
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const parseRow = (row: string) =>
        row.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim());
      const isSep = (row: string) => /^\|[\s\-:|]+\|/.test(row);
      if (tableLines.length >= 2 && isSep(tableLines[1])) {
        const headers = parseRow(tableLines[0]);
        const rows = tableLines.slice(2).map(parseRow);
        blocks.push({ type: "table", headers, rows });
      }
      continue;
    }

    // List
    if (isListItem(line)) {
      const items: string[] = [];
      const ordered = /^\d+\./.test(line.trim());
      while (i < lines.length && isListItem(lines[i])) {
        items.push(lines[i].replace(/^[\-\*•]\s+/, "").replace(/^\d+\.\s+/, "").trim());
        i++;
      }
      blocks.push({ type: "list", items, ordered });
      continue;
    }

    // Paragraph
    const paraLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) break;
      if (/^#{1,4}\s/.test(l)) break;
      if (l.trim().startsWith("|")) break;
      if (l.trim().startsWith("```")) break;
      if (/^[-*_]{3,}$/.test(l.trim())) break;
      if (isListItem(l) && paraLines.length === 0) break;
      paraLines.push(l);
      i++;
    }
    if (paraLines.length) blocks.push({ type: "paragraph", lines: paraLines });
  }

  return blocks;
}

export function MessageContent({ content }: { content: string }) {
  if (!content) return null;
  const blocks = parseBlocks(content);

  return (
    <div className="space-y-2.5 text-[13px] leading-relaxed">
      {blocks.map((block, i) => {
        switch (block.type) {

          case "heading": {
            const styles: Record<number, string> = {
              1: "text-[15px] font-bold text-foreground mt-2 mb-0.5",
              2: "text-[13px] font-bold text-foreground mt-2 mb-0.5",
              3: "text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-2 mb-0.5",
              4: "text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mt-1",
            };
            return (
              <p key={i} className={styles[block.level]}
                dangerouslySetInnerHTML={{ __html: renderInline(block.text) }} />
            );
          }

          case "hr":
            return <hr key={i} className="border-border/30 my-1" />;

          case "code":
            return (
              <pre key={i} className="bg-muted/40 border border-border/40 rounded-xl px-4 py-3 overflow-x-auto my-1">
                <code className="text-[11px] font-mono text-foreground/80 whitespace-pre">
                  {block.lines.join("\n")}
                </code>
              </pre>
            );

          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-xl border border-border/40 my-1">
                <table className="w-full text-[12px] border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border/40">
                      {block.headers.map((h, j) => (
                        <th key={j} className="px-3 py-2 text-left font-semibold text-muted-foreground text-[10px] uppercase tracking-wider whitespace-nowrap">
                          <span dangerouslySetInnerHTML={{ __html: renderInline(h) }} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, j) => (
                      <tr key={j} className={cn(
                        "border-b border-border/20 last:border-0 transition-colors",
                        j % 2 === 1 ? "bg-muted/[0.03]" : ""
                      )}>
                        {row.map((cell, k) => (
                          <td key={k} className="px-3 py-2 text-foreground/80">
                            <span dangerouslySetInnerHTML={{ __html: renderInline(cell) }} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case "list":
            return (
              <ul key={i} className="space-y-1.5 my-0.5">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2 items-start">
                    {block.ordered ? (
                      <span className="shrink-0 text-[11px] font-semibold text-muted-foreground/40 mt-[1px] min-w-[18px] tabular-nums">{j + 1}.</span>
                    ) : (
                      <span className="shrink-0 text-muted-foreground/30 mt-[5px] text-[8px] leading-none">▸</span>
                    )}
                    <span className="flex-1 text-foreground/85"
                      dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
                  </li>
                ))}
              </ul>
            );

          case "paragraph":
            return (
              <p key={i} className="text-foreground/85"
                dangerouslySetInnerHTML={{ __html: renderInline(block.lines.join("<br/>")) }} />
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
