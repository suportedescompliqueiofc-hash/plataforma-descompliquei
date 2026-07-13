import type { PaginaResumo } from "@/hooks/usePaginas";

export interface PaginaTreeNode extends PaginaResumo {
  filhos: PaginaTreeNode[];
}

export function buildTree(paginas: PaginaResumo[]): PaginaTreeNode[] {
  const byId = new Map<string, PaginaTreeNode>();
  for (const p of paginas) byId.set(p.id, { ...p, filhos: [] });

  const roots: PaginaTreeNode[] = [];
  for (const p of paginas) {
    const node = byId.get(p.id)!;
    if (p.parent_id && byId.has(p.parent_id)) {
      byId.get(p.parent_id)!.filhos.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortByOrdem = (a: PaginaTreeNode, b: PaginaTreeNode) => a.ordem_index - b.ordem_index;
  const sortRecursive = (nodes: PaginaTreeNode[]) => {
    nodes.sort(sortByOrdem);
    for (const n of nodes) sortRecursive(n.filhos);
  };
  sortRecursive(roots);

  return roots;
}

export function findBreadcrumb(paginas: PaginaResumo[], id: string): PaginaResumo[] {
  const byId = new Map(paginas.map((p) => [p.id, p]));
  const trail: PaginaResumo[] = [];
  let current = byId.get(id);
  while (current) {
    trail.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return trail;
}

export function collectDescendantIds(paginas: PaginaResumo[], rootId: string): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const p of paginas) {
    if (!p.parent_id) continue;
    const list = childrenByParent.get(p.parent_id) ?? [];
    list.push(p.id);
    childrenByParent.set(p.parent_id, list);
  }
  const result = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const childId of childrenByParent.get(id) ?? []) {
      if (!result.has(childId)) {
        result.add(childId);
        stack.push(childId);
      }
    }
  }
  return result;
}
