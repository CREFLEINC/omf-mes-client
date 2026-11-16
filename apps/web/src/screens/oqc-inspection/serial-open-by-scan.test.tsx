import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { SerialOpenByScan } from './serial-open-by-scan';

type OqcSerialScan = components['schemas']['OqcSerialScan'];
type OqcLotScan = components['schemas']['OqcLotScan'];
type PickedRequest = OqcLotScan['pickedRequests'][number];

/** 목록 위 「LOT 스캔」 — 시리얼 번호와 제품 LOT 번호 둘 다로 OQC 의뢰를 연다. */

const t = messages.oqcInspection.serials;
const scanText = messages.inspectionDocuments.scan;

const request = (id: number, statusCode = 'IN_PROGRESS'): PickedRequest => ({
  inspectionRequestId: id,
  inspectionRequestNo: `IRQ-${String(id)}`,
  shipmentRequestId: 30,
  statusCode,
});

const serialScan = (pickedRequests: PickedRequest[]): OqcSerialScan => ({
  serialNumberId: 11,
  serialNo: 'SN-0011',
  itemId: 7,
  itemCode: 'AAR4',
  itemName: '오토 리와인더',
  lotId: 50,
  lotNo: 'L-50',
  pickedRequests,
});

const renderScan = (data: {
  serials?: Record<string, OqcSerialScan>;
  lots?: Record<string, OqcLotScan>;
}) => {
  const calls: string[] = [];
  const stubFetch: StubFetch = async (req) => {
    const { pathname } = new URL(req.url);
    calls.push(pathname);
    const key = decodeURIComponent(pathname.split('/').at(-1) ?? '');
    const found = pathname.includes('/oqc-lots/') ? data.lots?.[key] : data.serials?.[key];
    return found === undefined
      ? jsonResponse({ message: '없음' }, { status: 404 })
      : jsonResponse(found);
  };
  const onOpen = vi.fn();
  const onOpenByLot = vi.fn();
  renderWithProviders(<SerialOpenByScan onOpen={onOpen} onOpenByLot={onOpenByLot} />, {
    fetch: stubFetch,
  });
  return { calls, onOpen, onOpenByLot };
};

const scan = async (value: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: scanText.label }), `${value}{Enter}`);
  return user;
};

describe('LOT 스캔 — 시리얼 또는 제품 LOT', () => {
  it('시리얼 번호면 지금처럼 시리얼로 연다 — LOT 조회는 하지 않는다', async () => {
    const { calls, onOpen, onOpenByLot } = renderScan({
      serials: { 'SN-0011': serialScan([request(1)]) },
    });
    await scan('SN-0011');

    await vi.waitFor(() => expect(onOpen).toHaveBeenCalledWith(1, expect.anything()));
    expect(onOpenByLot).not.toHaveBeenCalled();
    expect(calls.some((path) => path.includes('/oqc-lots/'))).toBe(false);
  });

  it('없는 시리얼이면 제품 LOT 번호로 찾아 그 LOT 을 피킹한 의뢰를 연다', async () => {
    const { onOpen, onOpenByLot } = renderScan({
      lots: { 'L-50': { lotNo: 'L-50', pickedRequests: [request(2)] } },
    });
    await scan('L-50');

    await vi.waitFor(() => expect(onOpenByLot).toHaveBeenCalledWith(2));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('LOT 을 피킹한 의뢰가 여럿이면 고르게 한다 — 대기·진행만', async () => {
    const { onOpenByLot } = renderScan({
      lots: {
        'L-50': {
          lotNo: 'L-50',
          pickedRequests: [request(2), request(3, 'REQUESTED'), request(4, 'COMPLETED')],
        },
      },
    });
    const user = await scan('L-50');

    expect(await screen.findByText(t.pickLotRequest)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /IRQ-4/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'IRQ-3' }));
    expect(onOpenByLot).toHaveBeenCalledWith(3);
  });

  it('LOT 은 있는데 피킹한 의뢰가 없으면 그 이유를 보인다', async () => {
    const { onOpenByLot } = renderScan({ lots: { 'L-50': { lotNo: 'L-50', pickedRequests: [] } } });
    await scan('L-50');

    expect(await screen.findByText(t.noPickedLotRequest('L-50'))).toBeInTheDocument();
    expect(onOpenByLot).not.toHaveBeenCalled();
  });

  it('시리얼도 LOT 도 없으면 둘 다 없다고 말하고 친 번호를 남긴다', async () => {
    renderScan({});
    await scan('NOPE-1');

    expect(await screen.findByText(t.openByScanNotFound)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: scanText.label })).toHaveValue('NOPE-1');
  });
});
