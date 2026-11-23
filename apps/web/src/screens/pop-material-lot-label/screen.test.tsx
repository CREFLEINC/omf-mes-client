import { ko, messages, vi as viMessages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POP_SCREENS } from '../../patterns/pop-screen-catalog';
import {
  HARNESS_NOW,
  PLANT_ID,
  group,
  lot,
  renderLabelScreen,
  sentTo,
  type HarnessOptions,
} from './screen-harness';

/**
 * 피처 014 P-01-01 — 왼쪽 공급사·품목(서버 쪽 · 찾기) · 오른쪽 탭 넷(미출력은 만들면서) · 로딩 · 알림 · 번호 스캔 찾기
 * (screens/P-01-01.md · 시안 P0101). 만들기 창은 `supplier-issue.test.tsx`, 인쇄 길은 `issue-flow.test.tsx` 가 문다.
 */

const t = messages.popMaterialLotLabel;
const tp = t.precreate;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(HARNESS_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const pairList = async (): Promise<HTMLElement> =>
  screen.findByRole('list', { name: tp.listTitle });

/** 왼쪽 공급사·품목 줄 — 품목코드로 찾는다. */
const pairButton = async (itemCode: string): Promise<HTMLElement> =>
  within(await pairList()).getByRole('button', { name: new RegExp(itemCode, 'u') });

const pickPair = async (
  user: ReturnType<typeof userEvent.setup>,
  itemCode = 'SYN-ITEM-01',
): Promise<void> => {
  await user.click(await pairButton(itemCode));
};

const lotTable = (tabName: string): HTMLElement => screen.getByRole('group', { name: tabName });

const bodyRows = (tabName: string): HTMLElement[] =>
  within(lotTable(tabName)).getAllByRole('row').slice(1);

const checkboxes = (): HTMLElement[] => screen.queryAllByRole('checkbox', { name: /\|/u });

/** 품목 가에 P/O 몫 — 미출력 2(수동) + 만들 수 있는 n. */
const withShare = (creatable: number, over: Partial<HarnessOptions> = {}): HarnessOptions => ({
  shares: {
    '8201:8601': {
      creatable,
      lotQty: 100,
      package: { uomId: 8403, uomCode: '롤', uomName: '롤', count: 10, qtyPerPackage: 10 },
      po: { purchaseOrderLineId: 7101, purchaseOrderNo: 'SYN-PO-07', lineNo: 1 },
    },
  },
  ...over,
});

describe('FR-010 · FR-011 왼쪽 공급사·품목 — 서버 쪽 · 찾기', () => {
  it('Q16 FR-010 목록은 단말 공장으로 쪽 단위로 부르고, 행에 미출력 · 생성 예정 칩과 품목 기본값을 적는다', async () => {
    const { sent } = renderLabelScreen(withShare(37));

    const button = await pairButton('SYN-ITEM-01');
    expect(button).toHaveTextContent('합성 품목 가');
    expect(button).toHaveTextContent(tp.chipUnprinted(2));
    expect(button).toHaveTextContent(tp.chipCreatable(37));
    expect(button).toHaveTextContent('합성 공급사 가 SYN-P-01');
    expect(button).toHaveTextContent(tp.defaultPackaged('100 EA', '롤 10'));

    const asked = sentTo(sent, '/logistics/material-lot-pairs')[0];
    expect(asked?.search.get('plantId')).toBe(String(PLANT_ID));
    expect(asked?.search.get('page')).toBe('1');
    expect(Number(asked?.search.get('size'))).toBeGreaterThan(0);
    /* ⛔ 공장 전체 대기 목록은 더 부르지 않는다(FR-010). */
    expect(sentTo(sent, '/logistics/waiting-material-lots')).toHaveLength(0);
  });

  it('Q16 FR-011 발행 이력 · LOT 이 없는 조합도 서고, 둘 다 0 이면 칩이 회색이다', async () => {
    renderLabelScreen();

    const empty = await pairButton('SYN-ITEM-02');
    expect(empty).toHaveTextContent(tp.chipUnprinted(0));
    expect(empty).toHaveTextContent(tp.chipCreatable(0));
  });

  it('Q16 기본값이 없거나 환산이 없는 품목은 빨간 글로 말하고 생성 예정 칩이 없다', async () => {
    renderLabelScreen({
      shares: {
        '8201:8601': { creatable: 0, lotQty: 0, package: null, status: 'NO_DEFAULT' },
        '8202:8602': { creatable: 0, lotQty: 0, package: null, status: 'NO_CONVERSION' },
      },
    });

    const noDefault = await pairButton('SYN-ITEM-01');
    expect(noDefault).toHaveTextContent(tp.noDefault);
    expect(noDefault).not.toHaveTextContent(/생성 예정/u);
    expect(await pairButton('SYN-ITEM-02')).toHaveTextContent(tp.noConversion);
  });

  it('Q16 FR-021 번호가 아닌 글자는 찾기 — 서버에 q 로 싣고, 없으면 그렇게 말한다', async () => {
    const user = userEvent.setup();
    const { sent } = renderLabelScreen();

    await pairList();
    const field = screen.getByRole('textbox', { name: tp.scanLabel });
    await user.type(field, '공급사 나{Enter}');

    await waitFor(() =>
      expect(sentTo(sent, '/logistics/material-lot-pairs').at(-1)?.search.get('q')).toBe(
        '공급사 나',
      ),
    );
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: tp.listTitle })).getAllByRole('button'),
      ).toHaveLength(1),
    );

    await user.clear(field);
    await user.type(field, '없는말{Enter}');
    expect(await screen.findByText(t.pairs.noMatch)).toBeInTheDocument();
  });

  it('FR-010 화면을 열기만 해서는 고르지 않는다 — 고르기 전에는 LOT 을 만들지 않는다', async () => {
    const { sent } = renderLabelScreen(withShare(5));

    await pairList();
    expect(screen.getByText(t.work.pickPair)).toBeInTheDocument();
    expect(sentTo(sent, '/logistics/material-lots')).toHaveLength(0);
  });

  it('FR-010 20초 다시 받기는 없다 — 가만히 두면 목록을 다시 부르지 않는다', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(HARNESS_NOW);
    const { sent } = renderLabelScreen();

    await waitFor(() => expect(sentTo(sent, '/logistics/material-lot-pairs')).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sentTo(sent, '/logistics/material-lot-pairs')).toHaveLength(1);
  });

  it('⛔ 단말의 공장을 모르면 목록을 부르지 않는다', async () => {
    const { sent } = renderLabelScreen({ identity: { plantId: null } });

    expect(await screen.findByText(t.work.noPlant)).toBeInTheDocument();
    expect(sentTo(sent, '/logistics/material-lot-pairs')).toHaveLength(0);
  });

  it('목록을 받지 못하면 사유와 다시 불러오기를 함께 보인다', async () => {
    renderLabelScreen({ waitingFail: true });

    expect(await screen.findByText(t.work.loadFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.work.retry })).toBeInTheDocument();
  });
});

