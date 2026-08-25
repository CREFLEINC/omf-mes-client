import type { components } from '@omf-mes/api-client';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import type { LotStatusCandidate } from './candidate-screen';
import { lotHoldDetailPath, LotStatusTransitionPreparation } from './transition-preparation';

const TRANSITIONS = '/quality/lot-status-transitions';
const HOLDS = '/quality/lot-holds';
const lot = (overrides: Partial<LotStatusCandidate> = {}): LotStatusCandidate => ({
  lotId: 701,
  lotNo: 'SYN-LOT-ALPHA',
  itemId: 801,
  lotStatusCode: 'NORMAL',
  versionNo: 7,
  warehouseId: 31,
  locationId: 41,
  fullyHeld: false,
  ...overrides,
});
const hold = (
  id: number,
  reasonCode: string,
  heldAt = '2026-08-25T08:00:00+09:00',
): components['schemas']['LotHold'] => ({
  lotHoldId: id,
  lotId: 701,
  lotNo: 'SYN-LOT-ALPHA',
  holdQty: 10,
  reasonCode,
  statusCode: 'HELD',
  heldAt,
});
const transition = (
  actionCode: 'RELEASE_HOLD' | 'CREATE_HOLD',
  targetLotStatusCode: string,
  allowed = true,
): components['schemas']['LotStatusTransition'] => ({
  actionCode,
  targetLotStatusCode,
  allowed,
});
const route = (path: string, body: unknown, headers?: HeadersInit, method = 'GET'): StubRoute => ({
  match: (request) => request.method === method && new URL(request.url).pathname === path,
  respond: () => jsonResponse(body, { headers }),
});
const transitionRoute = (
  transitions: components['schemas']['LotStatusTransition'][],
  note?: string,
): StubRoute =>
  route(TRANSITIONS, { lotId: 701, currentLotStatusCode: 'NORMAL', transitions, note });
