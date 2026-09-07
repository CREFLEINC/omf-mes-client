import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { confirmRequests, confirmStub, type ConfirmStubOptions } from './fixtures';
import { ShipmentConfirmScreen } from './screen';

const t = messages.shipmentConfirm;
const NOW = new Date('2026-09-01T12:00:00+09:00');

const renderScreen = (options: ConfirmStubOptions = {}) => {
  renderWithProviders(<ShipmentConfirmScreen now={NOW} />, {
    fetch: confirmStub(options),
    route: '/shipment/shipment-confirm',
  });

  return { user: userEvent.setup() };
};

const rowCheckbox = async (shipmentNo: string) =>
  screen.findByRole('checkbox', { name: t.list.selectRow(shipmentNo) });

/** 확인 창 안의 확정 버튼 — 여는 버튼과 이름이 같아 창 안으로 좁혀 집는다. */
const confirmInDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: t.confirmDialog.confirm }));
};

const openConfirm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: t.actions.confirm }));
};

describe('ShipmentConfirmScreen', () => {
  /*
   * ⭐ **「확정 후에는 취소할 수 없다」가 버튼 위에 있어야 한다**(J-7 · §5-3). 화면의 몫은 그
   * 사실을 적는 것까지다 — 관문을 두껍게 하면 경고 피로로 오히려 안 읽는다.
   */
  it('⭐ 되돌릴 수 없다는 것과 ERP 가 «대기열»이라는 것을 확정 전에 보인다', async () => {
    renderScreen();

    const outcome = await screen.findByRole('region', { name: t.panes.outcome });

    expect(outcome).toHaveTextContent(t.outcome.irreversible);
    expect(outcome).toHaveTextContent(t.outcome.erpQueued);
    /* ⛔ 「전송됨」이라 쓰지 않는다 — 대기열에 실리는 것과 나가는 것은 다르다. */
    expect(outcome).not.toHaveTextContent('전송됐');
  });

  it('미확정만 조회한다 — 받아서 거르지 않는다', async () => {
    renderScreen();
    await rowCheckbox('SYNTH-SH-0470');

    const list = confirmRequests();
    expect(list).toHaveLength(0);
    expect(
      screen.getByRole('region', { name: t.panes.list }).textContent?.includes('SYNTH-SH-0455'),
    ).toBe(true);
  });

  /*
   * ⚠ **3일 경과 건은 「모두 선택」에 담기지 않는다**(§6) — 위험한 것을 한 번에 쓸어 담지
   * 않게 하는 것이 목적이다. 개별로는 고를 수 있다.
   */
  it('⚠ 「모두 선택」이 3일 경과 건을 담지 않는다 — 개별로는 고를 수 있다', async () => {
    const { user } = renderScreen();
    await user.click(await screen.findByRole('checkbox', { name: t.list.selectAll }));

    expect(await rowCheckbox('SYNTH-SH-0461')).toBeChecked();
    expect(await rowCheckbox('SYNTH-SH-0470')).toBeChecked();
    expect(await rowCheckbox('SYNTH-SH-0455')).not.toBeChecked();

    await user.click(await rowCheckbox('SYNTH-SH-0455'));
    expect(await rowCheckbox('SYNTH-SH-0455')).toBeChecked();
  });

  it('⛔ 확정을 눌러도 확인 창을 거치기 전에는 아무것도 나가지 않는다', async () => {
    const { user } = renderScreen();
    await user.click(await rowCheckbox('SYNTH-SH-0470'));
    await openConfirm(user);

    expect(await screen.findByText(t.confirmDialog.irreversible)).toBeInTheDocument();
    expect(confirmRequests()).toHaveLength(0);
  });

  it('확인 창이 무엇을 확정하는지 이름으로 늘어놓는다', async () => {
    const { user } = renderScreen();
    await user.click(await rowCheckbox('SYNTH-SH-0461'));
    await user.click(await rowCheckbox('SYNTH-SH-0470'));
    await openConfirm(user);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('SYNTH-SH-0461');
    expect(dialog).toHaveTextContent('SYNTH-SH-0470');
  });

  it('고른 건을 건별로 확정한다', async () => {
    const { user } = renderScreen();
    await user.click(await rowCheckbox('SYNTH-SH-0461'));
    await user.click(await rowCheckbox('SYNTH-SH-0470'));
    await openConfirm(user);
    await confirmInDialog(user);

    await waitFor(() => {
      expect(confirmRequests()).toHaveLength(2);
    });
  });

  it('⭐ 확정마다 잠금 토큰을 상세에서 받아 싣는다', async () => {
    const { user } = renderScreen();
    await user.click(await rowCheckbox('SYNTH-SH-0470'));
    await openConfirm(user);
    await confirmInDialog(user);

    await waitFor(() => {
      const [posted] = confirmRequests();
      expect(posted?.headers.get('If-Match')).toBe('"v470"');
    });
  });

  /*
   * ⭐⭐ **성공분을 유지한다**(§6). 건별 호출이라 함께 되돌리지 않고 확정을 되돌릴 경로도
   * 없다 — 「전부 실패」로 뭉뚱그리면 사용자가 **이미 확정된 건을 다시 확정하러 간다.**
   */
  it('⭐⭐ 일부가 실패해도 성공분을 유지해 보이고, 실패한 건에 사유를 붙인다', async () => {
    const { user } = renderScreen({
      confirmResponse: (shipmentId) =>
        shipmentId === 461
          ? new Response(JSON.stringify({ code: 'VERSION_CONFLICT' }), {
              status: 409,
              headers: { 'Content-Type': 'application/json' },
            })
          : undefined,
    });
    await user.click(await rowCheckbox('SYNTH-SH-0461'));
    await user.click(await rowCheckbox('SYNTH-SH-0470'));
    await openConfirm(user);
    await confirmInDialog(user);

    expect(await screen.findByText(t.result.partial(1, 1))).toBeInTheDocument();
    expect(await screen.findByText(t.result.reasons.versionConflict)).toBeInTheDocument();
  });

  /*
   * ⭐ **멱등** — 통신이 끊긴 뒤 다시 눌러도 같은 키가 나가야 원장이 중복을 막는다(C-1).
   * 키를 새로 만들면 **같은 출하가 두 번 확정된다.**
   */
  it('⭐ 실패한 건을 다시 확정하면 같은 멱등 키가 나간다', async () => {
    const { user } = renderScreen({
      confirmResponse: () => new Response('', { status: 500 }),
    });
    await user.click(await rowCheckbox('SYNTH-SH-0470'));
    await openConfirm(user);
    await confirmInDialog(user);
    await waitFor(() => {
      expect(confirmRequests()).toHaveLength(1);
    });

    await user.click(await rowCheckbox('SYNTH-SH-0470'));
    await openConfirm(user);
    await confirmInDialog(user);

    await waitFor(() => {
      const posts = confirmRequests();
      expect(posts).toHaveLength(2);
      expect(posts[0]?.headers.get('Idempotency-Key')).toBe(
        posts[1]?.headers.get('Idempotency-Key'),
      );
    });
  });

  /*
   * ⛔ 토큰 없이 보내면 서버가 412 로 막을 뿐이고, 그 실패는 사용자가 고칠 수 있는 것이
   * 아니다 — **시도조차 하지 않고 사유를 낸다.**
   */
  it('⛔ 잠금 토큰을 못 받으면 확정을 시도하지 않고 사유를 낸다', async () => {
    const { user } = renderScreen({ omitEtag: true });
    await user.click(await rowCheckbox('SYNTH-SH-0470'));
    await openConfirm(user);
    await confirmInDialog(user);

    expect(await screen.findByText(t.result.reasons.lockUnavailable)).toBeInTheDocument();
    expect(confirmRequests()).toHaveLength(0);
  });

  it('⛔ 이미 확정된 건은 다시 시도 대상에 담지 않는다', async () => {
    const { user } = renderScreen({
      confirmResponse: () =>
        new Response(JSON.stringify({ code: 'ALREADY_CONFIRMED' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }),
    });
    await user.click(await rowCheckbox('SYNTH-SH-0470'));
    await openConfirm(user);
    await confirmInDialog(user);

    expect(await screen.findByText(t.result.reasons.alreadyConfirmed)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.retry })).toBeNull();
  });

  /* §5-8 — 요청과 실행이 다른 액션이다. 그 사실을 요청하는 자리에서 말한다. */
  it('취소 요청은 사유가 필수이고, 실행이 아니라 결재로 간다는 것을 말한다', async () => {
    const { user } = renderScreen();
    await user.click(await rowCheckbox('SYNTH-SH-0470'));
    await user.click(screen.getByRole('button', { name: t.actions.requestCancel }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(t.cancelDialog.approvalNote);

    await user.click(within(dialog).getByRole('button', { name: t.cancelDialog.submit }));
    expect(await screen.findByText(t.cancelDialog.reasonRequired)).toBeInTheDocument();
  });

  it('취소 요청은 한 건씩만 한다', async () => {
    const { user } = renderScreen();
    await user.click(await rowCheckbox('SYNTH-SH-0461'));
    await user.click(await rowCheckbox('SYNTH-SH-0470'));

    expect(screen.getByRole('button', { name: t.actions.requestCancel })).toBeDisabled();
  });

  /*
   * A-11 — **못 보이는 것을 못 보인다고 «화면에» 적는다.** 문구만 써 두고 내지 않으면
   * 사용자에게는 조용히 사라진 것과 같다 — 실제로 그렇게 두었던 것을 리뷰가 잡았다.
   */
  it('⚠ 못 보이는 것 셋을 화면에 적는다 — 문구만 두고 내지 않으면 없는 것과 같다', async () => {
    renderScreen();
    await screen.findByRole('checkbox', { name: t.list.selectRow('SYNTH-SH-0470') });

    const body = document.body.textContent ?? '';

    /* 자동 확정 설정·예정 시각 — 정책 코드 값 목록에 없다. */
    expect(body).toContain(t.withdrawn.autoConfirm);
    /* 취소 결재 중 여부 — 결재 대상 유형·승인 상태 코드가 미정이다. */
    expect(body).toContain(t.withdrawn.cancelPendingUnknown);
    /* 확정한 사람 — 담을 컬럼이 없다. */
    expect(body).toContain(t.withdrawn.confirmedBy);
    /* 승인된 취소의 실행 — 승인 완료를 가릴 축이 없다. */
    expect(body).toContain(t.withdrawn.executeCancel);
  });
});

describe('ShipmentConfirmScreen — 상태 표시명', () => {
  /* 계약은 코드만 내린다 — 표시명은 공통코드 SHIPMENT_STATUS 가 준다(G-32). 코드 원문을 사용자에게 보이지 않는다. */
  it('출하 상태를 공통코드 표시명으로 그린다', async () => {
    renderScreen();

    expect((await screen.findAllByText('미확정')).length).toBeGreaterThan(0);
    expect(screen.queryByText('UNCONFIRMED')).not.toBeInTheDocument();
  });
});
