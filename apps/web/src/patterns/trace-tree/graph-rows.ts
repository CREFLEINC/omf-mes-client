import type { TraceGraph, TraceGraphEdge, TraceGraphNode, TraceNodeKind } from './types';

/**
 * 추적 그래프 → LOT 계보 줄(피처 015 R-13) — 순수 함수만 둔다.
 *
 * 서버는 LOT 하나의 그래프(항목·줄)를 한 번에 준다. 화면은 그것을 뿌리에서 깊이 우선으로 펴 계보 줄로 만들고
 * (서버 내보내기 「LOT 계보」 시트와 같은 규칙 — 줄 순서는 그래프 줄 순서, 같은 항목 두 번째부터 「중복」,
 * 조상과 같으면 「순환」으로 멈춤), 그리기만 나눈다.
 *
 * - 묶음: 같은 부모 아래 같은 종류 항목이 20개를 넘으면 묶음 줄(「생산 LOT n개」) 하나로 접고, 펴면 50개씩 보이며
 *   [더 보기]로 50개씩 더 연다.
 * - 처음 펼침: 묶음을 모두 푼 줄이 200 이하면 모두 편다. 넘으면 2단계까지(묶음은 접힌 채) — 그래도 200을 넘으면
 *   1단계, 0단계로 줄인다(SC-006 처음 그린 줄 200 이하).
 * - [전체 펼치기]: 묶음을 모두 푼 줄이 200 이하일 때만.
 * - 경로 펼치기(`locate`): 최종 LOT 줄을 고르면 뿌리에서 그 항목까지 첫 경로의 접힌 조상과 묶음을 편다.
 */

export const BUNDLE_THRESHOLD = 20;
export const BUNDLE_PAGE = 50;
export const FIRST_VIEW_CAP = 200;
/** 처음 펼침이 넘치면 펼 깊이(줄 깊이 기준, 그 깊이의 줄까지 보인다). */
const FIRST_VIEW_DEPTH = 2;

/**
 * 계보 줄의 단계 — 항목 종류에 계보 안 자리를 더한다.
 * - `SEMI_LOT` 다시 투입된 생산 LOT(반제품) · `SEPARATED_LOT` 생산 LOT 분리(013) 자식
 * - `SPLIT_ORIGIN` 분할된 원래 LOT · `SEPARATED_ORIGIN` 분리된 원래 LOT(역방향 — 자식이 분할이냐 분리냐를 따른다)
 */
export type LineageStage =
  TraceNodeKind | 'SEMI_LOT' | 'SEPARATED_LOT' | 'SPLIT_ORIGIN' | 'SEPARATED_ORIGIN';

export type LineageMark = 'none' | 'duplicate' | 'cycle';

export interface LineageLine {
  /** 뿌리부터의 자리(「0.1.2」) — 접기 상태와 줄의 열쇠. 같은 항목이 두 길로 오면 자리가 다르다. */
  key: string;
  nodeKey: string;
  node: TraceGraphNode | undefined;
  /** 부모에서 이 줄로 온 이음. 뿌리는 없다. */
  edge: TraceGraphEdge | null;
  parent: LineageLine | null;
  depth: number;
  mark: LineageMark;
  stage: LineageStage;
  children: LineageLine[];
  groups: LineageGroup[];
  /** 묶음 안의 줄이면 그 묶음과 자리. */
  bundle: { key: string; index: number } | null;
}

export type LineageGroup =
  | { type: 'line'; line: LineageLine }
  | { type: 'bundle'; key: string; kind: TraceNodeKind; members: LineageLine[] };

export interface Lineage {
  root: LineageLine;
  /** 모든 줄(깊이 우선 순서). */
  all: LineageLine[];
  /** 묶음을 모두 푼 줄 수. */
  total: number;
  canExpandAll: boolean;
}

export interface TreeView {
  /** 접은 줄(`LineageLine.key`). 여기 없는 줄은 펴져 있다. */
  collapsed: ReadonlySet<string>;
  /** 편 묶음과 보이는 줄 수. 없는 묶음은 접혀 있다. */
  bundles: ReadonlyMap<string, number>;
  /** 경로 펼치기로 찾아간 줄. */
  located: string | null;
}

export type VisibleRow =
  | {
      type: 'node';
      key: string;
      depth: number;
      line: LineageLine;
      expandable: boolean;
      expanded: boolean;
      located: boolean;
    }
  | {
      type: 'bundle';
      key: string;
      depth: number;
      kind: TraceNodeKind;
      count: number;
      open: boolean;
      qty: number | null;
      uomCode: string | null;
      parent: LineageLine;
    }
  | {
      type: 'more';
      key: string;
      depth: number;
      bundleKey: string;
      remaining: number;
      next: number;
    };

/**
 * 나뉜 LOT 의 갈래 — 008 부분 출고 분할은 출고 번호가 있고 자재 LOT 이다(「분할 LOT」). 출고 번호 없는 생산 LOT 자식은
 * 013 생산 LOT 분리다(「분리 LOT」). 요약 · 계보가 같은 규칙을 쓴다.
 */
