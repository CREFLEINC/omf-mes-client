import { describe, expect, it } from 'vitest';

import {
  BUNDLE_PAGE,
  BUNDLE_THRESHOLD,
  FIRST_VIEW_CAP,
  buildLineage,
  collapseAll,
  expandAll,
  firstView,
  locate,
  openBundle,
  toggleRow,
  visibleRows,
  type VisibleRow,
} from './graph-rows';
import type { TraceGraph, TraceGraphEdge, TraceGraphNode } from './types';

const lot = (id: number, kind: TraceGraphNode['kind'] = 'PRODUCTION_LOT', lotNo?: string) =>
  ({
    nodeKey: `L:${String(id)}`,
    kind,
    lot: {
      lotId: id,
      lotNo: lotNo ?? `LOT-${String(id)}`,
      lotTypeCode: kind === 'MATERIAL_LOT' || kind === 'SPLIT_LOT' ? 'MATERIAL' : 'PRODUCTION',
      statusCode: 'NORMAL',
      lifecycleStatusCode: 'ACTIVE',
    },
    qty: 10,
    uomCode: 'EA',
  }) satisfies TraceGraphNode;

const wo = (id: number): TraceGraphNode => ({
  nodeKey: `W:${String(id)}`,
  kind: 'WORK_ORDER',
  workOrder: { workOrderId: id, workOrderNo: `WO-${String(id)}`, statusCode: 'CLOSED' },
});

const ship = (id: number): TraceGraphNode => ({
  nodeKey: `S:${String(id)}`,
  kind: 'SHIPMENT',
  shipment: {
    shipmentId: id,
    shipmentNo: `SH-${String(id)}`,
    shippedAt: null,
    statusCode: 'SHIPPED',
    customer: { partnerId: 1, code: 'C1', name: '고객 X' },
  },
});

const edge = (
  from: string,
  to: string,
  kind: TraceGraphEdge['kind'],
  qty = 10,
): TraceGraphEdge => ({
  from,
  to,
  kind,
  qty,
  basis: 'RECORDED',
});

const graph = (root: string, nodes: TraceGraphNode[], edges: TraceGraphEdge[]): TraceGraph => ({
  root,
  nodes,
  edges,
  limit: { exceeded: false, maxDepthReached: false, lotCount: nodes.length, lotCap: 5000 },
});

const keysOf = (rows: readonly VisibleRow[]) =>
  rows.map((row) => (row.type === 'node' ? row.line.nodeKey : `${row.type}:${row.key}`));

/* A → W/O 1 → P1 → W/O 2 → P3 → SH-1, W/O 1 → P2, A → A-S1 → W/O 3 */
const small = graph(
  'L:1',
  [
    lot(1, 'MATERIAL_LOT', 'A'),
    wo(1),
    lot(11),
    lot(12),
    wo(2),
    lot(13),
    ship(1),
    lot(2, 'SPLIT_LOT'),
    wo(3),
  ],
  [
    edge('L:1', 'W:1', 'CONSUMED'),
    edge('L:1', 'L:2', 'SPLIT'),
    edge('W:1', 'L:11', 'PRODUCED'),
    edge('W:1', 'L:12', 'PRODUCED'),
    edge('L:2', 'W:3', 'CONSUMED'),
    edge('L:11', 'W:2', 'CONSUMED'),
    edge('W:2', 'L:13', 'PRODUCED'),
    edge('L:13', 'S:1', 'SHIPPED'),
  ],
);

