import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { FourMInputsPanel } from './panel';

const t = messages.fourMInputs;

const consumption = (
  id: number,
  lotId: number,
  fourM?: { changeTypeCode: string; remarks?: string },
) => ({
  materialConsumptionId: id,
  consumptionNo: `MC-${String(id)}`,
  workOrderId: 70,
  itemId: 3,
  lotId,
  consumptionTypeCode: 'INPUT',
  inputQty: 12,
  actualConsumedQty: 0,
  uomId: 1,
  occurredAt: '2026-10-21T02:00:00.000Z',
  recordedAt: '2026-10-21T02:00:00.000Z',
  workerId: 1,
  statusCode: 'RECORDED',
  ...(fourM === undefined ? {} : { fourMChange: fourM }),
});

const stub = (items: unknown[]) =>
  createStubFetch([
    {
      match: (request) => request.url.includes('/production/material-consumptions'),
      respond: () => jsonResponse({ items, page: { page: 1, size: 200, total: items.length } }),
    },
    {
      match: (request) => request.url.includes('/mdm/code-values'),
      respond: () =>
        jsonResponse({
          items: [
            { codeValueId: 1, codeGroupId: 1, code: 'MATERIAL', codeName: '자재', isActive: true },
          ],
          page: { page: 1, size: 50, total: 1 },
        }),
    },
    {
      match: (request) => request.url.includes('/trace/lots/'),
      respond: (request) =>
        jsonResponse({
          lot: { lotId: Number(request.url.split('/').pop()), lotNo: 'SAMPLE-LOT|0011' },
          externalIdentifiers: [],
          holds: [],
        }),
    },
  ]);

/** omf-all-around#63 2단계 — 작업지시에 투입된 자재 중 4M 변경품만 보인다. */
describe('FourMInputsPanel', () => {
  it('4M 변경품으로 적힌 투입만 LOT 번호·변경 종류·내용으로 보인다', async () => {
    renderWithProviders(<FourMInputsPanel workOrderId={70} />, {
      fetch: stub([
        consumption(1, 11, { changeTypeCode: 'MATERIAL', remarks: '공급처 변경' }),
        consumption(2, 12),
      ]),
      session: null,
    });

    expect(await screen.findByText('SAMPLE-LOT|0011')).toBeInTheDocument();
    expect(await screen.findByText('자재')).toBeInTheDocument();
    expect(screen.getByText('공급처 변경')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('투입된 4M 변경품이 없으면 없다고 적는다', async () => {
    renderWithProviders(<FourMInputsPanel workOrderId={70} />, {
      fetch: stub([consumption(2, 12)]),
      session: null,
    });

    expect(await screen.findByText(t.none)).toBeInTheDocument();
  });
});
