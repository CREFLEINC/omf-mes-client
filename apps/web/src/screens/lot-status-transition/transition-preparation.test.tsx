import type { components } from '@omf-mes/api-client';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  fullyHeld: false,
  ...overrides,
});
const hold = (id: number, reasonCode: string): components['schemas']['LotHold'] => ({
  lotHoldId: id,
  lotId: 701,
  lotNo: 'SYN-LOT-ALPHA',
  holdQty: 10,
  reasonCode,
  statusCode: 'HELD',
  heldAt: '2026-08-25T08:00:00+09:00',
});
const transition = (
  actionCode: 'RELEASE_HOLD' | 'CREATE_HOLD',
  targetLotStatusCode: string,
): components['schemas']['LotStatusTransition'] => ({
  actionCode,
  targetLotStatusCode,
  allowed: true,
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
const holdRoutes = (
  items: components['schemas']['LotHold'][],
  etag: string | null,
): StubRoute[] => [
  route(HOLDS, { items, page: { page: 1, size: 50, total: items.length } }),
  ...items.map((item) =>
    route(lotHoldDetailPath(item.lotHoldId), item, etag === null ? undefined : { ETag: etag }),
  ),
];
const renderPreparation = (routes: StubRoute[], selected = lot()) => {
  const urls: URL[] = [];
  const requests: Request[] = [];
  const stub = createStubFetch(routes);
  const view = renderWithProviders(<LotStatusTransitionPreparation lot={selected} />, {
    fetch: async (request) => {
      urls.push(new URL(request.url));
      requests.push(request.clone());
      return stub(request);
    },
  });
  return { ...view, requests, urls, user: userEvent.setup() };
};
const choose = async (user: ReturnType<typeof userEvent.setup>, label: string, option: string) => {
  await user.click(await screen.findByLabelText(label));
  await user.click(await screen.findByRole('option', { name: option }));
};
const releaseRoute = (status = 200): StubRoute => ({
  match: (request) =>
    request.method === 'POST' &&
    new URL(request.url).pathname === `${lotHoldDetailPath(501)}:release`,
  respond: () =>
    jsonResponse(
      status === 200
        ? { ...hold(501, 'QUALITY_A'), statusCode: 'RELEASED' }
        : status === 409
          ? { conflictCause: 'user', message: '다른 사용자가 먼저 변경했습니다.' }
          : { message: '잠금 토큰이 만료됐습니다.' },
      { status },
    ),
});
const prepareRelease = async (
  release: StubRoute,
  detail: StubRoute[] = holdRoutes([hold(501, 'QUALITY_A')], 'W/"11"'),
) => {
  const view = renderPreparation([
    transitionRoute([transition('RELEASE_HOLD', 'NORMAL')]),
    ...detail,
    release,
  ]);
  await choose(view.user, '전이', 'NORMAL');
  await screen.findByText('보류 해제 준비가 완료되었습니다.');
  return view;
};
const fillRelease = async (
  user: ReturnType<typeof userEvent.setup>,
  quantity = '5',
  remarks = '재검사 합격으로 해제',
) => {
  await user.type(screen.getByLabelText('해제 수량'), quantity);
  if (remarks !== '') await user.type(screen.getByLabelText('해제 사유 및 비고'), remarks);
};

describe('Lot Status 전이 준비', () => {
  it('서버 outbound가 없으면 빈 선택기 대신 서버 안내를 표시한다', async () => {
    renderPreparation([transitionRoute([], '현재 LOT은 전이할 수 없습니다.')]);

    expect(await screen.findByText('현재 LOT은 전이할 수 없습니다.')).toBeVisible();
    expect(screen.queryByLabelText('전이')).toBeNull();
  });

  it.each([
    [7, '보류 등록 준비가 완료되었습니다.'],
    [undefined, 'LOT 잠금 정보를 확인하지 못해 진행할 수 없습니다.'],
  ])('CREATE_HOLD는 versionNo=%p에서 준비 경계를 지킨다', async (versionNo, expected) => {
    const { urls, user } = renderPreparation(
      [transitionRoute([transition('CREATE_HOLD', 'DEFECTIVE')])],
      lot({ versionNo }),
    );
    await choose(user, '전이', 'DEFECTIVE');

    expect(await screen.findByText(expected)).toBeVisible();
    expect(urls.some((url) => url.pathname === HOLDS)).toBe(false);
  });

  it('열린 보류가 하나면 자동 선택하고 상세 ETag가 있을 때만 준비한다', async () => {
    const selectedHold = hold(501, 'QUALITY_A');
    const { apiClient, urls, user } = renderPreparation([
      transitionRoute([transition('RELEASE_HOLD', 'NORMAL')]),
      ...holdRoutes([selectedHold], 'W/"11"'),
    ]);
    await choose(user, '전이', 'NORMAL');

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
    await choose(user, '전이', 'NORMAL');
    const select = await screen.findByLabelText('해제할 보류');

    expect(select).toHaveTextContent('하나를 선택하세요');
    expect(urls.filter((url) => url.pathname.includes('/quality/lot-holds/'))).toHaveLength(0);
    await choose(user, '해제할 보류', 'QUALITY_A');
    await screen.findByText('보류 해제 준비가 완료되었습니다.');
    await fillRelease(user);
    await choose(user, '해제할 보류', 'QUALITY_B');
    expect(await screen.findByText('보류 해제 준비가 완료되었습니다.')).toBeVisible();
    expect(screen.getByLabelText('해제 수량')).toHaveValue('');
    expect(screen.getByLabelText('해제 사유 및 비고')).toHaveValue('');
    expect(urls.filter((url) => url.pathname === lotHoldDetailPath(502))).toHaveLength(1);
  });

  it('보류 상세 ETag가 없으면 해제를 fail-closed한다', async () => {
    const { user } = renderPreparation([
      transitionRoute([transition('RELEASE_HOLD', 'NORMAL')]),
      ...holdRoutes([hold(501, 'QUALITY_A')], null),
    ]);
    await choose(user, '전이', 'NORMAL');

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
    await choose(user, '전이', 'NORMAL');
    await screen.findByText('보류 해제 준비가 완료되었습니다.');
    await fillRelease(user);
    await choose(user, '전이', 'DEFECTIVE');

    expect(await screen.findByText('보류 해제 준비가 완료되었습니다.')).toBeVisible();
    expect(screen.getByLabelText('해제 수량')).toHaveValue('');
    expect(screen.getByLabelText('해제 사유 및 비고')).toHaveValue('');
  });

  it.each([
    ['0', '해제 수량은 0보다 커야 합니다.'],
    ['11', '해제 수량은 보류 수량 10 이하여야 합니다.'],
  ])('해제 수량 %s를 차단한다', async (quantity, message) => {
    const { requests, user } = await prepareRelease(releaseRoute());
    await fillRelease(user, quantity);
    await user.click(screen.getByRole('button', { name: '해제 확인' }));

    expect(screen.getByText(message)).toBeVisible();
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);
  });

  it('자유 텍스트 해제 사유 및 비고를 필수로 검사한다', async () => {
    const { user } = await prepareRelease(releaseRoute());
    await fillRelease(user, '5', '');
    await user.click(screen.getByRole('button', { name: '해제 확인' }));

    expect(screen.getByText('해제 사유 및 비고를 입력하세요.')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('영향을 확인한 요청만 정확한 body·ETag·새 멱등 키로 보내고 관련 조회를 갱신한다', async () => {
    const { queryClient, requests, urls, user } = await prepareRelease(releaseRoute());
    queryClient.setQueryData(['lot-status-transition', 'candidates', 'synthetic'], {});
    await fillRelease(user);
    await user.click(screen.getByRole('button', { name: '해제 확인' }));
    let dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('창고 사용과 출고·출하 및 피킹 가능 여부가 바뀝니다.');
    expect(dialog).toHaveTextContent('이미 출고된 수량은 회수되지 않습니다.');
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
    expect(
      queryClient.getQueryState(['lot-status-transition', 'candidates', 'synthetic'])
        ?.isInvalidated,
    ).toBe(true);
  });

  it.each([409, 412])(
    '%s 충돌은 자동 재실행 없이 stale 안내와 재조회만 제공한다',
    async (status) => {
      const { requests, urls, user } = await prepareRelease(releaseRoute(status));
      await fillRelease(user);
      await user.click(screen.getByRole('button', { name: '해제 확인' }));
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: '보류 해제' }),
      );
      expect(
        await screen.findByText(
          'LOT 정보가 변경되었습니다. 최신 정보를 불러온 뒤 다시 확인하세요.',
        ),
      ).toBeVisible();
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
      const before = urls.length;
      await user.click(screen.getByRole('button', { name: '최신 불러오기' }));
      await waitFor(() => expect(urls.length).toBeGreaterThan(before));
      expect(screen.queryByRole('dialog')).toBeNull();
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
    expect(await screen.findByLabelText('해제 수량')).toHaveValue('');
    expect(screen.getByLabelText('해제 사유 및 비고')).toHaveValue('');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
