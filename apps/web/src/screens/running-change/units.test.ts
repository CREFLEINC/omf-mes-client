import { describe, expect, it } from 'vitest';

import { toInputQty, validateQty } from './input-qty';
import { isShotCountExceeded } from './mold';
import { makeConsumption, makeCurrentMold, makePart, OLD_CONSUMPTION_ID } from './fixtures';
import { toBlockReason, toQtyProblem } from './replace-panel';
import { normalizeScanCode } from './scan';
import { readWorkOrderId, WORK_ORDER_PARAM } from './screen-params';
import { replacedIds, toCurrentInputView } from './types';

describe('주소에서 읽는 작업지시', () => {
  const read = (raw: string): number | null =>
    readWorkOrderId(new URLSearchParams(`${WORK_ORDER_PARAM}=${raw}`));

  it('양의 정수만 받는다', () => {
    expect(read('1001')).toBe(1001);
    expect(read('0')).toBeNull();
    expect(read('-3')).toBeNull();
    expect(read('1.5')).toBeNull();
  });

  /* `Number`는 빈 문자열과 공백을 0으로 읽는다 — 자릿수 검사가 먼저다. */
  it('빈 값·공백·글자를 0으로 읽지 않는다', () => {
    expect(read('')).toBeNull();
    expect(read('%20')).toBeNull();
    expect(read('abc')).toBeNull();
    expect(readWorkOrderId(new URLSearchParams())).toBeNull();
  });
});

describe('스캔값 다듬기', () => {
  it('앞뒤 공백·개행만 턴다', () => {
    expect(normalizeScanCode(' LOT-SAMPLE-0031\r\n')).toBe('LOT-SAMPLE-0031');
  });

  /* ⛔ 대소문자 규칙이 계약에 없다(omf-mes#254) — 화면이 정하지 않는다. */
  it('대소문자를 바꾸지 않는다', () => {
    expect(normalizeScanCode('lot-Sample-0031')).toBe('lot-Sample-0031');
  });

  it('빈 값은 쓸 수 없다고 말한다', () => {
    expect(normalizeScanCode('   ')).toBeNull();
    expect(normalizeScanCode('')).toBeNull();
  });
});

describe('투입 수량', () => {
  it('비어 있는 것과 형식이 아닌 것과 0 이하를 구분한다', () => {
    expect(validateQty('')).toBe('empty');
    expect(validateQty('  ')).toBe('empty');
    expect(validateQty('12a')).toBe('format');
    expect(validateQty('-5')).toBe('format');
    expect(validateQty('0')).toBe('notPositive');
    expect(validateQty('0.0')).toBe('notPositive');
  });

  it('쓸 수 있는 값만 숫자로 옮긴다', () => {
    expect(toInputQty(' 120.5 ')).toBe(120.5);
    expect(toInputQty('0')).toBeNull();
    expect(toInputQty('-1')).toBeNull();
  });
});

describe('현재 투입 한 줄', () => {
  it('교체 축만 읽고 정정 축을 읽지 않는다', () => {
    const view = toCurrentInputView(
      makeConsumption({ replacedConsumptionId: 42, correctsConsumptionId: 99 }),
    );

    expect(view.replacedConsumptionId).toBe(42);
    expect(view).not.toHaveProperty('correctsConsumptionId');
  });

  it('교체 축이 비어 있으면 null 로 옮긴다', () => {
    expect(toCurrentInputView(makeConsumption()).replacedConsumptionId).toBeNull();
  });

  it('이미 이어진 투입의 번호를 모은다', () => {
    const rows = [
      toCurrentInputView(makeConsumption()),
      toCurrentInputView(
        makeConsumption({
          materialConsumptionId: 55002,
          replacedConsumptionId: OLD_CONSUMPTION_ID,
        }),
      ),
    ];

    expect(replacedIds(rows)).toEqual([OLD_CONSUMPTION_ID]);
  });
});

