import { describe, expect, it } from 'vitest';

import {
  canClose,
  EMPTY_DRAFT,
  toCreateBody,
  toMoment,
  validateDraft,
  type ToolResultDraft,
} from './result-draft';

/**
 * 「틀려도 조용한 것」만 시험한다 — 화면은 정상으로 보이면서 서버에 다른 뜻이 전달되는 계산.
 *
 * 누계 리셋은 **되돌릴 수 없는 쓰기**다(검증 수준 「중요」 4번 지점). 리셋 여부와 시작값이
 * 본문에 실리는 규칙이 틀리면 툴 수명 누계가 조용히 어긋난다.
 */

const draftOf = (patch: Partial<ToolResultDraft>): ToolResultDraft => ({
  ...EMPTY_DRAFT,
  tool: '7',
  startedAt: '2026-08-20',
  resultNote: '금형 청소',
  performer: '3',
  ...patch,
});

describe('toMoment', () => {
  it('날짜만 고른 값에 고정 오프셋을 찍는다', () => {
    expect(toMoment('2026-08-20', 540)).toBe('2026-08-20T00:00:00+09:00');
  });

  it('오프셋이 음수면 부호가 뒤집힌다', () => {
    expect(toMoment('2026-08-20', -300)).toBe('2026-08-20T00:00:00-05:00');
  });

  it('오프셋이 0이면 +00:00이다 — 부호를 잃지 않는다', () => {
    expect(toMoment('2026-08-20', 0)).toBe('2026-08-20T00:00:00+00:00');
  });
});

describe('canClose', () => {
  it('오더를 고르지 않으면 마감할 것이 없다', () => {
    expect(canClose(draftOf({ order: '' }))).toBe(false);
  });

  it('오더를 골랐으면 마감할 수 있다', () => {
    expect(canClose(draftOf({ order: '12' }))).toBe(true);
  });
});

describe('validateDraft — 되돌리기 시작값', () => {
  it('되돌리기를 껐으면 시작값이 비어도 통과한다', () => {
    expect(validateDraft(draftOf({ resetCounter: false, shotAfterReset: '' }))).toEqual({});
  });

  it('되돌리기를 켰는데 시작값이 비면 막는다 — 계약이 함께 보내기를 요구한다', () => {
    expect(
      validateDraft(draftOf({ resetCounter: true, shotAfterReset: '' })).shotAfterReset,
    ).toBeDefined();
  });

  it('⭐ 0은 값이다 — 빈 값과 가른다', () => {
    expect(
      validateDraft(draftOf({ resetCounter: true, shotAfterReset: '0' })).shotAfterReset,
    ).toBeUndefined();
  });

  it('음수·소수는 시작값이 될 수 없다', () => {
    expect(
      validateDraft(draftOf({ resetCounter: true, shotAfterReset: '-1' })).shotAfterReset,
    ).toBeDefined();
    expect(
      validateDraft(draftOf({ resetCounter: true, shotAfterReset: '1.5' })).shotAfterReset,
    ).toBeDefined();
  });
});

describe('validateDraft — 짝 제약', () => {
  it('외주면 업체명이 있어야 하고 수행자를 비운다', () => {
    const errors = validateDraft(draftOf({ isOutsourced: true, vendorName: '', performer: '3' }));

    expect(errors.vendorName).toBeDefined();
    expect(errors.performer).toBeDefined();
  });

  it('외주가 아니면 수행자가 있어야 한다', () => {
    expect(validateDraft(draftOf({ performer: '' })).performer).toBeDefined();
  });

  it('업체명이 공백뿐이면 비운 것으로 본다', () => {
    expect(
      validateDraft(draftOf({ isOutsourced: true, vendorName: '   ', performer: '' })).vendorName,
    ).toBeDefined();
  });
});

describe('validateDraft — 기간', () => {
  it('종료가 시작보다 앞서면 막는다', () => {
    expect(
      validateDraft(draftOf({ startedAt: '2026-08-20', finishedAt: '2026-08-19' })).finishedAt,
    ).toBeDefined();
  });

  it('같은 날은 허용한다 — 하루 안에 끝나는 보전이 흔하다', () => {
    expect(
      validateDraft(draftOf({ startedAt: '2026-08-20', finishedAt: '2026-08-20' })).finishedAt,
    ).toBeUndefined();
  });

  it('달력에 없는 날은 막는다', () => {
    expect(validateDraft(draftOf({ startedAt: '2026-02-30' })).startedAt).toBeDefined();
  });
});

describe('toCreateBody', () => {
  it('⛔ 되돌리기를 끄면 시작값을 싣지 않는다 — 실으면 되돌린 것으로 읽힐 수 있다', () => {
    const body = toCreateBody(draftOf({ resetCounter: false, shotAfterReset: '0' }), 540);

    expect(body.resetCounter).toBe(false);
    expect('shotCountAfterReset' in body).toBe(false);
  });

  it('되돌리기를 켜면 시작값을 숫자로 싣는다', () => {
    const body = toCreateBody(draftOf({ resetCounter: true, shotAfterReset: '0' }), 540);

    expect(body.resetCounter).toBe(true);
    expect(body.shotCountAfterReset).toBe(0);
  });

  it('⛔ 누계를 보내지 않는다 — 리셋 직전 값은 서버가 얼린다', () => {
    const body = toCreateBody(draftOf({ resetCounter: true, shotAfterReset: '5' }), 540);

    expect('shotCountBeforeReset' in body).toBe(false);
    expect('currentShotCount' in body).toBe(false);
  });

  it('⛔ 오더가 없으면 마감을 참으로 싣지 않는다', () => {
    const body = toCreateBody(draftOf({ order: '', closed: true }), 540);

    expect(body.closed).toBe(false);
    expect('maintenanceOrderId' in body).toBe(false);
  });

  it('오더가 있으면 마감과 오더 식별자를 함께 싣는다', () => {
    const body = toCreateBody(draftOf({ order: '12', closed: true }), 540);

    expect(body.closed).toBe(true);
    expect(body.maintenanceOrderId).toBe(12);
  });

  it('외주면 업체명을 싣고 수행자를 싣지 않는다', () => {
    const body = toCreateBody(
      draftOf({ isOutsourced: true, vendorName: ' 협력사 ', performer: '' }),
      540,
    );

    expect(body.outsourceVendorName).toBe('협력사');
    expect('performedByUserId' in body).toBe(false);
  });

  it('외주가 아니면 수행자를 싣고 업체명을 싣지 않는다', () => {
    const body = toCreateBody(draftOf({ performer: '3' }), 540);

    expect(body.performedByUserId).toBe(3);
    expect('outsourceVendorName' in body).toBe(false);
  });

  it('⛔ 부위 배열을 싣지 않는다 — 결과 값 목록이 없어 채울 수 없다', () => {
    expect('lines' in toCreateBody(draftOf({}), 540)).toBe(false);
  });

  it('종료일이 비면 싣지 않는다 — 진행 중인 보전이다', () => {
    expect('finishedAt' in toCreateBody(draftOf({ finishedAt: '' }), 540)).toBe(false);
  });
});
