import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { MaterialIssueLineDraft } from './types';
import {
  hasReasonOrRemarks,
  hasRequestableLine,
  publishBlockReason,
  readQty,
  validateHeader,
  validateLines,
  visibleHeaderErrors,
  type HeaderDraft,
} from './validation';

const t = messages.materialIssueRequest;

/**
 * 집중 갈래 — **발행 활성 조건**(D-4)과 **수량 읽기**(D-7).
 *
 * 발행 조건은 스펙 두 절이 갈리는 지점이라 판정을 한 함수에 가두었다. `&&` 를 `||` 로 잘못
 * 쓰면 화면은 멀쩡하고 사유 없는 전표만 늘어난다 — 진리표로 여덟 갈래를 전부 짚는다.
 */

const line = (patch: Partial<MaterialIssueLineDraft> = {}): MaterialIssueLineDraft => ({
  key: 'shortage:1',
  origin: 'shortage',
  bomComponentId: 7601,
  itemId: '7401',
  uomId: '7501',
  requiredQty: 200,
  issuedQty: 120,
  shortageQty: 80,
  requestedQty: '80',
  ...patch,
});

const header = (patch: Partial<HeaderDraft> = {}): HeaderDraft => ({
  workOrderId: '7101',
  warehouseId: '7201',
  destinationLocationId: '7301',
  requiredDate: '',
  requiredTime: '',
  reasonCode: '',
  remarks: '합성 비고',
  ...patch,
});

describe('readQty (D-7)', () => {
  it('빈 칸은 수가 아니다 — Number("") 은 0 이라 그대로 흘리면 0 수량이 실린다', () => {
    expect(readQty('')).toEqual({ kind: 'empty' });
    expect(readQty('   ')).toEqual({ kind: 'empty' });
  });

  it('못 읽는 글자는 수가 아니다', () => {
    expect(readQty('12x')).toEqual({ kind: 'invalid' });
  });

  it('0 은 읽되 0 으로 읽는다 — 「이번에 안 받는다」는 사실이다', () => {
    expect(readQty('0')).toEqual({ kind: 'qty', value: 0 });
  });

  it('앞뒤 공백을 다듬어 읽는다', () => {
    expect(readQty(' 80 ')).toEqual({ kind: 'qty', value: 80 });
  });
});

describe('validateLines', () => {
  it('품목·단위를 고르지 않은 줄에 오류가 선다', () => {
    const { errors } = validateLines([line({ key: 'manual:1', itemId: '', uomId: '' })]);

    expect(errors['manual:1.itemId']).toBe(t.errors.itemRequired);
    expect(errors['manual:1.uomId']).toBe(t.errors.uomRequired);
  });

  it('요청 수량이 0 이거나 비어 있는 것은 오류가 아니다 — 그 줄은 본문에서 빠진다', () => {
    expect(validateLines([line({ requestedQty: '0' })]).errors).toEqual({});
    expect(validateLines([line({ requestedQty: '' })]).errors).toEqual({});
  });

  it('못 읽는 값과 음수는 막는다', () => {
    expect(validateLines([line({ requestedQty: '12x' })]).errors['shortage:1.requestedQty']).toBe(
      t.errors.requestedQtyNotNumber,
    );
    expect(validateLines([line({ requestedQty: '-1' })]).errors['shortage:1.requestedQty']).toBe(
      t.errors.requestedQtyNotPositive,
    );
  });

  it('줄이 둘이면 오류가 서로 섞이지 않는다', () => {
    const { errors } = validateLines([
      line({ key: 'shortage:1', requestedQty: '12x' }),
      line({ key: 'manual:2', requestedQty: '80' }),
    ]);

    expect(errors['shortage:1.requestedQty']).toBeDefined();
    expect(errors['manual:2.requestedQty']).toBeUndefined();
  });
});

describe('validateHeader', () => {
  it('도착 위치는 필수다', () => {
    expect(validateHeader(header({ destinationLocationId: '' })).destinationLocationId).toBe(
      t.errors.destinationRequired,
    );
  });

  it('필요 시각을 둘 다 비우는 것은 오류가 아니다 — 선택 입력이다', () => {
    expect(validateHeader(header())).toEqual({});
  });

  it('날짜만 있고 시각이 비면 막는다', () => {
    expect(validateHeader(header({ requiredDate: '2026-09-04' })).requiredAt).toBe(
      t.errors.requiredTimeMissing,
    );
  });

  it('시각만 있고 날짜가 비어도 막는다 — 값을 만들 수 없다', () => {
    expect(validateHeader(header({ requiredTime: '14:00' })).requiredAt).toBe(
      t.errors.requiredDateMissing,
    );
  });
});

