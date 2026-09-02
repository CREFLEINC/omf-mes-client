import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { useWorkerSession } from '../../patterns/worker-session';
import { IqcSkipRequestScreen } from './screen';

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

const LOT_NO = '00000000000000000000000000000014';

const lot = (statusCode = 'INSPECTION_PENDING') => ({
  lotId: 7,
  lotNo: LOT_NO,
  itemId: 3,
  lotTypeCode: 'MATERIAL',
  plantId: 1,
  initialQty: 500,
  uomId: 2,
  sourceTypeCode: 'INBOUND_RECEIPT_LINE',
  sourceId: 11,
  statusCode,
  held: false,
});

const approval = (overrides: Record<string, unknown> = {}) => ({
  approvalRequestId: 91,
  approvalRequestNo: 'AR-2026-0014',
  approvalTypeCode: 'IQC_SKIP',
  requestedBy: 5,
  requestedByName: '김철수',
  requestedAt: '2026-09-01T00:14:00.000Z',
  statusCode: 'PENDING',
  reason: '라인 정지 임박',
  target: {
    targetTypeCode: 'INBOUND_LOT',
    targetId: 7,
    displayName: `LOT ${LOT_NO}`,
    openable: false,
  },
  currentStepNo: 1,
  totalStepNo: 2,
  isMyTurn: false,
  ...overrides,
});

interface RouteOptions {
  lots?: ReturnType<typeof lot>[];
  pending?: ReturnType<typeof approval>[];
  mine?: ReturnType<typeof approval>[];
  seen?: URL[];
  asked?: Request[];
}

const routes = (options: RouteOptions = {}) => [
  {
    match: (request: Request) => new URL(request.url).pathname === '/trace/lots',
    respond: (request: Request) => {
      options.seen?.push(new URL(request.url));
      const items = options.lots ?? [lot()];
      return jsonResponse({ items, page: { page: 0, size: 20, total: items.length } });
    },
  },
  {
    match: (request: Request) => new URL(request.url).pathname === '/mdm/items/3',
    respond: () => jsonResponse({ item: { itemId: 3, itemCode: 'ABC-100', itemName: 'PP 수지' } }),
  },
  {
    match: (request: Request) => new URL(request.url).pathname === '/mdm/uoms',
    respond: () =>
      jsonResponse({
        items: [{ uomId: 2, uomCode: 'kg', uomName: '킬로그램', isActive: true }],
        page: { page: 0, size: 200, total: 1 },
      }),
  },
  {
    match: (request: Request) =>
      new URL(request.url).pathname === '/app/approval-requests' && request.method === 'GET',
    respond: (request: Request) => {
      const url = new URL(request.url);
      options.seen?.push(url);
      options.asked?.push(request.clone());
      const items =
        url.searchParams.get('pendingOnly') === 'true'
          ? (options.pending ?? [])
          : (options.mine ?? []);
      return jsonResponse({ items, page: { page: 0, size: 20, total: items.length } });
    },
  },
];

/* 사번 없이는 요청할 수 없다 - 화면을 세우려면 먼저 세워 둔다. */
const SignedIn = ({ children }: { children: React.ReactNode }) => {
  const { worker, signIn } = useWorkerSession();

  useEffect(() => {
    if (worker === null) {
      signIn({ workerNo: '900028', workerName: '김철수' });
    }
  }, [signIn, worker]);

  return worker === null ? null : children;
};

const mount = (extra: ReturnType<typeof routes> = [], options: RouteOptions = {}) =>
  renderWithProviders(
    <MemoryRouter>
      <SignedIn>
        <IqcSkipRequestScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch([...extra, ...routes(options)]) },
  );

const scan = (code: string) => {
  const field = screen.getByLabelText('입하 LOT 스캔') as HTMLInputElement;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, code);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

const createRoute = (respond: (request: Request) => Response) => ({
  match: (request: Request) =>
    new URL(request.url).pathname === '/trace/lots/7:request-iqc-skip' && request.method === 'POST',
  respond,
});

beforeEach(() => {
  store.clear();
});

