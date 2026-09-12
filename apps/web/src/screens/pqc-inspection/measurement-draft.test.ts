import { describe, expect, it } from 'vitest';

import {
  DATA_TYPES,
  EMPTY_MEASUREMENT_DRAFT,
  hasValueError,
  isAllJudged,
  isValueInvalid,
  judgedCount,
  toMeasurementDrafts,
  toMeasurementInputs,
  withJudgment,
  withMeasuredValue,
  type MeasurementDraft,
  type MeasurementDrafts,
} from './measurement-draft';
import type { MeasurementRow } from './measurement-rows';

const MEASURED_AT = '2026-08-27T09:00:00+09:00';

/** 시험이 쓰는 초안 한 줄. **판정 출처는 따로 말하지 않으면 자동**이다. */
const draftOf = (judgment: string, value: string, judgmentByPerson = false): MeasurementDraft => ({
  judgment,
  value,
  judgmentByPerson,
});

const rowOf = (
  key: string,
  dataTypeCode: string,
  measured: MeasurementRow['measured'] = null,
): MeasurementRow => ({
  key,
  inspectionItemSpecId: Number(key.split('-')[0]),
  displayNo: 1,
  itemName: '항목',
  itemCode: 'ITEM',
  dataTypeCode,
  automaticJudgment: false,
  sampleNo: Number(key.split('-')[1]),
  sampleCount: 1,
  required: true,
  spec: { target: null, lower: 9.9, upper: 10.1, uomId: null },
  measured,
});

describe('toMeasurementDrafts — 저장된 값을 초안으로', () => {
  it('아직 재지 않은 줄은 빈 초안이다 — 판정을 미리 채우지 않는다', () => {
    const drafts = toMeasurementDrafts([rowOf('1-1', DATA_TYPES.numeric)]);

    expect(drafts['1-1']).toEqual(EMPTY_MEASUREMENT_DRAFT);
  });

  it('저장된 수치와 판정을 옮긴다', () => {
    const drafts = toMeasurementDrafts([
      rowOf('1-1', DATA_TYPES.numeric, {
        numericValue: 10.05,
        textValue: null,
        booleanValue: null,
        judgmentCode: 'ACCEPTED',
        measuredAt: MEASURED_AT,
        inspectionEquipmentId: null,
        calibrationExpired: false,
      }),
    ]);

    expect(drafts['1-1']).toEqual(draftOf('ACCEPTED', '10.05', true));
  });

  /* 거짓을 고른 것과 아직 안 고른 것이 화면에서 달라야 한다. */
  it('불리언 거짓도 값으로 옮긴다 — 빈 칸과 구분된다', () => {
    const drafts = toMeasurementDrafts([
      rowOf('2-1', DATA_TYPES.boolean, {
        numericValue: null,
        textValue: null,
        booleanValue: false,
        judgmentCode: 'REJECTED',
        measuredAt: MEASURED_AT,
        inspectionEquipmentId: null,
        calibrationExpired: false,
      }),
    ]);

    expect(drafts['2-1']).toEqual(draftOf('REJECTED', 'false', true));
  });
});

describe('자동 판정과 저장된 판정', () => {
  const autoRow = (measuredJudgment: string, value: number): MeasurementRow => ({
    ...rowOf('9-1', DATA_TYPES.numeric, {
      numericValue: value,
      textValue: null,
      booleanValue: null,
      judgmentCode: measuredJudgment,
      measuredAt: '2026-09-01T09:00:00+09:00',
      inspectionEquipmentId: null,
      calibrationExpired: false,
    }),
    automaticJudgment: true,
    spec: { target: null, lower: 9.9, upper: 10.1, uomId: null },
  });

  /*
   * ⭐ 사람이 이미 내린 판정을 자동 판정으로 덮으면 **검사자가 고친 값이 재조회마다
   * 되돌아간다.** 저장된 값이 우선한다.
   */
  it('저장된 판정이 있으면 자동 판정이 덮지 않는다', () => {
    /* 값은 규격 밖(12)이라 자동 판정은 불합격을 낼 자리인데, 저장된 것은 합격이다. */
    const drafts = toMeasurementDrafts([autoRow('ACCEPTED', 12)]);

    expect(drafts['9-1']?.judgment).toBe('ACCEPTED');
  });

  it('저장된 판정이 없고 자동 판정이 서면 채운 채로 시작한다', () => {
    const drafts = toMeasurementDrafts([autoRow('', 12)]);

    expect(drafts['9-1']?.judgment).toBe('REJECTED');
  });

  it('자동 판정이 서지 않으면 비운 채로 둔다', () => {
    const drafts = toMeasurementDrafts([rowOf('1-1', DATA_TYPES.numeric)]);

    expect(drafts['1-1']?.judgment).toBe('');
  });
});

/*
 * 88단계 2회차 실측을 그대로 옮긴다(#1091). POP 은 키패드로 **한 자씩** 치므로, 완성된 값이
 * 판정되는 일이 오히려 드물다 — 첫 글자의 판정이 박히면 규격 밖 제품이 「합격」으로 저장된다.
 */
