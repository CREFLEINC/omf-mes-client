import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  addAllocation,
  createLineAllocationDrafts,
  type LineAllocationDraft,
} from './line-allocation-draft';
import type { LotCandidateResult } from './lot-candidates';
import { ShipmentLinesPane } from './shipment-lines-pane';
import type { ShipmentRequestLineCandidate } from './types';

const sourceLine = (
  overrides: Partial<ShipmentRequestLineCandidate> = {},
): ShipmentRequestLineCandidate => ({
  shipmentRequestLineId: 701,
  lineNo: 1,
  itemId: 910001,
  requestedQty: 100,
  allocatedQty: 100,
  pickedQty: 100,
  shippedQty: 0,
  uomId: 920001,
  shippingInspectionRequired: false,
  ...overrides,
});

const lotResult = (items: LotCandidateResult['items'] = []): LotCandidateResult => ({
  items,
  truncated: false,
  isError: false,
  isLoading: false,
});

const baseProps = (lines: LineAllocationDraft[]) => ({
  lines,
  lotCandidates: {
    910001: lotResult([
      { lotId: 1001, lotNo: 'SYN-LOT-1001', held: false, expiryDate: null },
      { lotId: 1002, lotNo: 'SYN-LOT-1002', held: true, expiryDate: null },
    ]),
  },
  onAddAllocation: vi.fn(),
  onRemoveAllocation: vi.fn(),
  onSetAllocationLot: vi.fn(),
  onSetAllocationQty: vi.fn(),
  onSetShippedQty: vi.fn(),
});

describe('ShipmentLinesPane', () => {
  it('라인이 없으면 안내를 낸다', () => {
    render(<ShipmentLinesPane {...baseProps([])} />);

    expect(screen.getByText('상세 정보를 불러오지 못했습니다.')).toBeInTheDocument();
  });

  it('배분이 없는 라인은 자리표시 문구를 낸다', () => {
    const lines = createLineAllocationDrafts([sourceLine()]);

    render(<ShipmentLinesPane {...baseProps(lines)} />);

    expect(screen.getByText('선택된 LOT이 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'LOT 추가' })).toBeInTheDocument();
  });

  it('LOT 추가를 누르면 onAddAllocation을 부른다', async () => {
    const user = userEvent.setup();
    const props = baseProps(createLineAllocationDrafts([sourceLine()]));

    render(<ShipmentLinesPane {...props} />);

    await user.click(screen.getByRole('button', { name: 'LOT 추가' }));

    expect(props.onAddAllocation).toHaveBeenCalledWith(701);
  });

  it('배분이 있으면 LOT 선택·수량 입력·삭제 버튼을 낸다 — 보류 LOT은 선택할 수 없다', () => {
    const lines = [addAllocation(createLineAllocationDrafts([sourceLine()])[0]!)];

    render(<ShipmentLinesPane {...baseProps(lines)} />);

    const lotSelect = screen.getByRole('combobox', { name: /LOT · 라인 1/ });
    expect(lotSelect).toBeInTheDocument();
    expect(screen.getByLabelText(/수량 · 라인 1/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이 LOT 배분 삭제' })).toBeInTheDocument();
  });

  it('삭제 버튼을 누르면 onRemoveAllocation을 부른다', async () => {
    const user = userEvent.setup();
    const line = addAllocation(createLineAllocationDrafts([sourceLine()])[0]!);
    const draftId = line.allocations[0]?.draftId ?? '';
    const props = baseProps([line]);

    render(<ShipmentLinesPane {...props} />);

    await user.click(screen.getByRole('button', { name: '이 LOT 배분 삭제' }));

    expect(props.onRemoveAllocation).toHaveBeenCalledWith(701, draftId);
  });

  it('출하수량 칸을 고치면 onSetShippedQty를 부른다', async () => {
    const user = userEvent.setup();
    const props = baseProps(createLineAllocationDrafts([sourceLine()]));

    render(<ShipmentLinesPane {...props} />);

    await user.type(screen.getByLabelText('출하수량'), '5');

    expect(props.onSetShippedQty).toHaveBeenCalled();
  });

  it('제출 불가 사유가 있으면 그 문구를 낸다', () => {
    const lines = createLineAllocationDrafts([sourceLine()]);

    render(<ShipmentLinesPane {...baseProps(lines)} />);

    expect(
      screen.getByText('출하수량을 입력해 주세요. LOT을 하나 이상 선택해 주세요.'),
    ).toBeInTheDocument();
  });
});
