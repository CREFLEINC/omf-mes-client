import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { LotDetailPane } from './lot-detail-pane';

const t = messages.lotStatusHistory;

/** 합성값이다 — 실 운영 값을 쓰지 않는다. */
const baseLot = {
  lotId: 9101,
  lotNo: 'SYN-WIP-0001',
  itemId: 9201,
  plantId: 1,
  initialQty: 100,
  uomId: 9301,
  sourceTypeCode: 'WORK_ORDER',
  sourceId: 9401,
  statusCode: 'NORMAL',
};

const LOT_TYPES = [
  { value: 'PRODUCTION', label: '생산' },
  { value: 'WIP', label: '반제품' },
];

const render = (lot: Record<string, unknown>) => {
  const paths: string[] = [];
  renderWithProviders(
    <SessionProvider>
      <LotDetailPane lotId={9101} lotTypeOptions={LOT_TYPES} statusOptions={[]} />
    </SessionProvider>,
    {
      session: SYNTHETIC_SESSION,
      fetch: (request) => {
        const path = new URL(request.url).pathname;
        paths.push(path);
        if (path === '/trace/lots/9101') {
          return Promise.resolve(
            jsonResponse({ lot: { ...baseLot, ...lot }, externalIdentifiers: [], holds: [] }),
          );
        }
        if (path === '/production/work-orders/9401') {
          return Promise.resolve(jsonResponse({ workOrderId: 9401, workOrderNo: 'WO-SYN-0001' }));
        }
        if (path === '/mdm/uoms') {
          return Promise.resolve(
            jsonResponse({
              items: [{ uomId: 9301, uomCode: 'EA', uomName: '개', isActive: true }],
              page: { page: 1, size: 200, total: 1 },
            }),
          );
        }
        return Promise.resolve(jsonResponse({ message: '없음' }, { status: 404 }));
      },
    },
  );
  return paths;
};

const fields = async () => screen.findByLabelText(t.detail.attributes);

describe('W-03-01 LOT 상세 — 공정 반제품(피처 016)', () => {
  it('US1-1 반제품 LOT 은 유형 칩 「반제품」과 생산 공정 · 남은 투입 가능 두 줄을 보인다', async () => {
    render({
      lotTypeCode: 'WIP',
      producedOperation: {
        workOrderId: 9401,
        operationSeq: 10,
        processCode: 'P10',
        processName: '가공',
      },
      wipProducedQty: 100,
      wipRemainingQty: 40,
    });

    const list = await fields();
    expect(within(list).getByText('반제품')).toBeInTheDocument();
    expect(within(list).getByText(t.detail.wip.operation)).toBeInTheDocument();
    expect(await within(list).findByText('공정 10 · P10 가공 (WO-SYN-0001)')).toBeInTheDocument();
    expect(await within(list).findByText('40 EA (실적 100 − 투입 60)')).toBeInTheDocument();
  });

  it('US1-1 제품 LOT(마지막 공정)에는 두 줄이 없고 W/O 를 부르지 않는다', async () => {
    const paths = render({ lotTypeCode: 'PRODUCTION' });

    const list = await fields();
    expect(within(list).getByText('생산')).toBeInTheDocument();
    expect(within(list).queryByText(t.detail.wip.operation)).toBeNull();
    expect(within(list).queryByText(t.detail.wip.remaining)).toBeNull();
    expect(paths).not.toContain('/production/work-orders/9401');
  });
});
