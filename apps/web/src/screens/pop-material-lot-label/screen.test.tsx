import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POP_SCREENS } from '../../patterns/pop-screen-catalog';
import { LIST_REFRESH_MS } from './queries';
import {
  HARNESS_NOW,
  PLANT_ID,
  defaultInfo,
  group,
  lot,
  renderLabelScreen,
  sentTo,
} from './screen-harness';

/**
 * 005 P-01-01 — 왼쪽 공급사·품목 · 오른쪽 대기/최근 입하 표 · 고르기(screens/P-01-01.md).
 * 만들기 창은 `supplier-issue.test.tsx`, 인쇄 길은 `issue-flow.test.tsx` 가 문다.
 */

const t = messages.popMaterialLotLabel;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(HARNESS_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const pairButton = (name: RegExp): HTMLElement =>
  screen.getByRole('button', { name, pressed: false });

const waitingRows = (): HTMLElement[] =>
  screen.queryAllByRole('checkbox', { name: /SYN-ITEM-01\|/u });

describe('PopMaterialLotLabelScreen — 공급사·품목(왼쪽)', () => {
  it('공급사·품목마다 대기 칩 · 공급사 · 기본 정보 한 줄 · 라벨 미출력을 보인다(입하 LOT 탭 없음)', async () => {
    renderLabelScreen();

    const list = await screen.findByRole('list', { name: t.pairs.label });
    const [first, second] = within(list).getAllByRole('button');

    expect(first).toHaveTextContent('SYN-ITEM-01');
    expect(first).toHaveTextContent(t.pairs.waiting(3));
    expect(first).toHaveTextContent('합성 공급사 가');
    expect(first).toHaveTextContent(t.pairs.defaultPackaged('봉지 10 × 100 = 1,000 EA'));
    expect(first).toHaveTextContent(t.pairs.unprinted(2));
    expect(second).toHaveTextContent(t.pairs.waiting(0));
    expect(second).toHaveTextContent(t.pairs.noDefault);

    /* ⛔ 입하 LOT 탭 · 라벨 대기 입하 줄은 없다(FR-036 · D-19·D-25). */
    const tabs = within(screen.getByRole('group', { name: t.tabs.label })).getAllByRole('button');
    expect(tabs.map((tab) => tab.textContent)).toEqual([`${t.tabs.pairs}3`, t.tabs.reprint]);
    expect(screen.queryByText(/입하 줄/u)).toBeNull();
  });

  it('목록은 그 공장 하나로 부른다 — 단말의 공장', async () => {
    const { sent } = renderLabelScreen();

    await screen.findByRole('list', { name: t.pairs.label });
    expect(sentTo(sent, '/logistics/waiting-material-lots')[0]?.search.get('plantId')).toBe(
      String(PLANT_ID),
    );
  });

  it('찾기 칸은 공급사 · 품목의 코드와 이름으로 거른다 — 없으면 그렇게 말한다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await screen.findByRole('list', { name: t.pairs.label });
    await user.type(screen.getByRole('searchbox', { name: t.search.label }), '공급사 나');

    const list = screen.getByRole('list', { name: t.pairs.label });
    expect(within(list).getAllByRole('button')).toHaveLength(1);
    expect(within(list).getByRole('button')).toHaveTextContent('SYN-ITEM-02');

    await user.clear(screen.getByRole('searchbox', { name: t.search.label }));
    await user.type(screen.getByRole('searchbox', { name: t.search.label }), '없는말');
    expect(screen.getByText(t.pairs.noMatch)).toBeInTheDocument();
  });

  it('⛔ 단말의 공장을 모르면 목록을 부르지 않는다', async () => {
    const { sent } = renderLabelScreen({ identity: { plantId: null } });

    expect(await screen.findByText(t.work.noPlant)).toBeInTheDocument();
    expect(sentTo(sent, '/logistics/waiting-material-lots')).toHaveLength(0);
  });
});

