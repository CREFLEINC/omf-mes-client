import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { approvalScopeWarning } from './code-options';

describe('approvalScopeWarning', () => {
  it('승인 유형 기준값이 비어 있으면 넓은 조회 범위를 경고한다', () => {
    expect(approvalScopeWarning([])).toBe(messages.qualityApproval.scopeWarning);
  });

  it('승인 유형 기준값이 하나라도 있으면 준비 중 경고를 내리지 않는다', () => {
    expect(approvalScopeWarning(['IQC_SKIP'])).toBeUndefined();
  });
});
