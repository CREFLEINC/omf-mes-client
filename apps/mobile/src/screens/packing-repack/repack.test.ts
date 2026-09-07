import { describe, expect, it } from 'vitest';

import type { HandlingUnitContent, ScannedHandlingUnit } from '../../patterns/handling-units';
import {
  allocatedSources,
  canConfirm,
  mergedPairs,
  pooledContents,
  qtyProblemOf,
  remainderOf,
  sumOf,
  toCreateDraft,
  toReplaceDraft,
  unverifiedSources,
  type AllocationCheck,
  type DraftLine,
} from './repack';

const content = (overrides: Partial<HandlingUnitContent> = {}): HandlingUnitContent => ({
  handlingUnitContentId: 1,
  handlingUnitId: 10,
  itemId: 100,
  lotId: 1000,
  qty: 120,
  uomId: 9,
  ...overrides,
});

const unit = (
  handlingUnitId: number,
  contents: HandlingUnitContent[],
  handlingUnitNo = `CTN-${String(handlingUnitId)}`,
): ScannedHandlingUnit => ({
  handlingUnit: {
    handlingUnitId,
    handlingUnitNo,
    handlingUnitTypeCode: 'CARTON',
    warehouseId: 5,
    locationId: 7,
    statusCode: 'ACTIVE',
  },
  contents,
});

const line = (lotId: number, qty: string): DraftLine => ({ itemId: 100, lotId, uomId: 9, qty });