describe('PopMaterialLotLabelScreen — 오른쪽 표', () => {
  it('대기는 위에, 폐기는 아래에(고를 수 없음), 최근 입하된 LOT 은 입하 LOT 번호와 따로 선다', async () => {
    renderLabelScreen();

    await waitFor(() => expect(waitingRows()).toHaveLength(3));
    const waitingTable = screen.getByRole('group', { name: t.work.waitingTitle });
    const text = waitingTable.textContent ?? '';

    expect(text.indexOf('|0001')).toBeLessThan(text.indexOf('|0004'));
    expect(within(waitingTable).getByText(t.lotState.voided)).toBeInTheDocument();
    /* 폐기 LOT 은 체크 칸이 아니다. */
    expect(screen.queryByRole('checkbox', { name: /\|0004 /u })).toBeNull();

    const received = screen.getByRole('group', { name: t.work.receivedTitle(1) });
    expect(within(received).getByText(t.table.inboundLot('SYN-IL-0011'))).toBeInTheDocument();
    expect(within(received).getByText(t.lotState.received('정상'))).toBeInTheDocument();
    expect(within(received).queryByRole('checkbox')).toBeNull();
  });

  it('줄은 번호 · 재고 수량 · 패키징 · 공급사 LOT · 상태 · 라벨을 적는다 — 출력한 LOT 은 회차와 시각', async () => {
    renderLabelScreen();

    await waitFor(() => expect(waitingRows()).toHaveLength(3));
    const unprinted = screen.getByRole('checkbox', { name: /\|0001 /u });
    const printed = screen.getByRole('checkbox', { name: /\|0003 /u });

    expect(unprinted).toHaveTextContent('1,000EA');
    expect(unprinted).toHaveTextContent('봉지 10 × 100');
    expect(unprinted).toHaveTextContent('SYN-SL-77');
    expect(unprinted).toHaveTextContent(t.lotState.waiting);
    expect(unprinted).toHaveTextContent(t.table.unprinted);
    /* 08:12 는 공장 시각(UTC+7)이다. */
    expect(printed).toHaveTextContent('1회 11-11 08:12');
  });

  it('머리에 품목 · 공급사 · 기본 단위 · 기본 정보를 적는다', async () => {
    renderLabelScreen();

    expect(
      await screen.findByText(
        t.work.meta(
          '합성 공급사 가',
          'SYN-P-01',
          'EA',
          t.pairs.defaultPackaged('봉지 10 × 100 = 1,000 EA'),
        ),
      ),
    ).toBeInTheDocument();
  });

  it('대기가 없으면 만들라고 말한다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await screen.findByRole('list', { name: t.pairs.label });
    await user.click(pairButton(/SYN-ITEM-02/u));

    expect(screen.getByText(t.work.waitingEmpty)).toBeInTheDocument();
  });

  it('목록을 받지 못하면 사유와 다시 불러오기를 함께 보인다', async () => {
    renderLabelScreen({ waitingFail: true });

    expect(await screen.findByText(t.work.loadFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.work.retry })).toBeInTheDocument();
  });
});

