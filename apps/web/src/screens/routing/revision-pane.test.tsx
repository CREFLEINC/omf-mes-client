import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { routingFixtures } from './fixtures';
import { RevisionPane, type RevisionPaneProps } from './revision-pane';

const renderPane = (overrides: Partial<RevisionPaneProps> = {}) => {
  const onSelect = vi.fn();

  render(
    <RevisionPane
      revisions={routingFixtures}
      isLoading={false}
      isItemSelected
      selectedRoutingId={null}
      onSelect={onSelect}
      loadError={null}
      {...overrides}
    />,
  );

  return { onSelect, user: userEvent.setup() };
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

  it('아직 붙지 않은 발행 액션은 감추지 않고 사유와 함께 비활성으로 둔다', () => {
    renderPane();

    const button = screen.getByRole('button', { name: '신규 Rev 발행' });
    expect(button).toBeDisabled();
    expect(
      screen.getByText('신규 Rev 발행은 아직 실행할 수 없습니다. 기능이 준비되면 이 버튼을 쓸 수 있습니다.'),
    ).toBeInTheDocument();
  });

  it('Rev가 0건이면 발행 대신 등록 액션을 낸다', () => {
    renderPane({ revisions: [] });

    expect(screen.getByRole('button', { name: 'Routing 등록' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '신규 Rev 발행' })).not.toBeInTheDocument();
  });
});
