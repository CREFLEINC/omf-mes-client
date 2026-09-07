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
import { PackingRepackScreen } from './screen';

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

const CARTON = 'CTN-2026-0091';
const OTHER = 'CTN-2026-0092';

const unit = (handlingUnitId: number, handlingUnitNo: string) => ({
  handlingUnitId,
  handlingUnitNo,
  handlingUnitTypeCode: 'CARTON',
  warehouseId: 5,
  locationId: 7,
  statusCode: 'ACTIVE',
});

const content = (overrides: Record<string, unknown> = {}) => ({
  handlingUnitContentId: 1,
  handlingUnitId: 10,
  itemId: 100,
  lotId: 1000,
  qty: 180,
  uomId: 9,
  ...overrides,
});

interface Options {
  units?: ReturnType<typeof unit>[];
  contents?: Record<number, ReturnType<typeof content>[]>;
  seen?: Request[];
  /** 원 포장 치환만 거부한다. 새 포장 생성은 그대로 성공한다. */
  rejectReplace?: boolean;
  /** 확정 뒤 서버가 답할 내용. 다시 스캔했을 때 이것이 보여야 한다. */
  contentsAfter?: Record<number, ReturnType<typeof content>[]>;
  /** 이미 출하에 배분된 포장의 식별자. */
  allocated?: number[];
  /** 배분 조회가 닿지 않는 상황 - 오프라인에서 이 판정을 할 수 없는 자리다. */
  allocationUnreachable?: boolean;
  /** 배분 조회가 늦게 답하는 상황 - 묻는 중과 확인 못 함이 갈리는 자리다. */
  allocationPending?: boolean;
}

const routes = (options: Options = {}): StubRoute[] => {
  const units = options.units ?? [unit(10, CARTON)];
  const contents = options.contents ?? { 10: [content()] };
  let replaced = false;

  return [
    {
      match: (req) => new URL(req.url).pathname === '/inventory/handling-units',
      respond: (req) => {
        const url = new URL(req.url);

        if (req.method === 'POST') {
          options.seen?.push(req.clone());
          return jsonResponse(
            { handlingUnitId: 99, handlingUnitNo: 'CTN-2026-0100' },
            { status: 201 },
          );
        }

        const q = url.searchParams.get('q');

        return jsonResponse({
          items: units.filter((each) => q === null || each.handlingUnitNo.includes(q)),
          page,
        });
      },
    },
    {
      match: (req) => /\/inventory\/handling-units\/\d+$/.test(new URL(req.url).pathname),
      respond: (req) => {
        const id = Number(new URL(req.url).pathname.split('/').pop());
        const found = units.find((each) => each.handlingUnitId === id);
        const now = replaced ? (options.contentsAfter ?? contents) : contents;

        return jsonResponse({ handlingUnit: found, contents: now[id] ?? [] });
      },
    },
    {
      match: (req) => /\/inventory\/handling-units\/\d+\/contents$/.test(new URL(req.url).pathname),
      respond: (req) => {
        options.seen?.push(req.clone());

        if (options.rejectReplace === true) {
          return jsonResponse(
            { code: 'VALIDATION_FAILED', message: '이 포장은 출하에 배분됐습니다.', errors: [] },
            { status: 400 },
          );
        }

        replaced = true;
        return jsonResponse({ items: [] });
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
          items: [{ itemId: 100, itemCode: 'FG-1001', itemName: '외장 커버', fifoPolicyCode: 'FEFO' }],
          page,
        }),
    },
    {
      match: (req) => new URL(req.url).pathname === '/mdm/uoms',
      respond: () => jsonResponse({ items: [{ uomId: 9, uomCode: 'EA' }], page }),
    },
    {
      match: (req) => new URL(req.url).pathname === '/logistics/shipment-lot-allocations',
      respond: (req) => {
        if (options.allocationPending === true) {
          return new Promise<Response>(() => {
            /* 답하지 않는다. 묻는 중에 화면이 무엇을 말하는지 재는 자리다. */
          });
        }

        if (options.allocationUnreachable === true) {
          return jsonResponse(
            { code: 'SERVICE_UNAVAILABLE', message: '연결할 수 없습니다.', errors: [] },
            { status: 503 },
          );
        }

        const handlingUnitId = Number(new URL(req.url).searchParams.get('handlingUnitId'));

        return jsonResponse({
          items: (options.allocated ?? []).includes(handlingUnitId)
            ? [{ shipmentLotAllocationId: 1, handlingUnitId }]
            : [],
          page,
        });
      },
    },
  ];
};

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
        <PackingRepackScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch(routes(options)) },
  );

