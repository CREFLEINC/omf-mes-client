import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  PLACEHOLDER_APPROVAL_TYPE_CODES,
  PLACEHOLDER_REQUEST_STATUS_CODES,
  codeNote,
  codePlaceholder,
  toCodeOptions,
} from './code-options';

describe('자리표시 상수', () => {
  it('승인 유형 값 목록이 비어 있다 — 그것이 지금의 사실이다', () => {
    expect(PLACEHOLDER_APPROVAL_TYPE_CODES).toEqual([]);
  });

  it('요청 상태 값 목록이 비어 있다', () => {
    expect(PLACEHOLDER_REQUEST_STATUS_CODES).toEqual([]);
  });

  it('계약의 예시 값을 심지 않는다 — 예시는 확정이 아니다', () => {
    const planted = [...PLACEHOLDER_APPROVAL_TYPE_CODES, ...PLACEHOLDER_REQUEST_STATUS_CODES];

    expect(planted).not.toContain('DISPOSAL_REQUEST');
    expect(planted).not.toContain('IN_PROGRESS');
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

describe('안내', () => {
  it('선택지가 비면 왜 비었는지 밝힌다', () => {
    expect(codeNote([])).toBe(messages.pendingCode.note);
    expect(codePlaceholder()).toBe(messages.pendingCode.placeholder);
  });

  it('선택지가 차면 안내를 거둔다 — 남으면 화면이 거짓말을 한다', () => {
    expect(codeNote(toCodeOptions(['SAMPLE-A']))).toBeUndefined();
  });
});
