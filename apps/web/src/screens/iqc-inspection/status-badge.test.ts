import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toStatusBadge } from './status-badge';

const t = messages.iqcInspection.status;

describe('toStatusBadge', () => {
  it('대기와 진행을 서로 다른 문구·색으로 가른다 — 큐가 보이는 것이 이 둘이다', () => {
    const requested = toStatusBadge('REQUESTED');
    const inProgress = toStatusBadge('IN_PROGRESS');

    expect(requested).toEqual({ label: t.requested, tone: 'idle' });
    expect(inProgress).toEqual({ label: t.inProgress, tone: 'info' });
    expect(requested.tone).not.toBe(inProgress.tone);
  });

  it('모르는 값은 코드를 그대로 보인다 — 지어내지 않는다', () => {
    expect(toStatusBadge('COMPLETED').label).toBe('COMPLETED');
  });

  it('생략과 취소를 합치지 않는다 — 앞은 승인된 정상 종결이고 뒤는 무효가 된 것이다', () => {
    expect(toStatusBadge('SKIPPED').label).not.toBe(toStatusBadge('CANCELLED').label);
  });

  it('빈 값이 와도 화면이 선다', () => {
    expect(toStatusBadge('')).toEqual({ label: '', tone: 'idle' });
  });
});