const statusRoute = route('/mdm/code-values', {
  items: [
    ['NORMAL', '정상'],
    ['DEFECTIVE', '불량'],
    ['INSPECTION_PENDING', '검사 대기'],
  ].map(([code, codeName], index) => ({
    codeValueId: index + 1,
    codeGroupId: 1,
    code,
    codeName,
    displayOrder: index + 1,
    isActive: true,
  })),
  page: { page: 1, size: 50, total: 3 },
});
const holdRoutes = (
  items: components['schemas']['LotHold'][],
  etag: string | null,
): StubRoute[] => [
  route(HOLDS, { items, page: { page: 1, size: 50, total: items.length } }),
  ...items.map((item) =>
    route(lotHoldDetailPath(item.lotHoldId), item, etag === null ? undefined : { ETag: etag }),
  ),
];
const pagedHoldRoutes = (
  pages: Record<number, { items: components['schemas']['LotHold'][]; size: number; total: number }>,
  etag = '"12"',
): StubRoute[] => {
  const items = Object.values(pages).flatMap((page) => page.items);
  return [
    {
      match: (request) => request.method === 'GET' && new URL(request.url).pathname === HOLDS,
      respond: (request) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? 1);
        const result = pages[page] ?? { items: [], size: 50, total: 0 };
        return jsonResponse({
          items: result.items,
          page: { page, size: result.size, total: result.total },
        });
      },
    },
    ...items.map((item) => route(lotHoldDetailPath(item.lotHoldId), item, { ETag: etag })),
  ];
};
const VersionHarness = ({ selected }: { selected: LotStatusCandidate }) => {
  const [current, setCurrent] = useState(selected);
  return (
    <>
      <button type="button" onClick={() => setCurrent({ ...current, versionNo: 8 })}>
        LOT 버전 갱신
      </button>
      <LotStatusTransitionPreparation lot={current} />
    </>
  );
};
const renderPreparation = (routes: StubRoute[], selected = lot(), tracksVersion = false) => {
  const urls: URL[] = [];
  const requests: Request[] = [];
  const stub = createStubFetch([statusRoute, ...routes]);
  const view = renderWithProviders(
    tracksVersion ? (
      <VersionHarness selected={selected} />
    ) : (
      <LotStatusTransitionPreparation lot={selected} />
    ),
    {
      fetch: async (request) => {
        urls.push(new URL(request.url));
        requests.push(request.clone());
        return stub(request);
      },
    },
  );
  return { ...view, requests, urls, user: userEvent.setup() };
};
const choose = async (user: ReturnType<typeof userEvent.setup>, label: string, option: string) => {
  await user.click(await screen.findByLabelText(label));
  await user.click(await screen.findByRole('option', { name: option }));
};
const chooseTransition = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
): Promise<void> => {
  await user.click(await screen.findByRole('radio', { name: label }));
};
const releaseRoute = (
  status = 200,
  message = 'LOT 보류가 이미 해제된 최신 상태입니다.',
): StubRoute => ({
  match: (request) =>
    request.method === 'POST' &&
    new URL(request.url).pathname === `${lotHoldDetailPath(501)}:release`,
  respond: () =>
    jsonResponse(
      status === 200
        ? { ...hold(501, 'QUALITY_A'), statusCode: 'RELEASED' }
        : status === 409
          ? { conflictCause: 'user', message }
          : { message: '잠금 토큰이 만료됐습니다.' },
      { status },
    ),
});
const createRoute = (status = 201, message = 'LOT versionNo 8이 최신 상태입니다.'): StubRoute => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === HOLDS,
  respond: () =>
    jsonResponse(
      status === 201
        ? [hold(601, 'SYN_REASON')]
        : status === 409
          ? { conflictCause: 'user', message }
          : { code: 'INVALID_STATE', message: 'LOT 상태가 바뀌었습니다.' },
      { status },
    ),
});
const prepareRelease = async (
  release: StubRoute,
  detail: StubRoute[] = holdRoutes([hold(501, 'QUALITY_A')], 'W/"11"'),
  selected = lot(),
) => {
  const view = renderPreparation(
    [transitionRoute([transition('RELEASE_HOLD', 'NORMAL')]), ...detail, release],
    selected,
  );
  await chooseTransition(view.user, '정상');
  await screen.findByText('보류 해제 준비가 완료되었습니다.');
  return view;
};
const fillRelease = async (
  user: ReturnType<typeof userEvent.setup>,
  quantity = '5',
  remarks = '재검사 합격으로 해제',
) => {
  await user.click(screen.getByRole('radio', { name: '일부 해제' }));
  await user.type(screen.getByLabelText('해제 수량'), quantity);
  if (remarks !== '') await user.type(screen.getByLabelText('해제 사유 및 비고'), remarks);
};
const fillFullRelease = async (
  user: ReturnType<typeof userEvent.setup>,
  remarks = '재검사 합격으로 전량 해제',
) => user.type(screen.getByLabelText('해제 사유 및 비고'), remarks);
const prepareCreate = async (response = createRoute(), selected = lot({ availableQty: 20 })) => {
  const view = renderPreparation(
    [transitionRoute([transition('CREATE_HOLD', 'DEFECTIVE')]), response],
    selected,
  );
  await chooseTransition(view.user, '불량');
  await screen.findByRole('radio', { name: '전량 보류' });
  return view;
};
const fillCreate = async (
  user: ReturnType<typeof userEvent.setup>,
  quantity = '5',
  reason = 'SYN_REASON',
  remarks = '외관 이상으로 보류',
) => {
  await user.click(screen.getByRole('radio', { name: '일부 보류' }));
  await user.type(screen.getByLabelText('보류 수량'), quantity);
  if (reason !== '') await user.type(screen.getByLabelText('보류 사유'), reason);
  if (remarks !== '') await user.type(screen.getByLabelText('보류 비고'), remarks);
};
const fillFullCreate = async (
  user: ReturnType<typeof userEvent.setup>,
  reason = 'SYN_REASON',
  remarks = '',
) => {
  if (reason !== '') await user.type(screen.getByLabelText('보류 사유'), reason);
  if (remarks !== '') await user.type(screen.getByLabelText('보류 비고'), remarks);
};

