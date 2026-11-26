import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { messageRow } from '../integration-sync/fixtures';
import type { Session } from '../../patterns/session';
import { presetPeriod } from './created-period';
import { ErpOutboundScreen } from './screen';

const ROUTE = '/master-data/erp-outbound';
const SETTINGS_PATH = '/integration/outbound-item-settings';
const MESSAGES_PATH = '/integration/messages';

/** 서버 응답 그대로(서버 #849) — 차례 · 이름 · 짝 · 대기 · 실패 건수는 서버가 정한다. 송신 ON은 시험마다 붙인다. */
const SETTINGS = {
  items: [
    {
      outboundItemCode: 'PRODUCTION_RESULT',
      outboundItemName: '생산 실적',
      enabled: true,
      locked: true,
      lockReason: '필수',
      interfaceCode: 'IF-WO-CLOSE-SEND',
      pendingMessageCount: 0,
      failedMessageCount: 0,
    },
    {
      outboundItemCode: 'GOODS_RECEIPT',
      outboundItemName: '입고 (G/R)',
      enabled: true,
      locked: false,
      interfaceCode: 'IF-GR-SEND',
      pendingMessageCount: 2,
      failedMessageCount: 1,
    },
    {
      outboundItemCode: 'SHIPMENT_PGI',
      outboundItemName: '출하 (PGI)',
      enabled: false,
      locked: false,
      interfaceCode: 'IF-SHIPMENT-PGI-SEND',
      pendingMessageCount: 0,
      failedMessageCount: 0,
    },
    {
      outboundItemCode: 'RETURN',
      outboundItemName: '반품',
      enabled: true,
      locked: false,
      interfaceCode: null,
      pendingMessageCount: 0,
      failedMessageCount: 0,
    },
  ],
};

const GR_PENDING = [
  messageRow({
    integrationMessageId: 9101,
    messageKey: 'IF-GR-SEND:SAMPLE-GR-0001',
    interfaceCode: 'IF-GR-SEND',
    directionCode: 'OUTBOUND',
    statusCode: 'PENDING',
    targetTypeCode: 'GOODS_RECEIPT',
    targetId: 7701,
    retryCount: 0,
    lastErrorMessage: null,
  }),
  messageRow({
    integrationMessageId: 9102,
    messageKey: 'IF-GR-SEND:SAMPLE-GR-0002',
    interfaceCode: 'IF-GR-SEND',
    directionCode: 'OUTBOUND',
    statusCode: 'PENDING',
    targetTypeCode: 'GOODS_RECEIPT',
    targetId: 7702,
    retryCount: 0,
    lastErrorMessage: null,
  }),
];

const settingsRoute: StubRoute = {
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === SETTINGS_PATH,
  respond: () => jsonResponse(SETTINGS),
};

/** 건수(한 줄만 받는 조회)와 송신 예정 목록을 한 경로에서 가른다. */
const messagesRoute = (status = 200): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === MESSAGES_PATH,
  respond: (request) => {
    if (status !== 200) return jsonResponse({ message: '' }, { status });
    const query = new URL(request.url).searchParams;
    const isGrPending =
      query.get('interfaceCode') === 'IF-GR-SEND' && query.get('statusCode') === 'PENDING';
    const items = isGrPending ? GR_PENDING : [];

    return jsonResponse({ items, page: { page: 1, size: 20, total: items.length } });
  },
});

const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const renderScreen = (routes: StubRoute[], search = '', session?: Session | null) => {
  const requests: URL[] = [];
  const stub = createStubFetch(routes);
  const fetch: StubFetch = async (request) => {
    requests.push(new URL(request.url));

    return stub(request);
  };

  renderWithProviders(
    <>
      {/* 탭 막대 오른쪽 칩 자리(app/hub-tabs.tsx) — 화면이 그리기 전에 서 있어야 칩이 꽂힌다. */}
      <div id="hub-actions" data-testid="hub-actions" />
      <ErpOutboundScreen />
      <LocationProbe />
    </>,
    { fetch, route: `${ROUTE}${search}`, ...(session === undefined ? {} : { session }) },
  );

  return { requests, user: userEvent.setup() };
};

