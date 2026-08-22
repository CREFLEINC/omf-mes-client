import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RequestList, type RequestListProps } from './request-list';
import type { RequestRow } from './types';

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
    name: messages.qualityApproval.actions.selectRow(requestNo),
  });
  const row = selectButton.closest('tr');
  if (row === null) throw new Error(`${requestNo} 행을 찾지 못했습니다`);
  return row;
};

describe('RequestList compact selection', () => {
  it('최종 3구획의 왼쪽에 맞는 세 열과 원시 상태·내 차례를 표시한다', () => {
    renderList();

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      messages.qualityApproval.fields.request,
      messages.qualityApproval.fields.target,
      messages.qualityApproval.fields.statusCode,
    ]);
    expect(dataRow('SYNTH-REQ-031')).toHaveTextContent('SYNTH-CONCESSION');
    expect(dataRow('SYNTH-REQ-031')).toHaveTextContent('SYNTH-PENDING');
    expect(dataRow('SYNTH-REQ-031')).toHaveTextContent(messages.qualityApproval.values.myTurn);
    expect(dataRow('SYNTH-REQ-032')).not.toHaveTextContent(messages.qualityApproval.values.myTurn);
  });

  it('안정 ID로 고른 행을 유지하고 키보드 버튼으로 선택한다', async () => {
    const props = baseProps();
    const { rerender } = render(<RequestList {...props} />);
    const user = userEvent.setup();
    const firstButton = screen.getByRole('button', {
      name: messages.qualityApproval.actions.selectRow('SYNTH-REQ-031'),
    });

    expect(
      screen.getByRole('button', {
        name: messages.qualityApproval.actions.selectRow('SYNTH-REQ-032'),
      }),
    ).toHaveAttribute('aria-current', 'true');
    firstButton.focus();

    rerender(<RequestList {...props} rows={rows.slice(1)} />);
    expect(document.activeElement).toBe(document.body);

    await user.click(
      screen.getByRole('button', {
        name: messages.qualityApproval.actions.selectRow('SYNTH-REQ-032'),
      }),
    );
    expect(props.onSelect).toHaveBeenCalledWith(32);
  });

  it('가운데 쪽의 범위와 이동 가능 상태를 그대로 렌더한다', () => {
    renderList();

    expect(screen.getByText('21–40 / 전체 45건')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: messages.qualityApproval.actions.prevPage }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: messages.qualityApproval.actions.nextPage }),
    ).toBeEnabled();
  });
});

describe('RequestList empty states', () => {
  it('정상 빈 상태를 live status로 알린다', () => {
    renderList({ rows: [], selectedId: null });

    expect(screen.getByRole('status')).toHaveTextContent(messages.qualityApproval.empty.title);
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

    expect(screen.getByRole('status')).toHaveTextContent(
      messages.qualityApproval.empty.beyondTitle,
    );
    expect(
      screen.getByRole('button', { name: messages.qualityApproval.actions.prevPage }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: messages.qualityApproval.actions.nextPage }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole('button', { name: messages.qualityApproval.actions.goFirstPage }),
    );
    expect(onChangePage).toHaveBeenCalledWith(1);
  });
});
