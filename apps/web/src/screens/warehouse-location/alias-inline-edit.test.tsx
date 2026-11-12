import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { buildLocationRows } from '../../patterns/location-tree';
import {
  jsonResponse,
  renderHookWithProviders,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { LocationPane } from './location-pane';
import { useCanWriteLocations } from './queries';
import type { Location } from './types';

const t = messages.warehouseLocation;

const base: Location = {
  locationId: 0,
  warehouseId: 1001,
  parentLocationId: null,
  locationCode: '',
  locationName: '',
  isActive: true,
  aliasName: null,
  locationLevelCode: null,
  isLeaf: false,
  systemRoleCode: null,
  hasItemRestriction: false,
};

const LOCATIONS: Location[] = [
  {
    ...base,
    locationId: 1,
    locationCode: 'SYS-STAGING',
    locationName: '적치 대기',
    locationLevelCode: 'ZONE',
    systemRoleCode: 'PUTAWAY_STAGING',
    isLeaf: true,
  },
  { ...base, locationId: 10, locationCode: 'Z01', locationName: 'Z01', locationLevelCode: 'ZONE' },
  {
    ...base,
    locationId: 11,
    parentLocationId: 10,
    locationCode: 'Z01-R001',
    locationName: 'A열 1번 랙', // 옛 화면 — 별칭을 이름으로 넣어 만든 위치
    aliasName: 'A열 1번 랙',
    locationLevelCode: 'RACK',
  },
  {
    ...base,
    locationId: 12,
    parentLocationId: 11,
    locationCode: 'Z01-R001-L01',
    locationName: 'Z01-R001-L01',
    locationLevelCode: 'LEVEL',
  },
  {
    ...base,
    locationId: 13,
    parentLocationId: 12,
    locationCode: 'Z01-R001-L01-C01',
    locationName: 'Z01-R001-L01-C01',
    locationLevelCode: 'CELL',
    isLeaf: true,
  },
];

interface Recorded {
  method: string;
  path: string;
  headers: Headers;
  body: string;
}

const pathOf = (request: Request): string => new URL(request.url).pathname;

/** 상세 GET(잠금 값 `"v{n}"`)과 PUT 을 기록한다. `putStatus` 로 PUT 응답을 고른다. */
const renderPane = (
  options: { canEditAlias?: boolean; putStatus?: number; latestAlias?: string } = {},
) => {
  const requests: Recorded[] = [];
  let version = 1;
  let gets = 0;
  const routes: StubRoute[] = [
    {
      match: (request) =>
        request.method === 'GET' && /^\/mdm\/locations\/\d+$/.test(pathOf(request)),
      respond: (request) => {
        gets += 1;
        const id = Number(pathOf(request).split('/').pop());
        const found = LOCATIONS.find((location) => location.locationId === id)!;
        /* 두 번째 GET 부터는 다른 사용자가 고친 값이 보인다. */
        const location =
          gets > 1 && options.latestAlias !== undefined
            ? { ...found, aliasName: options.latestAlias }
            : found;
        return jsonResponse(
          { location, editability: { codeEditable: false, reason: 'EDITABLE' } },
          { headers: { ETag: `"v${String(version)}"` } },
        );
      },
    },
    {
      match: (request) => request.method === 'PUT',
      respond: (request) => {
        const status = options.putStatus ?? 200;
        if (status === 409) {
          version += 1;
          return jsonResponse({ conflictCause: 'user', message: '' }, { status });
        }
        if (status === 412) {
          version += 1;
          return jsonResponse({ message: '' }, { status });
        }
        const id = Number(pathOf(request).split('/').pop());
        return jsonResponse(
          { location: LOCATIONS.find((location) => location.locationId === id) },
          { headers: { ETag: `"v${String(version + 1)}"` } },
        );
      },
    },
  ];
  const fetch = async (request: Request): Promise<Response> => {
    requests.push({
      method: request.method,
      path: pathOf(request),
      headers: new Headers(request.headers),
      body: request.method === 'GET' ? '' : await request.clone().text(),
    });
    const route = routes.find((candidate) => candidate.match(request));
    if (route === undefined) throw new Error(`스텁에 없는 요청: ${request.method} ${request.url}`);
    return route.respond(request);
  };

  const rows = buildLocationRows(LOCATIONS, new Set([10, 11, 12]));
  const result = renderWithProviders(
    <LocationPane
      rows={rows}
      isLoading={false}
      expandedIds={new Set([10, 11, 12])}
      onToggleExpand={vi.fn()}
      onCollapseAll={vi.fn()}
      onExpandAll={vi.fn()}
      selectedIds={[]}
      onSelectionChange={vi.fn()}
      filterText=""
      onFilterTextChange={vi.fn()}
      canAddRoot
      addRootDisabledReason=""
      onAddRoot={vi.fn()}
      canAddChild={false}
      onAddChild={vi.fn()}
      canPrintLabels={false}
      isPrintingLabels={false}
      onPrintLabels={vi.fn()}
      onEdit={vi.fn()}
      actionBanner={null}
      loadError={null}
      canEditAlias={options.canEditAlias ?? true}
    />,
    { fetch },
  );
  const invalidate = vi.spyOn(result.queryClient, 'invalidateQueries');
  return { requests, invalidate, user: userEvent.setup() };
};

const puts = (requests: Recorded[]) => requests.filter((request) => request.method === 'PUT');

describe('별칭 바로 고치기 (목록)', () => {
  it('US2-1 ⭐ 저장하면 If-Match 와 함께 PUT 하고(이름 = 새 별칭) 목록을 다시 읽는다', async () => {
    const { requests, invalidate, user } = renderPane();

    await user.click(screen.getByRole('button', { name: t.aliasEdit.edit('Z01-R001') }));
    const input = await screen.findByRole('textbox', { name: t.aliasEdit.edit('Z01-R001') });
    expect(input).toHaveValue('A열 1번 랙');
    await user.clear(input);
    await user.type(input, '  B열 2번 랙 {Enter}');

    await waitFor(() => expect(puts(requests)).toHaveLength(1));
    const put = puts(requests)[0]!;
    expect(put.path).toBe('/mdm/locations/11');
    expect(put.headers.get('If-Match')).toBe('"v1"');
    expect(JSON.parse(put.body)).toEqual({ locationName: 'B열 2번 랙', aliasName: 'B열 2번 랙' });
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: t.aliasEdit.edit('Z01-R001') })).toBeNull(),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['locations'] });
  });

  it('US2-1 확인 단추로도 저장하고, 비우면 별칭을 지우고 이름은 코드로 돌아간다', async () => {
    const { requests, user } = renderPane();

    await user.click(screen.getByRole('button', { name: t.aliasEdit.edit('Z01-R001') }));
    const input = await screen.findByRole('textbox', { name: t.aliasEdit.edit('Z01-R001') });
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(puts(requests)).toHaveLength(1));
    expect(JSON.parse(puts(requests)[0]!.body)).toEqual({
      locationName: 'Z01-R001',
      aliasName: null,
    });
  });

  it('US2-1 Esc 는 저장하지 않고 닫는다', async () => {
    const { requests, user } = renderPane();

    await user.click(screen.getByRole('button', { name: t.aliasEdit.edit('Z01-R001') }));
    const input = await screen.findByRole('textbox', { name: t.aliasEdit.edit('Z01-R001') });
    await user.type(input, '바뀜{Escape}');

    expect(screen.queryByRole('textbox', { name: t.aliasEdit.edit('Z01-R001') })).toBeNull();
    expect(screen.getByText('A열 1번 랙')).toBeInTheDocument();
    expect(puts(requests)).toHaveLength(0);
  });

  it.each([409, 412])(
    'US2-1 ⭐ %i 이면 줄에 충돌 안내를 띄우고 최신 별칭 · 잠금 값을 다시 읽는다',
    async (status) => {
      const { requests, invalidate, user } = renderPane({
        putStatus: status,
        latestAlias: '남이 고친 이름',
      });

      await user.click(screen.getByRole('button', { name: t.aliasEdit.edit('Z01-R001') }));
      const input = await screen.findByRole('textbox', { name: t.aliasEdit.edit('Z01-R001') });
      await user.clear(input);
      await user.type(input, '내 이름{Enter}');

      expect(await screen.findByText(t.aliasEdit.conflict)).toBeInTheDocument();
      expect(input).toHaveValue('남이 고친 이름');
      expect(input).toBeEnabled();
      expect(
        requests.filter(
          (request) => request.method === 'GET' && request.path === '/mdm/locations/11',
        ),
      ).toHaveLength(2);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['locations'] });
    },
  );

  it('US2-1 권한이 없으면 연필이 없다', () => {
    renderPane({ canEditAlias: false });

    expect(screen.queryByRole('button', { name: t.aliasEdit.edit('Z01-R001') })).toBeNull();
    expect(screen.getByText('A열 1번 랙')).toBeInTheDocument();
  });

  it('US2-1 구역 · 랙 · 층 · 셀 모두와 서버가 만든 자리(별칭만 고침)에 연필이 있다', () => {
    renderPane();

    for (const code of ['SYS-STAGING', 'Z01', 'Z01-R001', 'Z01-R001-L01', 'Z01-R001-L01-C01']) {
      expect(screen.getByRole('button', { name: t.aliasEdit.edit(code) })).toBeInTheDocument();
    }
  });

  it('US2-1 서버가 만든 자리는 이름(적치 대기)을 그대로 두고 별칭만 바꾼다', async () => {
    const { requests, user } = renderPane();

    await user.click(screen.getByRole('button', { name: t.aliasEdit.edit('SYS-STAGING') }));
    const input = await screen.findByRole('textbox', { name: t.aliasEdit.edit('SYS-STAGING') });
    await user.type(input, '입고 대기 자리{Enter}');

    await waitFor(() => expect(puts(requests)).toHaveLength(1));
    expect(JSON.parse(puts(requests)[0]!.body)).toEqual({
      locationName: '적치 대기',
      aliasName: '입고 대기 자리',
    });
  });

  it('US2-1 한 번에 한 줄만 고친다 — 다른 줄 연필을 누르면 앞 줄 입력칸이 닫힌다', async () => {
    const { user } = renderPane();

    await user.click(screen.getByRole('button', { name: t.aliasEdit.edit('Z01-R001') }));
    await screen.findByRole('textbox', { name: t.aliasEdit.edit('Z01-R001') });
    await user.click(screen.getByRole('button', { name: t.aliasEdit.edit('Z01') }));

    expect(screen.queryByRole('textbox', { name: t.aliasEdit.edit('Z01-R001') })).toBeNull();
    const row = screen.getByRole('textbox', { name: t.aliasEdit.edit('Z01') }).closest('tr')!;
    expect(within(row).getByRole('button', { name: 'Z01' })).toBeInTheDocument();
  });
});

describe('useCanWriteLocations', () => {
  it('US2-1 세션 권한에 W-06-07 이 없으면 거짓, 있거나 모르면 참', () => {
    const without = renderHookWithProviders(() => useCanWriteLocations(), {
      session: { ...SYNTHETIC_SESSION, permissions: ['W-CO-08'] },
    });
    expect(without.result.current).toBe(false);

    const withIt = renderHookWithProviders(() => useCanWriteLocations(), {
      session: { ...SYNTHETIC_SESSION, permissions: ['W-06-07'] },
    });
    expect(withIt.result.current).toBe(true);

    const unknown = renderHookWithProviders(() => useCanWriteLocations(), {
      session: SYNTHETIC_SESSION,
    });
    expect(unknown.result.current).toBe(true);
  });
});
