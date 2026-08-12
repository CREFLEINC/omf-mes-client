import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RequestDetailPane } from './request-detail-pane';
import { toRequestDetailView } from './types';
import type { ApprovalRequest } from './types';

const t = messages.approvalInbox;

const baseRequest: ApprovalRequest = {
  approvalRequestId: 9001,
  approvalRequestNo: 'SYNTH-REQ-001',
  approvalTypeCode: 'SAMPLE-TYPE-A',
  requestedBy: 9301,
  requestedByName: '합성 상신자1',
  requestedAt: '2026-08-06T14:20:00+09:00',
  statusCode: 'SAMPLE-STATUS-OPEN',
  reason: '합성 사유 첫 줄\n둘째 줄은 훨씬 길게 이어지는 설명이다',
  target: {
    targetTypeCode: 'SAMPLE-TARGET-A',
    targetId: 9401,
    displayName: '합성 대상 문서 가',
    openable: true,
  },
  currentStepNo: 2,
  totalStepNo: 3,
  isMyTurn: true,
};

const renderPane = (overrides: Partial<ApprovalRequest> = {}): HTMLElement => {
  render(<RequestDetailPane view={toRequestDetailView({ ...baseRequest, ...overrides })} />);

  return screen.getByRole('group', { name: t.panes.request });
};

describe('RequestDetailPane', () => {
  it('확정된 다섯 값과 사유를 낸다', () => {
    const pane = renderPane();

    expect(within(pane).getByText('SYNTH-REQ-001')).toBeVisible();
    expect(within(pane).getByText('SAMPLE-TYPE-A')).toBeVisible();
    expect(within(pane).getByText('합성 상신자1')).toBeVisible();
    expect(within(pane).getByText('2026-08-06 14:20')).toBeVisible();
    expect(within(pane).getByText('SAMPLE-STATUS-OPEN')).toBeVisible();
  });

  it('사유 전문을 낸다 — 목록이 자른 둘째 줄이 여기서는 보인다', () => {
    const pane = renderPane();

    expect(within(pane).getByText('합성 사유 첫 줄')).toBeVisible();
    expect(within(pane).getByText('둘째 줄은 훨씬 길게 이어지는 설명이다')).toBeVisible();
  });

  it('줄마다 한 칸이다 — 이어 붙이면 줄바꿈이 사라진다', () => {
    renderPane();

    const reason = screen.getByRole('group', { name: t.panes.reason });

    expect([...reason.children].map((line) => line.textContent)).toEqual([
      '합성 사유 첫 줄',
      '둘째 줄은 훨씬 길게 이어지는 설명이다',
    ]);
  });

  it('가운데 빈 줄도 한 칸으로 남는다 — 문단 구분이 사유의 일부다', () => {
    renderPane({ reason: '머리\n\n꼬리' });

    const reason = screen.getByRole('group', { name: t.panes.reason });

    expect(reason.children).toHaveLength(3);
    expect(reason.children[1]?.textContent).toBe('');
  });

  it('사유를 자르지 않는다 — 긴 한 줄도 전문 그대로다', () => {
    const long = '긴 사유가 이어진다'.repeat(200);

    renderPane({ reason: long });

    expect(screen.getByText(long)).toBeVisible();
  });

  it('내부 번호를 어느 칸에도 내지 않는다', () => {
    const pane = renderPane();

    /* 짝 방향 — 사람이 읽는 값은 실제로 그려진다. */
    expect(within(pane).getByText('SYNTH-REQ-001')).toBeVisible();
    expect(within(pane).getByText('합성 상신자1')).toBeVisible();

    expect(pane.textContent).not.toContain('9001');
    expect(pane.textContent).not.toContain('9301');
    expect(pane.textContent).not.toContain('9401');
  });

  it('대상과 진행 단계를 여기서 그리지 않는다 — 각자 자기 구획이 있다', () => {
    const pane = renderPane();

    expect(pane.textContent).not.toContain('합성 대상 문서 가');
    expect(pane.textContent).not.toContain('SAMPLE-TARGET-A');
  });

  it('상신자 이름이 없으면 번호를 대신 내지 않는다', () => {
    const pane = renderPane({ requestedByName: '' });

    expect(within(pane).getByText(t.values.unknownRequester)).toBeVisible();
    expect(pane.textContent).not.toContain('9301');
  });

  it('사유가 비어 있으면 빈 칸 대신 그 사실을 적는다', () => {
    const pane = renderPane({ reason: '   ' });

    expect(within(pane).getByText(t.values.emptyReason)).toBeVisible();
  });

  it('값마다 이름표가 붙는다 — 무엇의 값인지 모르는 칸이 없다', () => {
    const pane = renderPane();

    for (const label of [
      t.fields.approvalRequestNo,
      t.fields.approvalTypeCode,
      t.fields.requestedByName,
      t.fields.requestedAt,
      t.fields.status,
      t.fields.reason,
    ]) {
      expect(within(pane).getByText(label)).toBeVisible();
    }
  });
});
