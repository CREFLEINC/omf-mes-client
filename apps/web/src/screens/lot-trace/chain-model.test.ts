import { describe, expect, it } from 'vitest';

import {
  backwardImpact,
  backwardStages,
  currentStage,
  flattenBackward,
  flattenForward,
  forwardImpact,
  forwardStages,
  groupShipments,
} from './chain-model';
import {
  backwardChain,
  forwardChain,
  inputMaterial,
  productionLot,
  workOrder,
} from './trace-fixtures';
import type { FlowShipment, FlowSplitLink } from './trace-types';

const shipment = (shipmentId: number, hu: string | null, qty: number): FlowShipment => ({
  shipmentId,
  shipmentNo: `SH-${String(shipmentId)}`,
  shippedAt: '2026-10-24T02:00:00Z',
  statusCode: 'CONFIRMED',
  customer: { id: shipmentId, code: `CUS-${String(shipmentId)}`, name: '고객' },
  qty,
  handlingUnitNo: hu,
});

describe('사슬 계산', () => {
  it('출하는 출하 번호로 묶고 취급 단위를 그 아래에 둔다(포장 없이 직접 배분은 단위 줄 없음)', () => {
    const groups = groupShipments([
      shipment(1, 'HU-1', 10),
      shipment(1, 'HU-2', 5),
      shipment(2, null, 3),
    ]);
    expect(groups.map((g) => [g.shipmentNo, g.qty, g.units.length])).toEqual([
      ['SH-1', 15, 2],
      ['SH-2', 3, 0],
    ]);
  });

  it('정방향 단계 줄: 포장은 확정만 세고, 지금 단계는 건수가 있는 마지막 단계다', () => {
    const lot = productionLot(201, 'P-1', {
      packages: [
        {
          handlingUnitId: 1,
          handlingUnitNo: 'HU-1',
          handlingUnitTypeCode: 'BOX',
          statusCode: 'OPEN',
          qty: 10,
          shippingUnit: null,
        },
      ],
    });
    const chain = forwardChain(101, 'M-1', [workOrder(1, [lot]), workOrder(2, [], null)]);
    const cells = forwardStages(chain);
    expect(cells.map((cell) => [cell.stage, cell.count])).toEqual([
      ['RECEIVED', 1],
      ['CONSUMED', 2],
      ['PRODUCED', 1],
      ['PRODUCTION_RECEIVED', 0],
      ['PACKED', 0],
      ['SHIPPED', 0],
    ]);
    expect(currentStage(cells)).toBe('PRODUCED');
    expect(forwardImpact(chain)).toEqual({ lots: 1, shipments: 0, customers: 0 });
  });

  it('역방향 단계 줄과 영향 요약(공급사는 입하 공급사로 센다)', () => {
    const chain = backwardChain(201, 'P-1', [inputMaterial(101, 'M-1'), inputMaterial(102, 'M-2')]);
    expect(backwardStages(chain).map((cell) => cell.stage)).toEqual([
      'PRODUCED',
      'PRODUCTION_RECEIVED',
      'PACKED',
      'SHIPPED',
    ]);
    expect(backwardImpact(chain)).toEqual({ lots: 2, suppliers: 1 });
  });

  it('추적 내보내기: LOT, 입하, 자재 입고, W/O, 생산 LOT 순으로 단계 깊이를 단다', () => {
    const root = forwardChain(101, 'M-1', [workOrder(1, [productionLot(201, 'P-1')])]);
    const lines = flattenForward(root);
    expect(lines.map((line) => [line.depth, line.kind])).toEqual([
      [0, 'LOT'],
      [1, 'INBOUND'],
      [1, 'RECEIPT'],
      [1, 'WORK_ORDER'],
      [2, 'PRODUCTION_LOT'],
    ]);
    expect(lines[0]).toMatchObject({ number: 'M-1' });
  });

  it('역방향 내보내기: 투입 자재와 근거, 공급사를 담는다', () => {
    const lines = flattenBackward(backwardChain(201, 'P-1', [inputMaterial(101, 'M-1')]));
    expect(lines.find((line) => line.kind === 'INPUT_MATERIAL')).toMatchObject({
      number: 'M-1',
      basis: 'LOT_GENEALOGY_ESTIMATE',
      partner: { code: 'SUP-A' },
    });
  });
});

/* 008 부분 출고 LOT 분할(omf-all-around#289) — 추적 내보내기에 분할 줄을 싣는다. */
describe('분할 줄 (008)', () => {
  const ROOT = 'ITEM-A|1000|261023|SUP-A|0001';
  const SPLIT = 'ITEM-A|300|261023|SUP-A|0001-S1';
  const NESTED = 'ITEM-A|120|261023|SUP-A|0001-S1-S1';
  const link = (lotId: number, lotNo: string, qty: number): FlowSplitLink => ({
    relationTypeCode: 'SPLIT',
    lot: { ...forwardChain(lotId, lotNo, []).lot },
    qty,
    uomCode: 'KG',
    splitAt: '2026-11-17T01:40:00Z',
    goodsIssue: { goodsIssueId: 7, goodsIssueNo: 'GI-SYN-0003', goodsIssueLineId: 9, lineNo: 1 },
  });
  const notes = { split: () => '분할 (GI-SYN-0003 · 라인 1)', rootInbound: '원래 LOT 의 입하' };

  it('US4-2 원래 LOT 은 분할 LOT 줄을 자손 깊이대로, W/O 는 경유 LOT 을 싣는다', () => {
    const chain = {
      ...forwardChain(101, ROOT, [{ ...workOrder(70, []), viaLot: { lotId: 102, lotNo: SPLIT } }]),
      splits: [link(102, SPLIT, 300), link(103, NESTED, 120)],
    };
    const lines = flattenForward(chain, notes);

    expect(
      lines
        .filter((line) => line.kind === 'SPLIT')
        .map((line) => [line.depth, line.number, line.qty]),
    ).toEqual([
      [1, SPLIT, 300],
      [2, NESTED, 120],
    ]);
    expect(lines.find((line) => line.kind === 'WORK_ORDER')?.via).toBe(SPLIT);
  });

  it('US4-3 분할 LOT 은 원래 LOT 줄과 수량 = 분할 수량, 입하 줄에 원래 LOT 의 입하라고 적는다', () => {
    const lines = flattenForward(
      { ...forwardChain(102, SPLIT, []), splitFrom: link(101, ROOT, 300) },
      notes,
    );

    expect(lines[0]).toMatchObject({ kind: 'LOT', qty: 300 });
    expect(lines[1]).toMatchObject({
      kind: 'SPLIT_FROM',
      number: ROOT,
      note: '분할 (GI-SYN-0003 · 라인 1)',
    });
    expect(lines.find((line) => line.kind === 'INBOUND')?.note).toBe('원래 LOT 의 입하');
  });

  it('US4-1 투입 자재가 분할 LOT 이면 조상을 한 단씩 깊게 싣는다', () => {
    const chain = backwardChain(201, 'P-SYN-0001', [
      inputMaterial(103, NESTED, { splitAncestry: [link(102, SPLIT, 120), link(101, ROOT, 300)] }),
    ]);

    expect(
      flattenBackward(chain, notes)
        .filter((line) => line.kind === 'SPLIT_FROM')
        .map((line) => [line.depth, line.number]),
    ).toEqual([
      [3, SPLIT],
      [4, ROOT],
    ]);
  });

  it('분할이 없으면 줄이 지금과 같다(회귀)', () => {
    const chain = forwardChain(101, ROOT, []);

    expect(flattenForward(chain, notes)).toEqual(flattenForward(chain));
  });
});
