import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  ShipmentProcessingCandidateListPane,
  type ShipmentProcessingCandidateRow,
} from './candidate-list-pane';
import { toPageView } from './pagination';

const row = (
  overrides: Partial<ShipmentProcessingCandidateRow> = {},
): ShipmentProcessingCandidateRow => ({
  shipmentRequestId: 501,
  shipmentRequestNo: 'SYN-SR-501',
  customerLabel: 'CUS-01 · Synthetic Customer',
  requestedShipDate: '2026-08-28',
  statusCode: 'SYN-STATUS',
  blockers: [],
  ...overrides,
});

const page = () => toPageView({ page: 1, size: 20, total: 1 }, 1);

describe('ShipmentProcessingCandidateListPane', () => {
  it('조회 실패면 오류만 낸다', () => {
    render(
      <ShipmentProcessingCandidateListPane
        rows={[]}
        selectedShipmentRequestId={null}
        isLoading={false}
        loadError={<p>synthetic error</p>}
        page={page()}
        onSelect={vi.fn()}
        onChangePage={vi.fn()}
      />,
    );

    expect(screen.getByText('synthetic error')).toBeInTheDocument();
  });

  it('불러오는 중이면 스켈레톤을 낸다', () => {
    render(
      <ShipmentProcessingCandidateListPane
        rows={[]}
        selectedShipmentRequestId={null}
        isLoading
        loadError={null}
        page={page()}
        onSelect={vi.fn()}
        onChangePage={vi.fn()}
      />,
    );

    expect(screen.getByRole('status', { name: '목록을 불러오는 중입니다.' })).toBeInTheDocument();
  });

  it('행을 클릭하면 onSelect를 부른다', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <ShipmentProcessingCandidateListPane
        rows={[row()]}
        selectedShipmentRequestId={null}
        isLoading={false}
        loadError={null}
        page={page()}
        onSelect={onSelect}
        onChangePage={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'SYN-SR-501 선택' }));

    expect(onSelect).toHaveBeenCalledWith(501);
  });

  it('고객 정보가 없으면 자리표시 문구를 낸다', () => {
    render(
      <ShipmentProcessingCandidateListPane
        rows={[row({ customerLabel: null })]}
        selectedShipmentRequestId={null}
        isLoading={false}
        loadError={null}
        page={page()}
        onSelect={vi.fn()}
        onChangePage={vi.fn()}
      />,
    );

    expect(screen.getByText('고객 정보 없음')).toBeInTheDocument();
  });

  it('관문을 통과하면 처리 가능 배지를, 막히면 사유 배지를 낸다', () => {
    render(
      <ShipmentProcessingCandidateListPane
        rows={[
          row({ blockers: ['PICKING_INCOMPLETE'] }),
          row({ shipmentRequestId: 502, shipmentRequestNo: 'SYN-SR-502' }),
        ]}
        selectedShipmentRequestId={null}
        isLoading={false}
        loadError={null}
        page={page()}
        onSelect={vi.fn()}
        onChangePage={vi.fn()}
      />,
    );

    expect(screen.getByText('피킹 미완료')).toBeInTheDocument();
    expect(screen.getByText('처리 가능')).toBeInTheDocument();
  });

  it('결과가 없으면 빈 상태를 낸다', () => {
    render(
      <ShipmentProcessingCandidateListPane
        rows={[]}
        selectedShipmentRequestId={null}
        isLoading={false}
        loadError={null}
        page={page()}
        onSelect={vi.fn()}
        onChangePage={vi.fn()}
      />,
    );

    expect(screen.getByText('조회 결과가 없습니다.')).toBeInTheDocument();
  });
});
