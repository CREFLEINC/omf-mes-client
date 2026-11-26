import type { components } from '@omf-mes/api-client';
import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { RoutingScreen } from './screen';

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

describe('라우팅 — 사업부의 공장 품목만(서버 #1156)', () => {
  afterEach(() => globalThis.localStorage.clear());

  it('품목 목록과 진행 상태 칩 건수를 OA 공장으로 부른다', async () => {
    const urls: URL[] = [];
    renderWithProviders(
      <SessionProvider>
        <RoutingScreen />
      </SessionProvider>,
      {
        session: { ...SYNTHETIC_SESSION, scopes: [] },
        route: '/master-data/routing',
        dataRouter: true,
        fetch: async (request: Request) => {
          const url = new URL(request.url);
          urls.push(url);
          if (url.pathname === '/mdm/plants') {
            return jsonResponse({ items: PLANTS, page: { ...EMPTY_PAGE, total: PLANTS.length } });
          }
          if (url.pathname === '/mdm/code-values') {
            return jsonResponse({ items: [{ code: 'PL-OA' }], page: { ...EMPTY_PAGE, total: 1 } });
          }
          return jsonResponse({ items: [], page: EMPTY_PAGE });
        },
      },
    );

    const items = () => urls.filter((url) => url.pathname === '/mdm/items');
    await waitFor(() => {
      /* 목록 한 번 + 칩 넷(작성중 · 확정 · 폐기 · 미등록). */
      expect(items().length).toBeGreaterThanOrEqual(5);
    });
    for (const url of items()) {
      expect(url.searchParams.get('plantId')).toBe('12');
    }
  });
});
