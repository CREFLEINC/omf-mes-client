import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders } from '../../test/api-harness';
import { reinstatementStub, requestsSent } from './fixtures';
import { StockReinstatementScreen } from './screen';

const t = messages.stockReinstatement;

const renderScreen = (route = '/shipment/stock-reinstatements') => {
  renderWithProviders(<StockReinstatementScreen />, { fetch: reinstatementStub(), route });
  return userEvent.setup();
};

const chooseTarget = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(
    await screen.findByRole('button', { name: t.actions.selectRow('LOT-SYNTH-6101') }),
  );
  expect(await screen.findByText(/반품 외관 이상/)).toBeInTheDocument();
};

const completeRequiredFields = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByLabelText(t.fields.targetWarehouse));
  await user.click(await screen.findByRole('option', { name: /WH-FG/ }));
  await user.click(screen.getByLabelText(t.fields.targetLocation));
  await user.click(await screen.findByRole('option', { name: /FG-A-01/ }));
  await user.click(screen.getByLabelText(t.fields.releaseReason));
  await user.click(screen.getByRole('option', { name: '재검사 합격' }));
};

describe('StockReinstatementScreen', () => {
  it('후속 처리 대기·재등록 가능 축을 서버 목록 요청에 고정한다', async () => {
    renderScreen();
    await screen.findByRole('button', { name: t.actions.selectRow('LOT-SYNTH-6101') });
    const request = requestsSent().find(
      (item) => new URL(item.url).pathname === '/quality/disposition-decisions',
    );
    const query = new URL(request?.url ?? 'http://api.test').searchParams;
    expect(query.get('reinstatable')).toBe('true');
    expect(query.get('followUpPending')).toBe('true');
    expect(query.get('size')).toBe('50');
    expect(query.has('dispositionTypeCode')).toBe(false);
  });

  it('선택 뒤 LOT·보류·품질 토큰과 시간순 판정 이력을 읽는다', async () => {
    const user = renderScreen();
    await chooseTarget(user);

    expect(screen.getByText(t.scopeNotice)).toBeInTheDocument();
    expect(screen.getAllByText(/WH-DEFECT/).length).toBeGreaterThan(0);
    expect(screen.getByText(/2027-02-01/)).toBeInTheDocument();
    expect(screen.getByText(t.history.opened)).toBeInTheDocument();
    expect(screen.getByText(t.history.held)).toBeInTheDocument();
    expect(screen.getByText(t.history.decided)).toBeInTheDocument();

    const paths = requestsSent().map((request) => new URL(request.url).pathname);
    expect(paths).toContain('/quality/lot-statuses');
    expect(paths).toContain('/quality/lot-holds');
    expect(paths).toContain('/trace/lots/6101');
  });

  it('한 번의 재등록 POST만 보내고 토큰은 본문에 싣는다', async () => {
    const user = renderScreen();
    await chooseTarget(user);

    await completeRequiredFields(user);
    await user.click(screen.getByRole('button', { name: t.actions.confirm }));

    const dialog = await screen.findByRole('dialog', { name: t.confirm.title });
    expect(within(dialog).getByText(t.warning.transition)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.actions.submit }));

    await waitFor(() => {
      expect(screen.getByText(t.success(200))).toBeInTheDocument();
    });
    const posts = requestsSent().filter((request) => request.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(new URL(posts[0]?.url ?? 'http://api.test').pathname).toBe(
      '/logistics/stock-reinstatements',
    );
    expect(posts[0]?.headers.get('Idempotency-Key')).toMatch(/[0-9a-f-]{36}/);
    expect(posts[0]?.headers.has('If-Match')).toBe(false);
    expect(posts[0]?.headers.has('X-Worker-No')).toBe(false);
    await expect(posts[0]?.json()).resolves.toMatchObject({
      dispositionDecisionId: 3101,
      lot: { lotId: 6101, versionNo: 7 },
      lotHoldId: 71001,
      toWarehouseId: 202,
      toLocationId: 303,
      qty: 200,
      uomId: 7101,
      releaseReasonCode: 'RETEST_PASS',
    });
  });

  /*
   * ⭐ 통보 221 — 이 오퍼레이션의 모든 409가 이제 `conflictCause`를 반드시 싣는다. 이 값을
   * 뺀 채로만(예전 계약 모양) 시험하면, 실제 서버가 함께 실어 보내는 값을 화면이 못 받았을 때만
   * 통과하는 시험이 된다 — 그래서 서버가 실제로 보내는 모양대로 `conflictCause`를 채운다.
   */
  it('업무 충돌 코드를 재등록 사유로 안내하고 최신 목록을 다시 읽는다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StockReinstatementScreen />, {
      fetch: reinstatementStub({
        postResponse: () =>
          jsonResponse(
            { code: 'ALREADY_REINSTATED', message: '합성 서버 문구', conflictCause: 'user' },
            { status: 409 },
          ),
      }),
      route: '/shipment/stock-reinstatements',
    });
    await chooseTarget(user);
    await completeRequiredFields(user);
    await user.click(screen.getByRole('button', { name: t.actions.confirm }));
    const dialog = await screen.findByRole('dialog', { name: t.confirm.title });
    await user.click(within(dialog).getByRole('button', { name: t.actions.submit }));

    expect(await within(dialog).findByText(t.conflict.already)).toBeInTheDocument();
    await waitFor(() => {
      const candidateReads = requestsSent().filter(
        (request) =>
          request.method === 'GET' &&
          new URL(request.url).pathname === '/quality/disposition-decisions',
      );
      expect(candidateReads.length).toBeGreaterThan(1);
    });
  });

  /*
   * ⭐ **낙관적 잠금 경합(`VERSION_CONFLICT`)만 원인별로 다르게 말한다**(통보 221) — 다른
   * 사용자·ERP 재동기화·워커 중 무엇이 원인이냐에 따라 사용자가 할 수 있는 다음 행동이
   * 달라지므로, 셋을 「다른 처리가 먼저 반영됐습니다」 하나로 뭉뚱그리지 않는다. `ALREADY_
   * REINSTATED`류와 달리 이 코드는 화면이 되말하지 않고 공용 배너(`SaveErrorBanner`)에 맡긴다.
   */
  it('⭐ 낙관적 잠금 경합은 원인(user·erpSync·workerLease)별로 다른 안내를 낸다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StockReinstatementScreen />, {
      fetch: reinstatementStub({
        postResponse: () =>
          jsonResponse(
            { code: 'VERSION_CONFLICT', message: '합성 서버 문구', conflictCause: 'erpSync' },
            { status: 409 },
          ),
      }),
      route: '/shipment/stock-reinstatements',
    });
    await chooseTarget(user);
    await completeRequiredFields(user);
    await user.click(screen.getByRole('button', { name: t.actions.confirm }));
    const dialog = await screen.findByRole('dialog', { name: t.confirm.title });
    await user.click(within(dialog).getByRole('button', { name: t.actions.submit }));

    expect(await within(dialog).findByText(messages.conflict.erpSync)).toBeInTheDocument();
    /* ⛔ 「이미 재등록됨」류의 고정 문구로 뭉개지 않는다 — 원인이 다르면 안내도 달라야 한다. */
    expect(within(dialog).queryByText(t.conflict.already)).not.toBeInTheDocument();
  });

  it('보유 수량을 넘으면 확인 창도 요청도 열지 않는다', async () => {
    const user = renderScreen();
    await chooseTarget(user);
    const qty = screen.getByLabelText(t.fields.qty);
    await user.clear(qty);
    await user.type(qty, '201');
    await user.click(screen.getByRole('button', { name: t.actions.confirm }));

    expect(screen.getByText(t.form.qtyExceeded(200))).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: t.confirm.title })).not.toBeInTheDocument();
    expect(requestsSent().filter((request) => request.method === 'POST')).toHaveLength(0);
  });
});