describe('withMeasuredValue — 자동 판정은 값이 바뀔 때마다 다시 계산한다', () => {
  const autoRow = (lower: number, upper: number): MeasurementRow => ({
    ...rowOf('7-1', DATA_TYPES.numeric),
    automaticJudgment: true,
    spec: { target: null, lower, upper, uomId: null },
  });

  /** 한 자씩 친다 — 초안이 앞 글자의 판정을 들고 다음 글자를 만난다. */
  const type = (row: MeasurementRow, keys: readonly string[]): MeasurementDraft =>
    keys.reduce(
      (draft, value) => withMeasuredValue(row, draft, value),
      EMPTY_MEASUREMENT_DRAFT as MeasurementDraft,
    );

  it('규격 7.97~8.03 — 첫 자 「8」의 합격이 8.5 에 박히지 않는다', () => {
    const row = autoRow(7.97, 8.03);

    expect(type(row, ['8']).judgment).toBe('ACCEPTED');
    expect(type(row, ['8', '8.5']).judgment).toBe('REJECTED');
    expect(type(row, ['8', '8.5', '9']).judgment).toBe('REJECTED');
  });

  it('규격 11.95~12.05 — 첫 자 「1」의 불합격이 12.00 에 박히지 않는다', () => {
    const row = autoRow(11.95, 12.05);

    expect(type(row, ['1']).judgment).toBe('REJECTED');
    expect(type(row, ['1', '12.00']).judgment).toBe('ACCEPTED');
    expect(type(row, ['1', '12.00', '11.98']).judgment).toBe('ACCEPTED');
  });

  /* ⭐ §5-11 의 나머지 반쪽 — 채운 값은 시작점이지만 **사람이 고른 값은 확정이다.** */
  it('사람이 고른 판정은 값을 고쳐도 덮이지 않는다', () => {
    const row = autoRow(7.97, 8.03);
    const chosen = withJudgment(row, type(row, ['8.5']), 'ACCEPTED');

    expect(chosen.judgment).toBe('ACCEPTED');
    expect(withMeasuredValue(row, chosen, '9').judgment).toBe('ACCEPTED');
  });

  /* 해제는 「판정하지 않은 상태로 돌린다」이고, 그 상태의 시작점이 자동 판정이다. */
  it('고른 판정을 해제하면 자동 판정이 되돌아온다', () => {
    const row = autoRow(7.97, 8.03);
    const chosen = withJudgment(row, type(row, ['9']), 'ACCEPTED');

    expect(withJudgment(row, chosen, '').judgment).toBe('REJECTED');
  });

  /*
   * ⚠ **규격 «안»의 값이면 해제해도 같은 판정이 도로 선다** — 검사자에게는 버튼이 안 먹는
   * 것처럼 보이지만 의도다. 그 줄의 시작 상태가 빈 칸이 아니라 자동 판정이기 때문이고, 빈
   * 칸으로 돌리려면 측정값을 지운다. 이 갈래를 시험에 못박아 두지 않으면 다음 사람이
   * 「해제가 안 된다」를 결함으로 읽고 자동 판정을 도로 잠근다(#1091 리뷰).
   */
  it('규격 안의 값이면 해제해도 자동 판정이 같은 값을 도로 채운다', () => {
    const row = autoRow(7.97, 8.03);
    const chosen = withJudgment(row, type(row, ['8.00']), 'ACCEPTED');

    const released = withJudgment(row, chosen, '');

    expect(released.judgment).toBe('ACCEPTED');
    /* ⭐ 다만 **출처는 자동으로 돌아간다** — 이제 값을 고치면 다시 계산된다. */
    expect(released.judgmentByPerson).toBe(false);
    expect(withMeasuredValue(row, released, '9').judgment).toBe('REJECTED');
  });

  /* 재지 않은 줄에 판정이 남으면 「사람이 합격으로 판정했다」로 읽힌다. */
  it('값을 지우면 자동 판정도 거둔다', () => {
    const row = autoRow(7.97, 8.03);

    expect(withMeasuredValue(row, type(row, ['8']), '').judgment).toBe('');
  });

  /* 자동 판정이 서지 않는 항목에 판정을 지어내지 않는다. */
  it('자동 판정이 서지 않는 항목은 값을 고쳐도 비운 채로 둔다', () => {
    const row = rowOf('7-1', DATA_TYPES.numeric);

    expect(withMeasuredValue(row, EMPTY_MEASUREMENT_DRAFT, '8').judgment).toBe('');
  });
});

