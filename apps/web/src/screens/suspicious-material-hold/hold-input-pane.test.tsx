import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import type { SelectedLotSnapshot } from './candidate-model';
import {
  buildSuspiciousMaterialHoldBody,
  type HoldInputLot,
  SuspiciousMaterialHoldInputPane,
} from './hold-input-pane';

const selected = (
  id: number,
  overrides: Partial<SelectedLotSnapshot> = {},
): SelectedLotSnapshot => ({
  lotId: id,
  lotNo: `SYN-LOT-${String(id)}`,
  itemId: 801001,
  versionNo: id,
  warehouseId: 802001,
  locationId: 803001,
  onHandQty: 25,
  uomId: 804001,
  lotStatusCode: 'NORMAL',
  ...overrides,
});
const display = (id: number, overrides: Partial<HoldInputLot> = {}): HoldInputLot => ({
  ...selected(id),
  locationLabel: '합성 창고 / 합성 위치',
  uomLabel: '합성 단위',
  ...overrides,
});
const draft = {
  mode: 'FULL' as const,
  holdQty: '',
  reasonCode: 'DAMAGE',
  releaseCondition: '재검 완료',
  remarks: '격리',
};

describe('의심자재 보류 body', () => {
  it('전량은 현재 순서의 version pair만 보내고 수량·단위를 생략한다', () => {
    expect(buildSuspiciousMaterialHoldBody(draft, [selected(701), selected(702)], 'HOLD')).toEqual({
      lots: [
        { lotId: 701, versionNo: 701 },
        { lotId: 702, versionNo: 702 },
      ],
      reasonCode: 'DAMAGE',
      releaseCondition: '재검 완료',
      targetLotStatusCode: 'HOLD',
      remarks: '격리',
    });
  });

  it('단건 일부는 양수 finite 수량과 같은 LOT 단위를 함께 보낸다', () => {
    expect(
      buildSuspiciousMaterialHoldBody(
        { ...draft, mode: 'PARTIAL', holdQty: '3.5' },
        [selected(701)],
        'HOLD',
      ),
    ).toMatchObject({ holdQty: 3.5, uomId: 804001 });
    for (const holdQty of ['', '0', '-1', 'Infinity'])
      expect(
        buildSuspiciousMaterialHoldBody(
          { ...draft, mode: 'PARTIAL', holdQty },
          [selected(701)],
          'HOLD',
        ),
      ).toBeNull();
  });

  it('다건 일부와 누락 version·UOM·필수값·target은 fail-closed다', () => {
    const partial = { ...draft, mode: 'PARTIAL' as const, holdQty: '1' };
    expect(
      buildSuspiciousMaterialHoldBody(partial, [selected(701), selected(702)], 'HOLD'),
    ).toBeNull();
    expect(
      buildSuspiciousMaterialHoldBody(partial, [selected(701, { uomId: undefined })], 'HOLD'),
    ).toBeNull();
    expect(
      buildSuspiciousMaterialHoldBody(draft, [selected(701, { versionNo: 0 })], 'HOLD'),
    ).toBeNull();
    expect(
      buildSuspiciousMaterialHoldBody({ ...draft, reasonCode: ' ' }, [selected(701)], 'HOLD'),
    ).toBeNull();
    expect(buildSuspiciousMaterialHoldBody(draft, [selected(701)], null)).toBeNull();
  });
});

const reasons = (
  items = [{ code: 'DAMAGE', codeName: '파손', isActive: true }],
  total = items.length,
) => jsonResponse({ items, page: { page: 1, size: 100, total } });
const renderPane = (
  lots: HoldInputLot[],
  response: Response | ((call: number) => Response | Promise<Response>) = reasons(),
) => {
  const onBodyChange = vi.fn();
  let calls = 0;
  const fetch = createStubFetch([
    {
      match: (request) => new URL(request.url).pathname === '/mdm/code-values',
      respond: (request) => {
        expect(new URL(request.url).searchParams.get('codeGroupCode')).toBe('LOT_HOLD_REASON');
        return typeof response === 'function' ? (response(++calls) as Response) : response;
      },
    },
  ]);
  const Harness = () => {
    const [current, setCurrent] = useState(lots);
    return (
      <>
        <button onClick={() => setCurrent([display(702), display(703)])}>owner 변경</button>
        <SuspiciousMaterialHoldInputPane
          selection={current}
          targetLotStatusCode="HOLD"
          isLocked={false}
          onBodyChange={onBodyChange}
        />
      </>
    );
  };
  const view = renderWithProviders(<Harness />, { fetch });
  return { ...view, onBodyChange, user: userEvent.setup() };
};

