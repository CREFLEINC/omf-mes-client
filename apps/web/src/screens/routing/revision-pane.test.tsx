import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { routingFixtures } from './fixtures';
import { RevisionPane, type RevisionPaneProps } from './revision-pane';

const renderPane = (overrides: Partial<RevisionPaneProps> = {}) => {
  const onViewDetail = vi.fn();
  const onNewRevision = vi.fn();
  const onCreateRouting = vi.fn();

  render(
    <RevisionPane
      revisions={routingFixtures}
      isLoading={false}
      isItemSelected
      selectedRoutingId={null}
      onViewDetail={onViewDetail}
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

  return { onViewDetail, onNewRevision, onCreateRouting, user: userEvent.setup() };
};

describe('RevisionPane', () => {
  /* 확정 일시(#231) — 공장 시각 yyyy-MM-dd HH:mm, 없으면 「—」. */
  it('확정 일시 열을 보이고, 값이 없는 개정은 「—」로 적는다', () => {
    renderPane({
      revisions: routingFixtures.map((row, index) => ({
        ...row,
        confirmedAt: index === 0 ? '2026-11-05T01:30:00.000Z' : null,
      })),
    });

    expect(screen.getByRole('columnheader', { name: /확정 일시/ })).toBeInTheDocument();
    expect(screen.getByText(/^2026-11-05 \d{2}:30$/)).toBeInTheDocument();
  });

  /* 기본 Rev 고르기(#231) — 확정 개정만 고를 수 있고, 지금 기본을 다시 고르면 아무 일도 없다. */
  it('기본 Rev 칸은 확정 개정만 고르게 하고, 고른 개정을 상위에 올린다', async () => {
    const onSetDefault = vi.fn();
    const { user } = renderPane({
      revisions: routingFixtures.map((row) => ({ ...row, isDefault: false })),
      onSetDefault,
    });

    const select = screen.getByLabelText('기본 Rev');
    expect(select).toHaveTextContent('미지정');
    await user.click(select);
    /* 확정(Rev 2)만 — 작성중 Rev 3 · 폐기 Rev 1 은 고를 수 없다. */
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Rev 2' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Rev 2' }));

    expect(onSetDefault).toHaveBeenCalledTimes(1);
  });

  it('기본 Rev 칸은 onSetDefault 를 주지 않으면 세우지 않는다', () => {
    renderPane();
    expect(screen.queryByLabelText('기본 Rev')).not.toBeInTheDocument();
  });

  /* 이력 관리 칸 — 기본 지정 표시 · 요약 · 지정 단추는 두지 않는다(#231). */
  it('기본 열 · 기본 Rev 요약 줄 · 기본으로 지정 단추가 없다', () => {
    renderPane();

    expect(screen.queryByRole('columnheader', { name: /^기본/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/기본 Rev:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '기본으로 지정' })).not.toBeInTheDocument();
  });

  /* 유효 시작일 · 종료일은 보이지 않는다(#231). */
  it('유효 시작일 · 종료일 열이 없다', () => {
    renderPane();

    expect(screen.queryByRole('columnheader', { name: /유효/ })).not.toBeInTheDocument();
  });

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

  it('상세 보기를 누르면 그 Rev 를 알린다', async () => {
    const { onViewDetail, user } = renderPane();

    await user.click(screen.getByRole('button', { name: 'Rev 2 상세 보기' }));

    expect(onViewDetail).toHaveBeenCalledWith(expect.objectContaining({ routingId: 7002 }));
  });

  it('선택된 Rev에 현재 위치 표식이 붙는다', () => {
    renderPane({ selectedRoutingId: 7002 });

    expect(screen.getByRole('button', { name: 'Rev 2 상세 보기' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Rev 3 상세 보기' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('품목을 고르기 전에는 선택 안내만 낸다', () => {
    renderPane({ isItemSelected: false, revisions: [] });

    expect(screen.getByText('품목을 선택하세요')).toBeInTheDocument();
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
