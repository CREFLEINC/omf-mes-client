import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { IQC_SKIP_APPROVAL_TYPE_CODE, typePendingNote } from './code-options';

const t = messages.iqcSkipApproval;

describe('승인 유형 고정 코드', () => {
  it('고정 OpenAPI의 IQC 생략 유형을 쓴다', () => {
    expect(IQC_SKIP_APPROVAL_TYPE_CODE).toBe('IQC_SKIP');
  });

  it('계약의 예시 값을 심지 않는다 — 예시는 확정이 아니다', () => {
    expect(IQC_SKIP_APPROVAL_TYPE_CODE).not.toBe('DISPOSAL_REQUEST');
  });
});

/**
 * **전환 감지기**(M06·M07의 단위 몫). 자리표시가 채워졌을 때 살아나는 것을 재지 않으면
 * 그 가지는 죽은 코드다 — 잠금을 상수로 굳혀도 아무 시험이 깨지지 않는다.
 */
describe('typePendingNote — 자리표시 두 방향', () => {
  it('코드가 비면 왜 좁혀지지 않는지 밝힌다', () => {
    expect(typePendingNote(null)).toBe(t.typePendingNote);
  });

  it('코드가 차면 안내를 거둔다 — 남으면 화면이 거짓말을 한다', () => {
    expect(typePendingNote('GOODS_ISSUE_DISPOSAL')).toBeUndefined();
  });

  it('공백만인 코드는 채워지지 않은 것으로 본다 — 그 값으로는 좁힐 수 없다', () => {
    expect(typePendingNote('   ')).toBe(t.typePendingNote);
  });
});
