import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import {
  enabledListResponse,
  makeRatio,
  pageMeta,
  policyCodeOf,
  ratioListResponse,
} from './fixtures';
import { ShotConversionScreen } from './screen';

const t = messages.shotConversion;
const at = (path: string) => (request: Request) => new URL(request.url).pathname === path;
const empty = () => jsonResponse({ items: [], page: pageMeta(0) });

const PLANTS = [
  { plantId: 11, plantCode: 'P1', plantName: '부품', businessUnitId: 1, isActive: true },
  { plantId: 12, plantCode: 'P2', plantName: 'OA', businessUnitId: 1, isActive: true },
];

describe('타발수 환산 — 사업부의 공장 것만', () => {
  afterEach(() => globalThis.localStorage.clear());

  it('다른 공장의 정책은 빼고 공통 정책은 남긴다', async () => {
    renderWithProviders(
      <SessionProvider>
        <ShotConversionScreen />
      </SessionProvider>,
      {
        session: { ...SYNTHETIC_SESSION, scopes: [] },
        fetch: createStubFetch([
          {
            match: (request) =>
              at('/app/operation-policies')(request) &&
              policyCodeOf(request) === 'SHOT_CONVERSION_ENABLED',
            respond: () => jsonResponse(enabledListResponse()),
          },
          {
            match: at('/app/operation-policies'),
            respond: () =>
              jsonResponse(
                ratioListResponse([
                  makeRatio(1, 0.11, { plantId: 11 }),
                  makeRatio(2, 0.22, { plantId: 12 }),
                  makeRatio(3, 0.33),
                ]),
              ),
          },
          {
            match: at('/mdm/code-values'),
            respond: () => jsonResponse({ items: [{ code: 'P2' }], page: pageMeta(1) }),
          },
          {
            match: at('/mdm/plants'),
            respond: () => jsonResponse({ items: PLANTS, page: pageMeta(2) }),
          },
          { match: () => true, respond: empty },
        ]),
      },
    );

    const pane = within(await screen.findByRole('region', { name: t.ratioList.paneTitle }));
    expect(await pane.findAllByText(/0\.22/)).not.toHaveLength(0);
    expect(pane.getAllByText(/0\.33/)).not.toHaveLength(0);
    expect(pane.queryByText(/0\.11/)).not.toBeInTheDocument();
  });
});
