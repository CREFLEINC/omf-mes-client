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

/** 첫째 목록의 공급사 — 고르면 둘째 목록이 그 공급사의 품목이 되고 첫 품목이 골라진다. */
const supplierButton = (name: string): HTMLElement =>
  screen.getByRole('button', { name, pressed: false });

/** 가운데 품목 표의 본문 줄. */
const itemRows = (): HTMLElement[] =>
  within(screen.getByRole('group', { name: t.pairs.itemsLabel }))
    .getAllByRole('row')
    .slice(1);

const waitingRows = (): HTMLElement[] =>
  screen.queryAllByRole('checkbox', { name: /SYN-ITEM-01\|/u });

/** 체크 칸이 놓인 표 줄 — 번호 · 수량 · 상태 · 라벨이 한 줄에 있다. */
const rowOf = (name: RegExp): HTMLElement =>
  screen.getByRole('checkbox', { name }).closest('tr') as HTMLElement;

describe('PopMaterialLotLabelScreen — 공급사·품목(왼쪽)', () => {
  it('첫째 목록은 공급사만, 둘째 목록은 고른 공급사의 품목 — 입하 대기 칩은 없다(입하 LOT 탭 없음)', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    /* 공급사 목록은 공급사명(코드 없이)과 라벨 미출력 수만(사용자 지시 2026-11-23). */
    const suppliers = within(
      await screen.findByRole('list', { name: t.pairs.suppliersLabel }),
    ).getAllByRole('button');
    expect(suppliers.map((button) => button.textContent)).toEqual([
      `합성 공급사 가${t.pairs.unprinted(2)}`,
      '합성 공급사 나',
    ]);

    /* 품목 표는 처음 공급사의 품목 — 코드 · 이름 · LOT 수 · 수량 · 라벨 출력 · IQC · 최근 발행(사용자 지시 2026-11-23). */
    const items = itemRows();
    expect(items).toHaveLength(1);
    const cells = within(items[0] as HTMLElement)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(cells[0]).toBe('SYN-ITEM-01');
    expect(cells[1]).toBe('합성 품목 가');
    /* 라벨 출력은 출력한 수 / 입하 대기 LOT 수. */
    expect(cells).toContain(t.pairs.printedOf(1, 3));
    expect(cells).not.toContain('SYN-P-01');
    expect(screen.queryByText(/입하 대기 \d/u)).toBeNull();

    /* 다른 공급사를 고르면 그 공급사의 품목으로 바뀐다. */
    await user.click(screen.getByRole('button', { name: '합성 공급사 나' }));
    expect(itemRows()).toHaveLength(1);
    expect(itemRows()[0]).toHaveTextContent('SYN-ITEM-02');
    expect(itemRows()[0]).not.toHaveTextContent('기본 정보 없음');

    /* ⛔ 입하 LOT 탭 · 라벨 대기 입하 줄은 없다(FR-036 · D-19·D-25). */
    const tabs = within(screen.getByRole('tablist', { name: t.tabs.label })).getAllByRole('tab');
    /* 탭 건수는 라벨을 아직 발행하지 않은 입하 대기만 — 출력한 9003 은 재발행 탭이다(사용자 지시 2026-11-19). */
    expect(tabs.map((tab) => tab.textContent)).toEqual([`${t.tabs.pairs}2`, t.tabs.reprint]);
    expect(screen.queryByText(/입하 줄/u)).toBeNull();
  });

  it('목록은 그 공장 하나로 부른다 — 단말의 공장', async () => {
    const { sent } = renderLabelScreen();

    await screen.findByRole('group', { name: t.pairs.itemsLabel });
    expect(sentTo(sent, '/logistics/waiting-material-lots')[0]?.search.get('plantId')).toBe(
      String(PLANT_ID),
    );
  });

  it('찾기 칸은 공급사 · 품목의 코드와 이름으로 거른다 — 없으면 그렇게 말한다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await screen.findByRole('group', { name: t.pairs.itemsLabel });
    /* 칸을 누르면 찾기 창이 뜬다 — [검색]으로 거른다(사용자 지시 2026-11-19). */
    await user.click(screen.getByRole('searchbox', { name: t.search.label }));
    await user.type(screen.getByRole('textbox', { name: t.search.label }), '공급사 나');
    await user.click(screen.getByRole('button', { name: messages.popUniform.scan.search }));

    expect(itemRows()).toHaveLength(1);
    expect(itemRows()[0]).toHaveTextContent('SYN-ITEM-02');

    expect(screen.getByRole('searchbox', { name: t.search.label })).toHaveValue('공급사 나');

    /* [취소]는 지금 거르는 글자를 그대로 둔다. */
    await user.click(screen.getByRole('searchbox', { name: t.search.label }));
    await user.clear(screen.getByRole('textbox', { name: t.search.label }));
    await user.type(screen.getByRole('textbox', { name: t.search.label }), '없는말');
    await user.click(screen.getByRole('button', { name: messages.popUniform.dialog.cancel }));
    expect(itemRows()).toHaveLength(1);

    await user.click(screen.getByRole('searchbox', { name: t.search.label }));
    await user.clear(screen.getByRole('textbox', { name: t.search.label }));
    await user.type(screen.getByRole('textbox', { name: t.search.label }), '없는말{Enter}');
    expect(screen.getByText(t.pairs.noMatch)).toBeInTheDocument();

    /* [×]로 비우면 다시 모두 보인다. */
    await user.click(screen.getByRole('button', { name: messages.popUniform.search.clear }));
    expect(screen.getByRole('searchbox', { name: t.search.label })).toHaveValue('');
  });

  it('⛔ 단말의 공장을 모르면 목록을 부르지 않는다', async () => {
    const { sent } = renderLabelScreen({ identity: { plantId: null } });

    expect(await screen.findByText(t.work.noPlant)).toBeInTheDocument();
    expect(sentTo(sent, '/logistics/waiting-material-lots')).toHaveLength(0);
  });
});

