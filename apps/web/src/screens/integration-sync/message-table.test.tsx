import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { messageRow } from './fixtures';
import { MessageTable } from './message-table';

const NOW = new Date('2026-08-06T12:00:00+09:00');

const renderTable = (props: Partial<Parameters<typeof MessageTable>[0]> = {}) => {
  const onFirstPage = vi.fn();
  const onOpenDetail = vi.fn();
  const onRetry = vi.fn();
  const onSelectionChange = vi.fn();
  render(
    <MessageTable
      rows={[messageRow()]}
      isLoading={false}
      hasPeriod
      isBeyondLast={false}
      onFirstPage={onFirstPage}
      onOpenDetail={onOpenDetail}
      onRetry={onRetry}
      retryingId={null}
      selectedIds={[]}
      onSelectionChange={onSelectionChange}
      now={NOW}
      {...props}
    />,
  );

  return { onFirstPage, onOpenDetail, onRetry, onSelectionChange, user: userEvent.setup() };
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

  it('재처리 버튼은 상태와 무관하게 언제나 누를 수 있다', async () => {
    // 실서버의 상태 어휘를 화면이 모른다. 「실패일 때만」으로 막으면 어휘가 다른 서버에서 전부 죽는다.
    const { onRetry, user } = renderTable({
      rows: [messageRow({ statusCode: 'ERROR', lockedBy: 'sync-worker-01' })],
    });

    const button = screen.getByRole('button', { name: 'SAMPLE-KEY-0001 재처리' });
    expect(button).toBeEnabled();

    await user.click(button);

    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ integrationMessageId: 9001 }));
  });

  it('보내는 중인 행의 버튼만 진행 중으로 잠긴다', () => {
    renderTable({
      rows: [
        messageRow(),
        messageRow({ integrationMessageId: 9002, messageKey: 'SAMPLE-KEY-0002' }),
      ],
      retryingId: 9001,
    });

    expect(screen.getByRole('button', { name: 'SAMPLE-KEY-0001 재처리' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'SAMPLE-KEY-0002 재처리' })).toBeEnabled();
  });

  it('행마다 선택칸이 있고 고르면 그 식별자가 넘어간다', async () => {
    const { onSelectionChange, user } = renderTable();

    /*
     * 디자인 시스템은 행 체크박스의 접근 이름을 모든 행에 같게 붙인다.
     * 이름으로 특정할 수 없어 순서로 찾는다 — 이 사실이 바뀌면 이 테스트가 먼저 깨진다.
     */
    await user.click(screen.getAllByRole('checkbox', { name: '행 선택' })[0] as HTMLElement);

    expect(onSelectionChange).toHaveBeenCalledWith(['9001']);
  });

  it('머리글 선택칸을 해제하면 빈 배열이 넘어간다 — 이 쪽의 선택이 통째로 풀린다', async () => {
    const { onSelectionChange, user } = renderTable({ selectedIds: ['9001'] });

    await user.click(screen.getByRole('checkbox', { name: '전체 선택' }));

    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('결과는 있는데 이 쪽이 비었으면 첫 쪽으로 갈 수단과 함께 안내한다', async () => {
    const { onFirstPage, user } = renderTable({ rows: [], isBeyondLast: true });

    expect(screen.getByText('이 쪽에는 결과가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('조건에 맞는 기록이 없습니다')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '첫 쪽으로' }));

    expect(onFirstPage).toHaveBeenCalledTimes(1);
  });
});
