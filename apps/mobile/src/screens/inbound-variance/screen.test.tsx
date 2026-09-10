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
import { runBackStep } from '../../patterns/back-step';
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
            ? [
                codeValue('SHORTAGE', '수량 부족', 1),
                codeValue('ITEM_MISMATCH', '품목 상이', 2),
                codeValue('UNREGISTERED_ITEM', '미등록 품목', 3),
              ]
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

const openReceipt = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('combobox', { name: '입하 고르기' }));
  await user.click(await screen.findByRole('option', { name: 'IB-2026-0002' }));
};

const fill = async (user: ReturnType<typeof userEvent.setup>, qty: string) => {
  await user.click(screen.getByRole('radio', { name: '수량 부족' }));
  await user.type(screen.getByLabelText(/대상 수량/), qty);
};

beforeEach(() => {
  held.failWrite = null;
  store.clear();
  localStorage.clear();
});

describe('입하 오류 등록 화면', () => {
  /*
   * 단추 안에 값을 넣으면 단추 글자 규격을 따라가 줄 번호와 수치가 같은 무게로 보인다.
   * 카드로 세워 제목과 부가를 갈라 둔다.
   */
  it('입하 라인을 카드로 세워 제목과 수치를 가른다', async () => {
    const user = userEvent.setup();
    mount();
    await openReceipt(user);

    const pick = await screen.findByRole('button', { name: /1번 줄/ });

    expect(pick.querySelector('strong')?.textContent).toBe('1번 줄');
    expect(pick.querySelector('p')?.textContent).toContain('실입하');
  });

  /* 확인하지 못한 것을 입하가 없는 것으로 말하지 않는다. */
  it('입하 조회 실패를 입하 없음으로 말하지 않는다', async () => {
    mount([], { receiptsStatus: 500 });

    expect(await screen.findByText('입하를 확인할 수 없습니다. 연결을 확인하세요.')).toBeTruthy();
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
          varianceTypeCode: 'SHORTAGE',
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

    expect(screen.getByText('예정 수량이 없어 차이를 비교하지 못합니다')).toBeTruthy();
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

    const body = (await seen[0]!.json()) as {
      varianceTypeCode: string;
      varianceQty: number;
      reasonCode: unknown;
    };

    expect(body.varianceTypeCode).toBe('SHORTAGE');
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

    expect(await screen.findByText('오류를 저장하지 못했습니다')).toBeTruthy();
    expect(screen.queryByText('입하 오류를 등록했습니다')).toBeNull();
    expect(seen).toHaveLength(0);
  });

  /* 세 값 고정 그룹이다. 펼침 목록은 열고 고르고 닫는 세 동작이라 장갑 낀 손에 불리하다. */
  it('오류 유형을 한 번에 고르는 라디오로 보인다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseLine(user);

    expect(await screen.findByRole('radio', { name: '수량 부족' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '품목 상이' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '미등록 품목' })).toBeTruthy();
  });

  /* 뒤로가기는 고른 라인을 먼저 놓는다. 두지 않으면 한 번에 작업 목록까지 나간다. */
  it('뒤로가기가 고른 라인을 먼저 놓는다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseLine(user);

    expect(runBackStep()).toBe(true);

    await waitFor(() => {
      expect(screen.queryByRole('radio', { name: '수량 부족' })).toBeNull();
    });
  });
});
