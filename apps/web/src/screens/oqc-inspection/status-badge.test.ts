import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toStatusBadge } from './status-badge';

const t = messages.oqcInspection.status;

describe('toStatusBadge', () => {
  it('계약이 확정한 5값을 서로 다르게 가른다', () => {
    expect(toStatusBadge('REQUESTED')).toEqual({ label: t.requested, tone: 'idle' });
    expect(toStatusBadge('IN_PROGRESS')).toEqual({ label: t.inProgress, tone: 'info' });
    expect(toStatusBadge('COMPLETED')).toEqual({ label: t.completed, tone: 'success' });
  });

  it('생략과 취소를 합치지 않는다 — 앞은 승인된 정상 종결이고 뒤는 의뢰가 무효가 된 것이다', () => {
    expect(toStatusBadge('SKIPPED').label).not.toBe(toStatusBadge('CANCELLED').label);
    expect(toStatusBadge('SKIPPED').tone).not.toBe(toStatusBadge('CANCELLED').tone);
  });

  it('모르는 값은 코드를 그대로 보인다 — 표시명을 지어내면 뜻도 화면이 지어낸 것이 된다', () => {
    expect(toStatusBadge('SOMETHING_NEW')).toEqual({ label: 'SOMETHING_NEW', tone: 'idle' });
  });
});
