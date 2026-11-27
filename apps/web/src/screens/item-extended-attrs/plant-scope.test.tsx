import type { components } from '@omf-mes/api-client';
import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { ItemBomScreen } from './bom-screen';
import { itemFixtures } from './fixtures';
import { ItemExtendedAttrsScreen } from './screen';

type Plant = components['schemas']['Plant'];

const plant = (plantId: number, plantCode: string): Plant => ({
  plantId,
  legalEntityId: 1,
  businessUnitId: 1,
  plantCode,
  plantName: plantCode,
  timezoneCode: 'UTC',
  isActive: true,
});

const PLANTS = [plant(11, 'PL-PARTS'), plant(12, 'PL-OA')];
const EMPTY_PAGE = { page: 1, size: 20, total: 0 };

/** 공장 둘 중 PL-OA 가 OA 공장이다(코드 그룹 INSPECTION_SHEET_PLANT). 나머지 조회는 빈 목록으로 답한다. */
const recordingFetch = () => {
  const urls: URL[] = [];
  const fetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    urls.push(url);
    if (url.pathname === '/mdm/plants') {
      return jsonResponse({ items: PLANTS, page: { ...EMPTY_PAGE, total: PLANTS.length } });
    }
    if (url.pathname === '/mdm/code-values') {
      return jsonResponse({ items: [{ code: 'PL-OA' }], page: { ...EMPTY_PAGE, total: 1 } });
    }
    if (/^\/mdm\/items\/\d+$/.test(url.pathname)) {
      return jsonResponse({
        item: itemFixtures[0],
        editability: { codeEditable: false, reason: 'EDITABLE' },
      });
    }
    return jsonResponse({ items: [], page: EMPTY_PAGE });
  };
  return { urls, fetch };
};

const sent = (urls: URL[], pathname: string) => urls.filter((url) => url.pathname === pathname);

const renderAt = (element: React.ReactNode, route: string) => {
  const { urls, fetch } = recordingFetch();
  renderWithProviders(<SessionProvider>{element}</SessionProvider>, {
    session: { ...SYNTHETIC_SESSION, scopes: [] },
    fetch,
    route,
  });
  return urls;
};

describe('품목·BOM 정보 — 사업부의 공장 품목만(서버 #1156)', () => {
  afterEach(() => globalThis.localStorage.clear());

  it('품목 탭은 OA 공장으로 품목을 부르고, 공장을 정하기 전에는 부르지 않는다', async () => {
    const urls = renderAt(<ItemExtendedAttrsScreen />, '/master-data/item-extended-attrs');

    await waitFor(() => {
      expect(sent(urls, '/mdm/items').length).toBeGreaterThan(0);
    });
    for (const url of sent(urls, '/mdm/items')) {
      expect(url.searchParams.get('plantId')).toBe('12');
    }
  });

  it('BOM 탭은 모품목과 고른 모품목의 BOM 을 같은 공장으로 부른다', async () => {
    const urls = renderAt(<ItemBomScreen />, '/master-data/item-boms?item=1001');

    await waitFor(() => {
      expect(sent(urls, '/mdm/items').length).toBeGreaterThan(0);
      expect(sent(urls, '/planning/boms').length).toBeGreaterThan(0);
    });
    const parents = sent(urls, '/mdm/items');
    expect(parents.every((url) => url.searchParams.get('plantId') === '12')).toBe(true);
    expect(parents[0]?.searchParams.get('hasBom')).toBe('true');
    for (const url of sent(urls, '/planning/boms')) {
      expect(url.searchParams.get('plantId')).toBe('12');
      expect(url.searchParams.get('parentItemId')).toBe('1001');
    }
  });

  it('세션이 없어 공장을 정할 근거가 없으면 공장으로 거르지 않는다', async () => {
    const { urls, fetch } = recordingFetch();
    renderWithProviders(
      <SessionProvider>
        <ItemExtendedAttrsScreen />
      </SessionProvider>,
      { session: null, fetch, route: '/master-data/item-extended-attrs' },
    );

    await waitFor(() => {
      expect(sent(urls, '/mdm/items').length).toBeGreaterThan(0);
    });
    expect(sent(urls, '/mdm/items')[0]?.searchParams.has('plantId')).toBe(false);
  });
});