describe('PopMaterialLotLabelScreen — 고르기와 동작 바', () => {
  it('줄을 누르면 고르고, 막대가 「N개 선택 · 라벨 미출력 N개」를 말한다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await waitFor(() => expect(waitingRows()).toHaveLength(3));
    expect(screen.getByText(t.bar.empty)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /\|0001 /u }));
    expect(screen.getByText(t.bar.selected(1, 1))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.bar.issue(1) })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.bar.void(1) })).toBeEnabled();
  });

  it('「대기 전체 선택」은 대기만 고르고, 이미 출력한 LOT 은 「다시 인쇄」로 안내한다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await waitFor(() => expect(waitingRows()).toHaveLength(3));
    await user.click(screen.getByRole('button', { name: t.bar.selectAllWaiting }));

    expect(screen.getByText(t.bar.selected(3, 2))).toBeInTheDocument();
    expect(screen.getByText(t.bar.printedNote(1))).toBeInTheDocument();
    /* 첫 발행은 미출력만 — 2장. */
    expect(screen.getByRole('button', { name: t.bar.issue(2) })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: t.bar.clear }));
    expect(screen.getByText(t.bar.empty)).toBeInTheDocument();
  });

  it('다른 공급사·품목을 누르면 고른 것이 풀린다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await waitFor(() => expect(waitingRows()).toHaveLength(3));
    await user.click(screen.getByRole('checkbox', { name: /\|0001 /u }));
    await user.click(pairButton(/SYN-ITEM-02/u));

    expect(screen.getByText(t.bar.empty)).toBeInTheDocument();
  });

  it('⛔ 사번을 모르면 발행 · 폐기 · 만들기를 잠그고 사유는 맨 위 띠가 말한다', async () => {
    const user = userEvent.setup();
    renderLabelScreen({ identity: { workerNo: null } });

    await waitFor(() => expect(waitingRows()).toHaveLength(3));
    await user.click(screen.getByRole('checkbox', { name: /\|0001 /u }));

    expect(screen.getByRole('button', { name: t.bar.issue(1) })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.bar.void(1) })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.work.create })).toBeDisabled();
  });
});

describe('PopMaterialLotLabelScreen — 다시 받기', () => {
  it('가만히 두어도 목록을 다시 받는다 — 관리웹 · PDA 의 변화가 스스로 선다(omf-all-around#29)', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(HARNESS_NOW);
    const { sent } = renderLabelScreen();

    await waitFor(() => expect(sentTo(sent, '/logistics/waiting-material-lots')).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(LIST_REFRESH_MS + 100);
    await waitFor(() => expect(sentTo(sent, '/logistics/waiting-material-lots')).toHaveLength(2));
  });

  it('새로 고침을 누르면 바로 다시 받고, 옆에 받은 시각을 적는다', async () => {
    const user = userEvent.setup();
    const { sent } = renderLabelScreen();

    await waitFor(() => expect(sentTo(sent, '/logistics/waiting-material-lots')).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: t.work.refresh }));
    await waitFor(() => expect(sentTo(sent, '/logistics/waiting-material-lots')).toHaveLength(2));
    expect(screen.getByText(/받음$/u)).toBeInTheDocument();
  });
});

describe('PopMaterialLotLabelScreen — 머리줄', () => {
  it('화면 이름이 화면 목록의 이름과 같다 — 「자재 관리 LOT 라벨」', async () => {
    renderLabelScreen();

    expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeInTheDocument();
    expect(POP_SCREENS.find((each) => each.code === 'P-01-01')?.name).toBe(t.title);
  });

  it('프린터 조회가 실패해도 목록은 그대로 쓴다', async () => {
    renderLabelScreen({ printersFail: true });

    await waitFor(() => expect(waitingRows()).toHaveLength(3));
  });
});

describe('PopMaterialLotLabelScreen — 다른 묶음', () => {
  it('기본 정보가 「패키징 없음」이면 「기본 1 TON · 패키징 없음」으로 적는다', async () => {
    renderLabelScreen({
      groups: [
        group([lot(9201, { lotQty: 1, package: null })], {
          itemId: 8602,
          itemCode: 'SYN-ITEM-02',
          supplierId: 8202,
          supplierCode: 'SYN-P-02',
          uomCode: 'TON',
        }),
      ],
      defaults: [
        defaultInfo({ itemId: 8602, supplierId: 8202, uomCode: 'TON', lotQty: 1, package: null }),
      ],
    });

    const list = await screen.findByRole('list', { name: t.pairs.label });
    expect(within(list).getByRole('button')).toHaveTextContent(t.pairs.defaultUnpackaged('1 TON'));
  });
});
