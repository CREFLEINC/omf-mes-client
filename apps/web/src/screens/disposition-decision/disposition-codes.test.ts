import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  DISPOSITION_TYPE_CODES,
  NONCONFORMANCE_STATUS_CODES,
  SEVERITY_CODES,
  dispositionLockReason,
  severityScopeWarning,
  toCodeOptions,
} from './disposition-codes';

/**
 * ⚠ 아래 코드 문자열은 **지어낸 자리표시**다 — 처분·심각도·상태의 실제 값 목록은 아직
 * 확정되지 않았다. 감지기가 「코드가 오면 이렇게 다룬다」를 보이기 위한 것이지
 * 확정값이 아니므로, 제품 상수로 옮기지 않는다.
 */
const PLACEHOLDER_DISPOSITION_CODE = 'CODE-A';
const PLACEHOLDER_SEVERITY_CODE = 'CODE-B';
const PLACEHOLDER_STATUS_CODE = 'CODE-C';

describe('코드 상수', () => {
  it('값 목록이 확정되기 전에는 코드를 지어내지 않는다', () => {
    expect(DISPOSITION_TYPE_CODES).toEqual([]);
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

describe('severityScopeWarning', () => {
  it('심각도·상태 이름이 모두 없을 때만 안내를 낸다', () => {
    expect(severityScopeWarning([], [])).toBe(messages.dispositionDecision.severityScopeWarning);
  });

  it('한쪽이라도 이름을 알 수 있으면 안내를 내지 않는다', () => {
    expect(severityScopeWarning([PLACEHOLDER_SEVERITY_CODE], [])).toBeUndefined();
    expect(severityScopeWarning([], [PLACEHOLDER_STATUS_CODE])).toBeUndefined();
  });
});