describe('US1 · US2 미출력 탭 — 고르면 이미 만들어져 있다', () => {
  it('US1-1 US1-6 US2-1 고르면 미출력 탭을 이 쪽 크기로 부르고, 차례 · P/O 라인 · 만든 방식 칸으로 선다', async () => {
    const user = userEvent.setup();
    const { sent } = renderLabelScreen(withShare(37));

    await pickPair(user);
    await waitFor(() => expect(checkboxes().length).toBeGreaterThan(0));

    const asked = sentTo(sent, '/logistics/material-lots')[0];
    expect(asked?.search.get('tab')).toBe('UNPRINTED');
    expect(asked?.search.get('supplierId')).toBe('8201');
    expect(asked?.search.get('itemId')).toBe('8601');
    expect(asked?.search.get('page')).toBe('1');
    const size = Number(asked?.search.get('size'));

    const rows = bodyRows(tp.tabs.UNPRINTED);
    expect(rows).toHaveLength(size);
    /* 수동 둘(9001 · 9002)이 먼저, 그 뒤 자동 — 만든 차례. */
    expect(within(rows[0] as HTMLElement).getAllByRole('cell')[1]).toHaveTextContent('1');
    expect(rows[0]).toHaveTextContent(tp.mode.MANUAL);
    expect(rows[2]).toHaveTextContent(tp.mode.AUTO);
    expect(rows[2]).toHaveTextContent(tp.poLine('SYN-PO-07', 1));
    expect(rows[2]).toHaveTextContent('롤 10 × 10');
    expect(rows[2]).toHaveTextContent('100 EA');
  });

  it('US2-1 쪽 넘김의 총 건수는 아직 만들지 않은 몫을 포함하고 그 수를 함께 말한다', async () => {
    const user = userEvent.setup();
    renderLabelScreen(withShare(37));

    await pickPair(user);
    await waitFor(() => expect(checkboxes().length).toBeGreaterThan(0));
    /* 미출력 2 + 만들 수 있는 37 = 39, 첫 쪽 5 줄이면 3 개를 만들고 34 가 남는다. */
    expect(screen.getByText(messages.popUniform.pager.total(39))).toBeInTheDocument();
    expect(screen.getByText(tp.notCreatedYet(34))).toBeInTheDocument();
    expect(
      within(screen.getByRole('tablist', { name: tp.tabsLabel })).getByRole('tab', {
        name: `${tp.tabs.UNPRINTED}39`,
      }),
    ).toBeInTheDocument();
  });

  it('US2-2 다음 쪽으로 가면 그 쪽만큼 더 만들고, 앞 쪽으로 돌아가면 새로 만들지 않는다', async () => {
    const user = userEvent.setup();
    const { shares } = renderLabelScreen(withShare(37));

    await pickPair(user);
    await waitFor(() => expect(checkboxes().length).toBeGreaterThan(0));
    expect(shares['8201:8601']?.creatable).toBe(34);

    await user.click(screen.getByRole('button', { name: messages.popUniform.pager.next }));
    await waitFor(() => expect(shares['8201:8601']?.creatable).toBe(29));

    await user.click(screen.getByRole('button', { name: messages.popUniform.pager.prev }));
    await waitFor(() => expect(bodyRows(tp.tabs.UNPRINTED)[0]).toHaveTextContent('|0001'));
    expect(shares['8201:8601']?.creatable).toBe(29);
  });

  it('US2-3 FR-013 조회 · 생성 중에는 「자재 관리 LOT 을 조회하고 생성하고 있습니다」를 보인다', async () => {
    const user = userEvent.setup();
    let open = (): void => undefined;
    const lotsGate = new Promise<void>((resolve) => {
      open = resolve;
    });
    renderLabelScreen(withShare(3, { lotsGate }));

    await pickPair(user);
    expect(await screen.findByText(tp.loading)).toBeInTheDocument();
    expect(screen.getByText(tp.loadingHint)).toBeInTheDocument();
    open();
    await waitFor(() => expect(screen.queryByText(tp.loading)).toBeNull());
  });

  it('US1-4 SC-005 기본값이 없으면 알림을 보이고 [자재 관리 LOT 생성]은 켜져 있다 — 수동 LOT 은 그대로 선다', async () => {
    const user = userEvent.setup();
    renderLabelScreen({
      shares: { '8201:8601': { creatable: 0, lotQty: 0, package: null, status: 'NO_DEFAULT' } },
    });

    await pickPair(user);
    expect(await screen.findByText(tp.notes.NO_DEFAULT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.work.create })).toBeEnabled();
    await waitFor(() => expect(checkboxes()).toHaveLength(2));
  });

  it('US1-5 SC-005 기본값은 있고 미입고 P/O · 미출력이 없으면 「입하 예정 계획이 없습니다…」 — 빈 표만 남지 않는다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await pickPair(user, 'SYN-ITEM-02');
    expect(await screen.findByText(tp.notes.NO_OPEN_PO)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: tp.tabs.UNPRINTED })).toBeNull();
  });

  it('US1-5 경계-환산 환산이 없으면 「품목 단위 환산이 없어 LOT 을 만들 수 없습니다…」', async () => {
    const user = userEvent.setup();
    renderLabelScreen({
      shares: { '8202:8602': { creatable: 0, lotQty: 0, package: null, status: 'NO_CONVERSION' } },
    });

    await pickPair(user, 'SYN-ITEM-02');
    expect(await screen.findByText(tp.notes.NO_CONVERSION)).toBeInTheDocument();
  });

  it('409 LOT_NO_CONFLICT 면 다시 불러오라고 말한다', async () => {
    const user = userEvent.setup();
    renderLabelScreen({
      lotsFail: {
        status: 409,
        body: { errors: [{ scope: 'request', code: 'LOT_NO_CONFLICT', message: '충돌' }] },
      },
    });

    await pickPair(user);
    expect(await screen.findByText(tp.notes.conflict)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.work.retry })).toBeInTheDocument();
  });

  it('머리에 품목코드 · 품목명 · 공급사 · 기본 단위를 이름표와 함께, 품목 기본값을 적는다', async () => {
    const user = userEvent.setup();
    renderLabelScreen(withShare(0));

    await pickPair(user);
    const head = await screen.findByRole('heading', { name: /SYN-ITEM-01/u });
    const f = t.work.fields;
    expect(head).toHaveTextContent(
      `${f.itemCode}SYN-ITEM-01${f.itemName}합성 품목 가${f.supplier}합성 공급사 가${f.uom}EA` +
        tp.headDefault(tp.defaultPackaged('100 EA', '롤 10 × 10')),
    );
  });

  it('vi 문구 — 로딩 · 알림이 베트남어로 옮겨져 있다', () => {
    const viP = viMessages.popMaterialLotLabel.precreate;
    const koP = ko.popMaterialLotLabel.precreate;

    expect(viP.loading).not.toBe(koP.loading);
    expect(viP.notes.NO_DEFAULT).not.toBe(koP.notes.NO_DEFAULT);
    expect(viP.notes.NO_OPEN_PO.length).toBeGreaterThan(0);
  });
});

