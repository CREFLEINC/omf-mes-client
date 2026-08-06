import { describe, expect, it } from 'vitest';

import { createQualificationDraft, type QualificationDraft } from './qualification-draft';
import {
  duplicateDraftIds,
  QUALIFICATION_FORM_FIELDS,
  validateQualificationDraft,
} from './qualification-validation';

const draft = (overrides: Partial<QualificationDraft> = {}): QualificationDraft => ({
  ...createQualificationDraft(),
  qualificationTypeCode: 'PENDING',
  validFrom: '2026-08-01',
  ...overrides,
});

describe('validateQualificationDraft', () => {
  it('채워진 줄은 오류가 없다', () => {
    expect(validateQualificationDraft(draft(), [])).toEqual({});
  });

  /* C72 */
  it('자격 유형과 유효 시작이 비면 막는다', () => {
    expect(
      validateQualificationDraft(draft({ qualificationTypeCode: '' }), []).qualificationTypeCode,
    ).toBe('필수 입력 항목입니다.');
    expect(validateQualificationDraft(draft({ validFrom: '' }), []).validFrom).toBe(
      '필수 입력 항목입니다.',
    );
  });

  it('인증번호가 100자를 넘으면 막고 상한 자체는 통과시킨다', () => {
    expect(
      validateQualificationDraft(draft({ certificateNo: 'A'.repeat(100) }), []).certificateNo,
    ).toBe(undefined);
    expect(
      validateQualificationDraft(draft({ certificateNo: 'A'.repeat(101) }), []).certificateNo,
    ).toBe('인증번호는 100자를 넘을 수 없습니다.');
  });

  /* C71 — 계약: 있으면 유효 시작 이상. 같은 날은 허용된다. */
  it('유효 종료가 유효 시작보다 앞서면 두 칸 모두에 오류가 붙는다', () => {
    const errors = validateQualificationDraft(
      draft({ validFrom: '2026-08-10', validTo: '2026-08-01' }),
      [],
    );

    expect(errors.validFrom).toBe('유효 종료는 유효 시작과 같거나 그 뒤여야 합니다.');
    expect(errors.validTo).toBe('유효 종료는 유효 시작과 같거나 그 뒤여야 합니다.');
  });

  it('유효 종료가 유효 시작과 같으면 막지 않는다', () => {
    expect(
      validateQualificationDraft(draft({ validFrom: '2026-08-01', validTo: '2026-08-01' }), []),
    ).toEqual({});
  });

  /* C71 — 한쪽만 있는 것은 계약이 허용한다. 비운 종료는 「무기한」이다. */
  it('유효 종료만 비어 있으면 막지 않는다', () => {
    expect(validateQualificationDraft(draft({ validTo: '' }), [])).toEqual({});
  });

  /*
   * C69 — 계약의 유일 제약이 `COALESCE(process_id,0)`으로 접힌다.
   * **공정을 비운 두 줄은 같은 짝이다.**
   */
  it('같은 자격 유형·공정 짝이 이미 있으면 막는다', () => {
    const existing = draft({ processId: '6001' });
    const candidate = draft({ processId: '6001' });

    expect(validateQualificationDraft(candidate, [existing]).qualificationTypeCode).toBe(
      '자격 유형과 공정 짝이 이미 있습니다. 공정을 다르게 고르거나 그 줄을 고치세요.',
    );
  });

  it('공정을 비운 두 줄은 같은 짝으로 센다', () => {
    const existing = draft();
    const candidate = draft();

    expect(validateQualificationDraft(candidate, [existing]).qualificationTypeCode).not.toBe(
      undefined,
    );
  });

  it('공정이 다르면 겹치지 않는다', () => {
    const existing = draft({ processId: '6001' });
    const candidate = draft({ processId: '6002' });

    expect(validateQualificationDraft(candidate, [existing])).toEqual({});
  });

  /* C69 — 자기 자신을 수정할 때 유형·공정이 그대로여도 중복이 아니다. */
  it('자기 자신은 중복으로 세지 않는다', () => {
    const existing = draft({ processId: '6001' });
    const edited = { ...existing, certificateNo: 'SYN-CERT-99' };

    expect(validateQualificationDraft(edited, [existing])).toEqual({});
  });
});

/* C70 — 서버가 준 목록에 이미 중복 짝이 있으면 그대로 보내도 서버가 거부한다. */
describe('duplicateDraftIds', () => {
  it('겹치는 짝의 줄을 전부 짚는다', () => {
    const a = draft({ processId: '6001' });
    const b = draft({ processId: '6001' });
    const c = draft({ processId: '6002' });

    const ids = duplicateDraftIds([a, b, c]);

    expect(ids.has(a.draftId)).toBe(true);
    expect(ids.has(b.draftId)).toBe(true);
    expect(ids.has(c.draftId)).toBe(false);
  });

  it('겹치는 짝이 없으면 비어 있다', () => {
    expect(
      duplicateDraftIds([draft({ processId: '6001' }), draft({ processId: '6002' })]).size,
    ).toBe(0);
  });

  it('공정을 비운 두 줄을 겹친 것으로 센다', () => {
    expect(duplicateDraftIds([draft(), draft()]).size).toBe(2);
  });
});

describe('QUALIFICATION_FORM_FIELDS', () => {
  it('이 창이 소유한 입력칸 이름을 계약 이름 그대로 갖는다', () => {
    expect([...QUALIFICATION_FORM_FIELDS]).toEqual([
      'qualificationTypeCode',
      'processId',
      'certificateNo',
      'validFrom',
      'validTo',
    ]);
  });
});
