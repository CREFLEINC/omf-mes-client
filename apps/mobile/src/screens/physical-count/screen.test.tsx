import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  createTestQueryClient,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { formatMaterialLotNo } from '../../patterns/material-lot-no';
import { runBackStep } from '../../patterns/back-step';
import { itemRoutes } from '../../test/master-routes';
import { useWorkerSession } from '../../patterns/worker-session';
import { PhysicalCountScreen } from './screen';

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

const page = { page: 1, size: 200, total: 1, totalElements: 1, totalPages: 1 };

const COUNT_NO = 'IC-2026-000031';
const LOC_CODE = 'A-01-03';

interface Options {
  /** 장부를 감춘 실사로 답한다 - 서버가 장부 수량을 내려보내지 않는다. */
  blind?: boolean;
  /** 첫 줄을 이미 센 것으로 답한다. */
  firstCounted?: boolean;
  /** 이미 센 첫 줄에 붙어 있는 차이 사유. 서버는 차이가 있는 줄을 사유 없이 받지 않는다. */
  firstReason?: string;
  /** 이 위치에 실사 라인이 없다고 답한다. */
  emptyLocation?: boolean;
  /** 품목·LOT 마스터 조회가 닿지 않는다 - 현장에서 연결이 끊긴 자리다. */
  mastersDown?: boolean;
  /** 아직 안 센 위치가 아홉 곳이다 - 창고 하나의 실사는 위치가 수십 곳이다. */
  manyLocations?: boolean;
  /** 계획 라인이 0 인 실사로 답한다. */
  emptyPlan?: boolean;
  /**
   * 다음 조회부터 둘째 줄이 이미 센 것으로 바뀐다 - 다른 단말이 그 줄을 센 상황이다.
   *
   * 같은 응답을 그대로 돌려주면 조회 캐시가 같은 배열을 그대로 내주어 화면이 다시 세우지
   * 않는다. 덮어쓰는 결함이 있어도 그 자리에서는 드러나지 않는다.
   */
  otherDevice?: { counted: boolean };
  /** 보낸 요청을 모은다. */
  seen?: Request[];
  /**
   * 물어본 주소를 모은다.
   *
   * 응답만 돌려주는 스텁은 조회 축이 빠진 것을 잡지 못한다 - 마감된 실사까지 목록에 서도
   * 스텁이 진행 중인 것만 답하면 시험이 통과한다.
   */
  asked?: string[];
}

/** 라벨에 찍힌 자재 LOT 번호. 화면이 대리키가 아니라 이 값을 보여야 대조할 수 있다. */
const LOT_NO = '0001234500000012002607310001230007';

/** 수량 칸을 찾는 이름. 품목 코드와 LOT 번호가 함께 선다. */
/*
 * 34자리는 나뉘어 적힌다. 붙여 쓰면 실물 라벨과 눈으로 대조할 수 없고, 한 위치에 같은 품목이
 * 여러 줄 서므로 자릿수를 세어 가며 줄을 찾게 된다.
 */
const QTY_LABEL = new RegExp(`ABC-123 · ${formatMaterialLotNo(LOT_NO)} 실물 수량`);
const QTY_REASON = new RegExp(`ABC-123 · ${formatMaterialLotNo(LOT_NO)} 차이 사유`);

