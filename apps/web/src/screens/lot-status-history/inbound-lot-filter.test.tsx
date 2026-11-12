import type { LotQualityStatusForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { LotStatusHistoryScreen } from './screen';

/*
 * FR-035 W-03-01 LOT 현황·변경이력 — 입하 LOT 칸 · 거르기(005 계약 §13 · screens/W-03-01.md).
 * 값은 전부 지어낸 합성값이다.
 */

const t = messages.lotStatusHistory;
const IL_NO = 'IL-20261112-0001';

const row = (overrides: Partial<LotQualityStatusForward>): LotQualityStatusForward => ({
  lotId: 401,
  lotNo: 'SAMPLE-LOT-001',
  itemId: 103,
  lotTypeCode: 'SAMPLE_MATERIAL',
  lotStatusCode: 'SAMPLE_NORMAL',
  onHandQty: 10,
  fullyHeld: false,
  latestTransitionAt: '2026-11-12T09:00:00+07:00',
  versionNo: 1,
  inboundLotId: null,
  inboundLotNo: null,
  ...overrides,
});

const ROWS = [
  row({ lotId: 401, lotNo: 'SAMPLE-LOT-001', inboundLotId: 9901, inboundLotNo: IL_NO }),
  /* 입하 LOT 이 없는 LOT(생산 · 재생) — 칸은 빈칸이다. */
  row({ lotId: 402, lotNo: 'SAMPLE-LOT-002' }),
];

const list = (items: unknown[]) => ({ items, page: { page: 1, size: 50, total: items.length } });

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
};

const locationSearch = (): URLSearchParams =>
  new URLSearchParams(screen.getByTestId('location').textContent ?? '');

const setup = (route = '/quality/lot-status') => {
  const urls: URL[] = [];
  const stub = createStubFetch([
    {
      match: (request) => new URL(request.url).pathname === '/quality/lot-statuses',
      respond: () => jsonResponse({ items: ROWS, page: { page: 1, size: 20, total: ROWS.length } }),
    },
    {
      match: (request) => new URL(request.url).pathname === '/quality/lot-status-summary',
      respond: () =>
        jsonResponse({
          counts: [{ statusCode: 'SAMPLE_NORMAL', lotCount: 2, lotTypeCode: 'SAMPLE_MATERIAL' }],
          asOf: '2026-11-12T09:00:00+07:00',
          outOfScopeCount: null,
        }),
    },
    {
      match: (request) => new URL(request.url).pathname === '/mdm/code-values',
      respond: (request) => {
        const group = new URL(request.url).searchParams.get('codeGroupCode');
        const items =
          group === 'LOT_TYPE'
            ? [{ code: 'SAMPLE_MATERIAL', codeName: '합성 자재', displayOrder: 1, isActive: true }]
            : [{ code: 'SAMPLE_NORMAL', codeName: '합성 정상', displayOrder: 1, isActive: true }];
        return jsonResponse(list(items));
      },
    },
    /* 나머지 참조(창고 · 품목 · 단위 …)는 빈 목록이다 — 이 시험이 보는 것은 입하 LOT 칸 · 조건뿐이다. */
    {
      match: (request) => request.method === 'GET',
      respond: () => jsonResponse(list([])),
    },
  ]);

  renderWithProviders(
    <>
      <SessionProvider>
        <LotStatusHistoryScreen />
      </SessionProvider>
      <LocationProbe />
    </>,
    {
      session: SYNTHETIC_SESSION,
      route,
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return stub(request);
      },
    },
  );

  return { urls, user: userEvent.setup() };
};

const lastOf = (urls: URL[], path: string): URL | undefined =>
  urls.filter(({ pathname }) => pathname === path).at(-1);

describe('FR-035 W-03-01 LOT 현황 — 입하 LOT 칸 · 거르기', () => {
  it('FR-035 목록 표에 「입하 LOT」 칸이 있고, 입하 LOT 이 없는 줄은 빈칸이다', async () => {
    setup();

    const table = await screen.findByRole('table', { name: t.current.pane });
    expect(
      await within(table).findByRole('button', { name: t.current.filterInboundLot(IL_NO) }),
    ).toHaveTextContent(IL_NO);
    expect(within(table).getAllByRole('button', { name: /^입하 LOT .+로 거르기$/ })).toHaveLength(
      1,
    );
    expect(
      within(table)
        .getAllByRole('columnheader')
        .some((header) => (header.textContent ?? '').includes(t.current.columns.inboundLot)),
    ).toBe(true);
  });

  it('FR-035 「입하 LOT 번호」 칸으로 조회하면 목록 · 요약 요청에 inboundLotNo 가 실린다', async () => {
    const { urls, user } = setup();

    await screen.findByRole('table', { name: t.current.pane });
    await user.click(screen.getByRole('button', { name: t.lotFilter.detailOpen }));
    await user.type(
      screen.getByRole('searchbox', { name: t.lotFilter.labels.inboundLotNo }),
      `${IL_NO}{Enter}`,
    );

    await waitFor(() => {
      expect(lastOf(urls, '/quality/lot-statuses')?.searchParams.get('inboundLotNo')).toBe(IL_NO);
    });
    expect(lastOf(urls, '/quality/lot-status-summary')?.searchParams.get('inboundLotNo')).toBe(
      IL_NO,
    );
    expect(locationSearch().get('ilno')).toBe(IL_NO);
  });

  it('FR-035 행의 입하 LOT 번호를 누르면 inboundLotId 로 거르고(상세는 열지 않는다), 거르기 표시의 ✕ 로 지운다', async () => {
    const { urls, user } = setup();

    await user.click(
      await screen.findByRole('button', { name: t.current.filterInboundLot(IL_NO) }),
    );

    await waitFor(() => {
      expect(lastOf(urls, '/quality/lot-statuses')?.searchParams.get('inboundLotId')).toBe('9901');
    });
    expect(lastOf(urls, '/quality/lot-status-summary')?.searchParams.get('inboundLotId')).toBe(
      '9901',
    );
    /* 단추 누름은 줄 고르기로 번지지 않는다. */
    expect(locationSearch().has('lot')).toBe(false);
    expect(screen.getByText(t.lotFilter.inboundLotChip(IL_NO))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.lotFilter.inboundLotChipRemove }));

    await waitFor(() => {
      expect(lastOf(urls, '/quality/lot-statuses')?.searchParams.has('inboundLotId')).toBe(false);
    });
    expect(screen.queryByText(t.lotFilter.inboundLotChip(IL_NO))).toBeNull();
    expect(locationSearch().has('il')).toBe(false);
  });
});