describe('계보 줄 만들기(graph → rows)', () => {
  it('US1-1 깊이 우선으로 들여 쓰고 줄 순서는 그래프 줄 순서다', () => {
    const lineage = buildLineage(small);
    const rows = visibleRows(lineage, firstView(lineage));
    expect(keysOf(rows)).toEqual([
      'L:1',
      'W:1',
      'L:11',
      'W:2',
      'L:13',
      'S:1',
      'L:12',
      'L:2',
      'W:3',
    ]);
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 2, 3, 4, 5, 2, 1, 2]);
  });

  it('US1-2 반제품(다시 투입된 생산 LOT)은 반제품 LOT 으로 적는다', () => {
    const lineage = buildLineage(small);
    const stageOf = (key: string) => lineage.all.find((line) => line.nodeKey === key)?.stage;
    expect(stageOf('L:11')).toBe('SEMI_LOT');
    expect(stageOf('L:13')).toBe('PRODUCTION_LOT');
    expect(stageOf('L:2')).toBe('SPLIT_LOT');
  });

  it('US2-4 출고 번호 없는 생산 LOT 자식은 「분리 LOT」(013), 역방향의 원래 LOT 은 「분리된 원래 LOT」', () => {
    const separated = graph(
      'L:41',
      [{ ...lot(41, 'SPLIT_LOT'), lot: { ...lot(41).lot, lotTypeCode: 'PRODUCTION' } }, lot(4)],
      [edge('L:41', 'L:4', 'SPLIT_FROM')],
    );
    const lineage = buildLineage(separated);
    expect(lineage.all.map((line) => line.stage)).toEqual(['SEPARATED_LOT', 'SEPARATED_ORIGIN']);
  });

  it('경계-여러 길 같은 LOT 에 두 길로 닿으면 두 번째부터 「중복 — 위와 같음」이고 아래를 펴지 않는다', () => {
    const twoWays = graph(
      'L:1',
      [lot(1, 'MATERIAL_LOT'), wo(1), lot(2, 'SPLIT_LOT'), lot(11)],
      [
        edge('L:1', 'W:1', 'CONSUMED'),
        edge('L:1', 'L:2', 'SPLIT'),
        edge('W:1', 'L:11', 'PRODUCED'),
        edge('L:2', 'W:1', 'CONSUMED'),
      ],
    );
    const lineage = buildLineage(twoWays);
    const rows = visibleRows(lineage, firstView(lineage));
    expect(keysOf(rows)).toEqual(['L:1', 'W:1', 'L:11', 'L:2', 'W:1']);
    const last = rows.at(-1);
    expect(last?.type === 'node' && last.line.mark).toBe('duplicate');
    expect(last?.type === 'node' && last.line.children).toEqual([]);
  });

  it('Q15 조상과 같은 항목은 「순환 참조 — 전개 중단」으로 멈춘다', () => {
    const cycle = graph(
      'L:1',
      [lot(1), wo(1)],
      [edge('L:1', 'W:1', 'CONSUMED'), edge('W:1', 'L:1', 'PRODUCED')],
    );
    const lineage = buildLineage(cycle);
    const rows = visibleRows(lineage, firstView(lineage));
    expect(keysOf(rows)).toEqual(['L:1', 'W:1', 'L:1']);
    const last = rows.at(-1);
    expect(last?.type === 'node' && last.line.mark).toBe('cycle');
  });

  it('US1-5 접은 줄 아래만 숨고 다시 펴면 돌아온다', () => {
    const lineage = buildLineage(small);
    const view = firstView(lineage);
    const w1 = lineage.all.find((line) => line.nodeKey === 'W:1');
    const folded = toggleRow(view, w1?.key ?? '');
    expect(keysOf(visibleRows(lineage, folded))).toEqual(['L:1', 'W:1', 'L:2', 'W:3']);
    expect(keysOf(visibleRows(lineage, toggleRow(folded, w1?.key ?? '')))).toEqual(
      keysOf(visibleRows(lineage, view)),
    );
  });
});

/* C → W/O 1 → 생산 LOT 134개, 각 LOT → 재고 */
const bigCount = 134;
const big = (() => {
  const nodes: TraceGraphNode[] = [lot(1, 'MATERIAL_LOT', 'C'), wo(1)];
  const edges: TraceGraphEdge[] = [edge('L:1', 'W:1', 'CONSUMED')];
  for (let index = 0; index < bigCount; index += 1) {
    const id = 100 + index;
    nodes.push(lot(id));
    nodes.push({
      nodeKey: `K:${String(id)}:1`,
      kind: 'STOCK',
      qty: 10,
      warehouse: { warehouseId: 1, code: 'WH', name: '제품창고' },
      location: { locationId: 1, code: 'A-01', name: 'A-01' },
    });
    edges.push(edge('W:1', `L:${String(id)}`, 'PRODUCED'));
    edges.push(edge(`L:${String(id)}`, `K:${String(id)}:1`, 'STOCKED'));
  }
  return graph('L:1', nodes, edges);
})();