export const splitStageOf = (node: TraceGraphNode): 'SPLIT_LOT' | 'SEPARATED_LOT' =>
  (node.split?.goodsIssueNo ?? null) === null && node.lot?.lotTypeCode !== 'MATERIAL'
    ? 'SEPARATED_LOT'
    : 'SPLIT_LOT';

const stageOf = (
  node: TraceGraphNode | undefined,
  edge: TraceGraphEdge | null,
  outKinds: ReadonlySet<string>,
  parentStage: LineageStage | null,
): LineageStage => {
  if (edge?.kind === 'SPLIT_FROM') {
    return parentStage === 'SEPARATED_LOT' ? 'SEPARATED_ORIGIN' : 'SPLIT_ORIGIN';
  }
  if (node === undefined) return 'PRODUCTION_LOT';
  if (node.kind === 'SPLIT_LOT') return splitStageOf(node);
  if (node.kind === 'PRODUCTION_LOT' && (edge?.kind === 'CONSUMED' || outKinds.has('CONSUMED'))) {
    return 'SEMI_LOT';
  }
  return node.kind;
};

/** 그래프를 계보 줄로 편다 — 깊이 우선, 같은 항목 두 번째부터 「중복」, 조상과 같으면 「순환」. */
export const buildLineage = (graph: TraceGraph): Lineage => {
  const nodes = new Map(graph.nodes.map((node) => [node.nodeKey, node]));
  const out = new Map<string, TraceGraphEdge[]>();
  for (const edge of graph.edges) {
    const list = out.get(edge.from);
    if (list === undefined) out.set(edge.from, [edge]);
    else list.push(edge);
  }
  const outKinds = (key: string): Set<string> =>
    new Set((out.get(key) ?? []).map((edge) => edge.kind));

  const all: LineageLine[] = [];
  const expanded = new Set<string>();
  const path = new Set<string>();

  const make = (
    nodeKey: string,
    key: string,
    edge: TraceGraphEdge | null,
    parent: LineageLine | null,
    mark: LineageMark,
  ): LineageLine => {
    const node = nodes.get(nodeKey);
    const line: LineageLine = {
      key,
      nodeKey,
      node,
      edge,
      parent,
      depth: parent === null ? 0 : parent.depth + 1,
      mark,
      stage: stageOf(node, edge, outKinds(nodeKey), parent?.stage ?? null),
      children: [],
      groups: [],
      bundle: null,
    };
    all.push(line);
    return line;
  };

  const visit = (line: LineageLine): void => {
    expanded.add(line.nodeKey);
    path.add(line.nodeKey);
    (out.get(line.nodeKey) ?? []).forEach((edge, index) => {
      const key = `${line.key}.${String(index)}`;
      const mark: LineageMark = path.has(edge.to)
        ? 'cycle'
        : expanded.has(edge.to)
          ? 'duplicate'
          : 'none';
      const child = make(edge.to, key, edge, line, mark);
      line.children.push(child);
      if (mark === 'none') visit(child);
    });
    path.delete(line.nodeKey);
    line.groups = groupChildren(line);
  };

  const root = make(graph.root, '0', null, null, 'none');
  visit(root);
  return { root, all, total: all.length, canExpandAll: all.length <= FIRST_VIEW_CAP };
};

/** 같은 종류가 20개를 넘으면 묶음 하나로 — 묶음은 그 종류 첫 줄 자리에 선다. */
const groupChildren = (line: LineageLine): LineageGroup[] => {
  const byKind = new Map<string, LineageLine[]>();
  for (const child of line.children) {
    const kind = child.node?.kind ?? 'UNKNOWN';
    const list = byKind.get(kind);
    if (list === undefined) byKind.set(kind, [child]);
    else list.push(child);
  }
  const groups: LineageGroup[] = [];
  const placed = new Set<string>();
  for (const child of line.children) {
    const kind = child.node?.kind ?? 'UNKNOWN';
    const members = byKind.get(kind) ?? [];
    if (members.length <= BUNDLE_THRESHOLD || child.node === undefined) {
      groups.push({ type: 'line', line: child });
      continue;
    }
    if (placed.has(kind)) continue;
    placed.add(kind);
    const key = `${line.key}#${kind}`;
    members.forEach((member, index) => {
      member.bundle = { key, index };
    });
    groups.push({ type: 'bundle', key, kind: child.node.kind, members });
  }
  return groups;
};

const bundlesOf = (lineage: Lineage): { key: string; size: number }[] =>
  lineage.all.flatMap((line) =>
    line.groups.flatMap((group) =>
      group.type === 'bundle' ? [{ key: group.key, size: group.members.length }] : [],
    ),
  );

/** [전체 펼치기] — 모든 줄과 묶음을 편다. */
export const expandAll = (lineage: Lineage): TreeView => ({
  collapsed: new Set(),
  bundles: new Map(bundlesOf(lineage).map((bundle) => [bundle.key, bundle.size])),
  located: null,
});

