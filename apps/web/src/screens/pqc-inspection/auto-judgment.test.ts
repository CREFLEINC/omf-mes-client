import { describe, expect, it } from 'vitest';

import {
  ITEM_JUDGMENTS,
  judgeAutomatically,
  lacksLimits,
  standsAutomatically,
} from './auto-judgment';
import { DATA_TYPES } from './measurement-draft';
import type { MeasurementRow } from './measurement-rows';

const rowOf = (over: Partial<MeasurementRow> = {}): MeasurementRow => ({
  key: '1-1',
  inspectionItemSpecId: 1,
  displayNo: 1,
  itemName: '치수',
  itemCode: 'DIM',
  dataTypeCode: DATA_TYPES.numeric,
  automaticJudgment: true,
  sampleNo: 1,
  sampleCount: 1,
  required: true,
  spec: { target: null, lower: 9.9, upper: 10.1 },
  measured: null,
  ...over,
});

const measured = (numericValue: number, judgmentCode = ''): MeasurementRow['measured'] => ({
  numericValue,
  textValue: null,
  booleanValue: null,
  judgmentCode,
  measuredAt: '2026-09-01T09:00:00+09:00',
  inspectionEquipmentId: null,
  calibrationExpired: false,
});

describe('standsAutomatically — 셋이 모두 참일 때만 선다', () => {
  it('플래그·수치형·기준이 갖춰지면 선다', () => {
    expect(standsAutomatically(rowOf())).toBe(true);
  });

  it('플래그가 꺼져 있으면 서지 않는다', () => {
    expect(standsAutomatically(rowOf({ automaticJudgment: false }))).toBe(false);
  });

  /* ⛔ 상·하한은 수치형에만 뜻이 있다 — 문자·불리언 항목은 언제나 사람이 고른다. */
  it('수치형이 아니면 서지 않는다', () => {
    expect(standsAutomatically(rowOf({ dataTypeCode: DATA_TYPES.text }))).toBe(false);
    expect(standsAutomatically(rowOf({ dataTypeCode: DATA_TYPES.boolean }))).toBe(false);
  });

  it('상하한이 둘 다 비면 서지 않는다', () => {
    expect(standsAutomatically(rowOf({ spec: { target: 10, lower: null, upper: null } }))).toBe(
      false,
    );
  });

  /* 「9.9 이상」 같은 한쪽 공차가 흔하다 — 둘 다 있을 때만 세면 그런 항목이 빠진다. */
  it('한쪽만 있어도 선다', () => {
    expect(standsAutomatically(rowOf({ spec: { target: null, lower: 9.9, upper: null } }))).toBe(
      true,
    );
    expect(standsAutomatically(rowOf({ spec: { target: null, lower: null, upper: 10.1 } }))).toBe(
      true,
    );
  });
});

describe('lacksLimits — 플래그는 켜졌는데 기준이 없다', () => {
  it('상하한이 둘 다 비면 참이다', () => {
    expect(lacksLimits(rowOf({ spec: { target: 10, lower: null, upper: null } }))).toBe(true);
  });

  it('기준이 있으면 거짓이다', () => {
    expect(lacksLimits(rowOf())).toBe(false);
  });

  /* 플래그가 꺼진 항목은 애초에 자동 판정을 기대하지 않는다 — 사유를 낼 자리가 아니다. */
  it('플래그가 꺼져 있으면 거짓이다', () => {
    expect(
      lacksLimits(
        rowOf({ automaticJudgment: false, spec: { target: null, lower: null, upper: null } }),
      ),
    ).toBe(false);
  });

  it('수치형이 아니면 거짓이다', () => {
    expect(
      lacksLimits(
        rowOf({ dataTypeCode: DATA_TYPES.text, spec: { target: null, lower: null, upper: null } }),
      ),
    ).toBe(false);
  });
});

describe('judgeAutomatically — 채우되 잴 값이 있을 때만', () => {
  it('규격 안이면 합격을 낸다', () => {
    expect(judgeAutomatically(rowOf({ measured: measured(10) }))).toBe(ITEM_JUDGMENTS.accepted);
  });

  it('규격 밖이면 불합격을 낸다', () => {
    expect(judgeAutomatically(rowOf({ measured: measured(12) }))).toBe(ITEM_JUDGMENTS.rejected);
  });

  /* ⛔ 아직 재지 않은 항목에 판정을 채우면 사람이 내리지 않은 판정이 저장된다. */
  it('잴 값이 없으면 아무것도 내지 않는다', () => {
    expect(judgeAutomatically(rowOf())).toBeNull();
  });

  it('자동 판정이 서지 않으면 아무것도 내지 않는다', () => {
    expect(
      judgeAutomatically(rowOf({ automaticJudgment: false, measured: measured(12) })),
    ).toBeNull();
  });

  /* 표시와 판정이 다른 자를 쓰면 「규격 밖」이라 말하면서 합격을 채우는 일이 생긴다. */
  it('경계값은 규격 안이라 합격이다', () => {
    expect(judgeAutomatically(rowOf({ measured: measured(9.9) }))).toBe(ITEM_JUDGMENTS.accepted);
    expect(judgeAutomatically(rowOf({ measured: measured(10.1) }))).toBe(ITEM_JUDGMENTS.accepted);
  });
});