describe('FR-014 탭 넷 — 출력됨(입하 전) · 입하된 LOT · 폐기 LOT', () => {
  it('US4-4 출력됨 탭은 출력했지만 입하 전 LOT — 고르면 [재인쇄] · [폐기]가 켜지고 사유를 고른다', async () => {
    const user = userEvent.setup();
    const { sent } = renderLabelScreen();

    await pickPair(user);
    await user.click(await screen.findByRole('tab', { name: tp.tabs.PRINTED }));
    await waitFor(() => expect(checkboxes()).toHaveLength(1));
    expect(sentTo(sent, '/logistics/material-lots').at(-1)?.search.get('tab')).toBe('PRINTED');

    const row = bodyRows(tp.tabs.PRINTED)[0] as HTMLElement;
    expect(row).toHaveTextContent('|0003');
    expect(row).toHaveTextContent(t.table.issuedSeq(1));
    expect(row).toHaveTextContent('11-11 08:12');
    expect(screen.getByText(tp.tabNotes.PRINTED)).toBeInTheDocument();

    await user.click(row);
    expect(screen.getByRole('button', { name: t.bar.void(1) })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.reprint.action(1) })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: '훼손' }));
    expect(screen.getByRole('button', { name: t.reprint.action(1) })).toBeEnabled();
  });

  it('US4-2 입하된 LOT 탭은 받은 LOT — 공급사 LOT · LOT 상태 · 입하 일시, 재인쇄만(폐기 없음)', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await pickPair(user);
    await user.click(await screen.findByRole('tab', { name: tp.tabs.RECEIVED }));
    await waitFor(() => expect(checkboxes()).toHaveLength(1));

    const row = bodyRows(tp.tabs.RECEIVED)[0] as HTMLElement;
    expect(row).toHaveTextContent('|0005');
    expect(row).toHaveTextContent(t.lotState.received(t.lotState.quality.NORMAL ?? ''));
    await user.click(row);
    expect(screen.queryByRole('button', { name: t.bar.void(1) })).toBeNull();
    expect(screen.getByRole('button', { name: t.reprint.action(1) })).toBeInTheDocument();
  });

  it('US4-3 폐기 LOT 탭은 고를 수도 찍을 수도 없다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await pickPair(user);
    await user.click(await screen.findByRole('tab', { name: tp.tabs.VOIDED }));
    await waitFor(() => expect(bodyRows(tp.tabs.VOIDED)).toHaveLength(1));

    expect(bodyRows(tp.tabs.VOIDED)[0]).toHaveTextContent('|0004');
    expect(checkboxes()).toHaveLength(0);
    expect(screen.getByText(tp.tabNotes.VOIDED)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.bar.issueIdle })).toBeDisabled();
  });

  it('탭을 바꾸면 고른 것이 풀린다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await pickPair(user);
    await waitFor(() => expect(checkboxes()).toHaveLength(2));
    await user.click(screen.getByRole('checkbox', { name: /\|0001 /u }));
    await user.click(screen.getByRole('tab', { name: tp.tabs.PRINTED }));
    await user.click(
      screen.getByRole('tab', { name: (name) => name.startsWith(tp.tabs.UNPRINTED) }),
    );

    await waitFor(() => expect(checkboxes()).toHaveLength(2));
    expect(screen.getByRole('button', { name: t.bar.issueIdle })).toBeDisabled();
  });
});

