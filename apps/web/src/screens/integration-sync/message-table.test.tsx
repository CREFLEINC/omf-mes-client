import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { messageRow } from './fixtures';
import { MessageTable } from './message-table';

const NOW = new Date('2026-08-06T12:00:00+09:00');

const renderTable = (props: Partial<Parameters<typeof MessageTable>[0]> = {}) => {
  const onFirstPage = vi.fn();
  const onOpenDetail = vi.fn();
  render(
    <MessageTable
      rows={[messageRow()]}
      isLoading={false}
      hasPeriod
      isBeyondLast={false}
      onFirstPage={onFirstPage}
      onOpenDetail={onOpenDetail}
      now={NOW}
      {...props}
    />,
  );

  return { onFirstPage, onOpenDetail, user: userEvent.setup() };
};

describe('MessageTable', () => {
  it('불러오는 중에는 표 대신 진행 상태를 낸다', () => {
    renderTable({ isLoading: true });

    expect(
      screen.getByRole('status', { name: '연계 메시지 목록을 불러오는 중' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('기간을 정한 뒤 0건이면 조건을 고치라고 안내한다', () => {
    renderTable({ rows: [] });

    expect(screen.getByText('조건에 맞는 기록이 없습니다')).toBeInTheDocument();
    expect(screen.getByText('기간을 넓히거나 조건을 줄인 뒤 다시 조회하세요.')).toBeInTheDocument();
  });

  it('기간이 없어 아직 조회하지 않았으면 다른 안내를 낸다 — 결과가 없는 것과 다르다', () => {
    renderTable({ rows: [], hasPeriod: false });

    expect(screen.getByText('기간을 고르고 조회하세요')).toBeInTheDocument();
    expect(screen.queryByText('조건에 맞는 기록이 없습니다')).not.toBeInTheDocument();
  });

  it('null이 섞인 행도 셀을 비우지 않는다', () => {
    renderTable({
      rows: [
        messageRow({
          lastErrorMessage: null,
          sentAt: null,
          completedAt: null,
          lockedAt: null,
          lockedBy: null,
        }),
      ],
    });

    const row = screen.getAllByRole('row')[1] as HTMLElement;
    expect(within(row).getByText('—')).toBeInTheDocument();
  });

  it('시도 횟수가 0이어도 그대로 보인다 — 0을 빈 칸으로 접으면 안 된다', () => {
    renderTable({ rows: [messageRow({ retryCount: 0 })] });

    const row = screen.getAllByRole('row')[1] as HTMLElement;
    expect(within(row).getByText('0')).toBeInTheDocument();
  });

  it('정렬 가능한 머리글을 두지 않는다 — 계약에 정렬 파라미터가 없다', () => {
    renderTable();

    // 정렬 가능한 열은 머리글이 button이 되고 aria-sort가 붙는다. 둘 다 없어야 한다.
    for (const header of screen.getAllByRole('columnheader')) {
      expect(within(header).queryByRole('button')).toBeNull();
      expect(header).not.toHaveAttribute('aria-sort');
    }
  });

  it('메시지 키가 상세를 여는 버튼이고 접근 이름에 그 키가 들어간다', async () => {
    const { onOpenDetail, user } = renderTable();

    await user.click(screen.getByRole('button', { name: 'SAMPLE-KEY-0001 상세 열기' }));

    expect(onOpenDetail).toHaveBeenCalledWith(9001);
  });

  it('결과는 있는데 이 쪽이 비었으면 첫 쪽으로 갈 수단과 함께 안내한다', async () => {
    const { onFirstPage, user } = renderTable({ rows: [], isBeyondLast: true });

    expect(screen.getByText('이 쪽에는 결과가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('조건에 맞는 기록이 없습니다')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '첫 쪽으로' }));

    expect(onFirstPage).toHaveBeenCalledTimes(1);
  });
});