describe('Q17 큰 계보 — 묶음 · [더 보기] · 처음 펼침', () => {
  it(`같은 부모 아래 같은 종류가 ${String(BUNDLE_THRESHOLD)}개를 넘으면 「생산 LOT n개」 묶음으로 접어 둔다`, () => {
    const lineage = buildLineage(big);
    const rows = visibleRows(lineage, firstView(lineage));
    expect(keysOf(rows)).toEqual(['L:1', 'W:1', expect.stringMatching(/^bundle:/) as string]);
    const bundle = rows[2];
    expect(bundle?.type === 'bundle' && bundle.count).toBe(bigCount);
    expect(bundle?.type === 'bundle' && bundle.kind).toBe('PRODUCTION_LOT');
  });

  it(`SC-006 처음 그린 줄은 ${String(FIRST_VIEW_CAP)} 이하이고 [전체 펼치기]는 꺼진다`, () => {
    const lineage = buildLineage(big);
    expect(lineage.total).toBe(2 + bigCount * 2);
    expect(lineage.canExpandAll).toBe(false);
    expect(visibleRows(lineage, firstView(lineage)).length).toBeLessThanOrEqual(FIRST_VIEW_CAP);
  });

  it(`묶음을 펴면 ${String(BUNDLE_PAGE)}개와 [더 보기], 누를 때마다 ${String(BUNDLE_PAGE)}개씩 더`, () => {
    const lineage = buildLineage(big);
    const bundle = visibleRows(lineage, firstView(lineage))[2];
    const key = bundle?.key ?? '';
    const once = openBundle(firstView(lineage), key);
    const rows = visibleRows(lineage, once);
    const lots = rows.filter(
      (row) => row.type === 'node' && row.line.node?.kind === 'PRODUCTION_LOT',
    );
    expect(lots).toHaveLength(BUNDLE_PAGE);
    const more = rows.at(-1);
    expect(more?.type).toBe('more');
    expect(more?.type === 'more' && more.remaining).toBe(bigCount - BUNDLE_PAGE);
    const thrice = openBundle(openBundle(once, key), key);
    const all = visibleRows(lineage, thrice);
    expect(
      all.filter((row) => row.type === 'node' && row.line.node?.kind === 'PRODUCTION_LOT'),
    ).toHaveLength(bigCount);
    expect(all.some((row) => row.type === 'more')).toBe(false);
  });

  it('작은 계보(묶음을 다 푼 줄이 200 이하)는 처음부터 모두 펴고 [전체 펼치기]가 켜진다', () => {
    const lineage = buildLineage(small);
    expect(lineage.canExpandAll).toBe(true);
    expect(visibleRows(lineage, firstView(lineage))).toHaveLength(lineage.total);
  });

  it('[모두 접기]는 뿌리 아래 한 단계만, [전체 펼치기]는 모두', () => {
    const lineage = buildLineage(small);
    expect(keysOf(visibleRows(lineage, collapseAll(lineage)))).toEqual(['L:1', 'W:1', 'L:2']);
    expect(visibleRows(lineage, expandAll(lineage))).toHaveLength(lineage.total);
  });
});

describe('Q18 최종 LOT 줄 → 경로 펼치기', () => {
  it('기준 LOT 에서 그 LOT 까지 첫 경로와 묶음을 펴고 그 줄 키를 돌려준다', () => {
    const lineage = buildLineage(big);
    const target = 'L:209'; // 110번째 생산 LOT
    const located = locate(lineage, collapseAll(lineage), target);
    expect(located).not.toBeNull();
    const rows = visibleRows(lineage, located?.view ?? firstView(lineage));
    const index = rows.findIndex((row) => row.key === located?.rowKey);
    expect(index).toBeGreaterThan(0);
    const found = rows[index];
    expect(found?.type === 'node' && found.line.nodeKey).toBe(target);
    expect(located?.view.located).toBe(located?.rowKey);
  });

  it('계보에 없는 항목이면 null', () => {
    const lineage = buildLineage(small);
    expect(locate(lineage, firstView(lineage), 'L:999')).toBeNull();
  });

  it('접힌 조상도 편다', () => {
    const lineage = buildLineage(small);
    const located = locate(lineage, collapseAll(lineage), 'S:1');
    expect(keysOf(visibleRows(lineage, located?.view ?? firstView(lineage)))).toContain('S:1');
  });
});
