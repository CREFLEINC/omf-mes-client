import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { emptyLineDraft, lineDraftsFromSalesOrder } from './line-draft';
import type { AvailableQtyLookup } from './lookups';
import { LineTable } from './line-table';
import { salesOrderDetailFixture } from './fixtures';
import { toSalesOrderDetailView } from './types';

const t = messages.shipmentRequestCreate;

const itemLookup = {
  entries: [{ value: '8301', label: 'SAMPLE-ITEM-01 · 합성 품목 가', isActive: true }],
  isError: false,
  isLoading: false,
};
const uomLookup = {
  entries: [{ value: '8401', label: 'SAMPLE-UOM-EA · 개', isActive: true }],
  isError: false,
  isLoading: false,
};
const itemOptions = [{ value: '8301', label: 'SAMPLE-ITEM-01 · 합성 품목 가' }];
const uomOptions = [{ value: '8401', label: 'SAMPLE-UOM-EA · 개' }];

const noAvailableQty: AvailableQtyLookup = {
  of: () => ({ kind: 'unasked' }),
  refetchAll: () => undefined,
};

describe('LineTable — 지시서 경유', () => {
  const rows = lineDraftsFromSalesOrder(toSalesOrderDetailView(salesOrderDetailFixture).lines);

  it('품목·요청 수량이 읽기 전용 글자다(미결 항목 표의 구현 판단)', () => {
    render(
      <LineTable
        mode="fromOrder"
        rows={rows}
        errors={{}}
        itemLookup={itemLookup}
        uomLookup={uomLookup}
        itemOptions={itemOptions}
        uomOptions={uomOptions}
        availableQty={noAvailableQty}
        onPatch={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('SAMPLE-ITEM-01 · 합성 품목 가')).toBeInTheDocument();
    expect(screen.queryByLabelText(t.lineTable.itemLabel(1))).not.toBeInTheDocument();
    /* 요청 수량 입력칸이 없다 — 글자로만 보인다. */
    expect(screen.queryByLabelText(t.lineTable.requestedQtyLabel(1))).not.toBeInTheDocument();
  });

  it('행 조작 열이 없다 — 지시서 경유는 라인을 더하거나 뺄 수 없다(완료 조건 C2)', () => {
    render(
      <LineTable
        mode="fromOrder"
        rows={rows}
        errors={{}}
        itemLookup={itemLookup}
        uomLookup={uomLookup}
        itemOptions={itemOptions}
        uomOptions={uomOptions}
        availableQty={noAvailableQty}
        onPatch={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: t.actions.removeLine(1) })).not.toBeInTheDocument();
  });
});

describe('LineTable — 단독 생성', () => {
  it('품목 선택칸과 요청 수량 입력칸을 낸다(완료 조건 C3)', () => {
    render(
      <LineTable
        mode="standalone"
        rows={[emptyLineDraft()]}
        errors={{}}
        itemLookup={itemLookup}
        uomLookup={uomLookup}
        itemOptions={itemOptions}
        uomOptions={uomOptions}
        availableQty={noAvailableQty}
        onPatch={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(t.lineTable.itemLabel(1))).toBeInTheDocument();
    expect(screen.getByLabelText(t.lineTable.requestedQtyLabel(1))).toBeInTheDocument();
  });

  it('한 줄뿐이면 행 삭제가 잠긴다', () => {
    render(
      <LineTable
        mode="standalone"
        rows={[emptyLineDraft()]}
        errors={{}}
        itemLookup={itemLookup}
        uomLookup={uomLookup}
        itemOptions={itemOptions}
        uomOptions={uomOptions}
        availableQty={noAvailableQty}
        onPatch={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: t.actions.removeLine(1) })).toBeDisabled();
  });

  it('배정 수량을 고치면 onPatch를 부른다', async () => {
    const onPatch = vi.fn<(key: string, patch: Record<string, unknown>) => void>();
    const user = userEvent.setup();
    const [row] = [emptyLineDraft()];

    render(
      <LineTable
        mode="standalone"
        rows={[row!]}
        errors={{}}
        itemLookup={itemLookup}
        uomLookup={uomLookup}
        itemOptions={itemOptions}
        uomOptions={uomOptions}
        availableQty={noAvailableQty}
        onPatch={onPatch}
        onRemove={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(t.lineTable.allocatedQtyLabel(1)), '5');

    expect(onPatch).toHaveBeenCalled();
  });

  it('가용보다 배정이 많으면 표식이 붙는다(완료 조건 C5) — 막지 않는다', () => {
    const row = { ...emptyLineDraft(), itemId: '8301', allocatedQty: '80' };
    const availableQty: AvailableQtyLookup = {
      of: () => ({ kind: 'qty', value: 60 }),
      refetchAll: () => undefined,
    };

    render(
      <LineTable
        mode="standalone"
        rows={[row]}
        errors={{}}
        itemLookup={itemLookup}
        uomLookup={uomLookup}
        itemOptions={itemOptions}
        uomOptions={uomOptions}
        availableQty={availableQty}
        onPatch={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(t.lineTable.allocatedQtyLabel(1))).toBeEnabled();
    expect(screen.getAllByText(t.shortage.title).length).toBeGreaterThan(0);
  });
});
