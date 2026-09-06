import { describe, expect, it } from 'vitest';

import { isProductionResultApprovalRequired } from './result-correction-mutations';

describe('정정 승인 필요 응답', () => {
  it('계약의 화면 단위 400을 승인 동선으로 보낸다', () => {
    expect(
      isProductionResultApprovalRequired({
        kind: 'validation',
        errors: [{ scope: 'screen', code: 'APPROVAL_REQUIRED', message: '승인이 필요합니다.' }],
      }),
    ).toBe(true);
    expect(isProductionResultApprovalRequired({ kind: 'http', status: 400 })).toBe(true);
  });

  it('필드 오류와 다른 실패는 승인 필요로 오인하지 않는다', () => {
    expect(
      isProductionResultApprovalRequired({
        kind: 'validation',
        errors: [{ scope: 'field', field: 'reasonCode', code: 'REQUIRED', message: '필수입니다.' }],
      }),
    ).toBe(false);
    expect(isProductionResultApprovalRequired({ kind: 'network' })).toBe(false);
  });
});
