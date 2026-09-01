import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { expeditedStub, requestsSent, type ExpeditedStubOptions } from './fixtures';
import { ExpeditedShipmentScreen } from './screen';

const t = messages.expeditedShipment;
const TODAY = new Date(2026, 8, 1);

const renderScreen = (options: ExpeditedStubOptions = {}) => {
  renderWithProviders(<ExpeditedShipmentScreen today={TODAY} />, {
    fetch: expeditedStub(options),
    route: '/shipment/expedited-shipment',
  });

  return { user: userEvent.setup() };
};

const pickOption = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  name: RegExp,
) => {
  /* 목록이 도착해야 칸이 선다 — 도착 전에 집으면 「없다」가 아니라 「아직」이다. */
  await user.click(await screen.findByLabelText(label));
  await user.click(await screen.findByRole('option', { name }));
};

/** LOT → 지시 → 수량 → 사유까지 정상 경로로 채운다. */
const fillAll = async (user: ReturnType<typeof userEvent.setup>) => {
  await pickOption(user, t.lot.label, /SYNTH-LOT-0311/);
  await pickOption(user, t.target.label, /SYNTH-SR-0470/);
  await user.type(await screen.findByLabelText(t.target.fields.qty), '300');
  await user.type(screen.getByLabelText(t.reason.label), '고객 라인 정지');
};

/**
 * 확인 창 안의 확정 버튼.
 *
 * ⚠ 여는 버튼과 확정 버튼의 이름이 같다(`W-04-04`와 같은 형태) — 창 안으로 좁혀 집는다.
 * 이름으로만 집으면 감지기가 «창 밖의» 버튼을 눌러 놓고 통과할 수 있다.
 */
const confirmInDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: t.confirm.confirm }));
};

/** POST 본문 — 무엇이 실제로 나갔는지. */
const postedBody = async (): Promise<Record<string, unknown> | null> => {
  const post = requestsSent().find(
    (request) => request.method === 'POST' && request.url.includes('/logistics/shipments'),
  );
  return post === undefined ? null : ((await post.json()) as Record<string, unknown>);
};

