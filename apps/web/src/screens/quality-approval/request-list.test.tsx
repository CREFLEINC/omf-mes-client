import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RequestList, type RequestListProps } from './request-list';
import type { RequestRow } from './types';

const t = messages.qualityApproval;

const rows: RequestRow[] = [
  {
    approvalRequestId: 31,
    approvalRequestNo: 'SYNTH-REQ-031',
    approvalTypeCode: 'SYNTH-CONCESSION',
    targetName: '합성 대상 A',
    statusCode: 'SYNTH-PENDING',
    isMyTurn: true,
  },
  {
    approvalRequestId: 32,
    approvalRequestNo: 'SYNTH-REQ-032',
    approvalTypeCode: 'SYNTH-LIMIT',
    targetName: '합성 대상 B',
    statusCode: 'SYNTH-DONE',
    isMyTurn: false,
  },
];

const baseProps = (): RequestListProps => ({
  rows,
  isLoading: false,
  error: null,
  page: {
    page: 2,
    canPrev: true,
    canNext: true,
    isBeyondLast: false,
    rangeLabel: '21–40 / 전체 45건',
  },
  selectedId: 32,
  onSelect: vi.fn(),
  onChangePage: vi.fn(),
});

const renderList = (overrides: Partial<RequestListProps> = {}) => {
  const props = { ...baseProps(), ...overrides };
  const result = render(<RequestList {...props} />);
  return { ...result, ...props, user: userEvent.setup() };
};

const dataRow = (requestNo: string): HTMLElement => {
  const selectButton = screen.getByRole('button', {
    name: t.actions.selectRow(requestNo),
  });
  const row = selectButton.closest('tr');
  if (row === null) throw new Error(`${requestNo} 행을 찾지 못했습니다`);
  return row;
};

describe('RequestList compact selection', () => {
  it('최종 3구획의 왼쪽에 맞는 세 열과 원시 상태·내 차례를 표시한다', () => {
    renderList();

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      t.fields.request,
      t.fields.target,
      t.fields.statusCode,
    ]);
    expect(dataRow('SYNTH-REQ-031')).toHaveTextContent('SYNTH-CONCESSION');
    expect(dataRow('SYNTH-REQ-031')).toHaveTextContent('SYNTH-PENDING');
    expect(dataRow('SYNTH-REQ-031')).toHaveTextContent(t.values.myTurn);
    expect(dataRow('SYNTH-REQ-032')).not.toHaveTextContent(t.values.myTurn);
  });

  it('안정 ID로 고른 행을 유지하고 키보드 버튼으로 선택한다', async () => {
    const props = baseProps();
    const { rerender } = render(<RequestList {...props} />);
    const user = userEvent.setup();
    const firstButton = screen.getByRole('button', {
      name: t.actions.selectRow('SYNTH-REQ-031'),
    });

    expect(
      screen.getByRole('button', {
        name: t.actions.selectRow('SYNTH-REQ-032'),
      }),
    ).toHaveAttribute('aria-current', 'true');
    firstButton.focus();

    rerender(<RequestList {...props} rows={rows.slice(1)} />);
    expect(document.activeElement).toBe(document.body);

    await user.click(
      screen.getByRole('button', {
        name: t.actions.selectRow('SYNTH-REQ-032'),
      }),
    );
    expect(props.onSelect).toHaveBeenCalledWith(32);
  });

  it('가운데 쪽의 범위와 이동 가능 상태를 그대로 렌더한다', () => {
    renderList();

    expect(screen.getByText('21–40 / 전체 45건')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.prevPage })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.actions.nextPage })).toBeEnabled();
  });

  it('이전 쪽 버튼은 현재 쪽보다 하나 작은 쪽을 요청한다', async () => {
    const { onChangePage, user } = renderList();

    await user.click(screen.getByRole('button', { name: t.actions.prevPage }));

    expect(onChangePage).toHaveBeenCalledWith(1);
  });

  it('다음 쪽 버튼은 현재 쪽보다 하나 큰 쪽을 요청한다', async () => {
    const { onChangePage, user } = renderList();

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    expect(onChangePage).toHaveBeenCalledWith(3);
  });
});

describe('RequestList terminal states', () => {
  it('로딩 status는 표와 빈 상태를 대체한다', () => {
    renderList({ isLoading: true, rows: [] });

    expect(screen.getByRole('status', { name: t.loading })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.title)).not.toBeInTheDocument();
  });

  it('오류 ReactNode는 표와 빈 상태를 대체한다', () => {
    renderList({
      rows: [],
      error: <div role="alert">합성 조회 오류</div>,
    });

    expect(screen.getByRole('alert')).toHaveTextContent('합성 조회 오류');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.title)).not.toBeInTheDocument();
  });
});

describe('RequestList empty states', () => {
  it('정상 빈 상태를 live status로 알린다', () => {
    renderList({ rows: [], selectedId: null });

    expect(screen.getByRole('status')).toHaveTextContent(t.empty.title);
  });

  it('범위 밖 빈 상태를 live status로 알리고 첫 쪽 callback을 보낸다', async () => {
    const { onChangePage, user } = renderList({
      rows: [],
      selectedId: null,
      page: {
        page: 4,
        canPrev: true,
        canNext: false,
        isBeyondLast: true,
        rangeLabel: '전체 45건',
      },
    });

    expect(screen.getByRole('status')).toHaveTextContent(t.empty.beyondTitle);
    expect(screen.getByRole('button', { name: t.actions.prevPage })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.actions.nextPage })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));
    expect(onChangePage).toHaveBeenCalledWith(1);
  });
});