describe('PopMaterialLotLabelScreen — 오른쪽 표', () => {
  it('입하 대기만 — 폐기한 LOT 과 라벨을 발행한 LOT(입하 대기 · 입하됨)은 표에 없다', async () => {
    renderLabelScreen();

    await waitFor(() => expect(waitingRows()).toHaveLength(2));
    const waitingTable = screen.getByRole('group', { name: t.work.waitingTitle });
    const text = waitingTable.textContent ?? '';

    expect(text).toContain('|0001');
    /* 폐기한 LOT 은 목록에서 뺀다(사용자 지시 2026-11-23). */
    expect(text).not.toContain('|0004');
    expect(within(waitingTable).queryByText(t.lotState.voided)).toBeNull();

    /* 라벨을 발행한 LOT 은 발행 대기 표에 서지 않는다 — 재발행 탭에만(사용자 지시 2026-11-19). */
    expect(text).not.toContain('|0003');
    expect(text).not.toContain('SYN-IL-0011');
    /* 「입하 N · 재발행 탭」 칩은 두지 않는다(사용자 지시 2026-11-23). */
    expect(screen.queryByText(t.work.receivedChip(1))).toBeNull();
  });

  it('줄은 번호 · 재고 수량 · 포장 · 공급사 LOT · 상태 · 라벨을 적는다 — 출력한 LOT 은 재발행 탭에 회차 · 시각 · 공급사 LOT 칸으로', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await waitFor(() => expect(waitingRows()).toHaveLength(2));
    const unprinted = rowOf(/\|0001 /u);

    expect(unprinted).toHaveTextContent('1,000 EA');
    /* 포장은 개수만(사용자 지시 2026-11-23). */
    expect(unprinted).toHaveTextContent('봉지 10');
    expect(unprinted).not.toHaveTextContent('× 100');
    expect(unprinted).toHaveTextContent('SYN-SL-77');
    /* 발행 대기 표는 모두 입하 대기라 LOT 상태 칸이 없다(사용자 지시 2026-11-23). */
    expect(within(unprinted).queryByText(t.lotState.waiting)).toBeNull();
    expect(unprinted).toHaveTextContent(t.table.unprinted);
    /* 발행 대기 표는 품목 칸이 없다 — 품목은 상세 제목에(사용자 지시 2026-11-23). */
    const waitingTable = screen.getByRole('group', { name: t.work.waitingTitle });
    expect(
      within(waitingTable).queryByRole('columnheader', { name: t.table.columns.itemCode }),
    ).toBeNull();
    expect(within(unprinted).queryByText('합성 품목 가')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /\|0003 /u })).toBeNull();

    await user.click(screen.getByRole('tab', { name: t.tabs.reprint }));
    const printed = (await screen.findByRole('checkbox', { name: /\|0003 /u })).closest(
      'tr',
    ) as HTMLElement;
    const cells = within(printed)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    /* 재발행 표는 품목코드 · 품목명 두 칸을 둔다. */
    expect(cells).toContain('SYN-ITEM-01');
    expect(cells).toContain('합성 품목 가');
    /* 공급사 LOT · 출력(회차) · 최근 출력 일시는 제 칸에 따로 — 08:12 는 공장 시각(UTC+7)이다. */
    expect(cells).toContain('SYN-SL-77');
    expect(cells).toContain(t.table.issuedSeq(1));
    expect(cells).toContain('11-11 08:12');
    expect(screen.queryByText(/출력한 자재 관리 LOT/u)).toBeNull();
  });

  it('머리에 품목코드 · 품목명 · 공급사 · 기본 단위를 이름표와 함께, 기본 정보를 적는다', async () => {
    renderLabelScreen();

    const head = await screen.findByRole('heading', { name: /SYN-ITEM-01/u });
    const f = t.work.fields;
    expect(head).toHaveTextContent(
      `${f.itemCode}SYN-ITEM-01${f.itemName}합성 품목 가${f.supplier}합성 공급사 가` +
        t.pairs.defaultPackaged('봉지 10 × 100 = 1,000 EA'),
    );
  });

  it('입하 대기가 없으면 만들라고 말한다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await screen.findByRole('group', { name: t.pairs.itemsLabel });
    await user.click(supplierButton('합성 공급사 나'));

    expect(screen.getByText(t.work.waitingEmpty)).toBeInTheDocument();
    expect(screen.getByText(t.work.waitingEmptyHint)).toBeInTheDocument();
  });

  it('목록을 받지 못하면 사유와 다시 불러오기를 함께 보인다', async () => {
    renderLabelScreen({ waitingFail: true });

    expect(await screen.findByText(t.work.loadFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.work.retry })).toBeInTheDocument();
  });
});