describe('ExpeditedShipmentScreen', () => {
  /*
   * ⭐ **「일어나지 않는 것」이 이 화면의 핵심이다**(§5-2 · J-7). 결과 구획이 버튼 위에 없으면
   * 누르는 사람이 검사·피킹·포장이 빠지는 줄 모르고 누른다 — 검사 안 한 물건이 고객에게 간다.
   */
  it('⭐ 무엇을 건너뛰는지·되돌릴 수 없다는 것을 확정 전에 상시 보인다', async () => {
    renderScreen();

    const outcome = await screen.findByRole('region', { name: t.panes.outcome });

    expect(outcome).toHaveTextContent(t.outcome.skipped);
    expect(outcome).toHaveTextContent(t.outcome.qualityGate);
    expect(outcome).toHaveTextContent(t.outcome.rollback);
    expect(outcome).toHaveTextContent(t.outcome.irreversible);
    /* ⭐ 「장부상」을 적지 않으면 창고 담당이 물건을 찾으러 간다(§5-4). */
    expect(outcome).toHaveTextContent('장부상');
  });

  it('선택하기 전에도 결과 구획이 보인다 — 관문이 막혀 있어도 성격을 먼저 알아야 한다', async () => {
    renderScreen();

    expect(await screen.findByRole('region', { name: t.panes.outcome })).toBeInTheDocument();
    expect(screen.getByText(t.headerNotice)).toBeInTheDocument();
  });

  it('⭐ 다 채우면 `expedited`와 사유를 실어 보낸다 — 이 화면의 전부다', async () => {
    const { user } = renderScreen();
    await fillAll(user);

    await user.click(screen.getByRole('button', { name: t.submit }));
    await confirmInDialog(user);

    await waitFor(async () => {
      const body = await postedBody();
      expect(body).not.toBeNull();
      expect(body?.expedited).toBe(true);
      expect(body?.expediteReason).toBe('고객 라인 정지');
    });
  });

  it('LOT 배분을 라인 하나에 실어 보낸다', async () => {
    const { user } = renderScreen();
    await fillAll(user);

    await user.click(screen.getByRole('button', { name: t.submit }));
    await confirmInDialog(user);

    await waitFor(async () => {
      const body = await postedBody();
      expect(body?.lines).toEqual([
        {
          shipmentRequestLineId: 4001,
          shippedQty: 300,
          uomId: 7001,
          allocations: [{ lotId: 9001, allocatedQty: 300, uomId: 7001 }],
        },
      ]);
    });
  });

  /*
   * ⛔ **결정 10에 예외를 두지 않는다**(§5-3). 「긴급」이 건너뛰는 것은 창고 경유와 피킹·포장이지
   * 품질 게이트가 아니다 — 여기서 통과시키면 차단의 단일 지점이라는 전제가 무너진다.
   */
  it('⛔ 검사 대기 LOT은 확정할 수 없고, 무엇을 하면 되는지 말한다', async () => {
    const { user } = renderScreen({ lotStatusCode: 'INSPECTION_PENDING' });
    /*
     * ⚠ **나머지를 다 채운 뒤에 본다.** 안 채우면 「대상을 고르세요」로도 버튼이 잠겨,
     * 차단이 풀려 있어도 감지기가 통과한다 — 실제로 그렇게 통과하던 것을 결함 재주입이 잡았다.
     */
    await fillAll(user);

    expect(await screen.findByText(t.release.inspectionPending)).toBeInTheDocument();
    expect(screen.getByText(t.lock.notReleasable)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.submit })).toBeDisabled();
  });

  it('⛔ 보류 중인 LOT도 확정할 수 없다', async () => {
    const { user } = renderScreen({ lotHeld: true });
    await fillAll(user);

    expect(await screen.findByText(t.release.held)).toBeInTheDocument();
    expect(screen.getByText(t.lock.notReleasable)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.submit })).toBeDisabled();
  });

  /* ⚠ 서버가 필드를 안 내리는 것만으로 화면이 잠기면 이 화면은 쓸 수 없게 된다. */
  it('보류 여부를 못 받아도 잠기지 않고, 최종 판정이 서버에 있다는 사실을 적는다', async () => {
    const { user } = renderScreen({ omitHeld: true });

    await pickOption(user, t.lot.label, /SYNTH-LOT-0311/);

    expect(await screen.findByText(t.release.serverDecides)).toBeInTheDocument();
    expect(screen.getByText(t.release.unknown)).toBeInTheDocument();
  });

  it('⛔ 수량이 배정 잔여를 넘으면 확정이 잠기고 두 상한을 함께 보인다', async () => {
    const { user } = renderScreen();
    await pickOption(user, t.lot.label, /SYNTH-LOT-0311/);
    await pickOption(user, t.target.label, /SYNTH-SR-0470/);
    await user.type(await screen.findByLabelText(t.target.fields.qty), '400');
    await user.type(screen.getByLabelText(t.reason.label), '사유');

    expect(screen.getByRole('button', { name: t.submit })).toBeDisabled();
    expect(screen.getByText(t.lock.qty)).toBeInTheDocument();
  });

  it('⛔ 사유가 없으면 확정이 잠긴다 — 서버가 400으로 막기 전에 화면이 막는다', async () => {
    const { user } = renderScreen();
    await pickOption(user, t.lot.label, /SYNTH-LOT-0311/);
    await pickOption(user, t.target.label, /SYNTH-SR-0470/);
    await user.type(await screen.findByLabelText(t.target.fields.qty), '300');

    expect(screen.getByRole('button', { name: t.submit })).toBeDisabled();
    expect(screen.getByText(t.lock.reason)).toBeInTheDocument();
  });

  /*
   * ⛔ 되돌리기가 없으므로 확인 창이 마지막 문이다(§5-7 · §6). 창을 거치지 않고 나가면
   * 「누르자마자 재고가 빠졌다」가 된다.
   */
  it('⛔ 확정을 눌러도 확인 창을 거치기 전에는 아무것도 나가지 않는다', async () => {
    const { user } = renderScreen();
    await fillAll(user);

    await user.click(screen.getByRole('button', { name: t.submit }));

    expect(await screen.findByText(t.confirm.irreversible)).toBeInTheDocument();
    expect(await postedBody()).toBeNull();
  });

  it('확인 창에서 취소하면 나가지 않는다', async () => {
    const { user } = renderScreen();
    await fillAll(user);

    await user.click(screen.getByRole('button', { name: t.submit }));
    const cancelDialog = await screen.findByRole('dialog');
    await user.click(within(cancelDialog).getByRole('button', { name: t.confirm.cancel }));

    expect(await postedBody()).toBeNull();
  });

  /*
   * ⭐ **멱등** — 통신이 끊긴 뒤 다시 눌러도 같은 키가 나가야 원장이 중복을 막는다(§5-6 · C-1).
   * 키를 새로 만들면 전표가 두 벌 생긴다.
   */
  it('⭐ 같은 확정을 다시 보내면 멱등 키가 같다 — 전표가 두 벌 생기지 않는다', async () => {
    const { user } = renderScreen({ createResponse: () => new Response('', { status: 500 }) });
    await fillAll(user);

    await user.click(screen.getByRole('button', { name: t.submit }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: t.confirm.confirm });
    await user.click(confirm);
    await waitFor(() => {
      expect(requestsSent().filter((request) => request.method === 'POST').length).toBeGreaterThan(
        0,
      );
    });
    await user.click(confirm);

    await waitFor(() => {
      const posts = requestsSent().filter((request) => request.method === 'POST');
      expect(posts.length).toBe(2);
      expect(posts[0]?.headers.get('Idempotency-Key')).toBe(
        posts[1]?.headers.get('Idempotency-Key'),
      );
    });
  });

  it('고른 지시에 품목이 맞는 라인이 없으면 사유를 내고 잠근다', async () => {
    const { user } = renderScreen({ lineItemId: 5999 });

    await pickOption(user, t.lot.label, /SYNTH-LOT-0311/);

    /* 품목이 안 맞는 지시는 선택지에서 빠진다 — 목록 응답의 라인으로 이미 걸러진다. */
    await user.click(screen.getByLabelText(t.target.label));
    expect(screen.queryByRole('option', { name: /SYNTH-SR-0470/ })).toBeNull();
  });

  /* ⚠ 계약이 창고를 필수로 두는데 스펙에 출처가 없다 — 몰래 첫 번째를 집지 않는다. */
  it('⚠ 활성 창고가 여럿이면 고르게 하고, 고르기 전에는 확정이 잠긴다', async () => {
    const { user } = renderScreen({ manyWarehouses: true });
    await fillAll(user);

    expect(await screen.findByText(t.lock.warehouse)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.submit })).toBeDisabled();

    await pickOption(user, t.loading.warehouse, /SYNTH-WH-2/);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.submit })).toBeEnabled();
    });
  });
});
