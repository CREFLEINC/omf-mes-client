import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { auditEvent, auditEventFixtures } from './fixtures';
import { EventTable, type EventTableProps } from './event-table';

const renderTable = (overrides: Partial<EventTableProps> = {}) => {
  const onFirstPage = vi.fn();

  render(
    <EventTable
      rows={auditEventFixtures}
      isLoading={false}
      hasPeriod
      isBeyondLast={false}
      onFirstPage={onFirstPage}
      {...overrides}
    />,
  );

  return { onFirstPage, user: userEvent.setup() };
};

describe('EventTable — 목록 표시', () => {
  it('응답 건수만큼 행이 그려진다', () => {
    renderTable();

    const table = screen.getByRole('table');

    // 머리글 행을 뺀 나머지가 자료 행이다.
    expect(within(table).getAllByRole('row')).toHaveLength(auditEventFixtures.length + 1);
  });

  it('발생 시각이 서버가 적어 보낸 벽시계 그대로 나온다', () => {
    renderTable();

    expect(screen.getByText('2026-08-04 09:12')).toBeInTheDocument();
  });

  it('대상 종류·대상·사건 종류·수행자가 받은 그대로 나온다', () => {
    renderTable({ rows: [auditEvent()] });

    expect(screen.getByText('SAMPLE_TARGET_A')).toBeInTheDocument();
    expect(screen.getByText('9101')).toBeInTheDocument();
    expect(screen.getByText('SAMPLE_EVENT_A')).toBeInTheDocument();
    expect(screen.getByText('9201')).toBeInTheDocument();
  });

  /*
   * 값이 없는 칸을 비워 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다.
   * 계약이 `performedBy`에 null을 허용한다.
   */
  it('수행자가 없으면 「—」가 나오고 행이 깨지지 않는다', () => {
    renderTable({ rows: [auditEvent({ performedBy: null })] });

    expect(screen.getByRole('table')).toHaveTextContent('—');
    expect(screen.getByText('SAMPLE_TARGET_A')).toBeInTheDocument();
  });

  it('발생 시각의 형식이 깨져 있어도 「—」로 내고 행을 버리지 않는다', () => {
    renderTable({ rows: [auditEvent({ occurredAt: '' })] });

    expect(screen.getByText('SAMPLE_EVENT_A')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('—');
  });
});

describe('EventTable — 로딩과 빈 상태', () => {
  it('불러오는 중에는 표 대신 진행 표시가 나온다', () => {
    renderTable({ isLoading: true });

    expect(screen.getByRole('status', { name: '변경 이력 목록을 불러오는 중' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('아직 조회하지 않았으면 기간을 고르라고 안내한다', () => {
    renderTable({ rows: [], hasPeriod: false });

    expect(screen.getByText('기간을 고르고 조회하세요')).toBeInTheDocument();
  });

  it('결과가 0건이면 조건을 줄이라고 안내한다', () => {
    renderTable({ rows: [] });

    expect(screen.getByText('조건에 맞는 변경 이력이 없습니다')).toBeInTheDocument();
  });

  /* 「결과가 없다」와 「이 쪽에 없다」는 사용자가 할 조치가 서로 다르다. */
  it('범위 밖 쪽은 결과 없음과 다른 안내를 내고 첫 쪽으로 가는 액션을 준다', async () => {
    const { onFirstPage, user } = renderTable({ rows: [], isBeyondLast: true });

    expect(screen.getByText('이 쪽에는 결과가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('조건에 맞는 변경 이력이 없습니다')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '첫 쪽으로' }));

    expect(onFirstPage).toHaveBeenCalledTimes(1);
  });
});