describe('PopMaterialLotLabelScreen — 고르기와 작업 줄', () => {
  it('줄을 누르면 고르고, 작업 줄 단추가 「라벨 N장 발행」 · 「입하 대기 N개 폐기」로 켜진다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await waitFor(() => expect(waitingRows()).toHaveLength(2));
    expect(screen.getByRole('button', { name: t.bar.issueIdle })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.bar.voidIdle })).toBeDisabled();

    /* 줄 어디를 눌러도 고른다. */
    await user.click(rowOf(/\|0001 /u));
    expect(screen.getByRole('checkbox', { name: /\|0001 /u })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('button', { name: t.bar.issue(1) })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.bar.void(1) })).toBeEnabled();
  });

  it('「입하 대기 전체 선택」은 표에 선 미출력 입하 대기만 고른다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await waitFor(() => expect(waitingRows()).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: t.bar.selectAll }));

    expect(waitingRows().filter((row) => row.getAttribute('aria-checked') === 'true')).toHaveLength(
      2,
    );
    expect(screen.getByRole('button', { name: t.bar.void(2) })).toBeEnabled();
    expect(screen.queryByText(t.bar.printedNote(1))).toBeNull();
    expect(screen.getByRole('button', { name: t.bar.issue(2) })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: t.bar.clear }));
    expect(screen.getByRole('button', { name: t.bar.issueIdle })).toBeDisabled();
  });

  it('다른 공급사·품목을 누르면 고른 것이 풀린다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await waitFor(() => expect(waitingRows()).toHaveLength(2));
    await user.click(screen.getByRole('checkbox', { name: /\|0001 /u }));
    await user.click(supplierButton('합성 공급사 나'));

    expect(screen.getByRole('button', { name: t.bar.voidIdle })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.bar.issueIdle })).toBeDisabled();
  });

  it('⛔ 사번을 모르면 발행 · 폐기 · 만들기를 잠그고 사유는 맨 위 띠가 말한다', async () => {
    const user = userEvent.setup();
    renderLabelScreen({ identity: { workerNo: null } });

    await waitFor(() => expect(waitingRows()).toHaveLength(2));
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

  it('맨 위 줄 [새로고침](모든 조회 다시 받기)을 누르면 바로 다시 받는다 — 목록 안 새로 고침은 없다(#295)', async () => {
    const { sent, queryClient } = renderLabelScreen();

    await waitFor(() => expect(sentTo(sent, '/logistics/waiting-material-lots')).toHaveLength(1));
    expect(screen.queryByText(/받음$/u)).toBeNull();
    await queryClient.invalidateQueries();
    await waitFor(() => expect(sentTo(sent, '/logistics/waiting-material-lots')).toHaveLength(2));
  });
});

