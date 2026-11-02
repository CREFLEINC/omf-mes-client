import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import type { SelectedLotSnapshot } from './candidate-model';
import {
  buildSuspiciousMaterialHoldBody,
  type HoldInputLot,
  SuspiciousMaterialHoldImpact,
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
  items: { code: string; codeName: string; isActive: boolean; nameKo?: string | null }[] = [
    { code: 'DAMAGE', codeName: '파손', isActive: true },
  ],
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
    /* 막힌 까닭은 카드 제목 줄이 보인다 — 이 시험은 받은 문장을 그대로 그린다. */
    const [notices, setNotices] = useState<string[]>([]);
    return (
      <>
        <button onClick={() => setCurrent([display(702), display(703)])}>owner 변경</button>
        <button onClick={() => setCurrent([])}>잠깐 비우기</button>
        <button onClick={() => setCurrent(lots)}>되돌리기</button>
        <SuspiciousMaterialHoldInputPane
          selection={current}
          targetLotStatusCode="HOLD"
          isLocked={false}
          onBodyChange={onBodyChange}
          onNoticesChange={setNotices}
        />
        {notices.map((notice) => (
          <p key={notice}>{notice}</p>
        ))}
        {/* 보류 시 제한 사항은 카드 안에서 따로 선다(사용자 2026-11-02) — 이 시험은 함께 본다. */}
        <SuspiciousMaterialHoldImpact selection={current} />
      </>
    );
  };
  /* 제한 사항 항목의 상세 팝업(LOT 상태 이력과 같은 팝업)이 세션 권한을 읽는다. */
  const view = renderWithProviders(
    <SessionProvider>
      <Harness />
    </SessionProvider>,
    { fetch, session: SYNTHETIC_SESSION },
  );
  return { ...view, onBodyChange, user: userEvent.setup() };
};

describe('의심자재 보류 입력 pane', () => {
  it('선택이 없으면 입력이 없고 단건은 일부·다건은 전량만 제공한다', async () => {
    const empty = renderPane([]);
    expect(screen.queryByRole('group', { name: '보류 등록 입력' })).toBeNull();
    empty.unmount();
    const one = renderPane([display(701)]);
    expect(screen.getByRole('group', { name: '보류 등록 입력' })).toBeVisible();
    expect(await screen.findByRole('radio', { name: '일부 보류' })).toBeEnabled();
    one.unmount();
    renderPane([display(701), display(702)]);
    expect(await screen.findByRole('radio', { name: '전량 보류' })).toBeChecked();
    expect(screen.queryByRole('radio', { name: '일부 보류' })).toBeNull();
  });

  /* G-33 — 사유 선택지의 표시명은 다국어 컬럼이 먼저다. 값(reasonCode)은 그대로 코드다. */
  it('다국어 이름이 있으면 선택지 라벨로 쓰고 값은 코드로 보낸다', async () => {
    const { onBodyChange, user } = renderPane(
      [display(701)],
      reasons([{ code: 'DAMAGE', codeName: '파손', nameKo: '파손(현지)', isActive: true }]),
    );
    const reason = await screen.findByLabelText(/^보류 사유/);
    await waitFor(() => expect(reason).toBeEnabled());
    await user.click(reason);
    await user.click(screen.getByRole('option', { name: '파손(현지)' }));
    await user.type(screen.getByLabelText('해제 조건'), '재검 완료');
    await waitFor(() =>
      expect(onBodyChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ reasonCode: 'DAMAGE' }),
      ),
    );
  });

  it('사유·해제 조건과 일부 수량이 유효할 때만 exact body를 알린다', async () => {
    const { onBodyChange, user } = renderPane([display(701)]);
    const reason = await screen.findByLabelText(/^보류 사유/);
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
    /* 못 받은 값은 「위치·단위 미확인」 한 줄로 묶는다(사용자 시안 2026-11-02). */
    expect(screen.getByText('위치·단위 미확인')).toBeVisible();
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
    const reason = await screen.findByLabelText(/^보류 사유/);
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

  it('보류 시 제한 사항 항목을 누르면 그 LOT 의 상세 팝업이 열리고 [닫기]로 닫힌다', async () => {
    const { user } = renderPane([display(701)]);
    await user.click(await screen.findByRole('button', { name: 'SYN-LOT-701 상세 보기' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: '닫기' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('보류 사유를 고르면 바로 해제 조건 칸으로 옮겨 간다', async () => {
    const { user } = renderPane([display(701)]);
    const reason = await screen.findByLabelText(/^보류 사유/);
    await waitFor(() => expect(reason).toBeEnabled());
    await user.click(reason);
    await user.click(await screen.findByRole('option', { name: '파손' }));
    await waitFor(() => expect(screen.getByLabelText(/^해제 조건/)).toHaveFocus());
  });

  it('재고 기록이 없는 LOT(창고 없음)은 「재고 없음」으로 보이고 전량 보류는 막지 않는다', async () => {
    const { warehouseId: _w, locationId: _l, onHandQty: _q, ...noStock } = selected(701);
    const { onBodyChange } = renderPane([{ ...noStock, locationLabel: null, uomLabel: null }]);

    expect(await screen.findByText('재고 없음')).toBeVisible();
    expect(screen.queryByText(/미확인/)).toBeNull();
    expect(screen.queryByText(/도착 상태가 확인되지 않아/)).toBeNull();
    expect(onBodyChange).not.toHaveBeenCalledWith(expect.objectContaining({ lots: [] }));
  });

  it('목록을 다시 받는 동안 선택이 잠깐 비어도 넣던 입력은 지우지 않고, 다른 LOT 을 고르면 비운다', async () => {
    const { user } = renderPane([display(701)]);
    const condition = await screen.findByLabelText(/^해제 조건/);
    await user.type(condition, '재검 완료');
    await user.click(screen.getByRole('button', { name: '잠깐 비우기' }));
    await user.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(await screen.findByLabelText(/^해제 조건/)).toHaveValue('재검 완료');
    await user.click(screen.getByRole('button', { name: 'owner 변경' }));
    expect(await screen.findByLabelText(/^해제 조건/)).toHaveValue('');
  });

  it('일부 보류 수량이 보유 수량을 넘으면 칸 아래에 알리고 등록 내용을 만들지 않는다', async () => {
    const { user, onBodyChange } = renderPane([display(701)]);
    await user.click(await screen.findByRole('radio', { name: '일부 보류' }));
    await user.type(screen.getByLabelText(/^보류 수량/), '26');

    expect(await screen.findByText('보류 수량은 보유 수량 25 이하여야 합니다.')).toBeVisible();
    expect(onBodyChange).toHaveBeenLastCalledWith(null);
  });
});
