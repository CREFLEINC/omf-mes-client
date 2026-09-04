import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { useWorkerSession } from '../../patterns/worker-session';
import { InboundVarianceScreen } from './screen';

const store = vi.hoisted(() => new Map<string, string>());
/** 단말 보관소가 거절하는 상황을 만든다. 담기지 못한 것을 화면이 말하는지 보기 위해서다. */
const held = vi.hoisted(() => ({ failWrite: null as string | null }));

vi.mock('../../patterns/local-store', () => ({
  readLocal: (key: string) => Promise.resolve(store.get(key) ?? null),
  writeLocal: (key: string, value: string) => {
    if (held.failWrite === key) {
      return Promise.reject(new Error('보관소가 가득 찼습니다'));
    }

    store.set(key, value);
    return Promise.resolve();
  },
  removeLocal: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

const page = { page: 0, size: 20, totalElements: 0, totalPages: 1 };

const receipt = {
  inboundReceiptId: 8,
  inboundReceiptNo: 'IB-2026-0002',
  supplierId: 2,
  plantId: 1,
  receiptDatetime: '2026-09-02T09:12:00+09:00',
  statusCode: 'RECEIVED',
};

const line = (overrides: Record<string, unknown> = {}) => ({
  inboundReceiptLineId: 55,
  inboundReceiptId: 8,
  lineNo: 1,
  purchaseOrderLineId: 41,
  itemId: 31,
  receivedQty: 480,
  uomId: 9,
  supplierLotMissing: false,
  inspectionRequired: true,
  statusCode: 'RECEIVED',
  ...overrides,
});

const codeValue = (code: string, name: string, order: number) => ({
  codeValueId: order,
  codeGroupId: 5,
  code,
  codeName: name,
  displayOrder: order,
  isActive: true,
});

interface Options {
  receipts?: unknown[];
  lines?: unknown[];
  known?: unknown[];
  receiptsStatus?: number;
}

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/logistics/inbound-receipts',
    respond: () =>
      options.receiptsStatus === undefined
        ? jsonResponse({ items: options.receipts ?? [receipt], page })
        : jsonResponse({ message: '실패' }, { status: options.receiptsStatus }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/logistics/inbound-receipts/8/lines',
    respond: () => jsonResponse({ items: options.lines ?? [line()] }),
  },
  {
    match: (req) =>
      new URL(req.url).pathname === '/logistics/inbound-receipt-lines/55/variances' &&
      req.method === 'GET',
    respond: () => jsonResponse({ items: options.known ?? [] }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/code-values',
    respond: (req) => {
      const group = new URL(req.url).searchParams.get('codeGroupCode');

      return jsonResponse({
        items:
          group === 'INBOUND_VARIANCE_TYPE'
            ? [codeValue('SHORT', '수량 부족', 1), codeValue('OVER', '수량 초과', 2)]
            : [codeValue('DAMAGED', '파손', 1)],
        page,
      });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/items/31',
    respond: () =>
      jsonResponse({ item: { itemCode: 'ABC-123', itemName: '원자재', fifoPolicyCode: 'FIFO' } }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/uoms',
    respond: () => jsonResponse({ items: [{ uomId: 9, uomCode: 'EA' }], page }),
  },
];

const SignedIn = ({ children }: { children: ReactNode }) => {
  const { worker, signIn } = useWorkerSession();

  useEffect(() => {
    if (worker === null) {
      signIn({ workerNo: '900028', workerName: '김철수' });
    }
  }, [signIn, worker]);

  return worker === null ? null : children;
};

const mount = (extra: StubRoute[] = [], options: Options = {}) =>
  renderWithProviders(
    <MemoryRouter>
      <SignedIn>
        <InboundVarianceScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch([...extra, ...routes(options)]) },
  );

const chooseLine = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('combobox', { name: '입하 고르기' }));
  await user.click(await screen.findByRole('option', { name: 'IB-2026-0002' }));
  await user.click(await screen.findByRole('button', { name: /1번 줄/ }));
  await screen.findByText('ABC-123 원자재');
};

const fill = async (user: ReturnType<typeof userEvent.setup>, qty: string) => {
  await user.click(screen.getByRole('combobox', { name: '오류 유형' }));
  await user.click(await screen.findByRole('option', { name: '수량 부족' }));
  await user.type(screen.getByLabelText('대상 수량'), qty);
};

beforeEach(() => {
  held.failWrite = null;
  store.clear();
  localStorage.clear();
});

describe('입하 오류 등록 화면', () => {
  /* 확인하지 못한 것을 입하가 없는 것으로 말하지 않는다. */
  it('입하 조회 실패를 입하 없음으로 말하지 않는다', async () => {
    mount([], { receiptsStatus: 500 });

    expect(
      await screen.findByText('입하를 확인할 수 없습니다. 연결을 확인하세요.'),
    ).toBeTruthy();
    expect(screen.queryByText('입하를 찾지 못했습니다')).toBeNull();
  });

  it('입하와 줄을 고르면 품목과 실입하 수량을 보인다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseLine(user);

    expect(screen.getByText('고른 줄 1번 · 실입하 480 EA')).toBeTruthy();
  });

  /* 수정도 삭제도 없다. 무엇이 이미 적혀 있는지 보이지 않으면 같은 것을 두 번 적는다. */
  it('이 줄에 이미 적힌 오류를 보인다', async () => {
    const user = userEvent.setup();
    mount([], {
      known: [
        {
          inboundVarianceId: 3,
          inboundReceiptLineId: 55,
          varianceTypeCode: 'SHORT',
          varianceQty: 20,
          uomId: 9,
        },
      ],
    });
    await chooseLine(user);

    expect(await screen.findByText('수량 부족 20 EA')).toBeTruthy();
  });

  /* 예정 수량이 이 화면에 오지 않아 차이와 견주지 못한다. 못 하는 것을 감추지 않는다. */
  it('차이와 견주지 못한다는 것을 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseLine(user);

    expect(
      screen.getByText('예정 수량이 이 화면에 오지 않아 차이와 견주지 못합니다'),
    ).toBeTruthy();
  });

  it('대상 수량이 0 이하면 등록을 막는다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseLine(user);
    await fill(user, '0');

    expect(await screen.findByText('대상 수량은 0보다 커야 합니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '오류 등록' }).hasAttribute('disabled')).toBe(true);
  });

  /* 사유를 모를 때 기록 자체가 막히면 안 된다. */
  it('사유를 비워도 등록할 수 있다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseLine(user);
    await fill(user, '20');

    expect(screen.getByText('사유는 비워도 됩니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '오류 등록' }).hasAttribute('disabled')).toBe(false);
  });

  /* 수정도 삭제도 없다. 누르기 전에 그 사실을 묻는다. */
  it('등록을 누르면 고칠 수 없다는 것을 먼저 묻는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/inbound-receipt-lines/55/variances' &&
          req.method === 'POST',
        respond: (req) => {
          seen.push(req.clone());
          return jsonResponse({ inboundVarianceId: 9 }, { status: 201 });
        },
      },
    ]);
    await chooseLine(user);
    await fill(user, '20');

    await user.click(screen.getByRole('button', { name: '오류 등록' }));

    expect(await screen.findByText('등록하면 고칠 수 없습니다')).toBeTruthy();
    expect(seen).toHaveLength(0);
  });

  it('돌아가기를 누르면 보내지 않는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/inbound-receipt-lines/55/variances' &&
          req.method === 'POST',
        respond: (req) => {
          seen.push(req.clone());
          return jsonResponse({ inboundVarianceId: 9 }, { status: 201 });
        },
      },
    ]);
    await chooseLine(user);
    await fill(user, '20');

    await user.click(screen.getByRole('button', { name: '오류 등록' }));
    await user.click(await screen.findByRole('button', { name: '돌아가기' }));

    expect(seen).toHaveLength(0);
  });

  /* 사번은 인증이 아니라 귀속이다. 없으면 서버가 요청 자체를 받지 않는다. */
  it('확인하면 유형과 수량을 줄 경로로 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/inbound-receipt-lines/55/variances' &&
          req.method === 'POST',
        respond: (req) => {
          seen.push(req.clone());
          return jsonResponse({ inboundVarianceId: 9 }, { status: 201 });
        },
      },
    ]);
    await chooseLine(user);
    await fill(user, '20');

    await user.click(screen.getByRole('button', { name: '오류 등록' }));
    await user.click(await screen.findByRole('button', { name: '등록합니다' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(seen[0]?.headers.get('X-Worker-No')).toBe('900028');
    expect(seen[0]?.headers.get('Idempotency-Key')).toBeTruthy();

    
    const body = (await seen[0]!.json()) as { varianceTypeCode: string; varianceQty: number; reasonCode: unknown };

    expect(body.varianceTypeCode).toBe('SHORT');
    expect(body.varianceQty).toBe(20);
    expect(body.reasonCode).toBeNull();
    expect(await screen.findByText('입하 오류를 등록했습니다')).toBeTruthy();
  });

  /* 반품이냐 폐기냐는 이 화면이 정하지 않는다. */
  it('등록 뒤에 반품과 폐기를 여기서 정하지 않는다고 말한다', async () => {
    const user = userEvent.setup();
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/inbound-receipt-lines/55/variances' &&
          req.method === 'POST',
        respond: () => jsonResponse({ inboundVarianceId: 9 }, { status: 201 }),
      },
    ]);
    await chooseLine(user);
    await fill(user, '20');

    await user.click(screen.getByRole('button', { name: '오류 등록' }));
    await user.click(await screen.findByRole('button', { name: '등록합니다' }));

    expect(
      await screen.findByText(
        '담당자 확인을 기다립니다. 반품과 폐기는 이 화면에서 정하지 않습니다.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /반품|폐기/ })).toBeNull();
  });
  const varianceRoute = (seen: Request[]): StubRoute => ({
    match: (req) =>
      new URL(req.url).pathname === '/logistics/inbound-receipt-lines/55/variances' &&
      req.method === 'POST',
    respond: (req) => {
      seen.push(req.clone());
      return jsonResponse({ inboundVarianceId: 9 }, { status: 201 });
    },
  });

  /*
   * 확인 대화의 단추도 상태로 닫힌다. 같은 틱에 두 번 누르면 닫히기 전에 두 번째가 들어와,
   * 멱등키가 다른 두 건이 담기고 같은 입하 오류가 두 번 기록된다.
   */
  it('같은 틱에 등록합니다를 세 번 눌러도 한 건만 나간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([varianceRoute(seen)]);
    await chooseLine(user);
    await fill(user, '20');

    await user.click(screen.getByRole('button', { name: '오류 등록' }));

    const button = await screen.findByRole('button', { name: '등록합니다' });

    button.click();
    button.click();
    button.click();

    await screen.findByText('입하 오류를 등록했습니다');
    expect(seen).toHaveLength(1);
  });

  /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 등록된 줄 안다. */
  it('담아 두지 못하면 등록되지 않았다고 말한다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([varianceRoute(seen)]);
    await chooseLine(user);
    await fill(user, '20');

    await user.click(screen.getByRole('button', { name: '오류 등록' }));

    held.failWrite = 'outbox';
    await user.click(await screen.findByRole('button', { name: '등록합니다' }));

    expect(await screen.findByText('오류를 담아 두지 못했습니다')).toBeTruthy();
    expect(screen.queryByText('입하 오류를 등록했습니다')).toBeNull();
    expect(seen).toHaveLength(0);
  });
});
