import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { ConcessionPane } from './concession-pane';
import type { NonconformanceLotRow } from './types';

/** W-03-10 특채 구획(omf-all-around#84 · 서버 선행 P-79) — 요청과 적용. */

const t = messages.dispositionDecision.concession;

const LOT: NonconformanceLotRow = {
  nonconformanceLotId: 1,
  lotId: 8801,
  lotNoText: 'MLOT-8801',
  affectedQtyText: '100',
  uomId: 7001,
  qualityStatusText: '불량',
};

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
  approvalRequestId: 99,
  statusCode,
  usable: statusCode === 'APPROVED',
});

const renderPane = (rows: unknown[], isClosed = false, applyFailure?: unknown) => {
  const writes: Request[] = [];
  const stubFetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    if (url.pathname === '/quality/concessions' && request.method === 'GET') {
      return jsonResponse({ items: rows, page: { page: 1, size: 20, total: rows.length } });
    }
    if (url.pathname === '/quality/concessions' && request.method === 'POST') {
      writes.push(request.clone());
      return jsonResponse(concession('PENDING'), { status: 201 });
    }
    if (url.pathname === '/quality/concessions/61:apply') {
      writes.push(request.clone());
      if (applyFailure !== undefined) return jsonResponse(applyFailure, { status: 400 });
      return jsonResponse(concession('APPROVED'));
    }
    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
  };
  renderWithProviders(
    <ConcessionPane
      nonconformanceId={41}
      lots={[LOT]}
      isClosed={isClosed}
      today={new Date(2026, 9, 16)}
    />,
    { fetch: stubFetch },
  );
  return { writes, user: userEvent.setup() };
};

describe('ConcessionPane', () => {
  it('특채를 요청한다 — LOT 이 하나면 그 LOT·단위로, 유효 시작은 오늘이다', async () => {
    const { writes, user } = renderPane([]);

    expect(await screen.findByText(t.none)).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.qty), '30');
    await user.type(screen.getByLabelText(t.reason), '외관 경미 — 조건부 사용');
    await user.click(screen.getByRole('button', { name: t.request }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.headers.get('Idempotency-Key')).toBeTruthy();
    await expect(writes[0]?.json()).resolves.toEqual({
      nonconformanceId: 41,
      lotId: 8801,
      approvedQty: 30,
      uomId: 7001,
      validFrom: '2026-10-16',
      reason: '외관 경미 — 조건부 사용',
    });
    expect(await screen.findByText(t.requested)).toBeInTheDocument();
  });

  it('결재 대기 특채를 적용한다', async () => {
    const { writes, user } = renderPane([concession('PENDING')]);

    await user.click(await screen.findByRole('button', { name: t.apply }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(new URL(writes[0]?.url ?? '').pathname).toBe('/quality/concessions/61:apply');
    expect(await screen.findByText(t.applied)).toBeInTheDocument();
  });

  it('적용 시점에 남은 수량을 넘으면(서버 400 approvedQty) 그 메시지를 오류 배너로 보인다', async () => {
    const message = '남은 수량을 넘습니다. (남은 수량 4)';
    const { writes, user } = renderPane([concession('PENDING')], false, {
      errors: [{ scope: 'field', field: 'approvedQty', code: 'INVALID', message }],
    });

    await user.click(await screen.findByRole('button', { name: t.apply }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(await screen.findByText(message, { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(t.applied)).not.toBeInTheDocument();
  });

  it('사유가 없거나 종결된 부적합이면 요청할 수 없다', async () => {
    const { user } = renderPane([]);
    await user.type(await screen.findByLabelText(t.qty), '30');
    expect(screen.getByRole('button', { name: t.request })).toBeDisabled();
    expect(screen.getByText(t.blocked.reason)).toBeInTheDocument();
  });

  it('종결된 부적합은 안내와 함께 잠긴다', async () => {
    renderPane([concession('APPROVED')], true);

    expect(await screen.findByText(t.status.APPROVED)).toBeInTheDocument();
    expect(screen.getByText(t.closedNote)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.request })).toBeDisabled();
  });
});
