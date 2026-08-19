import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { capacityNoteText, judgeCapacity } from './capacity-note';
import type { LocationCapacity } from './lookups';

const t = messages.putawayRule;

/** 위치 9301이 스스로 가진 용량 — 400 (단위 9401). 규칙 쪽 값 하나만 바꿔 갈래를 가른다. */
const CAPACITY: LocationCapacity = {
  locationId: 9301,
  capacityQty: 400,
  capacityUomId: 9401,
};

describe('judgeCapacity — 견줄 값이 없다', () => {
  /** C3-7 — 위치 용량이 비어 있으면 그 경고를 **만들지 않는다.** */
  it('위치 용량이 없으면 아무것도 내지 않는다', () => {
    expect(judgeCapacity(null, { capacityQty: 9999, uomId: 9401 })).toEqual({ kind: 'none' });
  });

  /** 창고 전체 규칙·미도착·실패도 부르는 쪽이 `null`로 접어 준다 — 같은 자리에서 침묵한다. */
  it('규칙 쪽 값이 있어도 위치 용량이 없으면 침묵한다', () => {
    expect(capacityNoteText(judgeCapacity(null, { capacityQty: 1, uomId: 9401 }))).toBeUndefined();
  });
});

describe('judgeCapacity — 실값을 보이되 견주지 않는다', () => {
  /** 다 치지 않은 입력에 경고를 띄우면 입력 도중 내내 붉은 글씨가 선다. */
  it('규칙 용량을 읽을 수 없으면 값만 낸다', () => {
    expect(judgeCapacity(CAPACITY, { capacityQty: null, uomId: 9401 })).toEqual({
      kind: 'plain',
      capacity: CAPACITY,
    });
  });

  it('단위를 고르지 않았으면 값만 낸다', () => {
    expect(judgeCapacity(CAPACITY, { capacityQty: 9999, uomId: null })).toEqual({
      kind: 'plain',
      capacity: CAPACITY,
    });
  });

  /**
   * 단위가 다르면 두 수의 크고 작음이 성립하지 않는다. **초과보다 앞서 판정한다** —
   * 뒤집으면 「9999가 400보다 크다」가 서고 사용자는 그것을 사실로 읽는다.
   */
  it('단위가 다르면 초과 판정 대신 사유를 낸다', () => {
    const note = judgeCapacity(CAPACITY, { capacityQty: 9999, uomId: 9402 });

    expect(note.kind).toBe('unitMismatch');
    expect(capacityNoteText(note)).toBe(t.notes.locationCapacityUnitMismatch);
  });
});

describe('judgeCapacity — 견준다', () => {
  it('넘지 않으면 값만 낸다', () => {
    const note = judgeCapacity(CAPACITY, { capacityQty: 400, uomId: 9401 });

    expect(note.kind).toBe('plain');
    expect(capacityNoteText(note)).toBeUndefined();
  });

  /** 경계는 **같을 때가 아니라 넘을 때** 운다 — 딱 맞게 채우는 것은 정상이다. */
  it('같으면 경고하지 않는다', () => {
    expect(judgeCapacity(CAPACITY, { capacityQty: 400, uomId: 9401 }).kind).not.toBe('over');
  });

  /** C3-6 — 넘으면 경고가 서되 이 판정 어디에도 「저장을 막는다」가 없다. */
  it('넘으면 값과 경고를 함께 낸다', () => {
    const note = judgeCapacity(CAPACITY, { capacityQty: 401, uomId: 9401 });

    expect(note).toEqual({ kind: 'over', capacity: CAPACITY });
    expect(capacityNoteText(note)).toBe(t.notes.locationCapacityOver);
  });

  /** 경고 문면이 「저장은 됩니다」를 말한다 — 막는 것으로 읽히면 사용자가 값을 지어낸다. */
  it('경고 문구가 저장을 막지 않는다고 말한다', () => {
    expect(t.notes.locationCapacityOver).toContain('저장은 됩니다');
  });
});
