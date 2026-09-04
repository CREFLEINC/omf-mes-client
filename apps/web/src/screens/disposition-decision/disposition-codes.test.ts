import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  DISPOSITION_TYPE_CODES,
  NONCONFORMANCE_STATUS_CODES,
  SEVERITY_CODES,
  dispositionLockReason,
  scopeWarning,
  toCodeOptions,
} from './disposition-codes';

/**
 * ⚠ 아래 코드 문자열은 **지어낸 자리표시**다 — 처분·심각도·상태의 실제 값 목록은 아직
 * 확정되지 않았다. 감지기가 「코드가 오면 이렇게 다룬다」를 보이기 위한 것이지
 * 확정값이 아니므로, 제품 상수로 옮기지 않는다.
 */
const PLACEHOLDER_DISPOSITION_CODE = 'REWORK';
const PLACEHOLDER_SEVERITY_CODE = 'CODE-B';
const PLACEHOLDER_STATUS_CODE = 'CODE-C';

describe('코드 상수', () => {
  it('고정 OpenAPI의 처분 유형 3종을 담는다', () => {
    expect(DISPOSITION_TYPE_CODES).toEqual(['REWORK', 'SCRAP', 'NORMAL']);
    expect(SEVERITY_CODES).toEqual([]);
    expect(NONCONFORMANCE_STATUS_CODES).toEqual([]);
  });
});

describe('toCodeOptions', () => {
  it('이름이 없는 동안에는 코드 값을 그대로 라벨로 쓴다', () => {
    expect(toCodeOptions([PLACEHOLDER_DISPOSITION_CODE])).toEqual([
      { value: PLACEHOLDER_DISPOSITION_CODE, label: PLACEHOLDER_DISPOSITION_CODE },
    ]);
  });

  it('빈 목록은 빈 선택지가 된다', () => {
    expect(toCodeOptions([])).toEqual([]);
  });
});

describe('dispositionLockReason', () => {
  it('선택지가 비면 잠금 사유를 낸다 — 감추지 않는다(G-2)', () => {
    expect(dispositionLockReason([])).toBe(messages.dispositionDecision.dispositionPending);
  });

  it('선택지가 있으면 잠그지 않는다', () => {
    expect(dispositionLockReason([PLACEHOLDER_DISPOSITION_CODE])).toBeUndefined();
  });
});

describe('scopeWarning', () => {
  const t = messages.dispositionDecision.scopeWarning;

  it('둘 다 이름이 없으면 둘을 함께 지목한다', () => {
    expect(scopeWarning([], [])).toBe(t.both);
  });

  it('심각도만 남으면 심각도를 지목한다 — 사유 없이 남기지 않는다', () => {
    expect(scopeWarning([], [PLACEHOLDER_STATUS_CODE])).toBe(t.severity);
  });

  it('상태만 남으면 상태를 지목한다', () => {
    expect(scopeWarning([PLACEHOLDER_SEVERITY_CODE], [])).toBe(t.status);
  });

  it('둘 다 이름을 알면 안내하지 않는다', () => {
    expect(scopeWarning([PLACEHOLDER_SEVERITY_CODE], [PLACEHOLDER_STATUS_CODE])).toBeUndefined();
  });
});
