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
import { ShopfloorReceiptScreen } from './screen';

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

const page = { page: 0, size: 200, totalElements: 0, totalPages: 1 };

const ISSUE_NO = 'GI-2026-000402';

interface Options {
  /** 이 출고 전표를 서버가 이미 받았다고 답한다. */
  alreadyReceived?: boolean;
  /** 수령 등록을 서버가 거부한다. */
  rejectReceipt?: boolean;
  /** 보낸 요청을 모은다. 한 건인지는 요청 수가 아니라 멱등키가 하나인지로 잰다. */
  seen?: Request[];
  /** 출고 라인 수량. */
  issueQty?: number;
  /** 이미 받았는지 묻는 조회가 닿지 않는다 - 오프라인에서 이 판정을 할 수 없는 자리다. */
  receivedCheckUnreachable?: boolean;
}

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/logistics/goods-issues',
    respond: () =>
      jsonResponse({
        items: [
          {
            goodsIssueId: 500,
            goodsIssueNo: ISSUE_NO,
            issueTypeCode: 'PRODUCTION',
            sourceDocumentTypeCode: 'PICKING_ORDER',
            sourceDocumentId: 300,
            sourceWarehouseId: 5,
            issuedAt: '2026-09-07T09:00:00+09:00',
            statusCode: 'POSTED',
          },
        ],
        page,
      }),
  },
  {
    match: (req) => /\/logistics\/goods-issues\/\d+\/lines$/.test(new URL(req.url).pathname),
    respond: () =>
      jsonResponse({
        items: [
          {
            goodsIssueLineId: 1,
            goodsIssueId: 500,
            lineNo: 1,
            itemId: 100,
            lotId: 1000,
            issueQty: options.issueQty ?? 500,
            uomId: 9,
          },
        ],
        page,
      }),
  },
  {
    match: (req) => /\/logistics\/picking-orders\/\d+$/.test(new URL(req.url).pathname),
    respond: () =>
      jsonResponse({
        pickingOrder: {
          pickingOrderId: 300,
          pickingOrderNo: 'PK-2026-000300',
          pickingTypeCode: 'MATERIAL',
          sourceDocumentTypeCode: 'MATERIAL_ISSUE_REQUEST',
          sourceDocumentId: 200,
          warehouseId: 5,
          statusCode: 'REGISTERED',
        },
        lines: [],
      }),
  },
  {
    match: (req) => /\/logistics\/material-issue-requests\/\d+$/.test(new URL(req.url).pathname),
    respond: () =>
      jsonResponse({
        materialIssueRequest: {
          materialIssueRequestId: 200,
          issueRequestNo: 'MR-2026-000200',
          workOrderId: 700,
          destinationLocationId: 42,
          requiredAt: '2026-09-07T08:00:00+09:00',
          statusCode: 'REGISTERED',
          requestedBy: 900028,
        },
        lines: [],
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/logistics/shopfloor-receipts',
    respond: (req) => {
      if (req.method === 'POST') {
        options.seen?.push(req.clone());

        if (options.rejectReceipt === true) {
          return jsonResponse(
            { code: 'VALIDATION_FAILED', message: '이미 받은 전표입니다.', errors: [] },
            { status: 400 },
          );
        }

        return jsonResponse({ shopfloorReceiptId: 900 }, { status: 201 });
      }

      if (options.receivedCheckUnreachable === true) {
        return jsonResponse(
          { code: 'SERVICE_UNAVAILABLE', message: '연결할 수 없습니다.', errors: [] },
          { status: 503 },
        );
      }

      return jsonResponse({
        items: options.alreadyReceived === true ? [{ shopfloorReceiptId: 900 }] : [],
        page,
      });
    },
  },
  {
    match: (req) => /^\/trace\/lots\/\d+$/.test(new URL(req.url).pathname),
    respond: (req) => {
      const id = Number(new URL(req.url).pathname.split('/').pop());

      return jsonResponse({
        lot: { lotId: id, lotNo: `FLOT-2026-0${String(id)}` },
        externalIdentifiers: [],
        holds: [],
      });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/items',
    respond: () =>
      jsonResponse({
        items: [{ itemId: 100, itemCode: 'RM-1001', itemName: '원자재', fifoPolicyCode: 'FEFO' }],
        page,
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/code-values',
    respond: () =>
      jsonResponse({
        items: [
          {
            code: 'TRANSPORT_DAMAGE',
            codeName: 'Transport damage',
            nameKo: '운반 중 파손',
            isActive: true,
            displayOrder: 1,
          },
        ],
        page,
      }),
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

const mount = (options: Options = {}) =>
  renderWithProviders(
    <MemoryRouter>
      <SignedIn>
        <ShopfloorReceiptScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch(routes(options)) },
  );

const scan = (code: string) => {
  const field = screen.getByLabelText('출고 QR 스캔') as HTMLInputElement;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, code);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

const receivedField = () => screen.findByLabelText(/RM-1001 · FLOT-2026-01000 수령 수량/);

beforeEach(() => {
  held.failWrite = null;
  store.clear();
  localStorage.clear();
});

describe('생산창고 입고 화면', () => {
  it('스캔한 출고 전표의 라인을 보인다', async () => {
    mount();
    await screen.findByLabelText('출고 QR 스캔');

    scan(ISSUE_NO);

    expect(await screen.findByText(`${ISSUE_NO} · 1라인`)).toBeTruthy();
    expect(await receivedField()).toBeTruthy();
  });

  /* 초과는 데이터베이스가 막는다. 화면이 통과시키면 확정이 서버에서 되돌아온다. */
  it('출고한 것보다 많이 받지 못한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('출고 QR 스캔');

    scan(ISSUE_NO);
    await user.type(await receivedField(), '501');

    expect(await screen.findByText(/출고한 500 보다 많이 받을 수 없습니다/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '입고 확정' })).toBeDisabled();
  });

  /* 왜 모자란지를 아는 사람은 물건을 받은 그 자리에 있다. */
  it('모자라면 사유를 고르기 전에는 확정할 수 없다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('출고 QR 스캔');

    scan(ISSUE_NO);
    await user.type(await receivedField(), '480');

    expect(await screen.findByText('차이 20 모자람')).toBeTruthy();
    expect(screen.getByRole('button', { name: '입고 확정' })).toBeDisabled();

    await user.click(screen.getByRole('combobox', { name: /차이 사유/ }));
    await user.click(screen.getByRole('option', { name: '운반 중 파손' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '입고 확정' })).not.toBeDisabled();
    });
  });

  it('전량 받으면 사유 없이 확정한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('출고 QR 스캔');

    scan(ISSUE_NO);
    await user.type(await receivedField(), '500');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '입고 확정' })).not.toBeDisabled();
    });
    expect(screen.queryByText('차이 0 모자람')).toBeNull();
  });

  /*
   * 수령 전표는 출고 전표와 1:1 이다. 단말이 기억하는 것으로는 재시작을 넘지 못해, 앱을 다시
   * 켜거나 다른 단말로 같은 전표를 열면 같은 물건을 두 번 받은 것이 된다.
   */
  it('이미 받은 출고 전표로 들어오면 그 사실을 말하고 막는다', async () => {
    mount({ alreadyReceived: true });
    await screen.findByLabelText('출고 QR 스캔');

    scan(ISSUE_NO);

    expect(await screen.findByText('이미 입고된 출고 전표입니다')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '입고 확정' })).toBeNull();
  });

  /*
   * 막지 않는다 - 오프라인 입고 자체가 이 화면이 하는 일이다. 다만 조용히 넘기면 작업자는
   * 확인된 줄 알고 이미 받은 전표를 또 받는다.
   */
  it('이미 받았는지 확인하지 못하면 그 사실을 밝히되 막지는 않는다', async () => {
    const user = userEvent.setup();
    mount({ receivedCheckUnreachable: true });
    await screen.findByLabelText('출고 QR 스캔');

    scan(ISSUE_NO);

    expect(await screen.findByText('이미 받은 전표인지 확인하지 못했습니다')).toBeTruthy();

    await user.type(await receivedField(), '500');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '입고 확정' })).not.toBeDisabled();
    });
  });

  it('확인이 끝나면 확인하지 못했다고 말하지 않는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('출고 QR 스캔');

    scan(ISSUE_NO);
    await user.type(await receivedField(), '500');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '입고 확정' })).not.toBeDisabled();
    });
    expect(screen.queryByText('이미 받은 전표인지 확인하지 못했습니다')).toBeNull();
  });

  it('확정하면 작업지시와 도착 위치를 함께 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await screen.findByLabelText('출고 QR 스캔');

    scan(ISSUE_NO);
    await user.type(await receivedField(), '500');
    await user.click(screen.getByRole('button', { name: '입고 확정' }));

    expect(await screen.findByText('입고를 기록했습니다')).toBeTruthy();

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    const body = (await seen[0]?.json()) as {
      goodsIssueId: number;
      workOrderId: number;
      destinationLocationId: number;
      lines: { receivedQty: number }[];
    };

    expect(body.goodsIssueId).toBe(500);
    expect(body.workOrderId).toBe(700);
    expect(body.destinationLocationId).toBe(42);
    expect(body.lines[0]?.receivedQty).toBe(500);
  });

  /*
   * 연타는 button.click() 을 연속으로 불러야 갈린다. await user.click() 세 번은 클릭 사이에
   * 다시 그리기가 끼어 결함이 있어도 통과한다. 요청 수가 아니라 멱등키가 하나인지로 잰다.
   */
  it('연타해도 한 건만 담는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await screen.findByLabelText('출고 QR 스캔');

    scan(ISSUE_NO);
    await user.type(await receivedField(), '500');

    const button = screen.getByRole('button', { name: '입고 확정' });
    button.click();
    button.click();
    button.click();

    expect(await screen.findByText('입고를 기록했습니다')).toBeTruthy();

    const keys = new Set(seen.map((each) => each.headers.get('Idempotency-Key')));

    expect(keys.size).toBe(1);
  });

  /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 입고된 줄 안다. */
  it('단말 보관소가 거절하면 기록되지 않았다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('출고 QR 스캔');

    scan(ISSUE_NO);
    await user.type(await receivedField(), '500');

    held.failWrite = 'outbox';
    await user.click(screen.getByRole('button', { name: '입고 확정' }));

    expect(await screen.findByText('입고를 담아 두지 못했습니다')).toBeTruthy();
  });

  it('서버가 되돌리면 되돌아왔다고 말한다', async () => {
    const user = userEvent.setup();
    mount({ rejectReceipt: true });
    await screen.findByLabelText('출고 QR 스캔');

    scan(ISSUE_NO);
    await user.type(await receivedField(), '500');
    await user.click(screen.getByRole('button', { name: '입고 확정' }));

    expect(await screen.findByText('입고가 되돌아왔습니다')).toBeTruthy();
  });
});