describe('visibleHeaderErrors — 만지지 않은 칸에는 붉은 글씨를 세우지 않는다', () => {
  const errors = { destinationLocationId: t.errors.destinationRequired };

  it('진입 직후에는 아무 오류도 보이지 않는다 — 사용자가 아직 아무 일도 하지 않았다', () => {
    expect(visibleHeaderErrors(errors, {}, false)).toEqual({});
  });

  it('그 칸을 만지면 그 칸의 오류가 드러난다', () => {
    expect(visibleHeaderErrors(errors, { destinationLocationId: true }, false)).toEqual(errors);
  });

  it('다른 칸을 만진 것으로는 드러나지 않는다', () => {
    expect(visibleHeaderErrors(errors, { requiredAt: true }, false)).toEqual({});
  });

  it('발행을 한 번 누르면 전부 드러난다', () => {
    expect(visibleHeaderErrors(errors, {}, true)).toEqual(errors);
  });
});

describe('hasRequestableLine · hasReasonOrRemarks', () => {
  it('요청 수량이 0 보다 큰 줄이 하나라도 있어야 한다', () => {
    expect(hasRequestableLine([line({ requestedQty: '0' })])).toBe(false);
    expect(hasRequestableLine([line({ requestedQty: '0' }), line({ requestedQty: '1' })])).toBe(
      true,
    );
  });

  it('사유 또는 비고 — 한쪽만 있어도 참이다', () => {
    expect(hasReasonOrRemarks('', '')).toBe(false);
    expect(hasReasonOrRemarks('SAMPLE_MIR_R_A', '')).toBe(true);
    expect(hasReasonOrRemarks('', '합성 비고')).toBe(true);
    expect(hasReasonOrRemarks('', '   ')).toBe(false);
  });
});

/**
 * 진리표 — {라인 유·무} × {사유 유·무} × {비고 유·무} 여덟 갈래.
 *
 * 스펙 §5-6 을 정본으로 둔 판정이다. **사유 없이 비고만 있어도 열린다**가 이 표의 핵심이고,
 * 설계가 §6 을 좁게 의도했다면 이 표의 셋째·넷째 행이 뒤집힌다.
 */
describe('publishBlockReason — 발행 활성 조건 (D-4)', () => {
  const base = {
    isSaving: false,
    hasPublished: false,
  };

  const cases: { hasLine: boolean; reason: string; remarks: string; open: boolean }[] = [
    { hasLine: true, reason: 'SAMPLE_MIR_R_A', remarks: '합성 비고', open: true },
    { hasLine: true, reason: 'SAMPLE_MIR_R_A', remarks: '', open: true },
    { hasLine: true, reason: '', remarks: '합성 비고', open: true },
    { hasLine: true, reason: '', remarks: '', open: false },
    { hasLine: false, reason: 'SAMPLE_MIR_R_A', remarks: '합성 비고', open: false },
    { hasLine: false, reason: 'SAMPLE_MIR_R_A', remarks: '', open: false },
    { hasLine: false, reason: '', remarks: '합성 비고', open: false },
    { hasLine: false, reason: '', remarks: '', open: false },
  ];

  for (const testCase of cases) {
    const label = `라인 ${testCase.hasLine ? '있음' : '없음'} · 사유 ${
      testCase.reason === '' ? '없음' : '있음'
    } · 비고 ${testCase.remarks === '' ? '없음' : '있음'} → ${testCase.open ? '열림' : '닫힘'}`;

    it(label, () => {
      const reason = publishBlockReason({
        ...base,
        header: header({ reasonCode: testCase.reason, remarks: testCase.remarks }),
        lines: [line({ requestedQty: testCase.hasLine ? '80' : '0' })],
      });

      expect(reason === null).toBe(testCase.open);
    });
  }

  it('W/O 를 고르지 않으면 그 사유부터 낸다', () => {
    expect(
      publishBlockReason({ ...base, header: header({ workOrderId: '' }), lines: [line()] }),
    ).toBe(t.actionReasons.noWorkOrder);
  });

  it('도착 위치를 고르지 않으면 그 사유를 낸다', () => {
    expect(
      publishBlockReason({
        ...base,
        header: header({ destinationLocationId: '' }),
        lines: [line()],
      }),
    ).toBe(t.actionReasons.noDestination);
  });

  it('라인 형식 오류가 있으면 닫힌다', () => {
    expect(
      publishBlockReason({
        ...base,
        header: header(),
        lines: [line({ requestedQty: '80' }), line({ key: 'manual:2', itemId: '', uomId: '' })],
      }),
    ).toBe(t.actionReasons.lineInvalid);
  });

  it('필요 시각이 반쪽이면 닫힌다 — 적은 날짜가 조용히 사라지지 않게 한다', () => {
    expect(
      publishBlockReason({
        ...base,
        header: header({ requiredDate: '2026-09-04' }),
        lines: [line()],
      }),
    ).toBe(t.actionReasons.requiredAtIncomplete);
  });

  it('전송 중과 발행 완료가 다른 사유보다 앞선다 — 두 겹의 잠금이다', () => {
    expect(publishBlockReason({ ...base, isSaving: true, header: header(), lines: [line()] })).toBe(
      t.actionReasons.saving,
    );
    expect(
      publishBlockReason({
        ...base,
        hasPublished: true,
        isSaving: true,
        header: header(),
        lines: [line()],
      }),
    ).toBe(t.actionReasons.alreadyPublished);
  });
});
