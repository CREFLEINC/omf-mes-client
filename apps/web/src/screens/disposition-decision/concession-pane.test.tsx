import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { ConcessionHistory } from './concession-pane';

/** W-03-10 특채 이력(omf-all-around#84 · #352) — 특채는 저장하면 바로 적용되므로 이력은 보기만 한다. */

const t = messages.dispositionDecision.concession;

const concession = (statusCode: string) => ({
  concessionId: 61,
  concessionNo: 'CNC-0061',
  nonconformanceId: 41,
  lotId: 8801,
  lotNo: 'MLOT-8801',
  approvedQty: 30,
  consumedQty: 0,
  uomId: 7001,
  validFrom: '2026-10-16',
  validTo: null,
  approvalRequestId: null,
  statusCode,
  usable: statusCode === 'APPROVED',
});

const stub =
  (rows: unknown[]): StubFetch =>
  async (request) => {
    const url = new URL(request.url);
    if (url.pathname === '/quality/concessions' && request.method === 'GET') {
      return jsonResponse({ items: rows, page: { page: 1, size: 20, total: rows.length } });
    }
    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
  };

const renderHistory = (rows: unknown[]) => {
  renderWithProviders(<ConcessionHistory nonconformanceId={41} />, { fetch: stub(rows) });
};

describe('ConcessionHistory', () => {
  it('이력이 없으면 한 줄로 알린다', async () => {
    renderHistory([]);

    expect(await screen.findByText(t.none)).toBeInTheDocument();
  });

  it('적용된 특채는 상태만 보이고 적용 · 반려 단추는 없다', async () => {
    renderHistory([concession('APPROVED')]);

    expect(await screen.findByText('CNC-0061')).toBeInTheDocument();
    expect(screen.getByText(t.status.APPROVED)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
