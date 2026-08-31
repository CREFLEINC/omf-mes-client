import { describe, expect, it } from 'vitest';

import {
  EMPTY_DRAFT,
  hasErrors,
  toCreateBody,
  toMoment,
  validateDraft,
  type ResultDraft,
} from './result-draft';

const draft = (overrides: Partial<ResultDraft> = {}): ResultDraft => ({
  ...EMPTY_DRAFT,
  target: '8101',
  startedAt: '2026-08-18',
  resultNote: '합성 실적 내용',
  performer: '7001',
  ...overrides,
});

describe('toMoment', () => {
  it('날짜를 그 날의 시작 시각으로 만든다', () => {
    expect(toMoment('2026-08-18', 540)).toBe('2026-08-18T00:00:00+09:00');
  });

  it('음수 오프셋을 부호와 함께 찍는다', () => {
    expect(toMoment('2026-08-18', -300)).toBe('2026-08-18T00:00:00-05:00');
  });

  it('분 단위 오프셋도 담는다', () => {
    expect(toMoment('2026-08-18', 330)).toBe('2026-08-18T00:00:00+05:30');
  });
});

describe('validateDraft', () => {
  it('다 채우면 오류가 없다', () => {
    expect(hasErrors(validateDraft(draft()))).toBe(false);
  });

  it('필수 넷이 비면 각각 사유를 낸다', () => {
    const errors = validateDraft(EMPTY_DRAFT);

    expect(Object.keys(errors).sort()).toEqual(['performer', 'resultNote', 'startedAt', 'target']);
  });

  it('공백만 친 실적 내용은 적은 것이 아니다', () => {
    expect(validateDraft(draft({ resultNote: '   ' })).resultNote).not.toBeUndefined();
  });

  it('종료가 시작보다 앞서면 막는다', () => {
    expect(validateDraft(draft({ finishedAt: '2026-08-17' })).finishedAt).toContain('앞섭니다');
  });

  it('종료는 비워도 된다 — 아직 끝나지 않은 건이 있다', () => {
    expect(validateDraft(draft({ finishedAt: '' })).finishedAt).toBeUndefined();
  });

  /**
   * ⭐ 계약이 「짝 제약은 화면이 진다」로 넘긴 자리다. 둘 다 채운 실적이 남으면 「누가 했는가」를
   * 셀 때 같은 건이 **양쪽에** 잡힌다.
   */
  it('외주면 수행자를 비워야 한다', () => {
    const errors = validateDraft(
      draft({ isOutsourced: true, vendorName: '합성 보전업체', performer: '7001' }),
    );

    expect(errors.performer).toBe(
      '외주 보전에는 수행자를 비웁니다. 업체와 담당자는 실적 내용에 적으세요.',
    );
  });

  it('외주면 업체 이름이 있어야 한다', () => {
    expect(
      validateDraft(draft({ isOutsourced: true, performer: '' })).vendorName,
    ).not.toBeUndefined();
  });

  it('외주가 아니면 수행자가 있어야 한다', () => {
    expect(validateDraft(draft({ performer: '' })).performer).toBe('수행자를 고르세요.');
  });

  it('수량이 0 이하면 막는다 — 0은 「쓰지 않았다」이고 그 줄은 없어야 한다', () => {
    expect(
      validateDraft(
        draft({
          parts: [
            { key: 'a', sparePartId: '1', partName: '합성 예비품', usedQty: '0', goodsIssueId: '' },
          ],
        }),
      ).parts,
    ).not.toBeUndefined();
  });

  /** 같은 예비품이 두 줄이면 합계가 갈려 「얼마나 썼는가」가 두 값이 된다. */
  it('같은 예비품을 두 번 적으면 막는다', () => {
    expect(
      validateDraft(
        draft({
          parts: [
            { key: 'a', sparePartId: '1', partName: '합성', usedQty: '1', goodsIssueId: '' },
            { key: 'b', sparePartId: '1', partName: '합성', usedQty: '2', goodsIssueId: '' },
          ],
        }),
      ).parts,
    ).toBe('같은 예비품을 두 번 적었습니다. 한 줄로 합치세요.');
  });
});

describe('toCreateBody', () => {
  /** ⛔ 실으면 낙관적 잠금이 필요해지는데 이 폼은 그 토큰을 갖고 있지 않다. */
  it('누계 리셋을 싣지 않는다', () => {
    expect(toCreateBody(draft(), 540)).not.toHaveProperty('resetCounter');
    expect(toCreateBody(draft(), 540)).not.toHaveProperty('shotCountAfterReset');
  });

  /** ⛔ 결과 값 목록이 없어 채울 수 없다 — 지어낸 값을 실으면 아무도 모르는 결과가 남는다. */
  it('항목·부위별 결과를 싣지 않는다', () => {
    expect(toCreateBody(draft(), 540)).not.toHaveProperty('lines');
  });

  it('외주면 수행자 대신 업체 이름을 싣는다', () => {
    const body = toCreateBody(
      draft({ isOutsourced: true, performer: '', vendorName: ' 합성 보전업체 ' }),
      540,
    );

    expect(body).not.toHaveProperty('performedByUserId');
    expect(body.outsourceVendorName).toBe('합성 보전업체');
  });

  it('외주가 아니면 업체 이름 대신 수행자를 싣는다', () => {
    const body = toCreateBody(draft(), 540);

    expect(body).not.toHaveProperty('outsourceVendorName');
    expect(body.performedByUserId).toBe(7001);
  });

  it('지시를 고르지 않으면 키 자체를 싣지 않는다 — 지시 없이도 실적이 성립한다', () => {
    expect(toCreateBody(draft(), 540)).not.toHaveProperty('maintenanceOrderId');
  });

  it('예비품이 없으면 키 자체를 싣지 않는다', () => {
    expect(toCreateBody(draft(), 540)).not.toHaveProperty('parts');
  });

  it('예비품 이름은 고를 때 푼 값을 그대로 싣는다 — 계약이 필수로 두었다', () => {
    const body = toCreateBody(
      draft({
        parts: [
          {
            key: 'a',
            sparePartId: '5001',
            partName: 'SYN-SP-01 · 합성 예비품',
            usedQty: '2',
            goodsIssueId: '',
          },
        ],
      }),
      540,
    );

    expect(body.parts?.[0]).toEqual({
      sparePartId: 5001,
      partName: 'SYN-SP-01 · 합성 예비품',
      usedQty: 2,
    });
  });

  it('출고 건을 고르지 않으면 키 자체를 싣지 않는다 — 여기서 출고를 만들지 않는다', () => {
    const body = toCreateBody(
      draft({
        parts: [
          { key: 'a', sparePartId: '5001', partName: '합성', usedQty: '2', goodsIssueId: '' },
        ],
      }),
      540,
    );

    expect(body.parts?.[0]).not.toHaveProperty('goodsIssueId');
  });
});