describe('긴급 IQC 생략 요청 화면', () => {
  /* 이름이 긴급이라 누르면 되는 것으로 읽힌다. 무엇이 아직 안 되는지를 먼저 말한다. */
  it('지금 바로 투입되지 않는다고 먼저 말한다', async () => {
    mount();

    expect(
      await screen.findByText('권한자 승인 후에 쓸 수 있습니다. 지금 바로 투입되지 않습니다.'),
    ).toBeInTheDocument();
  });

  it('스캔한 LOT의 품목과 수량을 되보인다', async () => {
    mount();
    await screen.findByLabelText('입하 LOT 스캔');

    scan(LOT_NO);

    expect(await screen.findByText('ABC-100 PP 수지')).toBeInTheDocument();
    expect(screen.getByText('500 kg')).toBeInTheDocument();
    expect(screen.getByText('수입검사 대기 중')).toBeInTheDocument();
  });

  it('사유를 적기 전에는 요청할 수 없다', async () => {
    mount();
    await screen.findByLabelText('입하 LOT 스캔');

    scan(LOT_NO);
    await screen.findByText('수입검사 대기 중');

    expect(screen.getByRole('button', { name: '요청' })).toBeDisabled();
  });

  /* 검사가 끝난 자재는 생략할 것이 없다. */
  it('검사 대기가 아닌 LOT은 사유를 적어도 요청할 수 없다', async () => {
    const user = userEvent.setup();
    mount([], { lots: [lot('NORMAL')] });
    await screen.findByLabelText('입하 LOT 스캔');

    scan(LOT_NO);
    expect(await screen.findByText('이미 검사가 끝난 자재입니다')).toBeInTheDocument();

    await user.type(screen.getByLabelText('사유'), '라인 정지 임박');

    expect(screen.getByRole('button', { name: '요청' })).toBeDisabled();
  });

  it('LOT을 찾지 못하면 그렇게 말한다', async () => {
    mount([], { lots: [] });
    await screen.findByLabelText('입하 LOT 스캔');

    scan(LOT_NO);

    expect(await screen.findByText(`${LOT_NO} LOT을 찾지 못했습니다`)).toBeInTheDocument();
  });

  /* 취소가 없어 다시 올리는 것이 유일한 정정 경로다. 막으면 그 길까지 닫힌다. */
  it('이미 올라간 요청이 있으면 알리되 막지 않는다', async () => {
    const user = userEvent.setup();
    mount([], { pending: [approval()] });
    await screen.findByLabelText('입하 LOT 스캔');

    scan(LOT_NO);
    await screen.findByText('수입검사 대기 중');
    await user.type(screen.getByLabelText('사유'), '라인 정지 임박');

    expect(await screen.findByText(/이미 요청이 올라가 있습니다/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '요청' })).toBeEnabled();
  });

  it('계약 경로로 사유만 보낸다', async () => {
    const user = userEvent.setup();
    const seen: URL[] = [];
    const sent: Request[] = [];
    mount(
      [
        createRoute((request) => {
          seen.push(new URL(request.url));
          sent.push(request.clone());
          return jsonResponse({ approvalRequestId: 91 }, { status: 202 });
        }),
      ],
      {},
    );
    await screen.findByLabelText('입하 LOT 스캔');

    scan(LOT_NO);
    await screen.findByText('수입검사 대기 중');
    await user.type(screen.getByLabelText('사유'), '라인 정지 임박');
    await user.click(screen.getByRole('button', { name: '요청' }));

    expect(await screen.findByText('요청했습니다')).toBeInTheDocument();
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(await sent[0]!.json()).toEqual({ reason: '라인 정지 임박' });
    expect(seen[0]?.pathname).toBe('/trace/lots/7:request-iqc-skip');
  });

  /* 담긴 것을 요청됨으로 보이면 기다리면 된다고 믿는 동안 아무에게도 가 있지 않다. */
  it('보내지 못하면 담아 두었다고만 말하고 유선을 함께 권한다', async () => {
    const user = userEvent.setup();
    mount([
      createRoute(() => {
        throw new TypeError('Failed to fetch');
      }),
    ]);
    await screen.findByLabelText('입하 LOT 스캔');

    scan(LOT_NO);
    await screen.findByText('수입검사 대기 중');
    await user.type(screen.getByLabelText('사유'), '라인 정지 임박');
    await user.click(screen.getByRole('button', { name: '요청' }));

    expect(await screen.findByText('요청을 담아 두었습니다')).toBeInTheDocument();
    expect(screen.getByText(/급하면 유선으로 함께 알리세요/)).toBeInTheDocument();
    expect(screen.queryByText('요청했습니다')).not.toBeInTheDocument();
  });

  /* 결재선이 없으면 사유를 고쳐 다시 올려도 같은 자리에서 되돌아온다. */
  it('결재선이 없으면 그 사유를 그대로 말한다', async () => {
    const user = userEvent.setup();
    mount([
      createRoute(() =>
        jsonResponse(
          {
            errors: [{ scope: 'screen', code: 'ROUTE_NOT_FOUND', message: '결재선이 없습니다' }],
          },
          { status: 400 },
        ),
      ),
    ]);
    await screen.findByLabelText('입하 LOT 스캔');

    scan(LOT_NO);
    await screen.findByText('수입검사 대기 중');
    await user.type(screen.getByLabelText('사유'), '라인 정지 임박');
    await user.click(screen.getByRole('button', { name: '요청' }));

    expect(await screen.findByText('요청이 되돌아왔습니다')).toBeInTheDocument();
    expect(
      screen.getByText('결재선이 없어 요청할 수 없습니다. 전산담당에게 문의하세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('요청을 담아 두었습니다')).not.toBeInTheDocument();
  });

  /* 누가 올린 요청인지 없이 기록을 남길 수 없다 - 계약이 사번 없는 쓰기를 받지 않는다. */
  it('사번을 확인하기 전에는 다 채워도 요청할 수 없고 이유를 말한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <IqcSkipRequestScreen />
      </MemoryRouter>,
      { fetch: createStubFetch(routes()) },
    );
    await screen.findByLabelText('입하 LOT 스캔');

    scan(LOT_NO);
    await screen.findByText('수입검사 대기 중');
    await user.type(screen.getByLabelText('사유'), '라인 정지 임박');

    expect(screen.getByText('사번을 확인해야 요청할 수 있습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '요청' })).toBeDisabled();
  });

  /* 다형 참조라 번호만으로 물으면 남의 표의 요청을 이 LOT 의 것으로 읽는다. */
  it('대기 요청을 대상 유형과 함께 묻는다', async () => {
    const seen: URL[] = [];
    mount([], { seen });
    await screen.findByLabelText('입하 LOT 스캔');

    scan(LOT_NO);
    await screen.findByText('수입검사 대기 중');

    await waitFor(() => {
      expect(seen.some((url) => url.searchParams.get('pendingOnly') === 'true')).toBe(true);
    });
    const asked = seen.find((url) => url.searchParams.get('pendingOnly') === 'true');
    expect(asked?.searchParams.get('targetTypeCode')).toBe('INBOUND_LOT');
    expect(asked?.searchParams.get('targetId')).toBe('7');
  });

  /*
   * 이 셸에는 계정 로그인이 없어 서버가 상신자를 풀 근거가 사번뿐이다. 한 단말을 여러
   * 사람이 교대로 쓰므로 없이 부르면 남이 올린 요청이 섞이고, 목록이 비는 것이 아니라
   * 채워진 채로 틀려 화면으로는 보이지 않는다.
   */
  it('내가 올린 요청을 물을 때 사번을 싣는다', async () => {
    const asked: Request[] = [];
    mount([], { mine: [approval()], asked });

    await screen.findByLabelText('입하 LOT 스캔');

    await waitFor(() => {
      expect(
        asked.some((request) => new URL(request.url).searchParams.get('requestedByMe') === 'true'),
      ).toBe(true);
    });

    const mineRequest = asked.find(
      (request) => new URL(request.url).searchParams.get('requestedByMe') === 'true',
    );

    expect(mineRequest?.headers.get('X-Worker-No')).toBe('900028');
  });

  it('내가 올린 요청을 상태와 함께 보인다', async () => {
    mount([], { mine: [approval()] });

    expect(await screen.findByText(`LOT ${LOT_NO}`)).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('올린 요청이 없으면 없다고 말한다', async () => {
    mount([], { mine: [] });

    expect(await screen.findByText('올린 요청이 없습니다.')).toBeInTheDocument();
  });
});
