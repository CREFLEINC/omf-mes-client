import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { MaterialLocationScreen } from './screen';

const SCANNED = '0001234500000012002607310001230007';

const page = { page: 0, size: 20, totalElements: 1, totalPages: 1 };

const lotRow = {
  lotId: 4,
  lotNo: SCANNED,
  itemId: 31,
  lotTypeCode: 'MATERIAL',
  plantId: 1,
  initialQty: 120,
  uomId: 41,
  sourceTypeCode: 'RECEIPT',
  sourceId: 1,
  statusCode: 'ACTIVE',
};

const balanceRow = (overrides: Record<string, unknown> = {}) => ({
  groupBy: 'LOCATION',
  warehouseId: 11,
  locationId: 21,
  itemId: 31,
  lotId: 4,
  ownershipTypeCode: 'OWNED',
  onHandQty: 120,
  reservedQty: 20,
  pickedQty: 0,
  blockedQty: 0,
  availableQty: 100,
  uomId: 41,
  ...overrides,
});

const route = (pathname: string, body: unknown): StubRoute => ({
  match: (request) => new URL(request.url).pathname === pathname,
  respond: () => jsonResponse(body),
});

interface StubOptions {
  balances?: unknown[];
  holds?: unknown[];
  lots?: unknown[];
}

const stub = (options: StubOptions = {}) =>
  createStubFetch([
    route('/trace/lots', { items: options.lots ?? [lotRow], page }),
    route('/inventory/balances', { items: options.balances ?? [balanceRow()], page }),
    route('/trace/lots/4/holds', { items: options.holds ?? [] }),
    route('/mdm/warehouses/11', { warehouse: { warehouseName: '1공장 자재창고' } }),
    route('/mdm/locations/21', {
      location: { locationCode: 'A-01-03', locationName: '3단 선반' },
    }),
    route('/mdm/locations/22', { location: { locationCode: 'B-02-01', locationName: '평치장' } }),
    route('/mdm/items/31', { item: { itemCode: 'ABC-123' } }),
    route('/mdm/uoms', { items: [{ uomId: 41, uomCode: 'EA' }], page }),
  ]);

const scan = async (value = SCANNED) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('스캔 대기'), `${value}{Enter}`);
  return user;
};