describe('isValueInvalid — 수치형에만 숫자 규칙을 건다', () => {
  it('수치형에 수치가 아닌 값은 잘못이다', () => {
    expect(isValueInvalid(rowOf('1-1', DATA_TYPES.numeric), draftOf('', 'abc'))).toBe(true);
  });

  it('수치형의 빈 칸은 잘못이 아니다 — 판정만으로 성립하는 줄이 있다', () => {
    expect(isValueInvalid(rowOf('1-1', DATA_TYPES.numeric), EMPTY_MEASUREMENT_DRAFT)).toBe(false);
  });

  /* ⛔ 문자 항목에 숫자 규칙을 걸면 정상 입력이 틀렸다고 나온다. */
  it('문자형에는 숫자 규칙을 걸지 않는다', () => {
    expect(isValueInvalid(rowOf('3-1', DATA_TYPES.text), draftOf('', '양호'))).toBe(false);
  });

  it('hasValueError 는 한 줄이라도 잘못되면 참이다', () => {
    const rows = [rowOf('1-1', DATA_TYPES.numeric), rowOf('3-1', DATA_TYPES.text)];
    const drafts: MeasurementDrafts = {
      '1-1': draftOf('', 'abc'),
      '3-1': draftOf('', '양호'),
    };

    expect(hasValueError(rows, drafts)).toBe(true);
  });
});

describe('진행 세기 — 값이 아니라 판정으로 센다', () => {
  const rows = [rowOf('1-1', DATA_TYPES.numeric), rowOf('2-1', DATA_TYPES.boolean)];

  it('판정한 줄만 센다', () => {
    const drafts: MeasurementDrafts = {
      '1-1': draftOf('ACCEPTED', ''),
      '2-1': EMPTY_MEASUREMENT_DRAFT,
    };

    expect(judgedCount(rows, drafts)).toBe(1);
    expect(isAllJudged(rows, drafts)).toBe(false);
  });

  /*
   * ⛔ 값으로 세면 육안 항목이 영영 안 끝난 것으로 보인다 — 그 항목에는 측정값이 없다.
   */
  it('값이 비어 있어도 판정했으면 끝난 줄이다', () => {
    const drafts: MeasurementDrafts = {
      '1-1': draftOf('ACCEPTED', ''),
      '2-1': draftOf('REJECTED', ''),
    };

    expect(isAllJudged(rows, drafts)).toBe(true);
  });
});

describe('toMeasurementInputs — 보내는 값으로 접는다', () => {
  it('판정하지 않은 줄은 싣지 않는다 — 사람이 내리지 않은 판정을 만들지 않는다', () => {
    const rows = [rowOf('1-1', DATA_TYPES.numeric)];

    expect(toMeasurementInputs(rows, { '1-1': draftOf('', '10') }, MEASURED_AT)).toEqual([]);
  });

  it('수치형은 numericValue 한 칸만 채운다', () => {
    const rows = [rowOf('1-1', DATA_TYPES.numeric)];
    const sent = toMeasurementInputs(rows, { '1-1': draftOf('ACCEPTED', '10.05') }, MEASURED_AT);

    expect(sent).toEqual([
      {
        inspectionItemSpecId: 1,
        sampleNo: 1,
        judgmentCode: 'ACCEPTED',
        measuredAt: MEASURED_AT,
        numericValue: 10.05,
      },
    ]);
    expect(sent[0]).not.toHaveProperty('textValue');
    expect(sent[0]).not.toHaveProperty('booleanValue');
  });

  it('문자형은 textValue 한 칸만 채운다', () => {
    const sent = toMeasurementInputs(
      [rowOf('3-1', DATA_TYPES.text)],
      { '3-1': draftOf('ACCEPTED', '양호') },
      MEASURED_AT,
    );

    expect(sent[0]).toMatchObject({ textValue: '양호' });
    expect(sent[0]).not.toHaveProperty('numericValue');
  });

  it('불리언은 booleanValue 한 칸만 채운다', () => {
    const sent = toMeasurementInputs(
      [rowOf('2-1', DATA_TYPES.boolean)],
      { '2-1': draftOf('ACCEPTED', 'false') },
      MEASURED_AT,
    );

    expect(sent[0]).toMatchObject({ booleanValue: false });
    expect(sent[0]).not.toHaveProperty('numericValue');
  });

  /* 육안 항목 — 판정만 있고 값이 없다. 세 칸 중 어느 것도 실리지 않아야 한다. */
  it('값이 비면 값 칸을 아예 싣지 않는다', () => {
    const sent = toMeasurementInputs(
      [rowOf('4-1', DATA_TYPES.text)],
      { '4-1': draftOf('ACCEPTED', '') },
      MEASURED_AT,
    );

    expect(Object.keys(sent[0] ?? {})).toEqual([
      'inspectionItemSpecId',
      'sampleNo',
      'judgmentCode',
      'measuredAt',
    ]);
  });

  it('수치형에 수치가 아닌 값이 남아 있으면 값 칸을 싣지 않는다', () => {
    const sent = toMeasurementInputs(
      [rowOf('1-1', DATA_TYPES.numeric)],
      { '1-1': draftOf('ACCEPTED', 'abc') },
      MEASURED_AT,
    );

    expect(sent[0]).not.toHaveProperty('numericValue');
  });
});
