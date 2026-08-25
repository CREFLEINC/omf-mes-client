import type { components } from '@omf-mes/api-client';
import { screen, waitFor } from '@testing-library/react';
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
const route = (path: string, body: unknown, headers?: HeadersInit): StubRoute => ({
  match: (request) => new URL(request.url).pathname === path,
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
  const stub = createStubFetch(routes);
  const view = renderWithProviders(<LotStatusTransitionPreparation lot={selected} />, {
    fetch: async (request) => {
      urls.push(new URL(request.url));
      return stub(request);
    },
  });
  return { ...view, urls, user: userEvent.setup() };
};
const choose = async (user: ReturnType<typeof userEvent.setup>, label: string, option: string) => {
  await user.click(await screen.findByLabelText(label));
  await user.click(await screen.findByRole('option', { name: option }));
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
    await choose(user, '해제할 보류', 'QUALITY_B');
    expect(await screen.findByText('보류 해제 준비가 완료되었습니다.')).toBeVisible();
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

  it('전이를 바꾸면 이전 보류 선택과 token 준비 상태를 지운다', async () => {
    const holds = [hold(501, 'QUALITY_A'), hold(502, 'QUALITY_B')];
    const { user } = renderPreparation([
      transitionRoute([
        transition('RELEASE_HOLD', 'NORMAL'),
        transition('CREATE_HOLD', 'DEFECTIVE'),
      ]),
      ...holdRoutes(holds, '"12"'),
    ]);
    await choose(user, '전이', 'NORMAL');
    await choose(user, '해제할 보류', 'QUALITY_A');
    await screen.findByText('보류 해제 준비가 완료되었습니다.');
    await choose(user, '전이', 'DEFECTIVE');
    await screen.findByText('보류 등록 준비가 완료되었습니다.');
    await choose(user, '전이', 'NORMAL');

    await waitFor(() =>
      expect(screen.getByLabelText('해제할 보류')).toHaveTextContent('하나를 선택하세요'),
    );
    expect(screen.queryByText('보류 해제 준비가 완료되었습니다.')).toBeNull();
  });
});