const itemsPane = () => within(screen.getByRole('region', { name: '송신 항목' }));
const pendingPane = () => within(screen.getByRole('region', { name: '송신 대기 목록' }));
const itemRow = (name: string): HTMLElement => {
  const row = itemsPane()
    .getByRole('button', { name: `${name} 선택` })
    .closest('tr');
  if (row === null) throw new Error(`${name} 줄이 없습니다`);

  return row;
};
const pendingListRequests = (requests: URL[]) =>
  requests.filter((url) => url.pathname === MESSAGES_PATH && url.searchParams.get('size') !== '1');

describe('ErpOutboundScreen — 송신 항목', () => {
  it('송신 항목마다 송신 여부와 대기 · 실패 건수를 낸다 — 송신이 없는 항목은 「—」다', async () => {
    renderScreen([settingsRoute, messagesRoute()]);

    await itemsPane().findByRole('button', { name: '입고 (G/R) 선택' });
    await waitFor(() => {
      expect(
        within(itemRow('입고 (G/R)'))
          .getAllByRole('cell')
          .map((c) => c.textContent),
      ).toEqual(['입고 (G/R)', '—', 'ON', '2건', '1건']);
    });
    expect(within(itemRow('생산 실적')).getByText('필수')).toBeInTheDocument();
    expect(within(itemRow('출하 (PGI)')).getByText('OFF')).toBeInTheDocument();
    expect(
      within(itemRow('반품'))
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['반품', '—', 'ON', '—', '—']);
  });

  it('건수는 송신 항목 설정에 실려 오는 서버 값이다 — 메시지 목록을 따로 세지 않는다', async () => {
    const { requests } = renderScreen([settingsRoute, messagesRoute()]);

    await waitFor(() => {
      expect(within(itemRow('입고 (G/R)')).getByText('2건')).toBeInTheDocument();
    });
    expect(requests.filter((url) => url.searchParams.get('size') === '1')).toHaveLength(0);
  });
});

describe('ErpOutboundScreen — 상태 선택', () => {
  it('상태 선택으로 화면 안에서 거른다 — 송신 대기 · 송신 OFF(#358)', async () => {
    const { user } = renderScreen([settingsRoute, messagesRoute()]);
    await itemsPane().findByRole('button', { name: '입고 (G/R) 선택' });
    const filter = within(screen.getByRole('region', { name: '조회 조건' }));

    await user.click(filter.getByRole('combobox', { name: '송신 상태 선택' }));
    await user.click(screen.getByRole('option', { name: '송신 OFF' }));
    await user.click(filter.getByRole('button', { name: '조회' }));

    expect(itemsPane().getByRole('button', { name: '출하 (PGI) 선택' })).toBeInTheDocument();
    expect(itemsPane().queryByRole('button', { name: '입고 (G/R) 선택' })).toBeNull();

    await user.click(filter.getByRole('combobox', { name: '송신 상태 선택' }));
    await user.click(screen.getByRole('option', { name: '송신 대기' }));
    await user.click(filter.getByRole('button', { name: '조회' }));

    expect(itemsPane().getByRole('button', { name: '입고 (G/R) 선택' })).toBeInTheDocument();
    expect(itemsPane().queryByRole('button', { name: '반품 선택' })).toBeNull();
  });
});

describe('ErpOutboundScreen — 탭 막대 칩', () => {
  it('송신이 꺼진 서버면 「송신 OFF」 칩을 맨 앞에 세운다', async () => {
    renderScreen([
      {
        match: (request) =>
          request.method === 'GET' && new URL(request.url).pathname === SETTINGS_PATH,
        respond: () => jsonResponse({ ...SETTINGS, sendEnabled: false }),
      },
      messagesRoute(),
    ]);

    const hub = within(screen.getByTestId('hub-actions'));
    expect(await hub.findByText('송신 OFF')).toBeInTheDocument();
    expect(await hub.findByText(/^송신 대기 /)).toBeInTheDocument();
  });

  it('켜짐을 모르는 서버(응답에 없음)면 켜짐 칩을 세우지 않는다', async () => {
    renderScreen([settingsRoute, messagesRoute()]);

    const hub = within(screen.getByTestId('hub-actions'));
    expect(await hub.findByText(/^송신 대기 /)).toBeInTheDocument();
    expect(hub.queryByText(/^송신 (ON|OFF)$/)).toBeNull();
  });
});

