import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { MaterialLotUsage, ProductionLotInputs } from './lot-genealogy';

const t = messages.lotGenealogy;

const codeValues = {
  match: (request: Request) => request.url.includes('/mdm/code-values'),
  respond: () =>
    jsonResponse({
      items: [{ codeValueId: 1, codeGroupId: 1, code: 'MATERIAL', codeName: '자재', isActive: true }],
      page: { page: 1, size: 50, total: 1 },
    }),
};

const serial = (id: number) => ({
  serialNumberId: id,
  serialNo: `SN-${String(id)}`,
  lotId: 501,
  lotNo: 'P-501',
  producedAt: '2026-10-22T02:00:00.000Z',
});

/** omf-all-around#166 — 생산 LOT 의 투입 자재와 자재 LOT 이 들어간 제품(계보 기준 추정). */
describe('ProductionLotInputs', () => {
  it('전 자재를 보이고 4M 변경품에는 변경 종류를 단다', async () => {
    renderWithProviders(<ProductionLotInputs lotId={501} />, {
      fetch: createStubFetch([
        codeValues,
        {
          match: (request) => request.url.includes('/trace/lots/501/input-materials'),
          respond: () =>
            jsonResponse({
              basis: 'LOT_GENEALOGY_ESTIMATE',
              items: [
                { lotId: 77, lotNo: 'ML-77', itemId: 41, itemCode: 'F537', itemName: 'PCB ASSY' },
                {
                  lotId: 78,
                  lotNo: 'ML-78',
                  itemId: 42,
                  itemCode: 'F538',
                  itemName: 'CASE',
                  fourMChange: { changeTypeCode: 'MATERIAL', remarks: '공급처 변경' },
                },
              ],
            }),
        },
      ]),
      session: null,
    });

    expect(await screen.findByText('ML-77')).toBeInTheDocument();
    expect(screen.getByText(t.basis.LOT_GENEALOGY_ESTIMATE)).toBeInTheDocument();
    expect(screen.getByText('PCB ASSY (F537)')).toBeInTheDocument();
    expect(await screen.findByText('자재, 공급처 변경')).toBeInTheDocument();
  });

  it('변경 종류 없이 적은 4M 변경품은 비고만 보인다(#133)', async () => {
    renderWithProviders(<ProductionLotInputs lotId={501} />, {
      fetch: createStubFetch([
        codeValues,
        {
          match: (request) => request.url.includes('/trace/lots/501/input-materials'),
          respond: () =>
            jsonResponse({
              basis: 'LOT_GENEALOGY_ESTIMATE',
              items: [
                {
                  lotId: 78,
                  lotNo: 'ML-78',
                  itemId: 42,
                  itemCode: 'F538',
                  itemName: 'CASE',
                  fourMChange: { remarks: '공급처 변경' },
                },
              ],
            }),
        },
      ]),
      session: null,
    });

    expect(await screen.findByText('ML-78')).toBeInTheDocument();
    expect(screen.getByText('공급처 변경')).toBeInTheDocument();
  });

  it('계보 이전 작업지시면 작업지시 단위 추정이라고 밝힌다', async () => {
    renderWithProviders(<ProductionLotInputs lotId={501} />, {
      fetch: createStubFetch([
        codeValues,
        {
          match: (request) => request.url.includes('/input-materials'),
          respond: () => jsonResponse({ basis: 'WORK_ORDER_ESTIMATE', items: [] }),
        },
      ]),
      session: null,
    });

    expect(await screen.findByText(t.basis.WORK_ORDER_ESTIMATE)).toBeInTheDocument();
    expect(screen.getByText(t.inputs.none)).toBeInTheDocument();
  });
});

describe('MaterialLotUsage', () => {
  it('들어간 생산 LOT 과 시리얼을 보이고 시리얼은 쪽으로 넘긴다', async () => {
    const pages: string[] = [];
    renderWithProviders(<MaterialLotUsage lotId={77} />, {
      fetch: createStubFetch([
        {
          match: (request) => request.url.includes('/affected-production-lots'),
          respond: () =>
            jsonResponse({
              basis: 'LOT_GENEALOGY_ESTIMATE',
              workOrders: [{ workOrderId: 70, workOrderNo: 'WO-70' }],
              items: [
                { lotId: 501, lotNo: 'P-501', itemId: 9, statusCode: 'NORMAL', workOrderId: 70, workOrderNo: 'WO-70' },
              ],
            }),
        },
        {
          match: (request) => request.url.includes('/used-serials'),
          respond: (request) => {
            const page = new URL(request.url).searchParams.get('page') ?? '1';
            pages.push(page);
            return jsonResponse({
              basis: 'LOT_GENEALOGY_ESTIMATE',
              items: page === '1' ? [serial(1)] : [serial(2)],
              page: { page: Number(page), size: 50, total: 60 },
            });
          },
        },
      ]),
      session: null,
    });

    expect(await screen.findByText('WO-70')).toBeInTheDocument();
    expect(await screen.findByText('SN-1')).toBeInTheDocument();
    expect(screen.getByText(t.usage.serialRange(1, 1, 60))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.usage.prev })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: t.usage.next }));

    expect(await screen.findByText('SN-2')).toBeInTheDocument();
    await waitFor(() => expect(pages).toEqual(['1', '2']));
  });

  it('투입 기록이 없으면 없다고 적는다', async () => {
    renderWithProviders(<MaterialLotUsage lotId={77} />, {
      fetch: createStubFetch([
        {
          match: (request) => request.url.includes('/affected-production-lots'),
          respond: () => jsonResponse({ basis: 'LOT_GENEALOGY_ESTIMATE', workOrders: [], items: [] }),
        },
        {
          match: (request) => request.url.includes('/used-serials'),
          respond: () =>
            jsonResponse({ basis: 'LOT_GENEALOGY_ESTIMATE', items: [], page: { page: 1, size: 50, total: 0 } }),
        },
      ]),
      session: null,
    });

    expect(await screen.findByText(t.usage.none)).toBeInTheDocument();
  });
});
