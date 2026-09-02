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

    const paths = requestedPaths();
    expect(paths.some((path) => path.includes('unacknowledgedOnly=true'))).toBe(true);
    /* ⛔ 전산담당 전용 경로다 — 업무 화면이 부르지 않는다(B-4-1 ④). */
    expect(paths.some((path) => path.startsWith('/integration/'))).toBe(false);
  });

  /*
   * ⛔ **간접 비교로 채우지 않는다.** W/O 수량으로 견주면 수량만 되고 납기·중단을 말하지 못해
   * 세 행 중 둘이 빈다 — 설계가 「계약이 늦으면 비워 두는 편이 낫다」로 못박았다.
   */
  it('⛔ 변경 항목을 아직 못 받는다는 사실을 적는다 — 지어내지 않는다', async () => {
    renderScreen();
    await screen.findByRole('button', { name: t.list.selectRow('SYNTH-PO-0031') });

    expect(screen.getAllByText(t.diff.pendingContract).length).toBeGreaterThan(0);
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

  /* A-11 — 못 보내는 것을 못 보낸다고 «화면에» 적는다. */
  it('⚠ 아직 못 보내는 것 둘을 화면에 적는다', async () => {
    renderScreen();
    await screen.findByRole('button', { name: t.list.selectRow('SYNTH-PO-0031') });

    const text = document.body.textContent ?? '';
    expect(text).toContain(t.withdrawn.adjustment);
    expect(text).toContain(t.withdrawn.cancelFollowUp);
  });
});
