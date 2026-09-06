import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import {
  acknowledgeRequests,
  poChangeStub,
  requestedPaths,
  type PoChangeStubOptions,
} from './fixtures';
import { PoChangeReviewScreen } from './screen';

const t = messages.poChangeReview;

const renderScreen = (options: PoChangeStubOptions = {}) => {
  renderWithProviders(<PoChangeReviewScreen />, {
    fetch: poChangeStub(options),
    route: '/production/po-change-review',
  });

  return { user: userEvent.setup() };
};

const selectRow = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: t.list.selectRow('SYNTH-PO-0031') }));
};

const body = async (): Promise<Record<string, unknown> | null> => {
  const [posted] = acknowledgeRequests();
  return posted === undefined ? null : ((await posted.json()) as Record<string, unknown>);
};

describe('PoChangeReviewScreen', () => {
  it('미확인 P/O만 조회한다 — 연계 원문 경로는 부르지 않는다', async () => {
    renderScreen();
    await screen.findByRole('button', { name: t.list.selectRow('SYNTH-PO-0031') });

    const listPane = screen.getByLabelText(t.panes.list);
    expect(listPane).toHaveClass('po-change-review-pane');
    expect(listPane.parentElement).toHaveClass('po-change-review-layout');
    expect(screen.getByRole('table', { name: t.panes.list })).toHaveClass('po-change-review-table');
    const paths = requestedPaths();
    expect(paths.some((path) => path.includes('unacknowledgedOnly=true'))).toBe(true);
    /* ⛔ 전산담당 전용 경로다 — 업무 화면이 부르지 않는다(B-4-1 ④). */
    expect(paths.some((path) => path.startsWith('/integration/'))).toBe(false);
  });

  /* ⭐ 「무엇이 몇에서 몇으로」는 lastChange 로만 온다 — withLastChange 를 켜고, 표시명은 계약이 준 그대로 그린다. */
  it('⭐ 변경 내역을 함께 받아 목록 열과 2열 비교표를 그린다 — 감소량은 화면이 뺀다', async () => {
    const { user } = renderScreen();
    await screen.findByRole('button', { name: t.list.selectRow('SYNTH-PO-0031') });

    expect(requestedPaths().some((path) => path.includes('withLastChange=true'))).toBe(true);
    expect(screen.getByText('수량 5000→4000 · 납기 2026-08-20→2026-08-20')).toBeInTheDocument();

    await selectRow(user);
    const diff = await screen.findByRole('table', { name: t.panes.diff });
    expect(diff).toHaveClass('po-change-review-diff');
    expect(screen.getByText('5000 EA')).toBeInTheDocument();
    expect(screen.getByText('4000 EA')).toBeInTheDocument();
    expect(screen.getByText(t.diff.decrease('1000'))).toBeInTheDocument();
    expect(screen.getByText(t.diff.same)).toBeInTheDocument();
    expect(screen.getByText(t.diff.receivedAt('2026-08-05 09:12'))).toBeInTheDocument();
  });

  /* 못 받은 것과 열거 밖(빈 배열)을 가른다 — 둘 다 지어내지 않고 사실을 적는다(G-9). */
  it('변경 내역이 없으면 그 사실을, 열거 밖이면 원문 안내를 적는다', async () => {
    const absent = renderScreen({ lastChange: 'absent' });
    await selectRow(absent.user);
    expect(await screen.findByText(t.diff.noLastChange)).toBeInTheDocument();
    expect(screen.getByText(t.list.changedFieldsUnknown)).toBeInTheDocument();
  });

  it('열거 밖 항목만 바뀌면 항목을 낼 수 없다고 적는다', async () => {
    const { user } = renderScreen({ lastChange: 'empty' });
    await selectRow(user);
    expect(await screen.findByText(t.diff.outOfScope)).toBeInTheDocument();
    expect(screen.getByText(t.list.changedFieldsOutOfScope)).toBeInTheDocument();
  });

  /* ⭐ `withProgress` 없이는 「이미 생산됨」이 그려지지 않는다 — 그 경고가 판단 근거다. */
  it('⭐ 영향 W/O를 실적과 함께 받는다', async () => {
    const { user } = renderScreen();
    await selectRow(user);

    await waitFor(() => {
      expect(
        requestedPaths().some(
          (path) => path.includes('/production/work-orders') && path.includes('withProgress=true'),
        ),
      ).toBe(true);
    });
    expect(await screen.findByText(/1200 이미 생산됨/)).toBeInTheDocument();
    expect(screen.getByRole('table', { name: t.panes.workOrders })).toHaveClass(
      'po-change-review-table',
    );
    expect(screen.getByText('CODE-B').closest('td')).toHaveAttribute('data-align', 'center');
  });

  it('⚠ 실적이 변경 후 수량을 넘으면 경고하되 막지 않는다', async () => {
    const { user } = renderScreen({ producedQty: 5000 });
    await selectRow(user);

    expect(
      await screen.findByText(t.workOrders.producedOverWarning('5000', '4000')),
    ).toBeInTheDocument();
    /* 경고이지 차단이 아니다 — 판정을 고르면 저장할 수 있어야 한다. */
    await user.click(screen.getByRole('radio', { name: t.decision.apply }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.decision.submit })).toBeEnabled();
    });
  });

  it('⛔ 강행은 사유 없이 저장할 수 없다', async () => {
    const { user } = renderScreen();
    await selectRow(user);
    await user.click(await screen.findByRole('radio', { name: t.decision.proceed }));

    expect(screen.getByRole('button', { name: t.decision.submit })).toBeDisabled();
    expect(screen.getByText(t.lock.reason)).toBeInTheDocument();
    /* ⓘ 파급을 저장 전에 말한다(G-19). */
    expect(screen.getByText(t.decision.proceedNote)).toBeInTheDocument();
  });

  it('반영은 사유 없이 저장할 수 있다 — 조정을 못 보내는 파급만 말한다', async () => {
    const { user } = renderScreen();
    await selectRow(user);
    await user.click(await screen.findByRole('radio', { name: t.decision.apply }));

    expect(screen.getByRole('button', { name: t.decision.submit })).toBeEnabled();
    expect(screen.getByText(t.decision.applyWithoutAdjustment)).toBeInTheDocument();
  });

  it('⚠ 반영에는 사유 칸을 싣지 않는다', async () => {
    const { user } = renderScreen();
    await selectRow(user);
    await user.click(await screen.findByRole('radio', { name: t.decision.apply }));
    await user.click(screen.getByRole('button', { name: t.decision.submit }));

    await waitFor(async () => {
      const sent = await body();
      expect(sent).toEqual({ decisionCode: 'APPLY' });
    });
  });

  it('강행은 사유를 실어 보낸다', async () => {
    const { user } = renderScreen();
    await selectRow(user);
    await user.click(await screen.findByRole('radio', { name: t.decision.proceed }));
    await user.type(screen.getByLabelText(t.decision.reasonLabel), '납기 우선');
    await user.click(screen.getByRole('button', { name: t.decision.submit }));

    await waitFor(async () => {
      expect(await body()).toEqual({ decisionCode: 'PROCEED', reason: '납기 우선' });
    });
  });

  /* ⭐ 토큰은 그 P/O의 상세가 내린다(B-1-1). 없으면 요청을 만들지 않는다. */
  it('⭐ 확인 처리에 잠금 토큰을 실어 보낸다', async () => {
    const { user } = renderScreen();
    await selectRow(user);
    await user.click(await screen.findByRole('radio', { name: t.decision.apply }));
    await user.click(screen.getByRole('button', { name: t.decision.submit }));

    await waitFor(() => {
      expect(acknowledgeRequests()[0]?.headers.get('If-Match')).toBe('"3"');
    });
  });

  it('⛔ 잠금 토큰을 못 받으면 요청을 만들지 않는다', async () => {
    const { user } = renderScreen({ omitEtag: true });
    await selectRow(user);
    await user.click(await screen.findByRole('radio', { name: t.decision.apply }));
    await user.click(screen.getByRole('button', { name: t.decision.submit }));

    await waitFor(() => {
      expect(screen.getByText(messages.save.staleToken)).toBeInTheDocument();
    });
    expect(acknowledgeRequests()).toHaveLength(0);
  });

  /*
   * ⭐⭐ **이 화면이 ERP 배치와 부딪치는 첫 화면이다**(§5-3 · §9-2). 부딪치는 상대가 사람이
   * 아니라서 「남이 고쳤다」로 적으면 **사용자가 동료를 찾으러 간다.**
   */
  it('⭐⭐ 충돌이 나면 「ERP가 다시 변경했습니다」로 말한다 — 「남이 고쳤다」가 아니다', async () => {
    const { user } = renderScreen({
      acknowledgeResponse: () =>
        new Response(JSON.stringify({ conflictCause: 'erpSync', message: '충돌' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }),
    });
    await selectRow(user);
    await user.click(await screen.findByRole('radio', { name: t.decision.apply }));
    await user.click(screen.getByRole('button', { name: t.decision.submit }));

    expect(await screen.findByText(t.conflict.title)).toBeInTheDocument();
    expect(screen.getByText(t.conflict.description)).toBeInTheDocument();
    /* 다시 불러오면 풀린다는 길을 함께 준다. */
    expect(screen.getByRole('button', { name: t.conflict.reload })).toBeInTheDocument();
  });

  it('대상을 바꾸면 앞서 고른 판정을 물려주지 않는다', async () => {
    const { user } = renderScreen();
    await selectRow(user);
    await user.click(await screen.findByRole('radio', { name: t.decision.proceed }));
    expect(screen.getByRole('radio', { name: t.decision.proceed })).toBeChecked();

    /* 같은 행을 다시 눌러도 선택 상태가 새로 서야 한다 — 되돌릴 수 없는 판정이다. */
    await user.click(screen.getByRole('button', { name: t.list.selectRow('SYNTH-PO-0031') }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.decision.submit })).toBeDisabled();
    });
  });

  /* A-11 — 이 화면에 두지 않은 것을 두지 않았다고 «화면에» 적는다. */
  it('⚠ 취소 후속을 이 화면에 두지 않았다고 적는다', async () => {
    renderScreen();
    await screen.findByRole('button', { name: t.list.selectRow('SYNTH-PO-0031') });

    expect(document.body.textContent ?? '').toContain(t.withdrawn.cancelFollowUp);
  });

  /* ⭐ 반영은 W/O 조정을 함께 싣는다 — 한 트랜잭션(B-8). 서버가 나누지 않으니 사람이 적는다. */
  it('⭐ 반영에서 조정 수량을 적으면 잠금 토큰과 함께 본문에 싣는다', async () => {
    const { user } = renderScreen();
    await selectRow(user);
    await user.click(await screen.findByRole('radio', { name: t.decision.apply }));
    expect(screen.getByText(t.decision.applyWithoutAdjustment)).toBeInTheDocument();

    await user.type(screen.getByLabelText(t.workOrders.adjustLabel('SYNTH-WO-013')), '2500');
    expect(screen.queryByText(t.decision.applyWithoutAdjustment)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.decision.submit }));

    await waitFor(async () => {
      expect(await body()).toEqual({
        decisionCode: 'APPLY',
        workOrderAdjustments: [{ workOrderId: 13, versionNo: 4, orderQty: 2500 }],
      });
    });
  });

  it('조정 칸에 잘못된 값이 있으면 저장을 막고 그 줄에 오류를 붙인다', async () => {
    const { user } = renderScreen();
    await selectRow(user);
    await user.click(await screen.findByRole('radio', { name: t.decision.apply }));
    await user.type(screen.getByLabelText(t.workOrders.adjustLabel('SYNTH-WO-013')), 'abc');

    expect(screen.getByText(t.workOrders.adjustNotNumber)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.decision.submit })).toBeDisabled();
    expect(screen.getByText(t.lock.adjustment)).toBeInTheDocument();
  });
});
