import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { ConcessionHistory } from './concession-pane';

/** W-03-10 특채 구획(omf-all-around#84 · 서버 선행 P-79) — 요청과 적용. */

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
  approvalRequestId: 99,
  statusCode,
  usable: statusCode === 'APPROVED',
});

const SPLIT = {
  splitLotId: 8802,
  splitLotNo: 'MLOT-8801-S1',
  splitNonconformanceId: 42,
  splitNonconformanceNo: 'NC-0042',
};

const stub =
  (rows: unknown[], writes: Request[], applyFailure?: unknown, split = false): StubFetch =>
  async (request) => {
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
      return jsonResponse({ ...concession('APPROVED'), splitResult: split ? SPLIT : null });
    }
    /* 005 G2 5차 — [특채 적용]은 결재가 승인 · 반려된 때만 열린다. 이 받침의 결재는 승인됨이다. */
    if (/^\/app\/approval-requests\/\d+$/u.test(url.pathname)) {
      return jsonResponse({ request: { statusCode: 'APPROVED' }, steps: [] });
    }
    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
  };

const renderHistory = (
  rows: unknown[],
  readOnly = false,
  applyFailure?: unknown,
  split = false,
) => {
  const writes: Request[] = [];
  renderWithProviders(<ConcessionHistory nonconformanceId={41} readOnly={readOnly} />, {
    fetch: stub(rows, writes, applyFailure, split),
  });
  return { writes, user: userEvent.setup() };
};

describe('ConcessionHistory', () => {
  it('이력이 없으면 한 줄로 알린다', async () => {
    renderHistory([]);

    expect(await screen.findByText(t.none)).toBeInTheDocument();
  });

  it('결재 대기 특채를 적용한다', async () => {
    const { writes, user } = renderHistory([concession('PENDING')]);

    await user.click(await screen.findByRole('button', { name: t.apply }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(new URL(writes[0]?.url ?? '').pathname).toBe('/quality/concessions/61:apply');
    expect(await screen.findByText(t.applied)).toBeInTheDocument();
    // 재고를 나눌 때 쓸 영업일을 늘 싣는다(#207 · C-8).
    expect(await writes[0]?.json()).toEqual({
      businessDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('일부 특채로 LOT 이 나뉘면 떼어 낸 LOT·새 부적합 번호를 알린다(#207)', async () => {
    const { user } = renderHistory([concession('PENDING')], false, undefined, true);

    await user.click(await screen.findByRole('button', { name: t.apply }));

    expect(await screen.findByText(t.appliedSplit('MLOT-8801-S1', 'NC-0042'))).toBeInTheDocument();
  });

  it('적용 시점에 남은 수량을 넘으면(서버 400 approvedQty) 그 메시지를 오류 배너로 보인다', async () => {
    const message = '남은 수량을 넘습니다. (남은 수량 4)';
    const { writes, user } = renderHistory([concession('PENDING')], false, {
      errors: [{ scope: 'field', field: 'approvedQty', code: 'INVALID', message }],
    });

    await user.click(await screen.findByRole('button', { name: t.apply }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(await screen.findByText(message, { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(t.applied)).not.toBeInTheDocument();
  });

  it('보기 전용이면 결재 대기도 상태만 보이고 적용 단추가 없다(처분 이력 탭 · #223)', async () => {
    renderHistory([concession('PENDING')], true);

    expect(await screen.findByText(t.status.PENDING)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.apply })).toBeNull();
  });
});