describe('ErpOutboundScreen — 끝 쪽 넘김', () => {
  it('송신 예정이 끝 쪽을 넘었으면 「첫 쪽으로」로 빠져나간다', async () => {
    /* 3쪽을 보던 사이 송신기가 대기를 비웠다 — 전체는 2건인데 3쪽을 부른다. */
    const beyondRoute: StubRoute = {
      match: (request) => {
        const url = new URL(request.url);
        return url.pathname === MESSAGES_PATH && url.searchParams.get('page') === '3';
      },
      respond: () => jsonResponse({ items: [], page: { page: 3, size: 20, total: 2 } }),
    };
    const { user } = renderScreen(
      [beyondRoute, settingsRoute, messagesRoute()],
      '?item=GOODS_RECEIPT&page=3',
    );

    expect(await pendingPane().findByText('이 쪽에는 송신 대기 건이 없습니다')).toBeInTheDocument();
    await user.click(pendingPane().getByRole('button', { name: '첫 쪽으로' }));

    expect(await pendingPane().findByText('SAMPLE-GR-0001')).toBeInTheDocument();
    expect(screen.getByTestId('location')).not.toHaveTextContent('page=');
  });
});

describe('ErpOutboundScreen — 송신 예정 목록', () => {
  it('고르지 않았으면 첫 항목을 연다', async () => {
    renderScreen([settingsRoute, messagesRoute()]);

    expect(await pendingPane().findByText('송신 대기 건이 없습니다')).toBeInTheDocument();
    expect(pendingPane().getByRole('heading', { name: '송신 대기 목록' })).toBeInTheDocument();
    expect(itemsPane().getByRole('button', { name: '생산 실적 선택' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('고른 항목을 다시 눌러 풀어도 등록일 조건 · 쪽 크기는 주소에 남는다', async () => {
    const { user } = renderScreen(
      [settingsRoute, messagesRoute()],
      '?item=GOODS_RECEIPT&from=2026-11-01&to=2026-11-07&size=50',
    );

    await user.click(await itemsPane().findByText('입고 (G/R)'));

    expect(screen.getByTestId('location')).toHaveTextContent(
      `${ROUTE}?item=&from=2026-11-01&to=2026-11-07&size=50`,
    );
  });

  it('항목 줄을 누르면 그 항목의 송신 예정을 주소에 남기고 목록으로 낸다', async () => {
    const { requests, user } = renderScreen([settingsRoute, messagesRoute()]);

    await user.click(await itemsPane().findByText('입고 (G/R)'));

    expect(
      await pendingPane().findByRole('heading', { name: '송신 대기 목록' }),
    ).toBeInTheDocument();
    // 메시지 키 대신 업무 번호만 — 연계 코드 · 대상 코드는 보이지 않는다(사용자 지시 2026-10-27).
    expect(pendingPane().getByText('SAMPLE-GR-0001')).toBeInTheDocument();
    expect(pendingPane().queryByText('IF-GR-SEND:SAMPLE-GR-0001')).toBeNull();
    expect(pendingPane().queryByText('GOODS_RECEIPT · 7702')).toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent(`${ROUTE}?item=GOODS_RECEIPT`);

    const list = pendingListRequests(requests).at(-1);
    expect(list?.searchParams.get('interfaceCode')).toBe('IF-GR-SEND');
    expect(list?.searchParams.get('statusCode')).toBe('PENDING');
    expect(list?.searchParams.get('directionCode')).toBe('OUTBOUND');
  });

  it('송신 대기 표 아래 쪽 넘김 줄 — 총 N건 · 쪽 크기 · [처음]~[마지막], 쪽 크기는 서버 size 로 싣는다(사용자 지시 2026-11-24)', async () => {
    const { requests, user } = renderScreen(
      [settingsRoute, messagesRoute()],
      '?item=GOODS_RECEIPT',
    );

    await pendingPane().findByText('SAMPLE-GR-0001');
    const nav = within(pendingPane().getByRole('navigation', { name: '쪽 이동' }));
    /* 「총 N건」은 감추지 않는다 — 다른 상세 표와 같은 모양(종전 숨김 규칙 걷음). */
    expect(nav.getByText('총 2건')).toBeVisible();
    expect(nav.getByText('1 / 1')).toBeInTheDocument();
    for (const name of ['처음', '이전', '다음', '마지막']) {
      expect(nav.getByRole('button', { name })).toBeDisabled();
    }
    /* 고르기 전에는 종전 그대로 20건씩 부른다. */
    expect(pendingListRequests(requests).at(-1)?.searchParams.get('size')).toBe('20');

    await user.click(nav.getByRole('combobox', { name: '페이지 크기' }));
    expect(nav.getByRole('combobox', { name: '페이지 크기' })).toHaveTextContent('20건');
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: /50건$/ }));

    await waitFor(() => {
      expect(pendingListRequests(requests).at(-1)?.searchParams.get('size')).toBe('50');
    });
    expect(screen.getByTestId('location')).toHaveTextContent('size=50');
    expect(screen.getByTestId('location')).not.toHaveTextContent('page=');
  });

  it('송신 대기가 없어도 쪽 넘김 줄은 선다(총 0건)', async () => {
    renderScreen([settingsRoute, messagesRoute()]);

    expect(await pendingPane().findByText('송신 대기 건이 없습니다')).toBeInTheDocument();
    const nav = within(pendingPane().getByRole('navigation', { name: '쪽 이동' }));
    expect(nav.getByText('총 0건')).toBeInTheDocument();
  });

  it('생성일 「전체」면 송신 대기를 전체 기간(2000-01-01 ~ 오늘)으로 부른다 — 서버는 기간을 꼭 받는다(#358)', async () => {
    const { requests } = renderScreen([settingsRoute, messagesRoute()], '?item=GOODS_RECEIPT');

    await pendingPane().findByText('SAMPLE-GR-0001');
    /*
     * 등록일 라벨 둘 · 시작일 · 종료일 · 조회는 늘 보인다 — 처음은 「전체」(라벨 안 눌림), 날짜 칸은 비어 있다.
     * 선택칸 · 「직접 지정」은 없앴다(사용자 지시 2026-11-25).
     */
    const chips = within(pendingPane().getByRole('group', { name: '등록일' }));
    expect(chips.getByRole('button', { name: '최근 1주일' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(chips.getByRole('button', { name: '최근 1개월' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(pendingPane().queryByRole('combobox', { name: '등록일' })).toBeNull();
    expect(pendingPane().queryByText('직접 지정')).toBeNull();
    expect(pendingPane().getByLabelText('시작일')).toHaveValue('');
    expect(pendingPane().getByLabelText('종료일')).toHaveValue('');
    const last = pendingListRequests(requests).at(-1);
    expect(last?.searchParams.get('createdFrom')).toMatch(/^2000-01-01T00:00:00[+-]\d{2}:\d{2}$/);
    expect(last?.searchParams.get('createdTo')).toMatch(/^\d{4}-\d{2}-\d{2}T23:59:59/);
  });

  it('등록일 날짜 두 칸으로 조회하면 그 기간을 실어 부르고 주소에 남긴다 — 날짜를 고치면 라벨 선택이 풀린다', async () => {
    const { requests, user } = renderScreen(
      [settingsRoute, messagesRoute()],
      '?item=GOODS_RECEIPT',
    );

    await pendingPane().findByText('SAMPLE-GR-0001');
    const week = within(pendingPane().getByRole('group', { name: '등록일' })).getByRole('button', {
      name: '최근 1주일',
    });
    await user.click(week);
    expect(week).toHaveAttribute('aria-pressed', 'true');
    await user.clear(pendingPane().getByLabelText('시작일'));
    expect(week).toHaveAttribute('aria-pressed', 'false');
    await user.type(pendingPane().getByLabelText('시작일'), '2026-11-01');
    await user.clear(pendingPane().getByLabelText('종료일'));
    await user.type(pendingPane().getByLabelText('종료일'), '2026-11-24');
    await user.click(pendingPane().getByRole('button', { name: '조회' }));

    await waitFor(() => {
      const last = pendingListRequests(requests).at(-1);
      expect(last?.searchParams.get('createdFrom')).toMatch(/^2026-11-01T00:00:00/);
      expect(last?.searchParams.get('createdTo')).toMatch(/^2026-11-24T23:59:59/);
    });
    expect(screen.getByTestId('location')).toHaveTextContent('from=2026-11-01&to=2026-11-24');
  });

  it('등록일 라벨을 누르면 그 범위를 바로 걸고, 다시 누르면 전체로 돌아간다(사용자 지시 2026-11-25)', async () => {
    const { requests, user } = renderScreen(
      [settingsRoute, messagesRoute()],
      '?item=GOODS_RECEIPT',
    );

    await pendingPane().findByText('SAMPLE-GR-0001');
    const chips = within(pendingPane().getByRole('group', { name: '등록일' }));
    const month = chips.getByRole('button', { name: '최근 1개월' });
    const expected = presetPeriod('month', new Date());
    await user.click(month);

    expect(month).toHaveAttribute('aria-pressed', 'true');
    expect(chips.getByRole('button', { name: '최근 1주일' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByTestId('location')).toHaveTextContent(
      `from=${expected.from}&to=${expected.to}`,
    );
    expect(pendingPane().getByLabelText('시작일')).toHaveValue(expected.from);
    expect(pendingPane().getByLabelText('종료일')).toHaveValue(expected.to);
    await waitFor(() => {
      const last = pendingListRequests(requests).at(-1);
      expect(last?.searchParams.get('createdFrom')).toMatch(
        new RegExp(`^${expected.from}T00:00:00`),
      );
      expect(last?.searchParams.get('createdTo')).toMatch(new RegExp(`^${expected.to}T23:59:59`));
    });

    await user.click(month);

    expect(month).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('location')).not.toHaveTextContent('from=');
    expect(screen.getByTestId('location')).not.toHaveTextContent('to=');
    expect(pendingPane().getByLabelText('시작일')).toHaveValue('');
    expect(pendingPane().getByLabelText('종료일')).toHaveValue('');
    await waitFor(() => {
      const last = pendingListRequests(requests).at(-1);
      expect(last?.searchParams.get('createdFrom')).toMatch(/^2000-01-01T00:00:00/);
    });
  });

  it('송신 대기 줄은 어디를 눌러도 고르고, 문서 번호는 링크가 아니다(사용자 지시 2026-11-24)', async () => {
    const { user } = renderScreen([settingsRoute, messagesRoute()], '?item=GOODS_RECEIPT');

    const cell = await pendingPane().findByText('SAMPLE-GR-0001');
    expect(pendingPane().queryByRole('link')).toBeNull();
    const pick = pendingPane().getByRole('button', { name: 'SAMPLE-GR-0001 선택' });
    expect(pick).not.toHaveAttribute('aria-current', 'true');

    await user.click(cell.closest('tr')?.querySelector('td:last-child') ?? cell);

    expect(pick).toHaveAttribute('aria-current', 'true');
  });

  it('고른 송신 대기 줄을 다시 누르면 선택이 풀린다(사용자 지시 2026-11-24)', async () => {
    const { user } = renderScreen([settingsRoute, messagesRoute()], '?item=GOODS_RECEIPT');

    await pendingPane().findByText('SAMPLE-GR-0001');
    const pick = pendingPane().getByRole('button', { name: 'SAMPLE-GR-0001 선택' });
    await user.click(pick);
    expect(pick).toHaveAttribute('aria-current', 'true');
    await user.click(pick);

    expect(pick).not.toHaveAttribute('aria-current');
  });

  it('고른 송신 항목을 다시 누르면 선택이 풀리고 첫 항목으로 되돌아가지 않는다(사용자 지시 2026-11-24)', async () => {
    const { user } = renderScreen([settingsRoute, messagesRoute()], '?item=GOODS_RECEIPT');

    await pendingPane().findByText('SAMPLE-GR-0001');
    await user.click(itemsPane().getByRole('button', { name: '입고 (G/R) 선택' }));

    expect(await screen.findByText('송신 항목을 선택하세요.')).toBeInTheDocument();
    expect(itemsPane().getByRole('button', { name: '입고 (G/R) 선택' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(itemsPane().getByRole('button', { name: '생산 실적 선택' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('송신이 없는 항목(반품)은 목록을 부르지 않고 그 사실만 말한다', async () => {
    const { requests } = renderScreen([settingsRoute, messagesRoute()], '?item=RETURN');

    expect(await pendingPane().findByText('아직 ERP로 보내지 않는 항목입니다')).toBeInTheDocument();
    expect(pendingListRequests(requests)).toHaveLength(0);
  });

  it('송신 항목 설정을 읽을 권한이 없으면(403) 목록 대신 권한 안내를 낸다', async () => {
    renderScreen(
      [
        {
          match: (request) =>
            request.method === 'GET' && new URL(request.url).pathname === SETTINGS_PATH,
          respond: () => jsonResponse({ message: '' }, { status: 403 }),
        },
        messagesRoute(),
      ],
      '?item=GOODS_RECEIPT',
    );

    expect(
      await itemsPane().findByText(
        '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('메시지를 읽을 권한이 없으면(403) 송신 예정 자리에 권한 안내를 낸다', async () => {
    renderScreen([settingsRoute, messagesRoute(403)], '?item=GOODS_RECEIPT');

    expect(
      await pendingPane().findByText(
        '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
      ),
    ).toBeInTheDocument();
  });
});

describe('ErpOutboundScreen — 조회 상자 · 배치(#358)', () => {
  it('송신 항목 이름으로 화면 안에서 거르고, 초기화하면 다 보인다 — 서버 요청은 그대로다', async () => {
    const { requests, user } = renderScreen([settingsRoute, messagesRoute()]);
    await itemsPane().findByRole('button', { name: '입고 (G/R) 선택' });
    const settingsCalls = requests.filter((url) => url.pathname === SETTINGS_PATH).length;
    // 초기화는 검색어가 처음 값(빈칸)과 다를 때만 보인다.
    expect(screen.queryByRole('button', { name: '초기화' })).toBeNull();

    await user.type(screen.getByRole('searchbox', { name: '송신 항목 검색' }), '입고');
    await user.click(
      within(screen.getByRole('region', { name: '조회 조건' })).getByRole('button', {
        name: '조회',
      }),
    );

    expect(itemsPane().getByRole('button', { name: '입고 (G/R) 선택' })).toBeInTheDocument();
    expect(itemsPane().queryByRole('button', { name: '반품 선택' })).toBeNull();
    expect(itemsPane().getByText('총 1건')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(itemsPane().getByRole('button', { name: '반품 선택' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '초기화' })).toBeNull();
    expect(requests.filter((url) => url.pathname === SETTINGS_PATH)).toHaveLength(settingsCalls);
  });

  it('맞는 항목이 없으면 목록 자리에 빈 안내를 낸다', async () => {
    const { user } = renderScreen([settingsRoute, messagesRoute()]);
    await itemsPane().findByRole('button', { name: '입고 (G/R) 선택' });

    await user.type(screen.getByRole('searchbox', { name: '송신 항목 검색' }), '없는 이름{Enter}');

    expect(itemsPane().getByText('조건에 맞는 송신 항목이 없습니다')).toBeInTheDocument();
  });

  it('탭 줄 오른쪽에 배치 「⋯」 메뉴가 선다', async () => {
    renderScreen([settingsRoute, messagesRoute()]);
    await itemsPane().findByRole('button', { name: '입고 (G/R) 선택' });

    const hub = within(screen.getByTestId('hub-actions'));
    expect(hub.getByRole('button', { name: '더보기' })).toBeInTheDocument();
  });
});