describe('자재 위치 확인 화면', () => {
  it('스캔하기 전에는 결과를 보이지 않는다', () => {
    renderWithProviders(<MaterialLocationScreen />, { fetch: stub() });

    expect(screen.getByLabelText('스캔 대기')).toBeInTheDocument();
    expect(screen.queryByText('보유')).not.toBeInTheDocument();
  });

  it('스캔한 LOT 번호를 다섯 토막으로 보인다', async () => {
    renderWithProviders(<MaterialLocationScreen />, { fetch: stub() });
    await scan();

    expect(
      await screen.findByText('000123450 · 000001200 · 260731 · 000123 · 0007'),
    ).toBeInTheDocument();
  });

  it('창고와 위치를 이름으로 보인다', async () => {
    renderWithProviders(<MaterialLocationScreen />, { fetch: stub() });
    await scan();

    expect(await screen.findByText('1공장 자재창고')).toBeInTheDocument();
    expect(screen.getByText('A-01-03 (3단 선반)')).toBeInTheDocument();
  });

  it('가용 수량은 서버가 준 값을 그대로 그린다', async () => {
    renderWithProviders(<MaterialLocationScreen />, {
      fetch: stub({ balances: [balanceRow({ availableQty: 77 })] }),
    });
    await scan();

    expect(await screen.findByText('77 EA')).toBeInTheDocument();
  });

  it('보유 수량이 음수여도 값을 보이고 확인을 청한다', async () => {
    renderWithProviders(<MaterialLocationScreen />, {
      fetch: stub({ balances: [balanceRow({ onHandQty: -5 })] }),
    });
    await scan();

    expect(await screen.findByText('-5 EA')).toBeInTheDocument();
    expect(screen.getByText('보유 수량이 음수입니다')).toBeInTheDocument();
  });

  it('수량이 0인 자리는 감추지 않고 소진으로 표시한다', async () => {
    renderWithProviders(<MaterialLocationScreen />, {
      fetch: stub({ balances: [balanceRow({ onHandQty: 0 })] }),
    });
    await scan();

    expect(await screen.findByText('0 EA (소진)')).toBeInTheDocument();
  });

  it('여러 자리에 나뉘면 수량이 많은 자리를 먼저 보인다', async () => {
    renderWithProviders(<MaterialLocationScreen />, {
      fetch: stub({
        balances: [
          balanceRow({ locationId: 22, onHandQty: 30 }),
          balanceRow({ locationId: 21, onHandQty: 90 }),
        ],
      }),
    });
    await scan();

    await screen.findByText('위치 2곳');
    const shown = screen.getAllByText(/^(A-01-03|B-02-01)/).map((node) => node.textContent);
    expect(shown).toEqual(['A-01-03 (3단 선반)', 'B-02-01 (평치장)']);
  });

  it('LOT 단위로 나뉘지 않는 잔액은 LOT 무관으로 표시한다', async () => {
    renderWithProviders(<MaterialLocationScreen />, {
      fetch: stub({ balances: [balanceRow({ lotId: null })] }),
    });
    await scan();

    expect(await screen.findByText('(LOT 무관)')).toBeInTheDocument();
  });

  it('보류가 걸려 있으면 경고로 알린다', async () => {
    renderWithProviders(<MaterialLocationScreen />, {
      fetch: stub({
        holds: [
          {
            lotHoldId: 1,
            lotId: 4,
            reasonCode: 'IQC_WAIT',
            statusCode: 'HELD',
            heldAt: '2026-08-27T00:00:00Z',
            holdQty: 20,
            uomId: 41,
            releaseCondition: '수입검사 합격',
          },
        ],
      }),
    });
    await scan();

    expect(await screen.findByRole('alert')).toHaveTextContent('보류 중');
    expect(screen.getByText(/20 EA 보류/)).toBeInTheDocument();
    expect(screen.getByText(/해제 조건: 수입검사 합격/)).toBeInTheDocument();
  });

  it('보류 수량이 없으면 전량 보류로 읽는다', async () => {
    renderWithProviders(<MaterialLocationScreen />, {
      fetch: stub({
        holds: [
          {
            lotHoldId: 1,
            lotId: 4,
            reasonCode: 'IQC_WAIT',
            statusCode: 'HELD',
            heldAt: '2026-08-27T00:00:00Z',
            holdQty: null,
          },
        ],
      }),
    });
    await scan();

    expect(await screen.findByText('전량 보류')).toBeInTheDocument();
  });

  it('없는 LOT이면 등록되지 않았다고 알린다', async () => {
    renderWithProviders(<MaterialLocationScreen />, { fetch: stub({ lots: [] }) });
    await scan();

    expect(await screen.findByText('등록되지 않은 LOT입니다')).toBeInTheDocument();
  });

  it('34자리가 아니면 조회하지 않고 읽은 자릿수를 알린다', async () => {
    renderWithProviders(<MaterialLocationScreen />, {
      fetch: createStubFetch([]),
    });
    await scan('0001234500');

    expect(
      await screen.findByText('자재 LOT은 34자리입니다. 10자리를 읽었습니다.'),
    ).toBeInTheDocument();
  });

  it('길이 오류 뒤에도 스캔 칸은 비워지고 포커스가 남는다', async () => {
    renderWithProviders(<MaterialLocationScreen />, { fetch: createStubFetch([]) });
    await scan('0001234500');

    const field = screen.getByLabelText('스캔 대기');
    expect(field).toHaveValue('');
    expect(field).toHaveFocus();
  });

  it('길이가 맞으면 오류가 사라진다', async () => {
    renderWithProviders(<MaterialLocationScreen />, { fetch: stub() });
    await scan('0001234500');
    await screen.findByText(/34자리입니다/);

    await scan();

    expect(await screen.findByText('1공장 자재창고')).toBeInTheDocument();
    expect(screen.queryByText(/34자리입니다/)).not.toBeInTheDocument();
  });

  it('서버에 닿지 못하면 오프라인이라고 알린다', async () => {
    renderWithProviders(<MaterialLocationScreen />, {
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    await scan();

    expect(await screen.findByText('오프라인이라 조회할 수 없습니다')).toBeInTheDocument();
  });

  it('서버가 오류를 주면 다시 시도를 낸다', async () => {
    renderWithProviders(<MaterialLocationScreen />, {
      fetch: createStubFetch([
        {
          match: (request) => new URL(request.url).pathname === '/trace/lots',
          respond: () => jsonResponse({ code: 'INTERNAL' }, { status: 500 }),
        },
      ]),
    });
    await scan();

    expect(await screen.findByText('조회하지 못했습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.queryByText('오프라인이라 조회할 수 없습니다')).not.toBeInTheDocument();
  });

  it('다음 스캔을 누르면 결과를 비우고 스캔 칸으로 돌아간다', async () => {
    renderWithProviders(<MaterialLocationScreen />, { fetch: stub() });
    const user = await scan();

    await user.click(await screen.findByRole('button', { name: '다음 스캔' }));

    expect(screen.queryByText('1공장 자재창고')).not.toBeInTheDocument();
    expect(screen.getByLabelText('스캔 대기')).toHaveFocus();
  });
});