describe('금형 타발수', () => {
  it('남은 타수가 0 이하면 넘은 것으로 본다', () => {
    expect(isShotCountExceeded(makeCurrentMold({ availableShotCount: 0 }))).toBe(true);
    expect(isShotCountExceeded(makeCurrentMold({ availableShotCount: -5 }))).toBe(true);
    expect(isShotCountExceeded(makeCurrentMold({ availableShotCount: 1 }))).toBe(false);
  });

  /* 적정 타수가 없으면 판정 자체가 서지 않는다 — 0으로 채우지 않는다. */
  it('남은 타수를 모르면 넘었다고 말하지 않는다', () => {
    expect(isShotCountExceeded(makeCurrentMold({ availableShotCount: null }))).toBe(false);
  });
});

describe('수량 문제를 말하는 시점', () => {
  const part = makePart();

  /* ⛔ 부품을 담는 순간 손도 대지 않은 칸이 붉어지면 안 된다. */
  it('아직 손대지 않은 빈 칸은 조용히 둔다', () => {
    expect(toQtyProblem({ qty: '', part, selectedTargetId: null })).toBeNull();
    expect(toQtyProblem({ qty: '', part: null, selectedTargetId: null })).toBeNull();
  });

  /* ⛔ 부품보다 수량을 먼저 치는 순서도 있다 — 그때 「abc」가 조용히 남으면 안 된다. */
  it('친 값은 부품이 없어도 잰다', () => {
    expect(toQtyProblem({ qty: 'abc', part: null, selectedTargetId: null })).toBe('format');
    expect(toQtyProblem({ qty: '0', part: null, selectedTargetId: null })).toBe('notPositive');
    expect(toQtyProblem({ qty: '120', part: null, selectedTargetId: null })).toBeNull();
  });

  /* 갖춰진 뒤의 빈 칸은 곧 등록이 잠긴 사유다 — 버튼 옆이 수량을 되풀이하지 않기 때문이다. */
  it('부품·대상이 갖춰진 뒤에는 비어 있음을 말한다', () => {
    expect(toQtyProblem({ qty: '', part, selectedTargetId: OLD_CONSUMPTION_ID })).toBe('empty');
    expect(toQtyProblem({ qty: '  ', part, selectedTargetId: OLD_CONSUMPTION_ID })).toBe('empty');
  });
});

describe('등록을 막는 사유', () => {
  const base = {
    gate: 'allowed' as const,
    hasWorkOrder: true,
    hasWorker: true,
    part: makePart(),
    selectedTargetId: OLD_CONSUMPTION_ID,
    qty: '120',
  };

  it('전부 갖춰지면 막지 않는다', () => {
    expect(toBlockReason(base)).toBeNull();
  });

  /* ⛔ 「아직 모른다」를 「통과」로 처리하지 않는다(F-6) — 조회 중에도 막는다. */
  it('게이팅을 조회하는 중에도 막는다', () => {
    expect(toBlockReason({ ...base, gate: 'checking' })).toBe('checking');
  });

  it('닫힘·확인 불가·미식별을 각각 그대로 낸다', () => {
    expect(toBlockReason({ ...base, gate: 'denied' })).toBe('denied');
    expect(toBlockReason({ ...base, gate: 'unavailable' })).toBe('unavailable');
    expect(toBlockReason({ ...base, gate: 'unidentified' })).toBe('unidentified');
  });

  /* 풀 수 없는 것을 앞에 둔다 — 여러 개를 늘어놓으면 무엇을 먼저 풀지 알 수 없다. */
  it('사번·작업지시가 부품·대상보다 앞선다', () => {
    expect(toBlockReason({ ...base, hasWorkOrder: false, part: null })).toBe('workOrderMissing');
    expect(toBlockReason({ ...base, hasWorker: false, part: null })).toBe('workerMissing');
  });

  it('부품·대상·수량이 빠지면 각각 막는다', () => {
    expect(toBlockReason({ ...base, part: null })).toBe('partMissing');
    expect(toBlockReason({ ...base, selectedTargetId: null })).toBe('targetMissing');
    expect(toBlockReason({ ...base, qty: '0' })).toBe('qtyInvalid');
  });
});