/** [모두 접기] — 뿌리 아래 한 단계만 보인다. */
export const collapseAll = (lineage: Lineage): TreeView => ({
  collapsed: new Set(
    lineage.all
      .filter((line) => line.depth > 0 && line.children.length > 0)
      .map((line) => line.key),
  ),
  bundles: new Map(),
  located: null,
});

const toDepth = (lineage: Lineage, depth: number): TreeView => ({
  collapsed: new Set(
    lineage.all
      .filter((line) => line.depth >= depth && line.children.length > 0)
      .map((line) => line.key),
  ),
  bundles: new Map(),
  located: null,
});

/** 처음 펼침 — 줄 200 이하면 모두, 넘으면 2단계까지(넘치면 더 얕게). */
export const firstView = (lineage: Lineage): TreeView => {
  if (lineage.canExpandAll) return expandAll(lineage);
  for (let depth = FIRST_VIEW_DEPTH; depth > 0; depth -= 1) {
    const view = toDepth(lineage, depth);
    if (visibleRows(lineage, view).length <= FIRST_VIEW_CAP) return view;
  }
  return toDepth(lineage, 0);
};

export const toggleRow = (view: TreeView, key: string): TreeView => {
  const collapsed = new Set(view.collapsed);
  if (collapsed.has(key)) collapsed.delete(key);
  else collapsed.add(key);
  return { ...view, collapsed };
};

/** 묶음을 펴거나 [더 보기] — 50개씩 더 보인다. */
export const openBundle = (view: TreeView, key: string): TreeView => {
  const bundles = new Map(view.bundles);
  bundles.set(key, (bundles.get(key) ?? 0) + BUNDLE_PAGE);
  return { ...view, bundles };
};

export const closeBundle = (view: TreeView, key: string): TreeView => {
  const bundles = new Map(view.bundles);
  bundles.delete(key);
  return { ...view, bundles };
};

/** 지금 보이는 줄 — 접은 줄 아래와 접은 묶음 안은 빼고, 편 묶음은 보이는 수만큼. */
export const visibleRows = (lineage: Lineage, view: TreeView): VisibleRow[] => {
  const rows: VisibleRow[] = [];
  const walk = (line: LineageLine, depth: number): void => {
    const expandable = line.children.length > 0;
    const expanded = expandable && !view.collapsed.has(line.key);
    rows.push({
      type: 'node',
      key: line.key,
      depth,
      line,
      expandable,
      expanded,
      located: view.located === line.key,
    });
    if (!expanded) return;
    for (const group of line.groups) {
      if (group.type === 'line') {
        walk(group.line, depth + 1);
        continue;
      }
      const shown = view.bundles.get(group.key);
      const qtys = group.members.map((member) => member.edge?.qty ?? null);
      const uoms = new Set(group.members.map((member) => member.node?.uomCode ?? null));
      const summable = qtys.every((qty) => qty !== null) && uoms.size === 1;
      rows.push({
        type: 'bundle',
        key: group.key,
        depth: depth + 1,
        kind: group.kind,
        count: group.members.length,
        open: shown !== undefined,
        qty: summable ? qtys.reduce<number>((sum, qty) => sum + (qty ?? 0), 0) : null,
        uomCode: summable ? ([...uoms][0] ?? null) : null,
        parent: line,
      });
      if (shown === undefined) continue;
      group.members.slice(0, shown).forEach((member) => {
        walk(member, depth + 2);
      });
      const remaining = group.members.length - shown;
      if (remaining > 0) {
        rows.push({
          type: 'more',
          key: `${group.key}:more`,
          depth: depth + 2,
          bundleKey: group.key,
          remaining,
          next: Math.min(BUNDLE_PAGE, remaining),
        });
      }
    }
  };
  walk(lineage.root, 0);
  return rows;
};

/**
 * 경로 펼치기(Q18) — 뿌리에서 그 항목까지 첫 경로(깊이 우선 순서로 처음 나오는 줄, 「중복」 줄보다 원래 줄)의
 * 접힌 조상과 묶음을 편다. 그 줄 키와 새 보기 상태를 돌려준다. 계보에 없으면 `null`.
 */
export const locate = (
  lineage: Lineage,
  view: TreeView,
  nodeKey: string,
): { view: TreeView; rowKey: string } | null => {
  const target =
    lineage.all.find((line) => line.nodeKey === nodeKey && line.mark === 'none') ??
    lineage.all.find((line) => line.nodeKey === nodeKey);
  if (target === undefined) return null;
  const collapsed = new Set(view.collapsed);
  const bundles = new Map(view.bundles);
  for (let line: LineageLine | null = target; line !== null; line = line.parent) {
    if (line !== target) collapsed.delete(line.key);
    if (line.bundle !== null) {
      const need = Math.ceil((line.bundle.index + 1) / BUNDLE_PAGE) * BUNDLE_PAGE;
      bundles.set(line.bundle.key, Math.max(bundles.get(line.bundle.key) ?? 0, need));
    }
  }
  return { view: { collapsed, bundles, located: target.key }, rowKey: target.key };
};
