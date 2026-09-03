import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  IQC_SKIP_APPROVAL_TYPE_CODE,
  PLACEHOLDER_REQUEST_STATUS_CODES,
  codeNote,
  codePlaceholder,
  toCodeOptions,
  typePendingNote,
} from './code-options';

const t = messages.iqcSkipApproval;

describe('승인 유형 코드 자리표시', () => {
  it('지금은 비어 있다 — 그것이 이 화면의 사실이다', () => {
    expect(IQC_SKIP_APPROVAL_TYPE_CODE).toBeNull();
  });

  it('계약의 예시 값을 심지 않는다 — 예시는 확정이 아니다', () => {
    expect(IQC_SKIP_APPROVAL_TYPE_CODE).not.toBe('DISPOSAL_REQUEST');
  });
});

describe('요청 상태 값 목록 자리표시', () => {
  it('비어 있다', () => {
    expect(PLACEHOLDER_REQUEST_STATUS_CODES).toEqual([]);
  });

  it('계약의 예시 값을 심지 않는다', () => {
    expect([...PLACEHOLDER_REQUEST_STATUS_CODES]).not.toContain('IN_PROGRESS');
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

describe('toCodeOptions', () => {
  it('값이 없으면 선택지도 없다', () => {
    expect(toCodeOptions([])).toEqual([]);
  });

  it('값이 오면 그 값이 선택지가 된다 — 자리표시를 채우면 칸이 살아난다', () => {
    expect(toCodeOptions(['SAMPLE-A', 'SAMPLE-B'])).toEqual([
      { value: 'SAMPLE-A', label: 'SAMPLE-A' },
      { value: 'SAMPLE-B', label: 'SAMPLE-B' },
    ]);
  });

  it('차례를 바꾸지 않는다 — 어떤 차례로 오는지가 뜻일 수 있다', () => {
    expect(toCodeOptions(['B', 'A']).map((option) => option.value)).toEqual(['B', 'A']);
  });

  it('라벨을 지어내지 않는다 — 코드값을 그대로 쓴다', () => {
    expect(toCodeOptions(['SAMPLE-A'])[0]?.label).toBe('SAMPLE-A');
  });
});

describe('선택칸 안내', () => {
  it('선택지가 비면 왜 비었는지 밝힌다', () => {
    expect(codeNote([])).toBe(messages.pendingCode.note);
    expect(codePlaceholder()).toBe(messages.pendingCode.placeholder);
  });

  it('선택지가 차면 안내를 거둔다', () => {
    expect(codeNote(toCodeOptions(['SAMPLE-A']))).toBeUndefined();
  });
});