describe('Lot Status 전이 준비', () => {
  it('서버 outbound가 없으면 빈 선택기 대신 서버 안내를 표시한다', async () => {
    renderPreparation([transitionRoute([], '현재 LOT은 전이할 수 없습니다.')]);

    expect(await screen.findByText('현재 LOT은 전이할 수 없습니다.')).toBeVisible();
    expect(screen.queryByRole('radiogroup', { name: '전이' })).toBeNull();
  });

  it('서버가 허용한 전이만 LOT Status 이름의 radio로 표시한다', async () => {
    const { user } = renderPreparation([
      transitionRoute([
        transition('CREATE_HOLD', 'DEFECTIVE'),
        transition('RELEASE_HOLD', 'NORMAL', false),
        transition('CREATE_HOLD', 'SYN-UNKNOWN'),
      ]),
    ]);
    const group = await screen.findByRole('radiogroup', { name: '전이' });

    expect(within(group).getAllByRole('radio')).toHaveLength(2);
    expect(within(group).getByRole('radio', { name: '불량' })).toBeVisible();
    expect(within(group).getByRole('radio', { name: 'SYN-UNKNOWN' })).toBeVisible();
    expect(within(group).queryByRole('radio', { name: '정상' })).toBeNull();
    await chooseTransition(user, '불량');
    expect(await screen.findByText('보류 등록 준비가 완료되었습니다.')).toBeVisible();
  });

  it.each([
    [7, '보류 등록 준비가 완료되었습니다.'],
    [undefined, 'LOT 잠금 정보를 확인하지 못해 진행할 수 없습니다.'],
  ])('CREATE_HOLD는 versionNo=%p에서 준비 경계를 지킨다', async (versionNo, expected) => {
    const { requests, urls, user } = renderPreparation(
      [transitionRoute([transition('CREATE_HOLD', 'DEFECTIVE')]), createRoute()],
      lot({ versionNo }),
    );
    await chooseTransition(user, '불량');

    expect(await screen.findByText(expected)).toBeVisible();
    expect(urls.some((url) => url.pathname === HOLDS)).toBe(false);
    if (versionNo === undefined) {
      expect(screen.queryByLabelText('보류 수량')).toBeNull();
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);
    }
  });

  it.each([
    ['0', 'SYN_REASON', '보류 수량은 0보다 커야 합니다.'],
    ['21', 'SYN_REASON', '보류 수량은 보류 가능 수량 20 이하여야 합니다.'],
    ['5', '', '보류 사유를 입력하세요.'],
  ])('CREATE_HOLD 입력 %s/%s를 fail-closed한다', async (quantity, reason, message) => {
    const { requests, user } = await prepareCreate();
    await fillCreate(user, quantity, reason);
    const confirm = screen.getByRole('button', { name: '등록 확인' });

    expect(screen.getByText(message)).toBeVisible();
    expect(confirm).toBeDisabled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);
  });

  it('보류 모드를 바꾸면 이전 입력을 버리고 새 모드의 필수값부터 다시 받는다', async () => {
    const { user } = await prepareCreate();
    await fillCreate(user);
    expect(screen.getByRole('button', { name: '등록 확인' })).toBeEnabled();

    await user.click(screen.getByRole('radio', { name: '전량 보류' }));
    expect(screen.queryByLabelText('보류 수량')).toBeNull();
    expect(screen.getByLabelText('보류 사유')).toHaveValue('');
    expect(screen.getByLabelText('보류 비고')).toHaveValue('');
    expect(screen.getByRole('button', { name: '등록 확인' })).toBeDisabled();
  });

  it('전량 보류는 수량·비고를 생략하고 위치 누락까지 영향 확인 후 등록한다', async () => {
    const { requests, user } = await prepareCreate(
      createRoute(),
      lot({ availableQty: undefined, warehouseId: undefined, locationId: undefined }),
    );
    expect(screen.getByRole('radio', { name: '전량 보류' })).toBeChecked();
    expect(screen.queryByLabelText('보류 수량')).toBeNull();
    expect(screen.getByRole('button', { name: '등록 확인' })).toBeDisabled();
    await fillFullCreate(user);
    await user.click(screen.getByRole('button', { name: '등록 확인' }));
    const dialog = await screen.findByRole('dialog');
    const impact = within(dialog).getByRole('alert');
    expect(impact).toHaveTextContent('이 전이가 하는 일');
    expect(impact).toHaveTextContent('대상 수량: 전량');
    expect(impact).toHaveTextContent('대상 위치: 창고 미확인 / Location 미확인');
    await user.click(within(dialog).getByRole('button', { name: '보류 등록' }));
    await waitFor(() =>
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1),
    );
    expect(await requests.find((request) => request.method === 'POST')!.json()).toEqual({
      lots: [{ lotId: 701, versionNo: 7 }],
      reasonCode: 'SYN_REASON',
      targetLotStatusCode: 'DEFECTIVE',
    });
  });

  it('CREATE_HOLD만 영향 확인 뒤 계약 body·새 멱등 키로 등록하고 조회를 갱신한다', async () => {
    const { queryClient, requests, urls, user } = await prepareCreate();
    const related = [
      ['lot-status-transition', 'candidates', 'synthetic'],
      ['lot-status-transition', 'open-holds', 701],
      ['lot-status-history', 'rows', 'synthetic'],
    ] as const;
    queryClient.setQueryData(related[0], {});
    queryClient.setQueryData(related[1], {
      items: [],
      page: { page: 1, size: 50, total: 0 },
    });
    queryClient.setQueryData(related[2], {});
    await fillCreate(user);
    await user.click(screen.getByRole('button', { name: '등록 확인' }));
    let dialog = await screen.findByRole('dialog');
    const impact = within(dialog).getByRole('alert');
    expect(impact).toHaveTextContent('Hold는 대상 수량의 출고·출하 및 피킹을 막습니다.');
    expect(impact).toHaveTextContent('대상 수량: 5');
    expect(impact).toHaveTextContent('대상 위치: 창고 31 / Location 41');
    expect(impact).toHaveTextContent(
      '다시 사용하려면 Release 전이가 필요하며, 이미 출고된 수량은 회수되지 않습니다.',
    );
    await user.click(within(dialog).getByRole('button', { name: '취소' }));
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: '등록 확인' }));
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '보류 등록' }));
    await waitFor(() =>
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1),
    );
    const sent = requests.find((request) => request.method === 'POST')!;
    expect(await sent.json()).toEqual({
      lots: [{ lotId: 701, versionNo: 7 }],
      holdQty: 5,
      reasonCode: 'SYN_REASON',
      targetLotStatusCode: 'DEFECTIVE',
      remarks: '외관 이상으로 보류',
    });
    expect(sent.headers.get('If-Match')).toBeNull();
    expect(sent.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(await screen.findByText('LOT 보류를 등록했습니다.')).toBeVisible();
    await waitFor(() => expect(urls.filter((url) => url.pathname === TRANSITIONS)).toHaveLength(2));
    expect(related.map((key) => queryClient.getQueryState(key)?.isInvalidated)).toEqual([
      true,
      true,
      true,
    ]);
    expect(requests.some((request) => request.url.includes(':release'))).toBe(false);
  });

  it('CREATE_HOLD 일반 실패는 같은 body·멱등 키로 명시적으로 재시도한다', async () => {
    const { requests, user } = await prepareCreate(createRoute(500));
    await fillCreate(user);
    await user.click(screen.getByRole('button', { name: '등록 확인' }));
    const dialog = await screen.findByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: '보류 등록' });
    await user.click(submit);
    expect(await within(dialog).findByText('LOT 상태가 바뀌었습니다.')).toBeVisible();
    await user.click(submit);
    await waitFor(() =>
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(2),
    );
    const posts = requests.filter((request) => request.method === 'POST');
    expect(posts.map((request) => request.headers.get('Idempotency-Key'))).toEqual([
      posts[0]?.headers.get('Idempotency-Key'),
      posts[0]?.headers.get('Idempotency-Key'),
    ]);
  });

  it.each([
    ['409', createRoute(409), 'LOT versionNo 8이 최신 상태입니다.'],
    [
      '409-empty',
      createRoute(409, ''),
      'LOT 정보가 변경되었습니다. 최신 정보를 불러온 뒤 다시 확인하세요.',
    ],
    ['412', createRoute(412), 'LOT 정보가 변경되었습니다. 최신 정보를 불러온 뒤 다시 확인하세요.'],
  ])(
    '%s CREATE_HOLD 충돌은 서버 최신 상태 또는 fallback 뒤 owner를 비운다',
    async (_case, response, expected) => {
      const { requests, urls, user } = await prepareCreate(response);
      await fillCreate(user);
      await user.click(screen.getByRole('button', { name: '등록 확인' }));
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: '보류 등록' }),
      );
      expect(await screen.findByText(expected)).toBeVisible();
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
      const before = urls.length;
      await user.click(screen.getByRole('button', { name: '최신 불러오기' }));
      await waitFor(() => expect(urls.length).toBeGreaterThan(before));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByRole('region', { name: '보류 등록 입력' })).toBeNull();
      expect(screen.getByRole('radio', { name: '불량' })).not.toBeChecked();
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    },
  );

  it('CREATE_HOLD 전이와 versionNo가 바뀌면 이전 입력·확인을 격리한다', async () => {
    const view = renderPreparation(
      [
        transitionRoute([
          transition('CREATE_HOLD', 'DEFECTIVE'),
          transition('CREATE_HOLD', 'INSPECTION_PENDING'),
        ]),
        createRoute(),
      ],
      lot({ availableQty: 20 }),
      true,
    );
    await chooseTransition(view.user, '불량');
    await fillCreate(view.user);
    await view.user.click(screen.getByRole('button', { name: '등록 확인' }));
    await screen.findByRole('dialog');
    await chooseTransition(view.user, '검사 대기');
    expect(screen.getByRole('radio', { name: '전량 보류' })).toBeChecked();
    expect(screen.queryByLabelText('보류 수량')).toBeNull();
    expect(screen.getByLabelText('보류 사유')).toHaveValue('');
    expect(screen.queryByRole('dialog')).toBeNull();

    await fillCreate(view.user);
    await view.user.click(screen.getByRole('button', { name: 'LOT 버전 갱신' }));
    expect(await screen.findByRole('radio', { name: '전량 보류' })).toBeChecked();
    expect(screen.queryByLabelText('보류 수량')).toBeNull();
    expect(screen.getByLabelText('보류 사유')).toHaveValue('');
  });

  it('열린 보류가 하나면 자동 선택하고 상세 ETag가 있을 때만 준비한다', async () => {
    const selectedHold = hold(501, 'QUALITY_A');
    const { apiClient, urls, user } = renderPreparation([
      transitionRoute([transition('RELEASE_HOLD', 'NORMAL')]),
      ...holdRoutes([selectedHold], 'W/"11"'),
    ]);
    await chooseTransition(user, '정상');

    expect(await screen.findByText('보류 해제 준비가 완료되었습니다.')).toBeVisible();
    expect(apiClient.etags.ifMatch(lotHoldDetailPath(501))).toBe('W/"11"');
    expect(urls.find((url) => url.pathname === HOLDS)?.searchParams.get('open')).toBe('true');
  });

  it('열린 보류가 여러 건이면 전체 자동 해제하지 않고 정확히 한 건을 고른다', async () => {
    const holds = [hold(501, 'QUALITY_A'), hold(502, 'QUALITY_B')];
    const { urls, user } = renderPreparation([
      transitionRoute([transition('RELEASE_HOLD', 'NORMAL')]),
      ...holdRoutes(holds, '"12"'),
    ]);
    await chooseTransition(user, '정상');
    const select = await screen.findByLabelText('해제할 보류');

    expect(select).toHaveTextContent('하나를 선택하세요');
    expect(urls.filter((url) => url.pathname.includes('/quality/lot-holds/'))).toHaveLength(0);
    await choose(user, '해제할 보류', '501 · QUALITY_A · 2026-08-25T08:00:00+09:00');
    await screen.findByText('보류 해제 준비가 완료되었습니다.');
    await fillRelease(user);
    await choose(user, '해제할 보류', '502 · QUALITY_B · 2026-08-25T08:00:00+09:00');
    expect(await screen.findByText('보류 해제 준비가 완료되었습니다.')).toBeVisible();
    expect(screen.getByRole('radio', { name: '전량 해제' })).toBeChecked();
    expect(screen.queryByLabelText('해제 수량')).toBeNull();
    expect(screen.getByLabelText('해제 사유 및 비고')).toHaveValue('');
    expect(urls.filter((url) => url.pathname === lotHoldDetailPath(502))).toHaveLength(1);
  });

  it('열린 보류를 페이지별 조회하고 현재 페이지 선택만 유지한다', async () => {
    const first = [
      hold(501, 'SAME_REASON', '2026-08-25T08:00:00+09:00'),
      hold(502, 'SAME_REASON', '2026-08-25T09:00:00+09:00'),
    ];
    const second = [hold(503, 'SAME_REASON', '2026-08-25T10:00:00+09:00')];
    const { urls, user } = renderPreparation([
      transitionRoute([
        transition('RELEASE_HOLD', 'NORMAL'),
        transition('RELEASE_HOLD', 'DEFECTIVE'),
      ]),
      ...pagedHoldRoutes({
        1: { items: first, size: 2, total: 3 },
        2: { items: second, size: 2, total: 3 },
      }),
    ]);
    await chooseTransition(user, '정상');
    const firstSelect = await screen.findByLabelText('해제할 보류');
    expect(firstSelect).toHaveTextContent('하나를 선택하세요');
    expect(urls.find((url) => url.pathname === HOLDS)?.searchParams.has('page')).toBe(false);
    await choose(user, '해제할 보류', '501 · SAME_REASON · 2026-08-25T08:00:00+09:00');
    await screen.findByText('보류 해제 준비가 완료되었습니다.');
    await fillRelease(user);

    await user.click(screen.getByRole('button', { name: '다음 쪽' }));
    expect(screen.queryByRole('region', { name: '보류 해제 입력' })).toBeNull();
    const secondSelect = await screen.findByLabelText('해제할 보류');
    expect(secondSelect).toHaveTextContent('하나를 선택하세요');
    expect(screen.getByRole('button', { name: '다음 쪽' })).toBeDisabled();
    expect(
      urls
        .filter((url) => url.pathname === HOLDS)
        .at(-1)
        ?.searchParams.get('page'),
    ).toBe('2');
    expect(screen.queryByText('보류 해제 준비가 완료되었습니다.')).toBeNull();
    await choose(user, '해제할 보류', '503 · SAME_REASON · 2026-08-25T10:00:00+09:00');
    await screen.findByText('보류 해제 준비가 완료되었습니다.');

    await chooseTransition(user, '불량');
    expect(screen.getByRole('button', { name: '이전 쪽' })).toBeDisabled();
    expect(await screen.findByLabelText('해제할 보류')).toHaveTextContent('하나를 선택하세요');
    await user.click(screen.getByRole('button', { name: '다음 쪽' }));
    await screen.findByLabelText('해제할 보류');
    await user.click(screen.getByRole('button', { name: '이전 쪽' }));
    expect(screen.queryByRole('region', { name: '보류 해제 입력' })).toBeNull();
    await waitFor(() =>
      expect(
        urls
          .filter((url) => url.pathname === HOLDS)
          .at(-1)
          ?.searchParams.has('page'),
      ).toBe(false),
    );
    expect(await screen.findByLabelText('해제할 보류')).toHaveTextContent('하나를 선택하세요');
  });

  it('잘못된 page size는 무한 페이지로 계산하지 않는다', async () => {
    const { user } = renderPreparation([
      transitionRoute([transition('RELEASE_HOLD', 'NORMAL')]),
      ...pagedHoldRoutes({ 1: { items: [hold(501, 'A'), hold(502, 'B')], size: 0, total: 100 } }),
    ]);
    await chooseTransition(user, '정상');
    await screen.findByLabelText('해제할 보류');

    expect(screen.queryByRole('button', { name: '다음 쪽' })).toBeNull();
    expect(screen.queryByRole('button', { name: '이전 쪽' })).toBeNull();
  });

  it.each([
    [
      '로딩',
      {
        match: (request: Request) => new URL(request.url).pathname === HOLDS,
        respond: () => new Promise<Response>(() => undefined) as unknown as Response,
      },
      '열린 보류를 불러오는 중입니다.',
    ],
    [
      '오류',
      {
        match: (request: Request) => new URL(request.url).pathname === HOLDS,
        respond: () => jsonResponse({ message: 'failed' }, { status: 500 }),
      },
      '열린 보류를 불러오지 못했습니다.',
    ],
    [
      '0건',
      route(HOLDS, { items: [], page: { page: 1, size: 50, total: 0 } }),
      '해제할 열린 보류가 없습니다.',
    ],
  ])('열린 보류 %s 상태를 준비 완료와 구분한다', async (_case, holdsRoute, expected) => {
    const { user } = renderPreparation([
      transitionRoute([transition('RELEASE_HOLD', 'NORMAL')]),
      holdsRoute,
    ]);
    await chooseTransition(user, '정상');

    expect(await screen.findByText(expected)).toBeVisible();
    expect(screen.queryByText('보류 해제 준비가 완료되었습니다.')).toBeNull();
  });

  it('보류 상세 ETag가 없으면 해제를 fail-closed한다', async () => {
    const { user } = renderPreparation([
      transitionRoute([transition('RELEASE_HOLD', 'NORMAL')]),
      ...holdRoutes([hold(501, 'QUALITY_A')], null),
    ]);
    await chooseTransition(user, '정상');

    expect(
      await screen.findByText('LOT 잠금 정보를 확인하지 못해 진행할 수 없습니다.'),
    ).toBeVisible();
    expect(screen.queryByText('보류 해제 준비가 완료되었습니다.')).toBeNull();
  });

  it('RELEASE_HOLD 전이를 바꾸면 단일 hold를 다시 준비하고 이전 입력을 지운다', async () => {
    const { user } = renderPreparation([
      transitionRoute([
        transition('RELEASE_HOLD', 'NORMAL'),
        transition('RELEASE_HOLD', 'DEFECTIVE'),
      ]),
      ...holdRoutes([hold(501, 'QUALITY_A')], '"12"'),
    ]);
    await chooseTransition(user, '정상');
    await screen.findByText('보류 해제 준비가 완료되었습니다.');
    await fillRelease(user);
    await chooseTransition(user, '불량');

    expect(await screen.findByText('보류 해제 준비가 완료되었습니다.')).toBeVisible();
    expect(screen.getByRole('radio', { name: '전량 해제' })).toBeChecked();
    expect(screen.queryByLabelText('해제 수량')).toBeNull();
    expect(screen.getByLabelText('해제 사유 및 비고')).toHaveValue('');
  });

  it('해제 모드를 바꾸면 앞 입력을 버리고 새 모드의 필수값부터 다시 받는다', async () => {
    const { user } = await prepareRelease(releaseRoute());
    await fillRelease(user);
    expect(screen.getByRole('button', { name: '해제 확인' })).toBeEnabled();

    await user.click(screen.getByRole('radio', { name: '전량 해제' }));
    expect(screen.queryByLabelText('해제 수량')).toBeNull();
    expect(screen.getByLabelText('해제 사유 및 비고')).toHaveValue('');
    expect(screen.getByRole('button', { name: '해제 확인' })).toBeDisabled();
  });

  it.each([
    ['0', '해제 수량은 0보다 커야 합니다.'],
    ['11', '해제 수량은 보류 수량 10 이하여야 합니다.'],
  ])('해제 수량 %s를 차단한다', async (quantity, message) => {
    const { requests, user } = await prepareRelease(releaseRoute());
    await fillRelease(user, quantity);
    const confirm = screen.getByRole('button', { name: '해제 확인' });

    expect(screen.getByText(message)).toBeVisible();
    expect(confirm).toBeDisabled();
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);
  });

  it('자유 텍스트 해제 사유 및 비고를 필수로 검사한다', async () => {
    const { user } = await prepareRelease(releaseRoute());
    await fillRelease(user, '5', '');
    const confirm = screen.getByRole('button', { name: '해제 확인' });

    expect(screen.getByText('해제 사유 및 비고를 입력하세요.')).toBeVisible();
    expect(confirm).toBeDisabled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('전량 해제는 수량을 받지 않고 releaseQty를 생략하며 위치 누락도 확인시킨다', async () => {
    const { requests, user } = await prepareRelease(
      releaseRoute(),
      undefined,
      lot({ warehouseId: undefined, locationId: undefined }),
    );
    expect(screen.getByRole('radio', { name: '전량 해제' })).toBeChecked();
    expect(screen.queryByLabelText('해제 수량')).toBeNull();
    expect(screen.getByRole('button', { name: '해제 확인' })).toBeDisabled();
    await fillFullRelease(user);
    await user.click(screen.getByRole('button', { name: '해제 확인' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('대상 수량: 전량');
    expect(dialog).toHaveTextContent('대상 위치: 창고 미확인 / Location 미확인');
    await user.click(within(dialog).getByRole('button', { name: '보류 해제' }));
    await waitFor(() =>
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1),
    );
    expect(await requests.find((request) => request.method === 'POST')!.json()).toEqual({
      targetLotStatusCode: 'NORMAL',
      remarks: '재검사 합격으로 전량 해제',
    });
  });

  it('영향을 확인한 요청만 정확한 body·ETag·새 멱등 키로 보내고 관련 조회를 갱신한다', async () => {
    const { queryClient, requests, urls, user } = await prepareRelease(releaseRoute());
    const related = [
      ['lot-status-transition', 'candidates', 'synthetic'],
      ['lot-status-history', 'rows', 'synthetic'],
    ] as const;
    for (const key of related) queryClient.setQueryData(key, {});
    await fillRelease(user);
    await user.click(screen.getByRole('button', { name: '해제 확인' }));
    let dialog = await screen.findByRole('dialog');
    const impact = within(dialog).getByRole('alert');
    expect(impact).toHaveTextContent('이 전이가 하는 일');
    expect(impact).toHaveTextContent('보류 해제는 대상 수량의 출고·출하 및 피킹 제한을 풉니다.');
    expect(impact).toHaveTextContent('대상 수량: 5');
    expect(impact).toHaveTextContent('대상 위치: 창고 31 / Location 41');
    expect(impact).toHaveTextContent(
      '다시 보류가 필요하면 새 Hold를 등록해야 하며, 이미 출고된 수량은 회수되지 않습니다.',
    );
    await user.click(within(dialog).getByRole('button', { name: '취소' }));
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: '해제 확인' }));
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '보류 해제' }));
    await waitFor(() =>
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1),
    );
    const sent = requests.find((request) => request.method === 'POST')!;
    expect(await sent.json()).toEqual({
      targetLotStatusCode: 'NORMAL',
      releaseQty: 5,
      remarks: '재검사 합격으로 해제',
    });
    expect(sent.headers.get('If-Match')).toBe('W/"11"');
    expect(sent.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(await screen.findByText('LOT 보류를 해제했습니다.')).toBeVisible();
    await waitFor(() =>
      expect(
        [TRANSITIONS, HOLDS, lotHoldDetailPath(501)].map(
          (path) => urls.filter((url) => url.pathname === path).length,
        ),
      ).toEqual([2, 2, 2]),
    );
    expect(related.map((key) => queryClient.getQueryState(key)?.isInvalidated)).toEqual([
      true,
      true,
    ]);
  });

  it.each([
    ['409', releaseRoute(409), 'LOT 보류가 이미 해제된 최신 상태입니다.'],
    [
      '409-empty',
      releaseRoute(409, ''),
      'LOT 정보가 변경되었습니다. 최신 정보를 불러온 뒤 다시 확인하세요.',
    ],
    ['412', releaseRoute(412), 'LOT 정보가 변경되었습니다. 최신 정보를 불러온 뒤 다시 확인하세요.'],
  ])(
    '%s 충돌은 서버 최신 상태 또는 fallback 뒤 owner를 비운다',
    async (_case, response, expected) => {
      const { requests, urls, user } = await prepareRelease(response);
      await fillRelease(user);
      await user.click(screen.getByRole('button', { name: '해제 확인' }));
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: '보류 해제' }),
      );
      expect(await screen.findByText(expected)).toBeVisible();
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
      const before = urls.length;
      await user.click(screen.getByRole('button', { name: '최신 불러오기' }));
      await waitFor(() => expect(urls.length).toBeGreaterThan(before));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByRole('region', { name: '보류 해제 입력' })).toBeNull();
      expect(screen.getByRole('radio', { name: '정상' })).not.toBeChecked();
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    },
  );

  it('재조회 ETag가 바뀌면 낡은 입력과 확인을 새 준비 결과에 넘기지 않는다', async () => {
    let etag = '"11"';
    const selectedHold = hold(501, 'QUALITY_A');
    const detailRoutes: StubRoute[] = [
      route(HOLDS, { items: [selectedHold], page: { page: 1, size: 50, total: 1 } }),
      {
        match: (request) =>
          request.method === 'GET' && new URL(request.url).pathname === lotHoldDetailPath(501),
        respond: () => jsonResponse(selectedHold, { headers: { ETag: etag } }),
      },
    ];
    const { apiClient, user } = await prepareRelease(releaseRoute(409), detailRoutes);
    await fillRelease(user);
    await user.click(screen.getByRole('button', { name: '해제 확인' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '보류 해제' }),
    );
    await screen.findByRole('button', { name: '최신 불러오기' });
    etag = '"12"';
    await user.click(screen.getByRole('button', { name: '최신 불러오기' }));

    await waitFor(() => expect(apiClient.etags.ifMatch(lotHoldDetailPath(501))).toBe('"12"'));
    expect(screen.queryByRole('region', { name: '보류 해제 입력' })).toBeNull();
    expect(screen.getByRole('radio', { name: '정상' })).not.toBeChecked();
    await chooseTransition(user, '정상');
    await screen.findByText('보류 해제 준비가 완료되었습니다.');
    expect(screen.getByRole('radio', { name: '전량 해제' })).toBeChecked();
    expect(screen.queryByLabelText('해제 수량')).toBeNull();
    expect(screen.getByLabelText('해제 사유 및 비고')).toHaveValue('');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
