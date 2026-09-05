import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  codeLockReason,
  codeOptionsOf,
  codeTruncatedNote,
  codeValueLabel,
  DISPOSITION_TYPE_CODES,
  dispositionLockReason,
  dispositionTypeLabel,
  dispositionTypeOptions,
  NONCONFORMANCE_STATUS_CODE_GROUP,
  SEVERITY_CODE_GROUP,
} from './disposition-codes';
import type { DispositionLookup } from './lookups';

const t = messages.dispositionDecision;
const lookup = (overrides: Partial<DispositionLookup> = {}): DispositionLookup => ({
  entries: [],
  truncated: false,
  isError: false,
  isLoading: false,
  ...overrides,
});
/* 합성 코드 — 실제 값 목록은 서버 공통코드가 준다. 비활성 값은 「지난 값」의 이름을 보이기 위해 둔다. */
const entries = [
  { value: 'CODE-B', label: '합성 심각도 B', isActive: true },
  { value: 'CODE-X', label: '합성 심각도 X', isActive: false },
];

describe('처분 유형 — 계약이 닫은 셋이라 표시명은 화면이 갖는다(G-33)', () => {
  it('고정 OpenAPI의 처분 유형 3종을 담는다', () => {
    expect(DISPOSITION_TYPE_CODES).toEqual(['REWORK', 'SCRAP', 'NORMAL']);
  });

  it.each([
    ['REWORK', '재작업'],
    ['SCRAP', '폐기'],
    ['NORMAL', '정상'],
  ])('%s → %s', (code, label) => {
    expect(dispositionTypeLabel(code)).toBe(label);
  });

  it('모르는 값은 코드를 그대로 보인다 — 뜻을 지어내지 않는다(G-9)', () => {
    expect(dispositionTypeLabel('SYN_NEW')).toBe('SYN_NEW');
  });

  it('선택지는 코드에 표시명을 붙인다', () => {
    expect(dispositionTypeOptions(['SCRAP'])).toEqual([{ value: 'SCRAP', label: '폐기' }]);
    expect(dispositionTypeOptions([])).toEqual([]);
  });
});

describe('공통코드 그룹 — 채번 식별자가 아니라 코드로 부른다', () => {
  it('심각도·상태 그룹 코드', () => {
    expect(SEVERITY_CODE_GROUP).toBe('NONCONFORMANCE_SEVERITY');
    expect(NONCONFORMANCE_STATUS_CODE_GROUP).toBe('NONCONFORMANCE_STATUS');
  });
});

describe('codeOptionsOf', () => {
  it('활성 값만 선택지가 된다', () => {
    expect(codeOptionsOf(lookup({ entries }))).toEqual([
      { value: 'CODE-B', label: '합성 심각도 B' },
    ]);
  });
});

describe('codeLockReason — 감추지 않고 사유를 단다(G-2)', () => {
  it('못 받음이 조회 중보다 앞선다', () => {
    expect(codeLockReason(lookup({ isError: true, isLoading: true }))).toBe(t.codeLock.failed);
  });

  it('조회 중이면 그 사유로 잠근다', () => {
    expect(codeLockReason(lookup({ isLoading: true }))).toBe(t.codeLock.loading);
  });

  it('서고 나서 비어 있으면 빈 목록 사유로 잠근다 — 비활성 값만 있어도 같다', () => {
    expect(codeLockReason(lookup())).toBe(t.codeLock.empty);
    expect(codeLockReason(lookup({ entries: [entries[1]!] }))).toBe(t.codeLock.empty);
  });

  it('활성 값이 있으면 잠그지 않는다', () => {
    expect(codeLockReason(lookup({ entries }))).toBeUndefined();
  });
});

describe('codeTruncatedNote', () => {
  it('잘려 왔을 때만 안내한다', () => {
    expect(codeTruncatedNote(lookup({ entries, truncated: true }))).toBe(t.codeTruncated);
    expect(codeTruncatedNote(lookup({ entries }))).toBeUndefined();
  });
});

describe('codeValueLabel — 목록 셀의 표시명', () => {
  it('아는 코드는 이름으로, 비활성 값도 이름으로 보인다', () => {
    expect(codeValueLabel(lookup({ entries }), 'CODE-B')).toBe('합성 심각도 B');
    expect(codeValueLabel(lookup({ entries }), 'CODE-X')).toBe('합성 심각도 X');
  });

  it('모르는 코드·조회 전·실패는 코드를 그대로 보인다(G-9)', () => {
    expect(codeValueLabel(lookup({ entries }), 'CODE-Z')).toBe('CODE-Z');
    expect(codeValueLabel(lookup({ isLoading: true }), 'CODE-B')).toBe('CODE-B');
    expect(codeValueLabel(lookup({ isError: true }), 'CODE-B')).toBe('CODE-B');
  });
});

describe('dispositionLockReason', () => {
  it('선택지가 비면 잠금 사유를 낸다 — 감추지 않는다(G-2)', () => {
    expect(dispositionLockReason([])).toBe(t.dispositionPending);
  });

  it('선택지가 있으면 잠그지 않는다', () => {
    expect(dispositionLockReason(['REWORK'])).toBeUndefined();
  });
});
