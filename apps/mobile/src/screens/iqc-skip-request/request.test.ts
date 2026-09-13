import { describe, expect, it } from 'vitest';

import type { Lot } from '../../patterns/lots';
import { hasReason, isInspectionPending, isRouteMissing, toOutboxDraft } from './request';

const lot = (statusCode: string): Lot => ({
  lotId: 7,
  lotNo: '00000000000000000000000000000014',
  itemId: 3,
  lotTypeCode: 'MATERIAL',
  plantId: 1,
  initialQty: 500,
  uomId: 2,
  sourceTypeCode: 'INBOUND_RECEIPT_LINE',
  sourceId: 11,
  statusCode,
  held: false,
});

describe('사유', () => {
  it('공백뿐이면 적지 않은 것으로 본다', () => {
    expect(hasReason('   ')).toBe(false);
    expect(hasReason('')).toBe(false);
    expect(hasReason('라인 정지 임박')).toBe(true);
  });
});

describe('검사 대기 판정', () => {
  it('검사 대기인 LOT만 통과시킨다', () => {
    expect(isInspectionPending(lot('INSPECTION_PENDING'))).toBe(true);
    expect(isInspectionPending(lot('NORMAL'))).toBe(false);
  });

  /* 판정하지 못한 것을 통과로 읽으면 검사가 끝난 자재에 생략 요청이 올라간다. */
  it('아직 못 찾은 LOT은 통과시키지 않는다', () => {
    expect(isInspectionPending(null)).toBe(false);
    expect(isInspectionPending(undefined)).toBe(false);
  });
});

describe('요청 초안', () => {
  it('계약 경로에 LOT 번호를 넣고 사유만 싣는다', () => {
    const draft = toOutboxDraft(7, '  라인 정지 임박  ', '2026-09-01T00:00:00.000Z', '900028');

    expect(draft.method).toBe('POST');
    expect(draft.path).toBe('/trace/lots/7:request-iqc-skip');
    expect(draft.body).toEqual({ reason: '라인 정지 임박' });
  });

  /* 승인 유형과 대상 유형은 서버가 경로에서 정한다. 화면이 문자열을 지어 실으면 어긋난다. */
  it('승인 유형과 대상 유형을 싣지 않는다', () => {
    const draft = toOutboxDraft(7, '사유', '2026-09-01T00:00:00.000Z', '900028');

    expect(Object.keys(draft.body as object)).toEqual(['reason']);
  });

  it('담을 때의 사번과 발생 시각을 들고 있는다', () => {
    const draft = toOutboxDraft(7, '사유', '2026-09-01T00:00:00.000Z', '900028');

    expect(draft.workerNo).toBe('900028');
    expect(draft.occurredAt).toBe('2026-09-01T00:00:00.000Z');
  });

  /* 승인자가 보고 판정하는 기록이라 담긴 것만으로 요청됐다고 할 수 없다. */
  it('담긴 것을 확정으로 보지 않는다', () => {
    expect(toOutboxDraft(7, '사유', '2026-09-01T00:00:00.000Z', '900028').confirmation).toBe(
      'pending',
    );
  });
});

describe('결재선 없음 판정', () => {
  it('서버가 말한 코드로 가른다', () => {
    expect(
      isRouteMissing({
        kind: 'validation',
        errors: [{ scope: 'screen', code: 'ROUTE_NOT_FOUND', message: '결재선이 없습니다' }],
      }),
    ).toBe(true);
  });

  it('다른 거부와 섞지 않는다', () => {
    expect(
      isRouteMissing({
        kind: 'validation',
        errors: [{ scope: 'field', code: 'REQUIRED', message: '사유를 적어 주세요' }],
      }),
    ).toBe(false);
    expect(isRouteMissing({ kind: 'http', status: 500 })).toBe(false);
  });
});