describe('FR-021 번호 스캔 찾기', () => {
  it('US4-5 출력한 LOT 번호를 스캔하면 그 공급사·품목 · 출력됨 탭을 열고 맨 위에 골라 둔다 — 사유를 골라 재인쇄', async () => {
    const user = userEvent.setup();
    const { sent } = renderLabelScreen();

    await pairList();
    await user.type(
      screen.getByRole('textbox', { name: tp.scanLabel }),
      'SYN-ITEM-01|1000|261111|SYN-P-01|0003{Enter}',
    );

    expect(
      await screen.findByText((text) => text.startsWith(tp.lookup.found(tp.tabs.PRINTED))),
    ).toBeInTheDocument();
    expect(sentTo(sent, '/logistics/material-lots/lookup')[0]?.search.get('plantId')).toBe(
      String(PLANT_ID),
    );
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /\|0003 /u })).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    );
    expect(screen.getByRole('tab', { name: tp.tabs.PRINTED })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(bodyRows(tp.tabs.PRINTED)[0]).toHaveTextContent(tp.lookup.chip);
    expect(screen.getByText((text) => text.endsWith(tp.lookup.foundReprint))).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '훼손' })).toBeInTheDocument();
  });

  it('US4-5 폐기 LOT 이면 폐기 LOT 탭을 열고 찍을 수 없다고 말한다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await pairList();
    await user.type(
      screen.getByRole('textbox', { name: tp.scanLabel }),
      'SYN-ITEM-01|1000|261111|SYN-P-01|0004{Enter}',
    );

    expect(await screen.findByText(tp.lookup.voided)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: tp.tabs.VOIDED })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('US4-5 그 공장에 없는 번호면 알림만 — 화면은 그대로', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await pairList();
    await user.type(
      screen.getByRole('textbox', { name: tp.scanLabel }),
      'SYN-ITEM-09|1|261111|SYN-P-09|0001{Enter}',
    );

    expect(await screen.findByText(tp.lookup.notFound)).toBeInTheDocument();
    expect(screen.getByText(t.work.pickPair)).toBeInTheDocument();
  });
});

