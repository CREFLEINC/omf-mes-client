import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../test/api-harness';
import { SYNTHETIC_SESSION } from '../test/session-harness';
import { plantSelectOf, useMasterDataPlant, useOnMasterDataPlantChange } from './master-data-plant';
import { usePlantMode } from './oa-access';
import { SessionProvider } from './session';

/** 공장 값은 합성이다 — 9는 사업부에 매이지 않은 공장, 8은 사용 중지 공장. */
const PLANTS = [
  { plantId: 9, plantCode: 'PX', plantName: '매이지 않음', isActive: true },
  { plantId: 8, plantCode: 'PY', plantName: '중지', businessUnitId: 1, isActive: false },
  { plantId: 1, plantCode: 'PL11', plantName: '부품', businessUnitId: 1, isActive: true },
  { plantId: 2, plantCode: 'PL13', plantName: 'OA', businessUnitId: 1, isActive: true },
];

const stub = (plants: unknown[] | null) =>
  createStubFetch([
    {
      match: (request) => request.url.includes('/mdm/code-values'),
      respond: () =>
        jsonResponse({ items: [{ code: 'PL13' }], page: { page: 1, size: 100, total: 1 } }),
    },
    {
      match: (request) => request.url.includes('/mdm/plants'),
      respond: () =>
        plants === null
          ? jsonResponse({ code: 'SERVER_ERROR', message: '오류' }, { status: 500 })
          : jsonResponse({ items: plants, page: { page: 1, size: 100, total: plants.length } }),
    },
  ]);

let changes = 0;

const Probe = ({ requested }: { requested: string }) => {
  const plant = useMasterDataPlant(requested);
  const { setMode } = usePlantMode();
  useOnMasterDataPlantChange(plant, () => {
    changes += 1;
  });
  return (
    <>
      <output>
        {plant.isChecking
          ? '확인 중'
          : `조회 ${plant.plantId} / 고름 ${plant.picked} / 선택지 ${plant.options === null ? '화면' : String(plant.options.length)}`}
      </output>
      <button type="button" onClick={() => setMode('parts')}>
        부품
      </button>
    </>
  );
};

const renderWith = (
  scopes: { businessUnitId: number; plantId?: number }[],
  requested = '',
  plants: unknown[] | null = PLANTS,
) =>
  renderWithProviders(
    <SessionProvider>
      <Probe requested={requested} />
    </SessionProvider>,
    { session: { ...SYNTHETIC_SESSION, scopes }, fetch: stub(plants) },
  );

describe('기준정보 목록의 공장', () => {
  afterEach(() => {
    globalThis.localStorage.clear();
    changes = 0;
  });

  it('두 공장 계정 — 고른 사업부의 공장만, 사업부를 바꾸면 선택을 풀라고 한 번 알린다', async () => {
    renderWith([]);

    expect(screen.getByText('확인 중')).toBeInTheDocument();
    expect(await screen.findByText('조회 2 / 고름 / 선택지 0')).toBeInTheDocument();
    expect(changes).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: '부품' }));
    expect(await screen.findByText('조회 1 / 고름 / 선택지 0')).toBeInTheDocument();
    expect(changes).toBe(1);
  });

  it('한쪽 공장만 가진 계정은 그 공장으로 고정되고 주소의 다른 공장은 버린다', async () => {
    renderWith([{ businessUnitId: 1, plantId: 1 }], '2');

    expect(await screen.findByText('조회 1 / 고름 / 선택지 0')).toBeInTheDocument();
  });

  it('사업부의 공장이 여럿이면 그 안에서만 고르고 「전체」는 없다', async () => {
    const more = [
      ...PLANTS,
      { plantId: 3, plantCode: 'PL12', plantName: '부품 2', businessUnitId: 1, isActive: true },
    ];
    renderWith(
      [
        { businessUnitId: 1, plantId: 1 },
        { businessUnitId: 1, plantId: 3 },
      ],
      '3',
      more,
    );

    expect(await screen.findByText('조회 3 / 고름 3 / 선택지 2')).toBeInTheDocument();
  });

  it('판단할 근거를 못 받으면 좁히지 않는다', async () => {
    renderWith([], '2', null);

    expect(await screen.findByText('조회 2 / 고름 2 / 선택지 화면')).toBeInTheDocument();
  });
});

describe('공장 선택칸', () => {
  const all = [{ value: '', label: '전체' }];

  it('고를 것이 없으면 감추고, 근거가 없으면 화면의 선택지를 그대로 낸다', () => {
    expect(plantSelectOf({ options: [], plantId: '1' }, '', all)).toBeNull();
    expect(plantSelectOf(undefined, '', all)).toEqual({ options: all, value: '' });
  });

  it('여럿이면 조회 중인 공장을 고른 것으로 보인다', () => {
    const options = [{ value: '1', label: '부품' }];
    expect(plantSelectOf({ options, plantId: '1' }, '', all)).toEqual({ options, value: '1' });
  });
});
