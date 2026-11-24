import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../test/api-harness';
import { SYNTHETIC_SESSION } from '../test/session-harness';
import { useOaAccess, usePlantMode } from './oa-access';
import { SessionProvider } from './session';

/* omf-all-around#336 — OA·부품 공장을 모두 가진 계정은 고른 동작을 따른다. */
const fetch = createStubFetch([
  {
    match: (request) => request.url.includes('/mdm/code-values'),
    respond: () =>
      jsonResponse({ items: [{ code: 'PL13' }], page: { page: 1, size: 100, total: 1 } }),
  },
  {
    match: (request) => request.url.includes('/mdm/plants'),
    respond: () =>
      jsonResponse({
        items: [
          { plantId: 1, plantCode: 'PL11', plantName: '부품', businessUnitId: 1 },
          { plantId: 2, plantCode: 'PL13', plantName: 'OA', businessUnitId: 1 },
        ],
        page: { page: 1, size: 100, total: 2 },
      }),
  },
]);

const Probe = () => {
  const access = useOaAccess();
  const { mixed, mode, setMode } = usePlantMode();
  return (
    <>
      <output>{`${access}/${String(mixed)}/${mode}`}</output>
      <button
        type="button"
        onClick={() => {
          setMode('parts');
        }}
      >
        부품
      </button>
    </>
  );
};

const renderWith = (scopes: { businessUnitId: number; plantId?: number }[]) =>
  renderWithProviders(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
    { session: { ...SYNTHETIC_SESSION, scopes }, fetch },
  );

describe('OA·부품 동작 고르기', () => {
  afterEach(() => {
    globalThis.localStorage.clear();
  });

  it('범위 없음 계정 — 기본은 OA, 「부품」을 고르면 OA 가 아니다', async () => {
    renderWith([]);

    expect(await screen.findByText('oa/true/oa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '부품' }));
    expect(await screen.findByText('not-oa/true/parts')).toBeInTheDocument();
  });

  it('OA 공장만 가진 계정은 고를 수 없고 늘 OA 다', async () => {
    renderWith([{ businessUnitId: 1, plantId: 2 }]);

    expect(await screen.findByText('oa/false/oa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '부품' }));
    expect(await screen.findByText('oa/false/oa')).toBeInTheDocument();
  });
});