describe('PopMaterialLotLabelScreen — 새로 고침과 기본 정보', () => {
  it('G2 L19 새로고침은 공급사·품목 기본 정보도 다시 받아, W-06-25 에서 고친 「기본 …」 줄이 바로 선다', async () => {
    const defaults = [defaultInfo()];
    const { sent, queryClient } = renderLabelScreen({ defaults });
    const plantWide = () =>
      sentTo(sent, '/mdm/supplier-item-defaults').filter(
        (each) => each.search.get('supplierId') === null,
      );

    /* 기본 정보는 상세 제목에 적는다. */
    const firstPair = async () => screen.findByRole('heading', { name: /SYN-ITEM-01/u });
    const before = t.pairs.defaultPackaged('봉지 10 × 100 = 1,000 EA');
    await waitFor(async () => expect(await firstPair()).toHaveTextContent(before));
    const asked = plantWide().length;

    /* 관리웹에서 고친 셈 — 다음 조회부터 새 값이 온다. */
    const changed = defaultInfo({
      lotQty: 2000,
      package: { uomId: 8402, uomCode: '봉지', uomName: '봉지', count: 20, qtyPerPackage: 100 },
      versionNo: 2,
    });
    defaults[0] = changed;
    /* 맨 위 줄 [새로고침]은 모든 조회를 다시 받는다(`pop-screen-nav`). */
    await queryClient.invalidateQueries();

    await waitFor(() => expect(plantWide().length).toBeGreaterThan(asked));
    await waitFor(async () =>
      expect(await firstPair()).toHaveTextContent(
        t.pairs.defaultPackaged('봉지 20 × 100 = 2,000 EA'),
      ),
    );
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

    await waitFor(() => expect(waitingRows()).toHaveLength(2));
  });
});

describe('PopMaterialLotLabelScreen — 다른 묶음', () => {
  it('기본 정보가 「포장 없음」이면 「기본 1 TON · 포장 없음」으로 적는다', async () => {
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

    expect(await screen.findByRole('heading', { name: /SYN-ITEM-02/u })).toHaveTextContent(
      t.pairs.defaultUnpackaged('1 TON'),
    );
  });
});
