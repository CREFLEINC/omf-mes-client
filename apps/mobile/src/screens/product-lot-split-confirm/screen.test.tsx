import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { useWorkerSession } from '../../patterns/worker-session';
import type { ProductLotSplit } from './queries';
import { ProductLotSplitConfirmScreen } from './screen';

/*
 * M-04-05 LOT 분리 확인(피처 013 · 시안 M0405 상태 ①~⑦). 합성값만 쓴다.
 */

const t = messages.productLotSplitConfirm;
const store = vi.hoisted(() => new Map<string, string>());

vi.mock('../../patterns/local-store', () => ({
  readLocal: (key: string) => Promise.resolve(store.get(key) ?? null),
  writeLocal: (key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  },
  removeLocal: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

const PARENT = 'SYN-PL-261118-0412';
const CHILD = `${PARENT}-S1`;
const OTHER = 'SYN-PL-261116-0107-S2';

const split = (overrides: Partial<ProductLotSplit> = {}): ProductLotSplit => ({
  productLotSplitId: 9,
  status: 'UNCONFIRMED',
  parentLot: { lotId: 123, lotNo: PARENT, qty: 70 },
  childLot: { lotId: 777, lotNo: CHILD, qty: 30 },
  item: { itemId: 1, itemCode: 'SYN-ITEM-01', itemName: '합성 보호 케이스', uomCode: 'EA' },
  location: { locationId: 45, locationCode: 'FG-A-01' },
  splitAt: '2026-11-20T02:12:00Z',
  splitWorkerNo: 'W0021',
  confirmedAt: null,
  confirmedWorkerNo: null,
  lastPrint: { parent: 'PRINTED', child: 'PRINTED' },
  ...overrides,
});

const page = { page: 1, size: 50, total: 1 };

interface Sent {
  path: string;
  headers: Headers;
  body: unknown;
}

const routes = (
  find: (lotNo: string) => ProductLotSplit | null,
  confirm: () => Response,
  sent: Sent[],
): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/logistics/product-lot-splits',
    respond: (req) => {
      const lotNo = new URL(req.url).searchParams.get('lotNo') ?? '';
      const found = find(lotNo);
      return jsonResponse({
        items: found === null ? [] : [found],
        page,
        unconfirmedCount: 1,
      });
    },
  },
  {
    match: (req) => new URL(req.url).pathname.endsWith(':confirm'),
    respond: async (req) => {
      sent.push({ path: new URL(req.url).pathname, headers: req.headers, body: await req.json() });
      return confirm();
    },
  },
];

const SignedIn = ({ children }: { children: ReactNode }) => {
  const { worker, signIn } = useWorkerSession();

  useEffect(() => {
    if (worker === null) signIn({ workerNo: '900028', workerName: '김철수' });
  }, [signIn, worker]);

  return worker === null ? null : children;
};

const pairOf = (lotNo: string): ProductLotSplit | null =>
  lotNo === PARENT || lotNo === CHILD ? split() : null;

const mount = (
  options: {
    find?: (lotNo: string) => ProductLotSplit | null;
    confirm?: () => Response;
  } = {},
) => {
  const sent: Sent[] = [];
  renderWithProviders(
    <MemoryRouter>
      <SignedIn>
        <ProductLotSplitConfirmScreen />
      </SignedIn>
    </MemoryRouter>,
    {
      fetch: createStubFetch(
        routes(
          options.find ?? pairOf,
          options.confirm ??
            (() =>
              jsonResponse({
                ...split(),
                status: 'CONFIRMED',
                confirmedAt: '2026-11-20T02:40:00Z',
              })),
          sent,
        ),
      ),
    },
  );
  return { sent };
};

type User = ReturnType<typeof userEvent.setup>;

/* 스캐너 대신 직접 입력으로 같은 값을 넣는다. */
const scan = async (user: User, value: string) => {
  if (screen.queryByRole('button', { name: t.scan.manualSubmit }) === null) {
    await user.click(await screen.findByRole('button', { name: t.scan.manualLabel }));
  }
  const field = screen.getByLabelText(t.scan.label);
  await user.clear(field);
  await user.type(field, value);
  await user.click(screen.getByRole('button', { name: t.scan.manualSubmit }));
};

const slot = (label: string) =>
  screen.findByRole('listitem', { name: new RegExp(`^${label} `, 'u') });

describe('M-04-05 LOT 분리 확인', () => {
  it('① 첫 스캔 대기 — 안내 글과 [나가기]만 있다', async () => {
    mount();

    expect(await screen.findByText(t.guide)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.actions.exit })).toBeTruthy();
    expect(screen.queryByRole('region', { name: t.pair.label })).toBeNull();
  });

  it('US3-2 · Q15 ② 새 LOT 먼저 → 두 칸, 새 LOT ✓, 「원래 LOT 라벨을 스캔하세요」(수량 70)', async () => {
    const user = userEvent.setup();
    mount();

    await scan(user, CHILD);
    expect(await screen.findByText(t.notice.needParentTitle)).toBeTruthy();
    expect(screen.getByText(t.notice.needParent('70 EA'))).toBeTruthy();
    expect((await slot(t.pair.child)).getAttribute('aria-label')).toBe(
      `${t.pair.child} ${t.pair.scanned}`,
    );
    expect((await slot(t.pair.parent)).getAttribute('aria-label')).toBe(
      `${t.pair.parent} ${t.pair.waiting}`,
    );
    expect(screen.getByRole('button', { name: t.actions.reset })).toBeTruthy();
  });

  it('US3-3 · Q15 ③ 두 장 스캔(새 → 원래) → :confirm 한 번, 두 LOT id · 사번 · 멱등 키, 「분리를 확인했습니다」', async () => {
    const user = userEvent.setup();
    const { sent } = mount();

    await scan(user, CHILD);
    await screen.findByText(t.notice.needParentTitle);
    await scan(user, PARENT);

    expect(await screen.findByText(t.notice.doneTitle)).toBeTruthy();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.path).toBe('/logistics/product-lot-splits/9:confirm');
    expect((sent[0]?.body as { lotIds: number[] }).lotIds.sort()).toEqual([123, 777]);
    expect(sent[0]?.headers.get('X-Worker-No')).toBe('900028');
    expect(sent[0]?.headers.get('Idempotency-Key')).toBeTruthy();
    expect(screen.getByRole('button', { name: t.actions.next })).toBeTruthy();
  });

  it('US3-3 · Q15 반대 순서(원래 → 새)도 확인된다', async () => {
    const user = userEvent.setup();
    const { sent } = mount();

    await scan(user, PARENT);
    expect(await screen.findByText(t.notice.needChildTitle)).toBeTruthy();
    expect(screen.getByText(t.notice.needChild('30 EA'))).toBeTruthy();
    await scan(user, CHILD);

    expect(await screen.findByText(t.notice.doneTitle)).toBeTruthy();
    expect(sent).toHaveLength(1);
  });

  it('같은 라벨을 두 번 스캔하면 무시한다', async () => {
    const user = userEvent.setup();
    const { sent } = mount();

    await scan(user, CHILD);
    await screen.findByText(t.notice.needParentTitle);
    await scan(user, CHILD);

    expect(screen.getByText(t.notice.needParentTitle)).toBeTruthy();
    expect(sent).toHaveLength(0);
  });

  it('US3-4 · Q16 ④ 짝이 아닌 라벨 → 「이 분리의 라벨이 아닙니다」, 진행은 그대로', async () => {
    const user = userEvent.setup();
    const { sent } = mount();

    await scan(user, CHILD);
    await screen.findByText(t.notice.needParentTitle);
    await scan(user, OTHER);

    expect(await screen.findByText(t.notice.wrongTitle)).toBeTruthy();
    expect(screen.getByText(t.notice.wrong(OTHER))).toBeTruthy();
    expect((await slot(t.pair.child)).getAttribute('aria-label')).toBe(
      `${t.pair.child} ${t.pair.scanned}`,
    );
    expect(sent).toHaveLength(0);

    /* 이어서 남은 원래 LOT 을 스캔하면 확인된다. */
    await scan(user, PARENT);
    expect(await screen.findByText(t.notice.doneTitle)).toBeTruthy();
  });

  it('US3-5 · Q16 ⑤ 첫 스캔이 확인된 분리면 바로 「이미 확인된 분리입니다」(시각 · 작업자)', async () => {
    const user = userEvent.setup();
    const { sent } = mount({
      find: () =>
        split({
          status: 'CONFIRMED',
          confirmedAt: '2026-11-20T02:40:00Z',
          confirmedWorkerNo: 'W0033',
        }),
    });

    await scan(user, PARENT);

    expect(await screen.findByText(t.notice.alreadyTitle)).toBeTruthy();
    expect(screen.getByText(t.notice.already('11-20 09:40', 'W0033'))).toBeTruthy();
    expect(sent).toHaveLength(0);
  });

  it('US3-5 다른 PDA 가 먼저 확인했으면(409 ALREADY_CONFIRMED) 「이미 확인된 분리입니다」', async () => {
    const user = userEvent.setup();
    mount({
      confirm: () =>
        jsonResponse(
          { code: 'ALREADY_CONFIRMED', message: '이미', conflictCause: 'user' },
          { status: 409 },
        ),
    });

    await scan(user, CHILD);
    await screen.findByText(t.notice.needParentTitle);
    await scan(user, PARENT);

    expect(await screen.findByText(t.notice.alreadyTitle)).toBeTruthy();
    expect(screen.getByText(t.notice.alreadyNoDetail)).toBeTruthy();
  });

  it('US3-6 · Q16 ⑥ 분리 이력이 없는 LOT → 「확인할 분리가 없습니다」', async () => {
    const user = userEvent.setup();
    mount({ find: () => null });

    await scan(user, 'SYN-PL-NOSPLIT');

    expect(await screen.findByText(t.notice.noneTitle)).toBeTruthy();
    expect(screen.getByText(t.notice.none('SYN-PL-NOSPLIT'))).toBeTruthy();
  });

  it('⑦ 연결이 끊기면 [다시 시도]가 같은 멱등 키로 다시 보낸다', async () => {
    const user = userEvent.setup();
    let fail = true;
    const { sent } = mount({
      confirm: () => {
        if (fail) throw new TypeError('Failed to fetch');
        return jsonResponse({
          ...split(),
          status: 'CONFIRMED',
          confirmedAt: '2026-11-20T02:40:00Z',
        });
      },
    });

    await scan(user, CHILD);
    await screen.findByText(t.notice.needParentTitle);
    await scan(user, PARENT);
    expect(await screen.findByText(t.notice.offlineTitle)).toBeTruthy();

    fail = false;
    await user.click(screen.getByRole('button', { name: t.actions.retry }));

    expect(await screen.findByText(t.notice.doneTitle)).toBeTruthy();
    expect(sent).toHaveLength(2);
    expect(sent[1]?.headers.get('Idempotency-Key')).toBe(sent[0]?.headers.get('Idempotency-Key'));
  });

  it('한 장 스캔 뒤 [처음부터]를 누르면 두 칸이 사라지고 첫 스캔부터 다시 한다', async () => {
    const user = userEvent.setup();
    mount();

    await scan(user, CHILD);
    await screen.findByText(t.notice.needParentTitle);
    await user.click(screen.getByRole('button', { name: t.actions.reset }));

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: t.pair.label })).toBeNull();
    });
    expect(screen.getByRole('button', { name: t.actions.exit })).toBeTruthy();
  });

  it('[다른 분리 확인]은 확인한 분리를 비우고 다음 첫 스캔을 받는다', async () => {
    const user = userEvent.setup();
    mount();

    await scan(user, CHILD);
    await screen.findByText(t.notice.needParentTitle);
    await scan(user, PARENT);
    await screen.findByText(t.notice.doneTitle);
    await user.click(screen.getByRole('button', { name: t.actions.next }));

    await waitFor(() => {
      expect(screen.queryByText(t.notice.doneTitle)).toBeNull();
    });
    const pair = screen.queryByRole('region', { name: t.pair.label });
    expect(pair === null ? null : within(pair).queryAllByRole('listitem')).toBeNull();
  });
});