const line = (overrides: Record<string, unknown> = {}) => ({
  inventoryCountLineId: 5101,
  inventoryCountId: 5001,
  lineNo: 1,
  locationId: 3001,
  itemId: 2002,
  lotId: 8001,
  systemQty: 120,
  countedQty: 0,
  varianceQty: 0,
  uomId: 1001,
  counted: false,
  countedAt: '2026-09-07T09:00:00+09:00',
  /* 서버가 라인에 실어 보내는 표시용 값. 화면은 이것을 읽고 마스터를 다시 부르지 않는다. */
  itemCode: 'ABC-123',
  itemName: '하우징',
  lotNo: LOT_NO,
  locationCode: LOC_CODE,
  ...overrides,
});

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/inventory/counts',
    respond: (req) => {
      options.asked?.push(req.url);

      return jsonResponse({
        items: [
          {
            inventoryCountId: 5001,
            inventoryCountNo: COUNT_NO,
            countTypeCode: 'PERIODIC',
            warehouseId: 1001,
            plannedDate: '2026-09-07',
            blindCount: options.blind === true,
            statusCode: 'IN_PROGRESS',
          },
        ],
        page,
      });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/locations',
    respond: () =>
      jsonResponse({
        items: [
          {
            locationId: 3001,
            warehouseId: 1001,
            locationCode: LOC_CODE,
            locationName: 'A구역 01열 03단',
            isActive: true,
          },
        ],
        page,
      }),
  },
  {
    /* 진행 요약은 서버가 세어 준다 - 화면이 전체 라인을 받아 세면 페이지네이션과 어긋난다. */
    match: (req) => /\/inventory\/counts\/\d+$/.test(new URL(req.url).pathname),
    respond: () =>
      jsonResponse({
        inventoryCount: {
          inventoryCountId: 5001,
          inventoryCountNo: COUNT_NO,
          countTypeCode: 'PERIODIC',
          warehouseId: 1001,
          plannedDate: '2026-09-07',
          blindCount: false,
          statusCode: 'IN_PROGRESS',
        },
        summary: {
          plannedCount: options.emptyPlan === true ? 0 : 120,
          countedCount: options.emptyPlan === true ? 0 : 38,
          uncountedCount: 82,
          varianceCount: 3,
          closable: false,
          closeBlockedReasonCode: 'COUNT_REMAINING',
        },
      }),
  },
  {
    match: (req) => /\/inventory\/counts\/\d+\/lines/.test(new URL(req.url).pathname),
    respond: (req) => {
      options.asked?.push(req.url);

      if (req.method === 'PUT') {
        options.seen?.push(req.clone());
        return jsonResponse({ items: [] });
      }

      if (options.emptyLocation === true) {
        return jsonResponse({ items: [], page });
      }

      /* 실사 위치를 모으는 조회다. 위치 축 없이 미실사만 묻는다. */
      if (new URL(req.url).searchParams.get('uncountedOnly') === 'true') {
        if (options.manyLocations === true) {
          /* 코드 순이 아닌 차례로 답한다 - 화면이 세우는지 본다. */
          const codes = [
            'A-01-05',
            'A-01-09',
            'A-01-01',
            'A-01-07',
            'A-01-03',
            'A-01-02',
            'A-01-08',
            'A-01-06',
            'A-01-04',
          ];

          return jsonResponse({
            items: codes.map((locationCode, at) =>
              line({ inventoryCountLineId: 6000 + at, counted: false, locationCode }),
            ),
            page,
          });
        }

        return jsonResponse({ items: [line({ counted: false })], page });
      }

      /* 블라인드 실사는 어느 줄에도 장부가 오지 않는다. */
      const hideSystemQty = options.blind === true ? { systemQty: undefined } : {};

      return jsonResponse({
        items: [
          line({
            ...hideSystemQty,
            counted: options.firstCounted === true,
            countedQty: options.firstCounted === true ? 118 : 0,
            ...(options.firstReason === undefined
              ? {}
              : { varianceReasonCode: options.firstReason }),
          }),
          line({
            ...hideSystemQty,
            inventoryCountLineId: 5102,
            lineNo: 2,
            itemId: 2001,
            itemCode: 'RM-1001',
            itemName: '수지A',
            lotId: null,
            lotNo: null,
            systemQty: options.blind === true ? undefined : 40,
            counted: options.otherDevice?.counted === true,
            countedQty: options.otherDevice?.counted === true ? 37 : 0,
          }),
        ],
        page,
      });
    },
  },
  /* 앞에 세워 마스터 조회를 가로챈다 - 연결이 끊기면 이 두 축이 먼저 닿지 않는다. */
  ...(options.mastersDown === true
    ? [
        {
          match: (req: Request) =>
            /\/trace\/lots\/\d+$/.test(new URL(req.url).pathname) ||
            new URL(req.url).pathname.startsWith('/mdm/items'),
          respond: () => Promise.reject(new TypeError('Failed to fetch')),
        },
      ]
    : []),
  {
    /* 실사 응답은 LOT 식별자만 준다. 번호는 이 조회에서 온다. */
    match: (req) => /\/trace\/lots\/\d+$/.test(new URL(req.url).pathname),
    respond: (req) => {
      const lotId = Number(new URL(req.url).pathname.split('/').pop());

      return jsonResponse({ lot: { lotId, lotNo: LOT_NO } });
    },
  },
  ...itemRoutes([
    {
      itemId: 2002,
      itemCode: 'ABC-123',
      itemName: '하우징',
      fifoPolicyCode: 'FIFO',
      baseUomId: 1001,
    },
    {
      itemId: 2001,
      itemCode: 'RM-1001',
      itemName: '수지A',
      fifoPolicyCode: 'FEFO',
      baseUomId: 1001,
    },
    /* 계획에 없는 품목. 장부에 없는 물건을 찾았을 때 고르는 자리다. */
    {
      itemId: 2003,
      itemCode: 'ZZZ-999',
      itemName: '미등록 자재',
      fifoPolicyCode: 'FIFO',
      baseUomId: 1001,
    },
  ]),
  {
    match: (req) => new URL(req.url).pathname === '/mdm/warehouses',
    respond: () =>
      jsonResponse({
        items: [{ warehouseId: 1001, warehouseCode: 'WH-1', warehouseName: '1공장 자재창고' }],
        page,
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/uoms',
    respond: () => jsonResponse({ items: [{ uomId: 1001, uomCode: 'EA' }], page }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/code-values',
    respond: (req) => {
      options.asked?.push(req.url);
      return jsonResponse({
        items:
          new URL(req.url).searchParams.get('codeGroupCode') === 'VARIANCE_REASON'
            ? [
                {
                  code: 'COUNT_ERROR',
                  codeName: 'Count error',
                  nameKo: '계수 오류',
                  isActive: true,
                  displayOrder: 1,
                },
              ]
            : new URL(req.url).searchParams.get('codeGroupCode') === 'INVENTORY_COUNT_TYPE'
              ? [
                  {
                    code: 'PERIODIC',
                    codeName: 'Periodic',
                    nameKo: '정기',
                    isActive: true,
                    displayOrder: 1,
                  },
                ]
              : [],
        page,
      });
    },
  },
];

const SignedIn = ({ children }: { children: ReactNode }) => {
  const { worker, signIn } = useWorkerSession();

  useEffect(() => {
    if (worker === null) {
      signIn({ workerNo: '100028', workerName: '김영수' });
    }
  }, [signIn, worker]);

  return worker === null ? null : children;
};

const mount = (options: Options = {}, queryClient?: ReturnType<typeof createTestQueryClient>) =>
  renderWithProviders(
    <MemoryRouter>
      <SignedIn>
        <PhysicalCountScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch(routes(options)), queryClient },
  );

const scanLocation = (code: string) => {
  const field = screen.getByLabelText('위치 스캔') as HTMLInputElement;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, code);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

/** 실사는 목록에서 정보를 보고 고른다 - 카드 한 장이 한 실사다. */
const pickCount = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: new RegExp(COUNT_NO) }));
};

