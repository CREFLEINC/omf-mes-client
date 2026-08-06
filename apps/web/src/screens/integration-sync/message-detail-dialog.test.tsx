import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { messageRow } from './fixtures';
import { MessageDetailDialog } from './message-detail-dialog';
import type { MessageDetailView } from './types';

const NOW = new Date('2026-08-06T12:00:00+09:00');

const renderDialog = (props: Partial<Parameters<typeof MessageDetailDialog>[0]> = {}) => {
  const onClose = vi.fn();
  render(
    <MessageDetailDialog
      open
      onClose={onClose}
      view={messageRow()}
      isLoading={false}
      loadError={null}
      now={NOW}
      {...props}
    />,
  );

  return { onClose };
};

/** 라벨이 붙은 칸의 값만 읽는다. 「—」가 여럿이라 화면 전체에서 찾으면 어느 칸인지 알 수 없다. */
const fieldValue = (label: string): string => {
  const cell = screen.getByText(label).closest('.field-cell');

  return (cell?.textContent ?? '').replace(label, '');
};

describe('MessageDetailDialog — 항목', () => {
  it('목록에 없던 항목이 전부 나온다', () => {
    renderDialog({
      view: messageRow({
        directionCode: 'INBOUND',
        targetTypeCode: 'SAMPLE_TARGET',
        targetId: 9101,
        sentAt: '2026-08-04T09:13:00+09:00',
        completedAt: '2026-08-04T09:15:00+09:00',
        lockedBy: 'sync-worker-01',
        lockedAt: '2026-08-04T11:20:00+09:00',
      }),
    });

    expect(fieldValue('방향')).toBe('INBOUND');
    expect(fieldValue('대상')).toBe('SAMPLE_TARGET · 9101');
    expect(fieldValue('전송')).toBe('2026-08-04 09:13');
    expect(fieldValue('완료')).toBe('2026-08-04 09:15');
    expect(fieldValue('처리 중')).toBe('sync-worker-01 (2026-08-04 11:20)');
    expect(fieldValue('다음 시도')).toBe('2026-08-04 09:20');
  });

  it('null인 값은 빈 칸이 아니라 「—」로 나온다', () => {
    renderDialog({
      view: messageRow({
        sentAt: null,
        completedAt: null,
        lockedAt: null,
        lockedBy: null,
        lastErrorMessage: null,
      }),
    });

    expect(fieldValue('전송')).toBe('—');
    expect(fieldValue('완료')).toBe('—');
    expect(fieldValue('처리 중')).toBe('—');
    expect(fieldValue('마지막 오류')).toBe('—');
  });

  it('시도 횟수가 0이어도 그대로 보인다', () => {
    renderDialog({ view: messageRow({ retryCount: 0 }) });

    expect(fieldValue('시도')).toBe('0');
  });

  it('잡고 있는 워커는 있는데 시각이 없으면 시각 자리만 「—」다', () => {
    renderDialog({ view: messageRow({ lockedBy: 'sync-worker-01', lockedAt: null }) });

    expect(fieldValue('처리 중')).toBe('sync-worker-01 (—)');
  });
});

describe('MessageDetailDialog — 전송 내용 구획', () => {
  it('구획은 있으나 잠겨 있고 사유가 이어져 있다', () => {
    renderDialog();

    const action = screen.getByRole('button', { name: '전송 내용 보기' });
    expect(action).toBeDisabled();

    const reasonId = action.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(reasonId)).toHaveTextContent(
      '전송 내용은 열람 범위가 정해진 뒤에 볼 수 있습니다.',
    );
  });

  it('화면 타입에 전문이 없어 그릴 값 자체가 없다', () => {
    /*
     * 서버는 전문을 언제나 실어 보낸다. 화면 타입이 그 값을 담지 않는 것이 유일한 방어다 —
     * 이 단언이 깨지면 타입에 payload가 다시 생겼다는 뜻이다.
     */
    const view: MessageDetailView = messageRow();

    expect(Object.keys(view)).not.toContain('payload');
  });
});

describe('MessageDetailDialog — 불러오는 중과 실패', () => {
  it('아직 받지 못했으면 빈 값을 자료로 보이지 않는다', () => {
    renderDialog({ view: undefined, isLoading: true });

    expect(
      screen.getByRole('status', { name: '연계 메시지 정보를 불러오는 중' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('방향')).not.toBeInTheDocument();
  });

  it('실패하면 항목 대신 실패 표시를 낸다', () => {
    renderDialog({ loadError: <p>불러오지 못했습니다</p> });

    expect(screen.getByText('불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByText('방향')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '전송 내용 보기' })).not.toBeInTheDocument();
  });
});
