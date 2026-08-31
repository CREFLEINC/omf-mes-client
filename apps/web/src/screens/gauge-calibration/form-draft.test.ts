import { describe, expect, it } from 'vitest';

import {
  EMPTY_DRAFT,
  hasErrors,
  isCalibrationType,
  toCreateBody,
  updatesMaster,
  validateDraft,
  type CalibrationDraft,
} from './form-draft';

const draft = (overrides: Partial<CalibrationDraft> = {}): CalibrationDraft => ({
  ...EMPTY_DRAFT,
  equipment: '8101',
  historyTypeCode: 'CALIBRATION',
  performedOn: '2026-08-11',
  resultCode: 'PASS',
  ...overrides,
});

describe('isCalibrationType', () => {
  it('검교정일 때만 전용 칸이 열린다', () => {
    expect(isCalibrationType(draft())).toBe(true);
    expect(isCalibrationType(draft({ historyTypeCode: 'CHECK' }))).toBe(false);
  });
});

describe('updatesMaster', () => {
  /**
   * ⭐ 이 판정이 틀리면 화면이 **사실과 다른 파급을 사람에게 말한다** — 확인 창이 「갱신됩니다」로
   * 물었는데 갱신되지 않거나, 그 반대가 된다. 저장을 되돌릴 수 없어 뒤늦게 바로잡을 길이 없다.
   */
  it('검교정 · 합격일 때만 계측기 마스터를 갱신한다', () => {
    expect(updatesMaster(draft())).toBe(true);
  });

  it('불합격이면 갱신하지 않는다 — 유효기한이 늘어나면 안 된다', () => {
    expect(updatesMaster(draft({ resultCode: 'FAIL' }))).toBe(false);
  });

  it('검교정이 아니면 결과와 무관하게 갱신하지 않는다', () => {
    expect(updatesMaster(draft({ historyTypeCode: 'CHECK' }))).toBe(false);
    expect(updatesMaster(draft({ historyTypeCode: 'CHECK', resultCode: 'PASS' }))).toBe(false);
  });
});

describe('validateDraft', () => {
  it('다 채우면 오류가 없다', () => {
    expect(hasErrors(validateDraft(draft()))).toBe(false);
  });

  it('필수 넷이 비면 각각 사유를 낸다', () => {
    const errors = validateDraft(EMPTY_DRAFT);

    expect(Object.keys(errors).sort()).toEqual([
      'equipment',
      'historyTypeCode',
      'performedOn',
      'resultCode',
    ]);
  });

  it('달력에 없는 실시일을 막는다', () => {
    expect(validateDraft(draft({ performedOn: '2026-02-31' })).performedOn).toContain('달력');
  });

  /**
   * ⭐ 계약이 막지 않는 짝 제약이라 화면이 진다. 막지 않으면 **이미 지난 기한**이 계측기
   * 마스터로 넘어가고, 되돌릴 길이 없다.
   */
  it('유효기한이 실시일보다 앞서면 막는다', () => {
    expect(validateDraft(draft({ nextDueOn: '2026-08-10' })).nextDueOn).toContain('앞섭니다');
  });

  it('유효기한이 실시일과 같으면 막지 않는다', () => {
    expect(validateDraft(draft({ nextDueOn: '2026-08-11' })).nextDueOn).toBeUndefined();
  });

  it('유효기한은 비워도 된다 — 계약이 선택으로 두었다', () => {
    expect(validateDraft(draft({ nextDueOn: '' })).nextDueOn).toBeUndefined();
  });
});

describe('toCreateBody', () => {
  it('필수 넷을 옮긴다', () => {
    expect(toCreateBody(draft())).toMatchObject({
      equipmentId: 8101,
      historyTypeCode: 'CALIBRATION',
      performedOn: '2026-08-11',
      resultCode: 'PASS',
    });
  });

  /**
   * ⭐ 화면이 잠가 둔 칸에 값이 남아 있을 수 있다(유형을 바꾸기 전에 적었다면). 그대로 보내면
   * 점검 이력에 성적서 번호가 붙는데, **화면에는 보이지 않으므로 아무도 눈치채지 못한다.**
   */
  it('검교정이 아니면 검교정 전용 칸을 싣지 않는다', () => {
    const body = toCreateBody(
      draft({
        historyTypeCode: 'CHECK',
        certificateNo: 'SYN-CERT-01',
        agencyName: '합성 교정기관',
        nextDueOn: '2027-08-10',
        toleranceNote: '합성 메모',
      }),
    );

    expect(body).not.toHaveProperty('certificateNo');
    expect(body).not.toHaveProperty('agencyName');
    expect(body).not.toHaveProperty('nextDueOn');
    expect(body).not.toHaveProperty('toleranceNote');
  });

  it('검교정이면 채운 전용 칸만 싣는다', () => {
    const body = toCreateBody(draft({ certificateNo: 'SYN-CERT-01', agencyName: '  ' }));

    expect(body.certificateNo).toBe('SYN-CERT-01');
    expect(body).not.toHaveProperty('agencyName');
  });

  it('공백만 친 비고는 값이 아니다 — 보내면 그것이 값으로 저장된다', () => {
    expect(toCreateBody(draft({ remarks: '   ' }))).not.toHaveProperty('remarks');
  });

  it('비고는 유형과 무관하게 실린다', () => {
    expect(toCreateBody(draft({ historyTypeCode: 'CHECK', remarks: '합성 비고' })).remarks).toBe(
      '합성 비고',
    );
  });
});