const scan = (code: string) => {
  const field = screen.getByLabelText(/포장 스캔|포장 더 스캔/) as HTMLInputElement;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, code);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

beforeEach(() => {
  held.failWrite = null;
  store.clear();
  localStorage.clear();
});

describe('포장 재구성 화면', () => {
  it('스캔한 포장의 내용물을 보인다', async () => {
    mount();
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);

    expect(await screen.findByText(CARTON)).toBeTruthy();

    /*
     * 단위 이름은 포장을 얹은 뒤에 따로 온다. 도착을 기다린다.
     *
     * 두 곳에 나온다 - 원 포장 카드와 남는 것 카드다. 아직 아무것도 옮기지 않았으니 전량이
     * 남는 것이 맞다.
     */
    expect(await screen.findAllByText(/FG-1001 · FLOT-2026-01000 · 180 EA/)).toHaveLength(2);
  });

  /* 부분 검색으로 물으므로 돌아온 줄을 다시 확인하지 않으면 비슷한 번호를 이 포장으로 읽는다. */
  it('번호가 정확히 같은 포장만 고른다', async () => {
    mount({ units: [unit(11, OTHER)] });
    await screen.findByLabelText('포장 스캔');

    scan('CTN-2026-009');

    expect(await screen.findByText(/CTN-2026-009 포장을 찾지 못했습니다/)).toBeTruthy();
  });

  /* 같은 포장을 두 번 세면 물건이 두 배로 있는 것처럼 보인다. */
  it('같은 포장을 두 번 얹지 않는다', async () => {
    mount();
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);
    await screen.findByText(CARTON);
    scan(CARTON);

    expect(await screen.findByText('이미 고른 포장입니다')).toBeTruthy();
    expect(screen.getAllByText(CARTON)).toHaveLength(1);
  });

  /*
   * 재구성하면 출하 배분이 가리키던 물건이 사라지고 되돌릴 길이 없다 - 새 포장은 이미
   * 만들어진 뒤라 치환이 거부돼도 원 포장이 그대로 남는다.
   */
  it('이미 출하에 배분된 포장이면 그 사실을 말하고 확정을 막는다', async () => {
    const user = userEvent.setup();
    mount({ allocated: [10] });
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);
    await screen.findByText(CARTON);

    expect(
      await screen.findByText(`${CARTON} 은(는) 이미 출하에 배분된 포장입니다`),
    ).toBeTruthy();

    await user.click(screen.getByLabelText('분할 — 하나를 여러 개로'));
    await user.type(await screen.findByLabelText(/FLOT-2026-01000 수량/), '80');

    expect(screen.getByRole('button', { name: '재구성 확정' })).toBeDisabled();
  });

  /* 합병은 원 포장이 여럿이다. 뒤쪽만 배분돼 있어도 그 물건이 사라지는 것은 같다. */
  it('합병에서 둘째 포장만 배분돼 있어도 확정을 막는다', async () => {
    const user = userEvent.setup();
    mount({
      units: [unit(10, CARTON), unit(11, OTHER)],
      contents: {
        10: [content({ qty: 80 })],
        11: [content({ handlingUnitContentId: 2, handlingUnitId: 11, lotId: 1001, qty: 60 })],
      },
      allocated: [11],
    });
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);
    await screen.findByText(CARTON);
    scan(OTHER);
    await screen.findByText(OTHER);

    expect(await screen.findByText(`${OTHER} 은(는) 이미 출하에 배분된 포장입니다`)).toBeTruthy();

    await user.click(screen.getByLabelText('합병 — 여러 포장을 하나로'));
    await user.type(await screen.findByLabelText(/FLOT-2026-01000 수량/), '80');

    expect(screen.getByRole('button', { name: '재구성 확정' })).toBeDisabled();
  });

  it('배분되지 않은 포장은 그대로 확정할 수 있다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);
    await screen.findByText(CARTON);
    await user.click(screen.getByLabelText('분할 — 하나를 여러 개로'));
    await user.type(await screen.findByLabelText(/FLOT-2026-01000 수량/), '80');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '재구성 확정' })).not.toBeDisabled();
    });
    expect(screen.queryByText(/이미 출하에 배분된 포장입니다/)).toBeNull();
    expect(screen.queryByText(/출하 배분 여부를 확인하지 못했습니다/)).toBeNull();
  });

  /*
   * 공유계약 C-6 이 판정용 값의 캐시를 막아 오프라인에서는 이 판정을 할 수 없다. 막으면
   * 오프라인 재구성 자체가 죽으므로 막지 않고 말한다 - 안 밝히면 확인된 줄 안다.
   */
  it('배분을 확인하지 못하면 그 사실을 밝히되 막지는 않는다', async () => {
    const user = userEvent.setup();
    mount({ allocationUnreachable: true });
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);
    await screen.findByText(CARTON);

    expect(
      await screen.findByText(`${CARTON} 의 출하 배분 여부를 확인하지 못했습니다`),
    ).toBeTruthy();

    await user.click(screen.getByLabelText('분할 — 하나를 여러 개로'));
    await user.type(await screen.findByLabelText(/FLOT-2026-01000 수량/), '80');

    expect(screen.getByRole('button', { name: '재구성 확정' })).not.toBeDisabled();
  });

  /*
   * 매번 뜨는 경고는 읽히지 않는다. 묻는 중을 확인 못 함으로 세면 스캔마다 깜빡여, 정말
   * 확인하지 못한 회차가 그 사이에 묻힌다.
   */
  it('배분을 묻는 중에는 확인하지 못했다고 말하지 않는다', async () => {
    const user = userEvent.setup();
    mount({ allocationPending: true });
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);
    await screen.findByText(CARTON);
    await user.click(screen.getByLabelText('분할 — 하나를 여러 개로'));
    await user.type(await screen.findByLabelText(/FLOT-2026-01000 수량/), '80');

    expect(screen.queryByText(/출하 배분 여부를 확인하지 못했습니다/)).toBeNull();
    expect(screen.queryByText(/이미 출하에 배분된 포장입니다/)).toBeNull();
    /* 아직 모르는 것을 통과시키면 사전 판정이 없는 것과 같다. */
    expect(screen.getByRole('button', { name: '재구성 확정' })).toBeDisabled();
  });

  it('유형을 고르기 전에는 확정할 수 없다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);
    await screen.findByText(CARTON);
    await user.type(await screen.findByLabelText(/FLOT-2026-01000 수량/), '80');

    expect(screen.getByRole('button', { name: '재구성 확정' })).toBeDisabled();

    await user.click(screen.getByLabelText('분할 — 하나를 여러 개로'));

    expect(screen.getByRole('button', { name: '재구성 확정' })).not.toBeDisabled();
  });

  it('원 포장에 있는 것보다 많이 담지 못한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);
    await screen.findByText(CARTON);
    await user.click(screen.getByLabelText('분할 — 하나를 여러 개로'));
    await user.type(await screen.findByLabelText(/FLOT-2026-01000 수량/), '181');

    expect(await screen.findByText(/원 포장에 있는 180 EA/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '재구성 확정' })).toBeDisabled();
  });

  /* 안 적으면 작업자가 잔량 라벨도 새로 뽑으려 한다. */
  it('분할 잔량이 원 포장 번호를 그대로 쓴다고 적는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);
    await screen.findByText(CARTON);
    await user.type(await screen.findByLabelText(/FLOT-2026-01000 수량/), '80');

    expect(
      await screen.findByText(`${CARTON} — 분할 잔량은 원 포장 번호를 그대로 씁니다`),
    ).toBeTruthy();
    expect(screen.getByText(/FG-1001 · FLOT-2026-01000 · 100 EA/)).toBeTruthy();
  });

  it('전량을 옮기면 원 포장이 비워진다고 적는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);
    await screen.findByText(CARTON);
    await user.type(await screen.findByLabelText(/FLOT-2026-01000 수량/), '180');

    expect(await screen.findByText('원 포장이 비워집니다')).toBeTruthy();
  });

  /* 조용히 합치면 어느 포장에서 얼마가 왔는지 못 본다. */
  it('같은 LOT 이 두 포장에서 만나면 합쳤다고 말한다', async () => {
    mount({
      units: [unit(10, CARTON), unit(11, OTHER)],
      contents: {
        10: [content({ qty: 80 })],
        11: [content({ handlingUnitContentId: 2, handlingUnitId: 11, qty: 60 })],
      },
    });
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);
    await screen.findByText(CARTON);
    scan(OTHER);
    await screen.findByText(OTHER);

    expect(await screen.findByText(/80 에 60 을\(를\) 더해 140 EA 이\(가\) 됩니다/)).toBeTruthy();
  });

  /* 발번과 인쇄는 POP 이 한다. 여기서 기다리게 두면 오지 않는 것을 기다린다. */
  it('라벨은 POP 에서 뽑는다고 적는다', async () => {
    mount();
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);

    expect(
      await screen.findByText('라벨 발행은 POP 에서 합니다. 이 화면은 구성만 바꿉니다.'),
    ).toBeTruthy();
  });

  it('확정하면 새 포장과 원 포장 치환을 함께 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);
    await screen.findByText(CARTON);
    await user.click(screen.getByLabelText('분할 — 하나를 여러 개로'));
    await user.type(await screen.findByLabelText(/FLOT-2026-01000 수량/), '80');
    await user.click(screen.getByRole('button', { name: '재구성 확정' }));

    expect(await screen.findByText('재구성을 기록했습니다')).toBeTruthy();

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });

    const created = (await seen[0]!.json()) as { contents: { qty: number }[] };
    const replaced = (await seen[1]!.json()) as { items: { qty: number }[] };

    expect(seen[0]!.method).toBe('POST');
    expect(created.contents[0]?.qty).toBe(80);
    expect(seen[1]!.method).toBe('PUT');
    expect(replaced.items[0]?.qty).toBe(100);
  });

  /*
   * 새 포장 하나만 보면 원 포장 치환이 거부돼도 성공으로 보인다. 그때 새 포장은 이미
   * 만들어졌고 원 포장은 그대로라 같은 물건이 두 곳에 있게 된다 - 되돌리기 경로가 없다.
   */
  it('원 포장 치환이 거부되면 성공으로 보이지 않는다', async () => {
    const user = userEvent.setup();
    mount({ rejectReplace: true });
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);
    await screen.findByText(CARTON);
    await user.click(screen.getByLabelText('분할 — 하나를 여러 개로'));
    await user.type(await screen.findByLabelText(/FLOT-2026-01000 수량/), '80');
    await user.click(screen.getByRole('button', { name: '재구성 확정' }));

    expect(await screen.findByText('재구성이 되돌아왔습니다')).toBeTruthy();
    expect(screen.queryByText('재구성을 기록했습니다')).toBeNull();
  });

  /*
   * 구성 치환은 집합을 통째로 갈아 끼운다. 옛 수량으로 계산한 잔량이 실재를 덮으면 물건이
   * 조용히 사라진다.
   */
  it('확정한 포장을 다시 스캔하면 바뀐 수량을 보인다', async () => {
    const user = userEvent.setup();
    mount({
      contents: { 10: [content({ qty: 180 })] },
      contentsAfter: { 10: [content({ qty: 100 })] },
    });
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);
    await screen.findByText(CARTON);
    await user.click(screen.getByLabelText('분할 — 하나를 여러 개로'));
    await user.type(await screen.findByLabelText(/FLOT-2026-01000 수량/), '80');
    await user.click(screen.getByRole('button', { name: '재구성 확정' }));
    await screen.findByText('재구성을 기록했습니다');

    await user.click(screen.getByRole('button', { name: '다음 재구성' }));
    await screen.findByLabelText('포장 스캔');
    scan(CARTON);

    expect(await screen.findByText(/원 포장 합 100 EA/)).toBeTruthy();
  });

  it('쓰기에 사번을 싣는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);
    await screen.findByText(CARTON);
    await user.click(screen.getByLabelText('분할 — 하나를 여러 개로'));
    await user.type(await screen.findByLabelText(/FLOT-2026-01000 수량/), '80');
    await user.click(screen.getByRole('button', { name: '재구성 확정' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });

    expect(seen[0]!.headers.get('X-Worker-No')).toBe('900028');
    expect(seen[0]!.headers.get('Idempotency-Key')).toBeTruthy();
  });
  /*
   * 장갑 낀 손은 한 번 더 누른다. 상태로 잠그면 다시 그리기 전의 연타를 놓쳐, 멱등키가 다른
   * 묶음이 하나 더 담기고 같은 물건이 두 번 재구성된다 - 되돌리기 경로가 없다.
   */
  it('같은 틱에 확정을 세 번 눌러도 한 묶음만 나간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);
    await screen.findByText(CARTON);
    await user.click(screen.getByLabelText('분할 — 하나를 여러 개로'));
    await user.type(await screen.findByLabelText(/FLOT-2026-01000 수량/), '80');

    const button = screen.getByRole('button', { name: '재구성 확정' });

    button.click();
    button.click();
    button.click();

    await screen.findByText('재구성을 기록했습니다');
    expect(seen).toHaveLength(2);
  });

  /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 재구성된 줄 안다. */
  it('담아 두지 못하면 기록되지 않았다고 말한다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await screen.findByLabelText('포장 스캔');

    scan(CARTON);
    await screen.findByText(CARTON);
    await user.click(screen.getByLabelText('분할 — 하나를 여러 개로'));
    await user.type(await screen.findByLabelText(/FLOT-2026-01000 수량/), '80');

    held.failWrite = 'outbox';
    await user.click(screen.getByRole('button', { name: '재구성 확정' }));

    expect(await screen.findByText('재구성을 담아 두지 못했습니다')).toBeTruthy();
    expect(screen.queryByText('재구성을 기록했습니다')).toBeNull();
    expect(seen).toHaveLength(0);
  });
});