const openLocation = async (user: ReturnType<typeof userEvent.setup>) => {
  await pickCount(user);
  scanLocation(LOC_CODE);
  await screen.findByText(`위치 ${LOC_CODE}`);
};

beforeEach(() => {
  held.failWrite = null;
  store.clear();
  localStorage.clear();
});

describe('실물 카운트 화면', () => {
  it('진행 중인 실사를 고르면 위치를 스캔할 수 있다', async () => {
    const user = userEvent.setup();
    mount();

    await pickCount(user);

    expect(await screen.findByLabelText('위치 스캔')).toBeTruthy();
  });

  /*
   * 마감된 실사를 고르면 쓰기가 서버에서 되돌아온다. 화면이 목록에서 미리 거르지 않으면
   * 사람은 한 위치를 다 센 뒤에야 그 사실을 안다.
   */
  it('진행 중인 실사만 물어본다', async () => {
    const asked: string[] = [];
    mount({ asked });

    await screen.findByRole('button', { name: new RegExp(COUNT_NO) });

    expect(asked.some((url) => url.includes('inProgressOnly=true'))).toBe(true);
  });

  /* 창고 하나의 라인이 수천 건이다. 위치로 끊어 묻지 않으면 옆 선반의 줄까지 적게 된다. */
  it('그 위치의 라인만 물어본다', async () => {
    const user = userEvent.setup();
    const asked: string[] = [];
    mount({ asked });
    await openLocation(user);

    expect(asked.some((url) => url.includes('/lines') && url.includes('locationId=3001'))).toBe(
      true,
    );
  });

  it('위치를 스캔하면 그 위치의 라인이 뜬다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    expect(await screen.findByLabelText(QTY_LABEL)).toBeTruthy();
    expect(screen.getByText('전산 잔량 120 EA')).toBeTruthy();
  });

  /*
   * 실사를 골라도 어디로 가야 하는지 화면이 말하지 않으면 위치 코드를 아는 사람만 쓸 수 있다.
   * 대상 위치는 실사 헤더에 없고 라인에 붙어 있으므로, 아직 안 센 라인에서 모아 보인다.
   */
  it('실사 위치를 말한다', async () => {
    const user = userEvent.setup();
    mount();

    await pickCount(user);

    expect(await screen.findByText(new RegExp(`실사 위치.*${LOC_CODE}`))).toBeTruthy();
  });

  /*
   * 창고 하나의 실사는 위치가 수십 곳이다. 다 늘어놓으면 화면을 넘겨 위치 스캔 칸이 아래로
   * 밀리고, 순회는 앞에서부터 하므로 뒤쪽 코드는 지금 쓸모가 없다.
   */
  it('위치가 많으면 앞의 몇 곳과 남은 수를 말한다', async () => {
    const user = userEvent.setup();
    mount({ manyLocations: true });

    await pickCount(user);

    const shown = await screen.findByText(/실사 위치/);

    expect(shown.textContent).toContain('외 5곳');
    /* 코드 순으로 세워 창고를 도는 차례와 어긋나지 않게 한다. */
    expect(shown.textContent).toContain('A-01-01');
    expect(shown.textContent).not.toContain('A-01-09');
  });

  /*
   * 한 위치를 끝내면 그곳은 목록에서 빠져야 한다. 낡은 목록을 그대로 두면 방금 다 센 선반으로
   * 다시 보낸다.
   */
  it('한 위치를 끝내면 남은 위치를 다시 받는다', async () => {
    const user = userEvent.setup();
    const asked: string[] = [];
    mount({ asked });
    await openLocation(user);

    await user.type(await screen.findByLabelText(QTY_LABEL), '120');
    await user.click(screen.getByRole('button', { name: '이 위치 완료' }));
    await user.click(await screen.findByRole('button', { name: '다음 위치' }));

    await waitFor(() => {
      expect(asked.filter((url) => url.includes('uncountedOnly=true')).length).toBeGreaterThan(1);
    });
  });

  /*
   * 이 선반을 다 셌는지는 실사 전체 진행과 다른 물음이다. 화면이 든 줄로 바로 셀 수 있고,
   * 세는 사람이 한 위치를 끝낼 때마다 확인하는 것이 이 값이다.
   */
  it('이 위치에서 몇 줄을 셌는지 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    expect(await screen.findByText('진행 0 / 2')).toBeTruthy();

    await user.type(await screen.findByLabelText(QTY_LABEL), '120');

    expect(await screen.findByText('진행 1 / 2')).toBeTruthy();
  });

  /*
   * 숫자만 있으면 장갑 낀 손으로 훑을 때 읽고 나눠야 한다. 얼마나 남았는지는 길이로 먼저
   * 들어온다.
   */
  it('이 위치 진행을 막대로도 보인다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    const bar = await screen.findByRole('progressbar', { name: '진행' });

    expect(bar.getAttribute('aria-valuenow')).toBe('0');

    await user.type(await screen.findByLabelText(QTY_LABEL), '120');

    await waitFor(() => {
      /* 퍼센트가 아니라 센 줄 수다 - 둘 중 하나를 셌다. */
      expect(screen.getByRole('progressbar', { name: '진행' }).getAttribute('aria-valuenow')).toBe(
        '1',
      );
    });
  });

  /*
   * 숫자판이 화면 아래를 덮는다. 옮긴 줄이 그 아래 가려져 있으면 어느 줄에 적는지 머리글로만
   * 알게 되고, 전산 잔량과 앞서 센 값을 못 본 채 적는다.
   */
  /*
   * 옮긴 자리에 커서가 없으면 어디에 적히는지 화면이 말하지 않는다. 숫자판을 누르면 값은
   * 들어가는데 테두리는 앞 라인에 남아 있어, 잘못 적고도 모른다.
   */
  it('앞뒤 라인으로 옮기면 그 칸에 커서가 간다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    const fields = await screen.findAllByLabelText(/실물 수량 입력/);
    await user.click(fields[0] as HTMLInputElement);

    await user.click(screen.getByRole('button', { name: '다음 라인' }));

    await waitFor(() => {
      expect(document.activeElement).toBe(fields[1]);
    });
  });

  it('앞뒤 라인으로 옮기면 그 라인이 보이게 스크롤한다', async () => {
    const user = userEvent.setup();
    const seen: Element[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
      seen.push(this);
    };

    try {
      mount();
      await openLocation(user);

      const fields = await screen.findAllByLabelText(/실물 수량 입력/);
      await user.click(fields[0] as HTMLInputElement);
      seen.length = 0;

      await user.click(screen.getByRole('button', { name: '다음 라인' }));

      await waitFor(() => {
        expect(seen).not.toHaveLength(0);
      });
      /*
       * 적는 칸을 맞춘다 - 라인 전체를 맞추면 제목과 값이 자리를 차지해 정작 칸이 숫자판
       * 아래로 밀린다.
       */
      const target = seen[seen.length - 1];

      expect(target?.tagName).toBe('INPUT');
      expect(target?.getAttribute('aria-label')).toContain('RM-1001');
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  /*
   * 앞서 센 값은 칸에 담겨 보이는데 사유만 감추면 반쪽이다. 어떤 사유로 저장됐는지 모른 채
   * 그 줄을 다시 보내게 된다.
   */
  it('앞서 고른 사유를 그대로 보인다', async () => {
    const user = userEvent.setup();
    mount({ firstCounted: true, firstReason: 'COUNT_ERROR' });
    await openLocation(user);

    const combo = await screen.findByRole('combobox', { name: QTY_REASON });

    expect(combo.textContent).toContain('계수 오류');
  });

  /*
   * 한 위치에 아홉 줄이 넘게 선다. 한 줄을 적을 때마다 숫자판을 닫고 다음 칸을 눌러 다시
   * 열면 손이 화면을 두 번 오간다 - 숫자판에서 바로 옮긴다.
   */
  it('숫자판에서 앞뒤 줄로 옮긴다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    const fields = await screen.findAllByLabelText(/실물 수량 입력/);
    await user.click(fields[0] as HTMLInputElement);

    const pad = () => screen.getByRole('button', { name: '7' }).closest('.physical-count__keypad');

    expect(pad()?.textContent).toContain('ABC-123');
    /* 첫 줄에서는 앞으로 갈 곳이 없다. */
    expect(screen.getByRole('button', { name: '앞 라인' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '다음 라인' }));

    expect(pad()?.textContent).toContain('RM-1001');
    /* 마지막 줄에서는 뒤로 갈 곳이 없다. */
    expect(screen.getByRole('button', { name: '다음 라인' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '앞 라인' }));

    expect(pad()?.textContent).toContain('ABC-123');
  });

  /*
   * 숫자판이 줄 사이에 끼면 그 아래 줄들이 화면 밖으로 밀린다. 아홉 줄이 넘는 목록에서 적던
   * 자리를 잃고, 뒤이어 뜨는 차이 사유가 숫자판 아래에 생겨 어디서 온 칸인지 알 수 없다.
   */
  it('숫자판은 줄 목록 밖에 선다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);
    await user.click(await screen.findByLabelText(QTY_LABEL));

    const key = await screen.findByRole('button', { name: '7' });

    expect(key.closest('.physical-count__line')).toBeNull();
  });

  /* 목록 밖에 서면 어느 줄에 적는 중인지 숫자판이 스스로 말해야 한다. */
  it('숫자판이 지금 적는 줄을 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);
    await user.click(await screen.findByLabelText(QTY_LABEL));

    const pad = (await screen.findByRole('button', { name: '7' })).closest(
      '.physical-count__keypad',
    );

    expect(pad?.textContent).toContain(formatMaterialLotNo(LOT_NO));
  });

  /*
   * 실사 번호와 날짜만으로는 어느 실사인지 갈리지 않는다. 같은 날 여러 창고의 실사가 함께
   * 서므로, 무엇을 고르는지 보고 고를 수 있어야 한다.
   */
  it('실사를 목록에서 정보를 보고 고른다', async () => {
    const user = userEvent.setup();
    mount();

    const card = await screen.findByRole('button', { name: new RegExp(COUNT_NO) });

    expect(card.textContent).toContain('1공장 자재창고');
    expect(card.textContent).toContain('정기');

    await user.click(card);

    expect(await screen.findByLabelText('위치 스캔')).toBeTruthy();
  });

  /*
   * 순회하다 보면 장부에 없는 물건이 나온다. 계획 라인이 없어 적을 자리가 없으면 그 재고는
   * 실사에서 통째로 빠진다.
   *
   * 새 라인의 번호는 서버가 채번한다 - 오프라인에서는 만들 수 없으므로 온라인일 때만 연다.
   */
  it('목록에 없는 재고를 더해 함께 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await openLocation(user);

    /* 설계가 적은 대로 더하기 표시를 앞에 단다. */
    const add = await screen.findByRole('button', { name: '목록에 없는 재고' });
    expect(add.textContent).toContain('add');

    await user.click(add);
    await user.click(await screen.findByRole('button', { name: /ZZZ-999/ }));
    await user.type(await screen.findByLabelText(/ZZZ-999 실물 수량 입력/), '7');

    /* 장부에 없던 물건이라 차이가 그대로 남는다 - 왜 여기 있는지가 조정의 근거다. */
    await user.click(await screen.findByRole('combobox', { name: /ZZZ-999 차이 사유/ }));
    await user.click(await screen.findByRole('option', { name: '계수 오류' }));
    await user.click(screen.getByRole('button', { name: '이 위치 완료' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    const body = (await seen[0]?.json()) as {
      lines: { inventoryCountLineId?: number; itemId: number; countedQty: number; uomId: number }[];
    };
    const added = body.lines.find((each) => each.itemId === 2003);

    /* 번호가 없는 줄이 신규다. 서버가 그것을 보고 채번한다. */
    expect(added).toBeDefined();
    expect(added).not.toHaveProperty('inventoryCountLineId');
    expect(added?.countedQty).toBe(7);
    expect(added?.uomId).toBe(1001);
  });

  /*
   * 라우터 이력에는 이 화면 하나뿐이다. 화면 안 단계를 되돌리지 않으면 실사를 고르고 위치까지
   * 스캔한 사람이 뒤로가기 한 번에 작업 목록까지 나가 처음부터 다시 들어와야 한다.
   */
  /*
   * 숫자판이 화면 아래를 덮고 있으면 그것이 가장 안쪽 단계다. 그대로 두고 위치를 되돌리면
   * 적던 자리를 잃고, 사람은 뒤로가기가 무엇을 닫는지 모른 채 누르게 된다.
   */
  it('숫자판이 열려 있으면 뒤로가기가 그것부터 닫는다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    const fields = await screen.findAllByLabelText(/실물 수량 입력/);
    await user.click(fields[0] as HTMLInputElement);
    await screen.findByRole('button', { name: '7' });

    expect(runBackStep()).toBe(true);

    /* 숫자판만 닫힌다 - 라인 목록은 그대로 선다. */
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '7' })).toBeNull();
    });
    expect(screen.getAllByLabelText(/실물 수량 입력/).length).toBeGreaterThan(0);
  });

  /*
   * 닫을 때 커서는 그 칸에 남는다. 여는 자리를 포커스에만 걸어 두면 같은 칸을 다시 눌러도
   * 아무 일이 없어, 사람은 숫자판이 고장 난 줄 안다.
   */
  it('뒤로가기로 닫은 칸을 다시 누르면 숫자판이 열린다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    const fields = await screen.findAllByLabelText(/실물 수량 입력/);
    await user.click(fields[0] as HTMLInputElement);
    await screen.findByRole('button', { name: '7' });

    runBackStep();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '7' })).toBeNull();
    });

    await user.click(fields[0] as HTMLInputElement);

    expect(await screen.findByRole('button', { name: '7' })).toBeTruthy();
  });

  it('뒤로가기는 화면 안 단계를 하나씩 되돌린다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    /* 위치 → 실사 고르기 차례로 되돌아온다. */
    expect(runBackStep()).toBe(true);
    expect(await screen.findByLabelText('위치 스캔')).toBeTruthy();

    expect(runBackStep()).toBe(true);
    expect(await screen.findByRole('button', { name: new RegExp(COUNT_NO) })).toBeTruthy();

    /* 더 되돌릴 것이 없으면 화면 밖으로 넘긴다. */
    expect(runBackStep()).toBe(false);
  });

  /*
   * 계획 라인이 0 인 실사는 진행을 말할 것이 없다. 막대에 0 을 나누게 두면 채움이 어디에
   * 서는지 정해지지 않는다.
   */
  it('계획 라인이 없으면 진행을 보이지 않는다', async () => {
    const user = userEvent.setup();
    mount({ emptyPlan: true });

    await pickCount(user);
    await screen.findByLabelText('위치 스캔');

    expect(screen.queryByRole('progressbar', { name: '실사 진행' })).toBeNull();
  });

  /*
   * 창고를 순회하는 일이라 한 번에 끝나지 않는다. 얼마나 남았는지 화면이 말하지 않으면 언제
   * 끝나는지 모른 채 돌게 되고, 다 돌았는지도 스스로 셈해야 한다.
   */
  it('고른 실사의 진행을 말한다', async () => {
    const user = userEvent.setup();
    mount();

    await pickCount(user);

    expect(await screen.findByText('진행 38 / 120')).toBeTruthy();
  });

  /*
   * 한 위치에 개수로 세는 품목과 무게로 세는 품목이 섞여 선다. 단위가 빠지면 40 이 마흔 개인지
   * 마흔 킬로그램인지 가릴 수 없고, 그 판단이 그대로 재고 조정으로 나간다.
   */
  it('수량 옆에 단위를 세운다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    expect(await screen.findByText('전산 잔량 120 EA')).toBeTruthy();
  });

  /*
   * 블라인드는 장부가 오지 않는다. 자리까지 지우면 장부가 없는 실사와 구별되지 않아, 가려진
   * 것인지 원래 없는 것인지 줄을 보고 알 수 없다.
   */
  it('블라인드는 장부 자리를 가린 채로 남긴다', async () => {
    const user = userEvent.setup();
    mount({ blind: true });
    await openLocation(user);

    await screen.findAllByText(/전산 잔량 ▪▪▪/);

    /* 줄마다 선다 - 한 줄만 가리면 나머지가 장부 없는 줄로 읽힌다. */
    expect(screen.getAllByText(/전산 잔량 ▪▪▪/)).toHaveLength(2);
  });

  /*
   * 줄 이름은 제목으로 한 번만 선다. 칸 라벨에 또 적으면 한 줄에 같은 34자리가 두 번 서서,
   * 아홉 줄이 넘는 목록에서 어느 것이 줄 이름이고 어느 것이 칸 이름인지 갈리지 않는다.
   */
  it('줄 이름을 눈에 보이는 자리에 한 번만 세운다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);
    await screen.findByLabelText(QTY_LABEL);

    const shown = formatMaterialLotNo(LOT_NO);
    const seen = screen.getAllByText((_, node) => node?.textContent?.includes(shown) === true);
    /* 조상 요소가 함께 걸리므로 그 글자만 담은 잎만 센다. */
    const leaves = seen.filter((node) => node.children.length === 0);

    expect(leaves).toHaveLength(1);
  });

  /*
   * 계약이 품목 코드와 LOT 번호를 라인에 실어 보내는 이유가 여기 있다 - 모바일은 오프라인에서
   * 마스터를 갱신할 수 없다. 이름을 마스터에서 다시 받아 오면 연결이 끊긴 자리에서 줄마다
   * 이름이 통째로 사라지고, 세는 사람이 어느 줄에 적는지 알 수 없게 된다.
   */
  it('마스터가 닿지 않아도 라인이 실어 온 이름을 보인다', async () => {
    const user = userEvent.setup();
    mount({ mastersDown: true });
    await openLocation(user);

    expect(await screen.findByLabelText(QTY_LABEL)).toBeTruthy();
  });

  /*
   * 라벨에는 LOT 번호가 찍혀 있고 대리키는 찍혀 있지 않다. 대리키를 보이면 세는 사람이
   * 지금 어느 LOT 을 세는지 실물과 맞춰볼 수 없다.
   */
  it('LOT 자리에 대리키를 보이지 않는다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);
    await screen.findByLabelText(QTY_LABEL);

    expect(screen.queryByLabelText(/ABC-123 · 8001 실물 수량/)).toBeNull();
  });

  /*
   * 이 화면의 핵심이다. 안 센 것을 0 으로 보내면 관리웹이 그것을 전량 손실로 잡는다.
   */
  it('안 센 줄은 보내지 않는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await openLocation(user);

    await user.type(await screen.findByLabelText(QTY_LABEL), '120');
    await user.click(screen.getByRole('button', { name: '이 위치 완료' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    const body = (await seen[0]?.json()) as {
      locationId: number;
      lines: { inventoryCountLineId: number }[];
    };

    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]?.inventoryCountLineId).toBe(5101);
    expect(body.locationId).toBe(3001);
  });

  /*
   * 한 위치를 나눠 센다. 아홉 줄이 넘는 위치를 한 번에 다 세지 못하면 같은 위치를 다시 연다.
   *
   * 계약은 이 경로를 치환으로 정의한다 - 본문에 없는 기존 라인을 미실사로 되돌린다. 앞서
   * 센 줄을 빼고 보내면 그 회차가 지워지고, 되돌릴 길이 없어 다시 세러 가야 한다.
   */
  it('앞서 센 줄을 손대지 않아도 그 값이 본문에 함께 든다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen, firstCounted: true, firstReason: 'COUNT_ERROR' });
    await openLocation(user);

    /* 아직 안 센 둘째 줄에만 적는다 */
    const fields = await screen.findAllByLabelText(/실물 수량/);
    await user.type(fields[1] as HTMLInputElement, '40');
    await user.click(screen.getByRole('button', { name: '이 위치 완료' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    const body = (await seen[0]?.json()) as {
      lines: { inventoryCountLineId: number; countedQty: number }[];
    };

    expect(body.lines).toHaveLength(2);
    expect(body.lines.find((each) => each.inventoryCountLineId === 5101)?.countedQty).toBe(118);
    expect(body.lines.find((each) => each.inventoryCountLineId === 5102)?.countedQty).toBe(40);
  });

  /* 세어 보니 없더라는 유효한 답이다. 0 을 못 적으면 그 사실을 남길 길이 없다. */
  it('0 을 적으면 센 것으로 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await openLocation(user);

    await user.type(await screen.findByLabelText(QTY_LABEL), '0');
    await user.click(await screen.findByRole('combobox', { name: /차이 사유/ }));
    await user.click(screen.getByRole('option', { name: '계수 오류' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '이 위치 완료' })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: '이 위치 완료' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    const body = (await seen[0]?.json()) as { lines: { countedQty: number }[] };

    expect(body.lines[0]?.countedQty).toBe(0);
  });

  it('비블라인드 실물 차이는 공통코드 사유 선택 후 그 값을 PUT 본문에 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    const asked: string[] = [];
    mount({ seen, asked });
    await openLocation(user);
    await user.type(await screen.findByLabelText(QTY_LABEL), '118');
    expect(screen.getByRole('button', { name: '이 위치 완료' })).toBeDisabled();
    await user.click(await screen.findByRole('combobox', { name: /차이 사유/ }));
    await user.click(screen.getByRole('option', { name: '계수 오류' }));
    await user.click(screen.getByRole('button', { name: '이 위치 완료' }));
    await waitFor(() => expect(seen).toHaveLength(1));
    const body = (await seen[0]?.json()) as {
      lines: { countedQty: number; varianceReasonCode: string }[];
    };
    expect(body.lines[0]).toMatchObject({ countedQty: 118, varianceReasonCode: 'COUNT_ERROR' });
    expect(asked.some((url) => url.includes('codeGroupCode=VARIANCE_REASON'))).toBe(true);
  });

  it('블라인드 첫 계수는 사유 없이 원래 흐름으로 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ blind: true, seen });
    await openLocation(user);
    await user.type(await screen.findByLabelText(QTY_LABEL), '118');
    expect(screen.queryByRole('combobox', { name: /차이 사유/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: '이 위치 완료' }));
    await waitFor(() => expect(seen).toHaveLength(1));
    const body = (await seen[0]?.json()) as { lines: Record<string, unknown>[] };
    expect(body.lines[0]).not.toHaveProperty('varianceReasonCode');
  });

  it('블라인드 기존 계수를 그대로 동봉하면 서버에서 받은 계수 시각과 미입력 사유를 보존한다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ blind: true, firstCounted: true, seen });
    await openLocation(user);
    /* 앞서 센 값이 칸에 담겨 있다 - 손대지 않고 그대로 내보낸다. */
    expect((await screen.findByLabelText(QTY_LABEL)).getAttribute('value')).toBe('118');
    expect(screen.queryByRole('combobox', { name: /차이 사유/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: '이 위치 완료' }));
    await waitFor(() => expect(seen).toHaveLength(1));
    const body = (await seen[0]?.json()) as {
      lines: { countedAt: string; varianceReasonCode?: string }[];
    };
    expect(body.lines[0]?.countedAt).toBe('2026-09-07T09:00:00+09:00');
    expect(body.lines[0]).not.toHaveProperty('varianceReasonCode');
  });

  /* 안 센 줄과 0 으로 센 줄이 화면에서도 갈려야 한다. */
  it('아직 세지 않은 줄임을 화면이 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    expect(await screen.findAllByText('이 라인은 아직 세지 않았습니다')).toHaveLength(2);
  });

  /*
   * 적은 값 옆에 그대로 두면 적은 것이 안 먹은 것으로 읽힌다. 서버 상태가 안 센 것인
   * 사실은 그대로라, 화면은 칸이 빈 동안에만 그 말을 한다.
   */
  it('값을 적은 줄에는 아직 세지 않았다고 말하지 않는다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    await user.type(await screen.findByLabelText(QTY_LABEL), '120');

    await waitFor(() => {
      expect(screen.getAllByText('이 라인은 아직 세지 않았습니다')).toHaveLength(1);
    });
  });

  /* 지우면 다시 안 센 줄이다. 한 번 적었다고 그 사실이 사라지지 않는다. */
  it('적은 값을 지우면 아직 세지 않았다고 다시 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    const field = await screen.findByLabelText(QTY_LABEL);
    await user.type(field, '118');
    await user.clear(field);

    await waitFor(() => {
      expect(screen.getAllByText('이 라인은 아직 세지 않았습니다')).toHaveLength(2);
    });
  });

  it('이미 센 줄은 앞서 센 값을 보인다', async () => {
    const user = userEvent.setup();
    mount({ firstCounted: true });
    await openLocation(user);

    expect(await screen.findByText('앞서 센 값 118 EA')).toBeTruthy();
  });

  /*
   * 되돌릴 수 없는 조정이 이 수만큼 나간다. 사유를 요구하면서 얼마인지 말하지 않으면 사람이
   * 전산 잔량과 적은 값을 보고 암산해 고른다.
   */
  it('전산과 다르게 세면 차이를 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    await user.type(await screen.findByLabelText(QTY_LABEL), '100');

    expect(await screen.findByText('차이 20 EA 부족')).toBeTruthy();
  });

  it('많이 세면 많다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    await user.type(await screen.findByLabelText(QTY_LABEL), '135');

    expect(await screen.findByText('차이 15 EA 많음')).toBeTruthy();
  });

  /*
   * 장갑을 끼고 한 손으로 조작한다. 단말 키보드는 키가 촘촘하고, 올라오면 줄 목록과 완료
   * 단추를 덮어 무엇을 적는 줄인지 가려진다. 다른 열한 화면이 화면 숫자판을 쓴다.
   */
  it('수량 칸을 누르면 화면 숫자판이 선다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    const field = await screen.findByLabelText(QTY_LABEL);

    expect(field).toHaveAttribute('inputmode', 'none');

    await user.click(field);

    expect(await screen.findByRole('button', { name: '7' })).toBeTruthy();
  });

  /* 장부를 보고 그대로 적는 것을 막는 실사다. 서버가 장부를 안 내려보낸다. */
  it('전산 잔량을 감춘 실사에서는 그 값을 보이지 않는다', async () => {
    const user = userEvent.setup();
    mount({ blind: true });
    await openLocation(user);

    expect(await screen.findByText(/전산 잔량을 감춘 실사입니다/)).toBeTruthy();
    expect(screen.queryByText(/^전산 잔량 \d/)).toBeNull();
  });

  it('한 줄도 적지 않으면 완료할 수 없다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    await screen.findByLabelText(QTY_LABEL);

    expect(screen.getByRole('button', { name: '이 위치 완료' })).toBeDisabled();
  });

  /*
   * 단말이 재접속하면 조회가 다시 돈다. 그때 적어 둔 것을 덮어쓰면 한 선반을 다 센 사람이
   * 아무 말 없이 처음부터 다시 센다.
   */
  it('다시 읽어와도 적어 둔 수량이 남는다', async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    const otherDevice = { counted: false };
    mount({ otherDevice }, queryClient);
    await openLocation(user);

    await user.type(await screen.findByLabelText(QTY_LABEL), '118');

    /* 다른 단말이 둘째 줄을 센다. 그 사실은 받아 오되 내가 적은 것은 그대로여야 한다. */
    otherDevice.counted = true;
    await queryClient.invalidateQueries({ queryKey: ['physical-count-lines'] });

    expect(await screen.findByText('앞서 센 값 37 EA')).toBeTruthy();
    expect((screen.getByLabelText(QTY_LABEL) as HTMLInputElement).value).toBe('118');
  });

  it('라인이 없는 위치는 그 사실을 말한다', async () => {
    const user = userEvent.setup();
    mount({ emptyLocation: true });
    await openLocation(user);

    expect(await screen.findByText(/이 위치에는 실사 라인이 없습니다/)).toBeTruthy();
  });

  /*
   * 연타는 button.click() 을 연속으로 불러야 갈린다. await user.click() 세 번은 클릭 사이에
   * 다시 그리기가 끼어 결함이 있어도 통과한다.
   */
  it('연타해도 한 건만 담는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await openLocation(user);

    await user.type(await screen.findByLabelText(QTY_LABEL), '120');

    const button = screen.getByRole('button', { name: '이 위치 완료' });
    button.click();
    button.click();
    button.click();

    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });

    const keys = new Set(seen.map((each) => each.headers.get('Idempotency-Key')));

    expect(keys.size).toBe(1);
  });

  /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 센 줄 안다. */
  it('단말 보관소가 거절하면 기록되지 않았다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    await user.type(await screen.findByLabelText(QTY_LABEL), '120');

    held.failWrite = 'outbox';
    await user.click(screen.getByRole('button', { name: '이 위치 완료' }));

    expect(await screen.findByText('실물 수량을 저장하지 못했습니다')).toBeTruthy();
  });
});
