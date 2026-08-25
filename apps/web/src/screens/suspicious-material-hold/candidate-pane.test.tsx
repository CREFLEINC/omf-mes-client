import type { components } from '@omf-mes/api-client';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import type { SelectedLotSnapshot } from './candidate-model';
import { SuspiciousMaterialCandidatePane } from './candidate-pane';

type Lot = components['schemas']['LotQualityStatus'];
const LOTS = '/quality/lot-statuses';
const lot = (id: number, overrides: Partial<Lot> = {}): Lot => ({
  lotId: id,
  lotNo: `SYN-LOT-${String(id)}`,
  itemId: 801001,
  lotStatusCode: 'INSPECTION_PENDING',
  versionNo: id,
  warehouseId: 802001,
  locationId: 803001,
  onHandQty: 25,
  uomId: 804001,
  fullyHeld: false,
  latestTransitionAt: '2026-08-25T09:00:00+09:00',
  ...overrides,
});
const page = (items: Lot[], current = 1, total = items.length) => ({
  items,
  page: { page: current, size: 2, total },
});
const references = (path: string): unknown => {
  const entries: Record<string, unknown> = {
    '/mdm/items': { itemId: 801001, itemCode: 'SYN', itemName: '품목' },
    '/mdm/warehouses': {
      warehouseId: 802001,
      warehouseCode: 'WH',
      warehouseName: '창고',
    },
    '/mdm/code-values': {
      code: 'INSPECTION_PENDING',
      codeName: '검사 대기',
    },
    '/mdm/uoms': { uomId: 804001, uomCode: 'SYN-EA', uomName: '합성 단위' },
  };
  return entries[path] === undefined
    ? undefined
    : { items: [entries[path]], page: { page: 1, size: 50, total: 1 } };
};
const Harness = () => {
  const [selection, setSelection] = useState<SelectedLotSnapshot[]>([]);
  return (
    <SuspiciousMaterialCandidatePane
      isLocked={false}
      selection={selection}
      onSelectionChange={setSelection}
    />
  );
};
type LotResponder = (request: Request, call: number) => Response | Promise<Response>;
const renderPane = (respond: LotResponder) => {
  const urls: URL[] = [];
  let calls = 0;
  const fetch = createStubFetch([
    {
      match: (request) => {
        const path = new URL(request.url).pathname;
        return path === LOTS || references(path) !== undefined;
      },
      respond: (request) => {
        const path = new URL(request.url).pathname;
        urls.push(new URL(request.url));
        if (path === LOTS) return respond(request, ++calls) as Response;
        return jsonResponse(references(path));
      },
    },
  ]);
  return { ...renderWithProviders(<Harness />, { fetch }), urls, user: userEvent.setup() };
};
const lotUrls = (urls: URL[]): URL[] => urls.filter((url) => url.pathname === LOTS);

describe('의심자재 후보 pane', () => {
  it('6열 이름과 다중 선택을 제공하고 전량 보류·raw ID 노출을 막는다', async () => {
    const { user } = renderPane(() =>
      jsonResponse(page([lot(701), lot(702), lot(703, { fullyHeld: true })])),
    );

    expect(
      (await screen.findAllByRole('columnheader')).map((cell) => cell.textContent).join('|'),
    ).toBe('선택|LOT 번호|품목|위치|보유 수량·단위|Lot Status·최근 전이');
    await user.click(screen.getByRole('checkbox', { name: 'SYN-LOT-701 선택' }));
    await user.click(screen.getByRole('checkbox', { name: 'SYN-LOT-702 선택' }));
    expect(screen.getByText('2건 선택')).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'SYN-LOT-703 선택' })).toBeDisabled();
    expect(screen.getByText(/이미 전량 보류되어 선택할 수 없습니다/)).toBeVisible();
    for (const raw of ['701', '801001', '802001', '803001', '804001'])
      expect(screen.queryByText(raw)).toBeNull();
  });

  it('draft는 조회 전 요청을 바꾸지 않고 조회·page 이동 때 선택을 비운다', async () => {
    const { urls, user } = renderPane((_, call) =>
      jsonResponse(page(call === 1 ? [lot(701)] : [lot(702)], call === 3 ? 2 : 1, 4)),
    );
    await user.click(await screen.findByRole('checkbox', { name: 'SYN-LOT-701 선택' }));
    await user.type(screen.getByLabelText('LOT 번호'), 'SYN-SEARCH');
    expect(lotUrls(urls)).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '조회' }));
    await screen.findByRole('checkbox', { name: 'SYN-LOT-702 선택' });
    expect(screen.getByText('0건 선택')).toBeVisible();
    expect(lotUrls(urls)[1]?.searchParams.get('q')).toBe('SYN-SEARCH');
    await user.click(screen.getByRole('button', { name: '다음 쪽' }));
    await waitFor(() => expect(lotUrls(urls).at(-1)?.searchParams.get('page')).toBe('2'));
  });

  it('loading·error·retry·empty를 정상 빈 결과와 구분한다', async () => {
    let release!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const view = renderPane((_, call) => (call === 1 ? pending : jsonResponse(page([]))));
    expect(
      await screen.findByRole('status', { name: '의심자재 후보를 불러오는 중' }),
    ).toBeVisible();
    release(jsonResponse({ message: 'synthetic' }, { status: 500 }));
    expect(await screen.findByText('의심자재 후보를 불러오지 못했습니다.')).toBeVisible();
    await view.user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('조건에 맞는 LOT이 없습니다.')).toBeVisible();
  });

  it('background error와 성공 응답의 소실 뒤 같은 LOT이 재등장해도 선택은 부활하지 않는다', async () => {
    const view = renderPane((_, call) =>
      call === 2
        ? jsonResponse({ message: 'synthetic' }, { status: 500 })
        : jsonResponse(page(call === 3 ? [] : [lot(701)])),
    );
    await view.user.click(await screen.findByRole('checkbox', { name: 'SYN-LOT-701 선택' }));
    await view.queryClient.invalidateQueries({ queryKey: ['suspicious-material-hold'] });
    expect(await screen.findByText('의심자재 후보를 불러오지 못했습니다.')).toBeVisible();
    expect(screen.getByText('0건 선택')).toBeVisible();
    await view.user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('조건에 맞는 LOT이 없습니다.')).toBeVisible();
    await view.queryClient.invalidateQueries({ queryKey: ['suspicious-material-hold'] });
    expect(await screen.findByRole('checkbox', { name: 'SYN-LOT-701 선택' })).not.toBeChecked();
  });
});
