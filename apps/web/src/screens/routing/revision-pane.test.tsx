import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { routingFixtures } from './fixtures';
import { RevisionPane, type RevisionPaneProps } from './revision-pane';

const renderPane = (overrides: Partial<RevisionPaneProps> = {}) => {
  const onSelect = vi.fn();
  const onNewRevision = vi.fn();
  const onCreateRouting = vi.fn();

  render(
    <RevisionPane
      revisions={routingFixtures}
      isLoading={false}
      isItemSelected
      selectedRoutingId={null}
      onSelect={onSelect}
      loadError={null}
      newRevisionDisabledReason={null}
      isCreating={false}
      isPublishing={false}
      onNewRevision={onNewRevision}
      onCreateRouting={onCreateRouting}
      banner={null}
      {...overrides}
    />,
  );

  return { onSelect, onNewRevision, onCreateRouting, user: userEvent.setup() };
};

describe('RevisionPane', () => {
  it('받은 순서대로 Rev와 상태 배지를 그린다 — 계약이 판 번호 내림차순으로 준다', () => {
    renderPane();

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Rev 3'),
      expect.stringContaining('Rev 2'),
      expect.stringContaining('Rev 1'),
    ]);

    expect(screen.getByText('작성중')).toBeInTheDocument();
    expect(screen.getByText('확정')).toBeInTheDocument();
    expect(screen.getByText('폐기')).toBeInTheDocument();
  });

  it('Rev를 누르면 선택을 알린다', async () => {
    const { onSelect, user } = renderPane();

    await user.click(screen.getByRole('button', { name: 'Rev 2' }));

    expect(onSelect).toHaveBeenCalledWith(7002);
  });

  it('선택된 Rev에 현재 위치 표식이 붙는다', () => {
    renderPane({ selectedRoutingId: 7002 });

    expect(screen.getByRole('button', { name: 'Rev 2' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Rev 3' })).not.toHaveAttribute('aria-current');
  });

  it('품목을 고르기 전에는 선택 안내만 낸다', () => {
    renderPane({ isItemSelected: false, revisions: [] });

    expect(screen.getByText('좌측에서 품목을 먼저 고르세요')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('Rev가 0건이면 빈 상태를 낸다', () => {
    renderPane({ revisions: [] });

    expect(screen.getByText('등록된 Rev가 없습니다')).toBeInTheDocument();
  });

  it('조회에 실패하면 목록도 빈 상태도 내지 않고 받은 오류 표시만 낸다', () => {
    renderPane({ revisions: [], loadError: <p>목록을 불러오지 못했습니다</p> });

    expect(screen.getByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 Rev가 없습니다')).not.toBeInTheDocument();
  });

  it('불러오는 동안에는 스켈레톤을 낸다', () => {
    renderPane({ revisions: [], isLoading: true });

    expect(screen.getByRole('status', { name: 'Rev 목록을 불러오는 중' })).toBeInTheDocument();
  });

  it('Rev가 1건 이상이면 발행 액션을 눌러 상위에 올린다', async () => {
    const { onNewRevision, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '신규 Rev 발행' }));

    expect(onNewRevision).toHaveBeenCalledTimes(1);
  });

  it('발행을 막는 사유가 있으면 비활성이고 그 사유가 보인다', () => {
    const reason =
      '신규 Rev 발행은 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.';
    renderPane({ newRevisionDisabledReason: reason });

    expect(screen.getByRole('button', { name: '신규 Rev 발행' })).toBeDisabled();
    expect(screen.getByText(reason)).toBeInTheDocument();
  });

  /* 복사할 원본 판이 없으면 발행이 성립하지 않는다 — 계약도 두 경로를 나눠 두었다. */
  it('Rev가 0건이면 발행 대신 등록 액션을 내고 눌러 상위에 올린다', async () => {
    const { onCreateRouting, user } = renderPane({ revisions: [] });

    expect(screen.queryByRole('button', { name: '신규 Rev 발행' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Routing 등록' }));

    expect(onCreateRouting).toHaveBeenCalledTimes(1);
  });

  it('등록 폼이 이미 열려 있으면 등록 액션을 다시 누를 수 없다', () => {
    renderPane({ revisions: [], isCreating: true });

    expect(screen.getByRole('button', { name: 'Routing 등록' })).toBeDisabled();
  });

  it('발행 실패 배너를 목록 위에 낸다', () => {
    renderPane({ banner: <p>발행하지 못했습니다.</p> });

    expect(screen.getByText('발행하지 못했습니다.')).toBeInTheDocument();
  });
});