describe('고르기와 작업 줄', () => {
  it('줄을 누르면 고르고, 작업 줄 단추가 「라벨 N장 발행」 · 「입하 대기 N개 폐기」로 켜진다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await pickPair(user);
    await waitFor(() => expect(checkboxes()).toHaveLength(2));
    expect(screen.getByRole('button', { name: t.bar.issueIdle })).toBeDisabled();

    await user.click(
      screen.getByRole('checkbox', { name: /\|0001 /u }).closest('tr') as HTMLElement,
    );
    expect(screen.getByRole('button', { name: t.bar.issue(1) })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.bar.void(1) })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: t.bar.clear }));
    expect(screen.getByRole('button', { name: t.bar.issueIdle })).toBeDisabled();
  });

  it('⛔ 「입하 대기 전체 선택」 · 정렬 고르기는 없다(시안 확인 거리 2)', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await pickPair(user);
    await waitFor(() => expect(checkboxes()).toHaveLength(2));
    expect(screen.queryByRole('button', { name: t.bar.selectAll })).toBeNull();
    expect(screen.queryByRole('tab', { name: /최신순/u })).toBeNull();
  });

  it('다른 공급사·품목을 누르면 고른 것이 풀리고 미출력 탭으로 돌아간다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    await pickPair(user);
    await waitFor(() => expect(checkboxes()).toHaveLength(2));
    await user.click(screen.getByRole('checkbox', { name: /\|0001 /u }));
    await pickPair(user, 'SYN-ITEM-02');

    expect(screen.getByRole('button', { name: t.bar.issueIdle })).toBeDisabled();
  });

  it('⛔ 사번을 모르면 발행 · 폐기 · 만들기를 잠근다', async () => {
    const user = userEvent.setup();
    renderLabelScreen({ identity: { workerNo: null } });

    await pickPair(user);
    await waitFor(() => expect(checkboxes()).toHaveLength(2));
    await user.click(screen.getByRole('checkbox', { name: /\|0001 /u }));

    expect(screen.getByRole('button', { name: t.bar.issue(1) })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.bar.void(1) })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.work.create })).toBeDisabled();
  });
});

describe('머리줄', () => {
  it('화면 이름이 화면 목록의 이름과 같다 — 「자재 관리 LOT 라벨」', () => {
    renderLabelScreen();

    expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeInTheDocument();
    expect(POP_SCREENS.find((each) => each.code === 'P-01-01')?.name).toBe(t.title);
  });

  it('프린터 조회가 실패해도 목록은 그대로 쓴다', async () => {
    renderLabelScreen({ printersFail: true, groups: [group([lot(9001)])] });

    expect(await pairButton('SYN-ITEM-01')).toBeInTheDocument();
  });
});
