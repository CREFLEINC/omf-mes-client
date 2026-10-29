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

  /* omf-all-around#212 — 생략은 근거(기본 설정 · 결재 승인)로 한 번 더 가른다. 근거가 없으면 종전 「생략」. */
  it('생략은 근거로 가른다 — 기본 설정 · 결재 승인 · 근거 없음', () => {
    expect(toStatusBadge('SKIPPED', 'DEFAULT').label).toBe(t.skippedDefault);
    expect(toStatusBadge('SKIPPED', 'APPROVAL').label).toBe(t.skippedApproval);
    expect(toStatusBadge('SKIPPED', null).label).toBe(t.skipped);
    expect(toStatusBadge('REQUESTED', 'DEFAULT').label).toBe(t.requested);
  });

  it('모르는 값은 코드를 그대로 보인다 — 표시명을 지어내면 뜻도 화면이 지어낸 것이 된다', () => {
    expect(toStatusBadge('SOMETHING_NEW')).toEqual({ label: 'SOMETHING_NEW', tone: 'idle' });
  });
});
