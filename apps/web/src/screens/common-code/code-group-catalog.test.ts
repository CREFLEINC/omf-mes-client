import { describe, expect, it } from 'vitest';

import { EXPECTED_CODE_GROUPS, isProvisionalCatalog } from './code-group-catalog';

/**
 * 이 파일이 지키는 것은 값이 아니라 **값을 지어내지 않았다는 사실**이다.
 * 코드 체계 정의가 표준화 작업 중이라(omf-mes#64) 확정된 기대 목록이 없다.
 */
describe('EXPECTED_CODE_GROUPS', () => {
  it('비어 있다 — 확정되지 않은 목록에 값을 지어넣지 않는다', () => {
    expect(EXPECTED_CODE_GROUPS).toEqual([]);
  });
});

describe('isProvisionalCatalog', () => {
  it('기대 목록이 비어 있는 동안 임시 목록으로 본다', () => {
    expect(isProvisionalCatalog()).toBe(true);
  });

  it('기대 목록이 비어 있다는 사실과 임시 판정이 같은 근거를 쓴다', () => {
    expect(isProvisionalCatalog()).toBe(EXPECTED_CODE_GROUPS.length === 0);
  });
});