describe('의심자재 보류 입력 pane', () => {
  it('선택이 없으면 입력이 없고 단건은 일부·다건은 전량만 제공한다', async () => {
    const empty = renderPane([]);
    expect(screen.queryByRole('region', { name: '보류 등록 입력' })).toBeNull();
    empty.unmount();
    const one = renderPane([display(701)]);
    expect(screen.getByRole('heading', { level: 2, name: '보류 등록 입력' })).toBeVisible();
    expect(await screen.findByRole('radio', { name: '일부 보류' })).toBeEnabled();
    one.unmount();
    renderPane([display(701), display(702)]);
    expect(await screen.findByRole('radio', { name: '전량 보류' })).toBeChecked();
    expect(screen.queryByRole('radio', { name: '일부 보류' })).toBeNull();
  });

  it('사유·해제 조건과 일부 수량이 유효할 때만 exact body를 알린다', async () => {
    const { onBodyChange, user } = renderPane([display(701)]);
    const reason = await screen.findByLabelText('보류 사유');
    await waitFor(() => expect(reason).toBeEnabled());
    await user.click(reason);
    await user.click(screen.getByRole('option', { name: '파손' }));
    await user.type(screen.getByLabelText('해제 조건'), '재검 완료');
    await waitFor(() =>
      expect(onBodyChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ reasonCode: 'DAMAGE' }),
      ),
    );
    await user.click(screen.getByRole('radio', { name: '일부 보류' }));
    expect(onBodyChange).toHaveBeenLastCalledWith(null);
    await user.type(screen.getByLabelText('보류 수량'), '2');
    await waitFor(() =>
      expect(onBodyChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ holdQty: 2, uomId: 804001 }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'owner 변경' }));
    expect(screen.getByRole('radio', { name: '전량 보류' })).toBeChecked();
    expect(screen.queryByLabelText('보류 수량')).toBeNull();
    await waitFor(() => expect(onBodyChange).toHaveBeenLastCalledWith(null));
  });

  it('lookup error·truncated·empty와 이름 없는 위치·단위는 이유를 보이고 fail-closed다', async () => {
    const { onBodyChange } = renderPane(
      [display(701, { locationLabel: null, uomLabel: null })],
      reasons([{ code: 'DAMAGE', codeName: '파손', isActive: true }], 2),
    );
    expect(await screen.findByText(/보류 사유 목록이 완결되지 않았습니다/)).toBeVisible();
    expect(screen.getByText(/위치 이름 미확인/)).toBeVisible();
    expect(screen.getByText(/단위 이름 미확인/)).toBeVisible();
    expect(onBodyChange).toHaveBeenLastCalledWith(null);
    for (const raw of ['802001', '803001', '804001']) expect(screen.queryByText(raw)).toBeNull();
  });

  it('blank name과 background reason refetch 중 cached 사유를 fail-closed한다', async () => {
    let release!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const view = renderPane([display(701)], (call) =>
      call === 1 ? reasons([{ code: 'DAMAGE', codeName: '파손', isActive: true }]) : pending,
    );
    const reason = await screen.findByLabelText('보류 사유');
    await waitFor(() => expect(reason).toBeEnabled());
    await view.user.click(reason);
    await view.user.click(screen.getByRole('option', { name: '파손' }));
    await view.user.type(screen.getByLabelText('해제 조건'), '재검 완료');
    await waitFor(() =>
      expect(view.onBodyChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ reasonCode: 'DAMAGE' }),
      ),
    );
    void view.queryClient.invalidateQueries({ queryKey: ['suspicious-material-hold', 'reasons'] });
    await waitFor(() => expect(view.onBodyChange).toHaveBeenLastCalledWith(null));
    expect(reason).toBeDisabled();
    release(reasons([{ code: 'DAMAGE', codeName: '   ', isActive: true }]));
    expect(await screen.findByText(/보류 사유 목록이 완결되지 않았습니다/)).toBeVisible();
    expect(screen.queryByRole('option', { name: 'DAMAGE' })).toBeNull();
  });
});