describe('원 포장 모으기', () => {
  it('여러 포장의 내용을 한 벌로 모은다', () => {
    const pooled = pooledContents([
      unit(10, [content({ lotId: 1000, qty: 80 })]),
      unit(11, [content({ handlingUnitContentId: 2, lotId: 1001, qty: 60 })]),
    ]);

    expect(pooled).toHaveLength(2);
    expect(sumOf(pooled)).toBe(140);
  });

  /* 구성 표가 같은 품목·LOT 짝을 두 줄로 갖지 못한다. */
  it('같은 품목·LOT 이 만나면 합친다', () => {
    const pooled = pooledContents([
      unit(10, [content({ lotId: 1000, qty: 80 })]),
      unit(11, [content({ handlingUnitContentId: 2, lotId: 1000, qty: 60 })]),
    ]);

    expect(pooled).toHaveLength(1);
    expect(pooled[0]?.qty).toBe(140);
  });

  /* 조용히 합치면 어느 포장에서 얼마가 왔는지 못 본다. */
  it('합쳐진 짝의 조각을 남긴다', () => {
    const merged = mergedPairs([
      unit(10, [content({ lotId: 1000, qty: 80 })]),
      unit(11, [content({ handlingUnitContentId: 2, lotId: 1000, qty: 60 })]),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.parts).toEqual([80, 60]);
    expect(merged[0]?.content.qty).toBe(140);
  });

  it('한 포장에만 있던 짝은 합쳐진 것이 아니다', () => {
    const merged = mergedPairs([
      unit(10, [content({ lotId: 1000, qty: 80 })]),
      unit(11, [content({ handlingUnitContentId: 2, lotId: 1001, qty: 60 })]),
    ]);

    expect(merged).toEqual([]);
  });
});

describe('수량 검사', () => {
  it('숫자가 아니면 막는다', () => {
    expect(qtyProblemOf(line(1000, ''), 120)).toBe('notNumber');
    expect(qtyProblemOf(line(1000, '열'), 120)).toBe('notNumber');
  });

  it('음수를 막는다', () => {
    expect(qtyProblemOf(line(1000, '-1'), 120)).toBe('negative');
  });

  /* 전량을 새 포장으로 옮기면 잔량이 0 이 되고 그것도 재구성이다. */
  it('0 은 막지 않는다', () => {
    expect(qtyProblemOf(line(1000, '0'), 120)).toBeNull();
  });

  it('원 포장에 있는 것보다 많이 담을 수 없다', () => {
    expect(qtyProblemOf(line(1000, '120'), 120)).toBeNull();
    expect(qtyProblemOf(line(1000, '121'), 120)).toBe('overPooled');
  });
});

describe('남는 것', () => {
  it('담고 남은 만큼만 남는다', () => {
    const remainder = remainderOf([unit(10, [content({ qty: 180 })])], [line(1000, '80')]);

    expect(remainder).toHaveLength(1);
    expect(remainder[0]?.qty).toBe(100);
  });

  it('전량을 옮기면 남는 줄이 없다', () => {
    expect(remainderOf([unit(10, [content({ qty: 180 })])], [line(1000, '180')])).toEqual([]);
  });

  it('여러 포장에서 모은 뒤의 잔량도 합에서 뺀다', () => {
    const remainder = remainderOf(
      [
        unit(10, [content({ lotId: 1000, qty: 80 })]),
        unit(11, [content({ handlingUnitContentId: 2, lotId: 1000, qty: 60 })]),
      ],
      [line(1000, '100')],
    );

    expect(remainder[0]?.qty).toBe(40);
  });
});

/** 배분 판정이 끝나 막을 것이 없는 상태. 이 묶음이 재려는 것은 배분이 아니다. */
const cleared = (sources: ScannedHandlingUnit[]): Map<number, AllocationCheck> =>
  new Map(sources.map((source) => [source.handlingUnit.handlingUnitId, 'clear' as const]));

describe('확정 가능 여부', () => {
  const sources = [unit(10, [content({ qty: 180 })])];
  const checks = cleared(sources);

  it('사번이 없으면 확정할 수 없다', () => {
    expect(canConfirm(sources, [line(1000, '80')], false, checks)).toBe(false);
  });

  it('원 포장이 없으면 확정할 수 없다', () => {
    expect(canConfirm([], [line(1000, '80')], true, new Map())).toBe(false);
  });

  /* 아무것도 옮기지 않으면 바뀌는 것이 없다. 빈 재구성을 기록으로 남기지 않는다. */
  it('아무것도 옮기지 않으면 확정할 수 없다', () => {
    expect(canConfirm(sources, [line(1000, '0')], true, checks)).toBe(false);
  });

  it('원 포장보다 많이 담으면 확정할 수 없다', () => {
    expect(canConfirm(sources, [line(1000, '181')], true, checks)).toBe(false);
  });

  it('원 포장에 없는 LOT 은 확정할 수 없다', () => {
    expect(canConfirm(sources, [line(9999, '10')], true, checks)).toBe(false);
  });

  it('허용치 안이면 확정한다', () => {
    expect(canConfirm(sources, [line(1000, '80')], true, checks)).toBe(true);
  });
});

describe('출하에 배분된 원 포장', () => {
  const first = unit(10, [content({ qty: 180 })], 'CTN-0010');
  const second = unit(
    11,
    [content({ handlingUnitContentId: 2, lotId: 1001, qty: 60 })],
    'CTN-0011',
  );
  const sources = [first, second];
  const lines = [line(1000, '80')];

  const checks = (...pairs: [number, AllocationCheck][]): Map<number, AllocationCheck> =>
    new Map(pairs);

  it('배분된 포장이 있으면 확정할 수 없다', () => {
    expect(canConfirm(sources, lines, true, checks([10, 'allocated'], [11, 'clear']))).toBe(false);
  });

  /* 합병은 원 포장이 여럿이다. 뒤쪽만 배분돼 있어도 그 물건이 사라지는 것은 같다. */
  it('합병에서 둘째 포장만 배분돼 있어도 확정할 수 없다', () => {
    expect(canConfirm(sources, lines, true, checks([10, 'clear'], [11, 'allocated']))).toBe(false);
  });

  it('배분된 포장을 번호로 짚는다', () => {
    const blocked = allocatedSources(sources, checks([10, 'clear'], [11, 'allocated']));

    expect(blocked.map((each) => each.handlingUnit.handlingUnitNo)).toEqual(['CTN-0011']);
  });

  it('배분되지 않은 포장은 그대로 진행한다', () => {
    expect(canConfirm(sources, lines, true, checks([10, 'clear'], [11, 'clear']))).toBe(true);
  });
});

/*
 * 공유계약 C-6 이 판정용 값의 캐시를 막아 오프라인에서는 이 판정을 할 수 없다. 막으면
 * 오프라인 재구성 자체가 죽고, 조용히 넘기면 배분된 포장이 재구성된다.
 */
describe('배분을 확인하지 못한 원 포장', () => {
  const sources = [unit(10, [content({ qty: 180 })], 'CTN-0010')];
  const lines = [line(1000, '80')];

  it('확인하지 못해도 확정을 막지 않는다', () => {
    expect(canConfirm(sources, lines, true, new Map([[10, 'unknown' as const]]))).toBe(true);
  });

  it('확인하지 못한 포장을 번호로 짚는다', () => {
    const unverified = unverifiedSources(sources, new Map([[10, 'unknown' as const]]));

    expect(unverified.map((each) => each.handlingUnit.handlingUnitNo)).toEqual(['CTN-0010']);
  });

  /* 판정이 아예 오지 않은 것과 배분되지 않은 것이 같아 보이면 안 된다. */
  it('판정이 없는 포장은 확인하지 못한 것으로 본다', () => {
    expect(unverifiedSources(sources, new Map())).toHaveLength(1);
  });

  it('확인된 포장은 짚지 않는다', () => {
    expect(unverifiedSources(sources, new Map([[10, 'clear' as const]]))).toHaveLength(0);
  });
});

describe('보낼 것', () => {
  const sources = [unit(10, [content({ qty: 180 })], 'CTN-2026-0091')];
  const lines = [line(1000, '80')];
  const now = new Date('2026-09-02T10:00:00+09:00');

  /* 카톤을 갈라도 카톤이다. 값 목록을 따로 고르게 하면 원 포장과 다른 것을 고를 수 있다. */
  it('새 포장은 원 포장과 같은 유형이다', () => {
    const draft = toCreateDraft(sources, lines, 'batch-1', now, '900028');
    const body = draft.body as { handlingUnitTypeCode: string };

    expect(body.handlingUnitTypeCode).toBe('CARTON');
  });

  it('새 포장에 담은 것만 싣는다', () => {
    const draft = toCreateDraft(sources, lines, 'batch-1', now, '900028');
    const body = draft.body as { contents: { lotId: number; qty: number }[] };

    expect(body.contents).toEqual([{ itemId: 100, lotId: 1000, qty: 80, uomId: 9 }]);
  });

  it('수량이 0 인 줄은 새 포장에 넣지 않는다', () => {
    const draft = toCreateDraft(sources, [line(1000, '0')], 'batch-1', now, '900028');
    const body = draft.body as { contents: unknown[] };

    expect(body.contents).toEqual([]);
  });

  /*
   * 새 포장이 안 갔는데 원 포장이 비워지면 물건이 사라진다. 묶음이 그것을 막고, 앞이
   * 거부되면 뒤가 함께 되돌아간다.
   */
  it('새 포장과 원 포장 치환이 한 묶음이다', () => {
    const create = toCreateDraft(sources, lines, 'batch-1', now, '900028');
    const replace = toReplaceDraft(sources[0]!, [], 'batch-1', now, '900028');

    expect(create.batchId).toBe('batch-1');
    expect(replace.batchId).toBe('batch-1');
  });

  it('원 포장 치환은 그 포장을 가리킨다', () => {
    const replace = toReplaceDraft(
      sources[0]!,
      remainderOf(sources, lines),
      'batch-1',
      now,
      '900028',
    );

    expect(replace.method).toBe('PUT');
    expect(replace.path).toBe('/inventory/handling-units/10/contents');
    expect(replace.body).toEqual({ items: [{ itemId: 100, lotId: 1000, qty: 100, uomId: 9 }] });
  });

  /* 치환이라 요청에서 빠진 줄은 지워진다. 빈 목록이 원 포장을 비운다는 뜻이다. */
  it('잔량이 없으면 빈 목록을 보낸다', () => {
    const replace = toReplaceDraft(sources[0]!, [], 'batch-1', now, '900028');

    expect(replace.body).toEqual({ items: [] });
  });
});
