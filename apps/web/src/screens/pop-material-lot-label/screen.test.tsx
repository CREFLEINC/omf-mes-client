import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POP_SCREENS } from '../../patterns/pop-screen-catalog';
import { PRINTER_STORAGE_KEY } from './printer-choice';
import { LIST_REFRESH_MS, PENDING_RECENT_DAYS, shiftDate } from './queries';
import { HARNESS_NOW, line, receipt, renderLabelScreen, sentTo } from './screen-harness';
import { formatPlantClock, plantToday } from '../../patterns/plant-time';

const t = messages.popMaterialLotLabel;

beforeEach(() => {
  /* 발판의 입하일(08-27)이 화면의 기본 기간(이번 주)에 들게 날짜만 멈춘다(`HARNESS_NOW`). */
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(HARNESS_NOW);
});

afterEach(() => {
  vi.useRealTimers();
  delete window.pop;
  try {
    window.localStorage.removeItem(PRINTER_STORAGE_KEY);
  } catch {
    /* 저장소가 없는 시험 환경 — 지울 것도 없다. */
  }
});

/** 두 공급사 — 나(8202)가 10:00 에 하나, 가(8201)가 09:00 · 11:00 에 둘. 먼저 입하된 공급사는 가다. */
const TWO_SUPPLIERS = {
  receipts: [
    receipt(8101, 8202, '2026-08-27T10:00:00Z'),
    receipt(8102, 8201, '2026-08-27T09:00:00Z'),
    receipt(8103, 8201, '2026-08-27T11:00:00Z'),
  ],
  lines: [line(8501, 8101, 8602, 300), line(8502, 8102, 8601, 500), line(8503, 8103, 8602, 1500)],
};

const supplierTiles = async (): Promise<HTMLElement[]> =>
  within(await screen.findByRole('list', { name: t.suppliers.label })).findAllByRole('button');

const rows = (): HTMLElement[] => screen.queryAllByRole('checkbox', { name: /입하$/u });

describe('PopMaterialLotLabelScreen — 공급사로 묶는다', () => {
  it('먼저 입하된 공급사가 위에 서고 큰 숫자가 남은 장수다', async () => {
    renderLabelScreen(TWO_SUPPLIERS);

    const tiles = await supplierTiles();

    expect(tiles.map((tile) => tile.querySelector('.pop-mlot-supplier-name')?.textContent)).toEqual(
      ['합성 공급사 가', '합성 공급사 나'],
    );
    expect(tiles[0]).toHaveTextContent(/2장/u);
    expect(tiles[0]).toHaveTextContent(t.suppliers.since('08-27 16:00'));
    expect(tiles[1]).toHaveTextContent(/1장/u);
    expect(tiles[1]).toHaveTextContent(t.suppliers.at('08-27 17:00'));
  });

  it('처음에는 맨 위 공급사의 줄을 입하 순서로 보이고, 다른 공급사를 누르면 그 줄로 바뀌며 고른 것이 풀린다', async () => {
    const user = userEvent.setup();
    renderLabelScreen(TWO_SUPPLIERS);

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('SYN-ITEM-01'),
      expect.stringContaining('SYN-ITEM-02'),
    ]);
    expect(screen.getByRole('heading', { name: '합성 공급사 가' })).toBeInTheDocument();

    await user.click(rows()[0] as HTMLElement);
    expect(rows()[0]).toHaveAttribute('aria-checked', 'true');

    const tiles = await supplierTiles();
    await user.click(tiles[1] as HTMLElement);

    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.getByRole('heading', { name: '합성 공급사 나' })).toBeInTheDocument();
    expect(rows()[0]).toHaveAttribute('aria-checked', 'false');
    expect(tiles[1]).toHaveAttribute('aria-pressed', 'true');
  });

  it('열 머리를 한 번만 두고, 줄에는 품목코드 · 품목명 · 수량 · 입하 시각만 선다', async () => {
    renderLabelScreen();

    await waitFor(() => expect(rows()).toHaveLength(1));
    const row = rows()[0] as HTMLElement;

    expect(row).toHaveTextContent('SYN-ITEM-01');
    expect(row).toHaveTextContent('합성 품목 가');
    expect(row).toHaveTextContent('500EA');
    expect(row).toHaveTextContent('26.08.27 16:12');
    /* 옛 목록은 값마다 이름표를 붙였다 — 줄에 이름표가 없다. */
    expect(row).not.toHaveTextContent(t.table.columns.itemCode);
    expect(screen.getAllByText(t.table.columns.itemCode)).toHaveLength(1);
  });

  it('입하 일시는 yy.mm.dd hh:mm 이다 — 오늘 들어온 줄도 날짜를 빼지 않는다', async () => {
    renderLabelScreen({
      receipts: [receipt(8101, 8201, '2026-08-28T02:05:00Z')],
      lines: [line(8501, 8101, 8601, 500)],
    });

    await waitFor(() => expect(rows()[0]).toHaveTextContent('26.08.28 09:05'));
  });

  it('수량은 천 단위 쉼표를 넣는다', async () => {
    renderLabelScreen({ lines: [line(8501, 8101, 8601, 51000)] });

    await waitFor(() => expect(rows()[0]).toHaveTextContent('51,000EA'));
  });

  it('마지막 열이 IQC 다 — 검사 대상 줄에만 「필수」를 적는다', async () => {
    renderLabelScreen({
      receipts: [receipt(8101, 8201, '2026-08-27T09:00:00Z')],
      lines: [
        line(8501, 8101, 8601, 500, { inspectionRequired: true }),
        line(8502, 8101, 8602, 700),
      ],
    });

    await waitFor(() => expect(rows()).toHaveLength(2));
    const head = screen.getByText(t.table.columns.itemCode).parentElement as HTMLElement;

    expect(head.lastElementChild).toHaveTextContent(t.table.columns.iqc);
    expect(rows()[0]?.lastElementChild).toHaveTextContent(t.table.iqcRequired);
    expect(rows()[1]?.lastElementChild).toBeEmptyDOMElement();
    /* 품목명 옆의 옛 「IQC」 표식은 열로 옮겼다 — 한 줄에 한 번만. */
    expect(rows()[0]).not.toHaveTextContent(t.table.columns.iqc);
  });
});

describe('PopMaterialLotLabelScreen — 고르기', () => {
  it('줄 어디를 눌러도 체크되고 다시 누르면 풀린다 — 동작 바가 장수를 말한다', async () => {
    const user = userEvent.setup();
    renderLabelScreen(TWO_SUPPLIERS);

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.getByText(t.bar.empty)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.bar.issueIdle })).toBeDisabled();

    await user.click(within(rows()[1] as HTMLElement).getByText('합성 품목 나'));
    await user.click(rows()[0] as HTMLElement);

    expect(screen.getByText(t.bar.selected(2))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.bar.issue(2) })).toBeEnabled();

    await user.click(rows()[0] as HTMLElement);
    expect(screen.getByText(t.bar.selected(1))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.bar.clear }));
    expect(screen.getByText(t.bar.empty)).toBeInTheDocument();
  });

  it('전체 선택은 이 공급사의 모든 쪽을 고르고, 다시 누르면 모두 푼다', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 10 }, (_, index) =>
      line(8501 + index, 8101, 8601, 100 + index, { lineNo: index + 1 }),
    );
    renderLabelScreen({ lines: many });

    const selectAll = await screen.findByRole('checkbox', { name: t.table.selectAll });
    await user.click(selectAll);

    expect(screen.getByText(t.bar.selected(10))).toBeInTheDocument();
    expect(selectAll).toHaveAttribute('aria-checked', 'true');

    await user.click(selectAll);
    expect(screen.getByText(t.bar.empty)).toBeInTheDocument();
  });

  it('한 줄만 고르면 전체 선택이 「일부」를 말한다', async () => {
    const user = userEvent.setup();
    renderLabelScreen(TWO_SUPPLIERS);

    await waitFor(() => expect(rows()).toHaveLength(2));
    await user.click(rows()[0] as HTMLElement);

    expect(screen.getByRole('checkbox', { name: t.table.selectAll })).toHaveAttribute(
      'aria-checked',
      'mixed',
    );
  });

  it('⛔ 사번을 모르면 발행 단추를 감추지 않고 잠그며, 사유는 맨 위 띠가 말한다', async () => {
    const user = userEvent.setup();
    renderLabelScreen({ identity: { workerNo: null } });

    await waitFor(() => expect(rows()).toHaveLength(1));
    await user.click(rows()[0] as HTMLElement);

    expect(screen.getByRole('button', { name: t.bar.issue(1) })).toBeDisabled();
    expect(screen.getByText(messages.popChrome.workerMissing)).toBeInTheDocument();
  });
});

describe('PopMaterialLotLabelScreen — 쪽과 찾기', () => {
  it('칸 높이를 모르면 한 쪽 8줄 — 넘치는 줄은 다음 쪽에서 보인다', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 9 }, (_, index) =>
      line(8501 + index, 8101, 8601, 100 + index, { lineNo: index + 1 }),
    );
    renderLabelScreen({ lines: many });

    await waitFor(() => expect(rows()).toHaveLength(8));
    expect(screen.getByText(t.table.range(1, 8, 9))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.table.prev })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: t.table.next }));

    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent('108');
    expect(screen.getByText(t.table.range(9, 9, 9))).toBeInTheDocument();
  });

  it('찾기 칸에 품목코드나 입하번호를 넣으면 맞는 줄과 그 공급사만 남는다', async () => {
    const user = userEvent.setup();
    renderLabelScreen(TWO_SUPPLIERS);

    await waitFor(() => expect(rows()).toHaveLength(2));
    const search = screen.getByRole('searchbox', { name: t.search.label });

    await user.type(search, 'item-02');
    /* 두 공급사에 하나씩 맞는다 — 맞는 줄이 있는 공급사만 남고, 그중 먼저 입하된 쪽이 열린다. */
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toHaveTextContent('SYN-ITEM-02');
    expect(await supplierTiles()).toHaveLength(2);

    await user.clear(search);
    await user.type(search, 'SYN-IB-8101');
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '합성 공급사 나' })).toBeInTheDocument(),
    );
    expect(await supplierTiles()).toHaveLength(1);

    await user.clear(search);
    await user.type(search, '없는코드');
    expect(await screen.findByText(t.table.noMatch)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.search.clear }));
    await waitFor(() => expect(rows()).toHaveLength(2));
  });
});

describe('PopMaterialLotLabelScreen — 어디서 받는가', () => {
  it('줄 목록 경로가 있으면 그것만 부른다 — 미부착 · 미발행 조건을 싣고 입하 건 목록은 부르지 않는다', async () => {
    const { sent } = renderLabelScreen({ ...TWO_SUPPLIERS, lineList: 'served' });

    await waitFor(() => expect(rows()).toHaveLength(2));
    const asked = sentTo(sent, '/logistics/inbound-receipt-lines')[0];

    expect(asked?.search.get('labelIssued')).toBe('false');
    expect(asked?.search.get('supplierLotLabelAttached')).toBe('false');
    expect(sentTo(sent, '/logistics/inbound-receipts')).toHaveLength(0);
  });

  /**
   * ⭐ 앞선 서버(줄 목록 경로 없음 · 404)에서도 화면이 선다 — 입하 건 → 줄로 모은다.
   * 건 목록의 `labelIssued=false` 는 「발행된 줄이 하나도 없는 건」이라 일부만 찍은 옛 건이 빠진다(#1241) —
   * 최근 며칠은 발행 조건 없이 함께 받는다.
   */
  it('줄 목록 경로가 없으면(404) 미발행 건 + 최근 입하 건을 받아 건마다 미발행 줄을 모은다', async () => {
    const { sent } = renderLabelScreen(TWO_SUPPLIERS);

    await waitFor(() => expect(rows()).toHaveLength(2));
    const receiptAsks = sentTo(sent, '/logistics/inbound-receipts');

    expect(receiptAsks.some((ask) => ask.search.get('labelIssued') === 'false')).toBe(true);
    expect(
      receiptAsks.some(
        (ask) =>
          !ask.search.has('labelIssued') &&
          ask.search.get('receiptDateFrom') === shiftDate(plantToday(), -PENDING_RECENT_DAYS),
      ),
    ).toBe(true);
    expect(receiptAsks.every((ask) => ask.search.get('supplierLotLabelAttached') === 'false')).toBe(
      true,
    );

    const lineAsk = sent.find((entry) => /\/inbound-receipts\/\d+\/lines$/u.test(entry.path));
    expect(lineAsk?.search.get('labelIssued')).toBe('false');
    expect(lineAsk?.search.get('supplierLotLabelAttached')).toBe('false');
  });

  it('취소된 입하는 발행 대기에 세우지 않는다', async () => {
    renderLabelScreen({
      receipts: [
        receipt(8101, 8201, '2026-08-27T09:00:00Z'),
        receipt(8102, 8202, '2026-08-27T09:30:00Z', 'CANCELLED'),
      ],
      lines: [line(8501, 8101, 8601, 500), line(8502, 8102, 8602, 700)],
    });

    expect(await supplierTiles()).toHaveLength(1);
  });

  it('가만히 두어도 목록을 다시 받는다 — PDA 가 등록한 입하가 스스로 뜬다(omf-all-around#29)', async () => {
    vi.useFakeTimers();

    try {
      const { sent } = renderLabelScreen({ lineList: 'served' });

      await vi.advanceTimersByTimeAsync(100);
      const first = sentTo(sent, '/logistics/inbound-receipt-lines').length;
      expect(first).toBeGreaterThan(0);

      await vi.advanceTimersByTimeAsync(LIST_REFRESH_MS + 100);

      expect(sentTo(sent, '/logistics/inbound-receipt-lines').length).toBeGreaterThan(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it('새로 고침을 누르면 바로 다시 받는다', async () => {
    const user = userEvent.setup();
    const { sent } = renderLabelScreen({ lineList: 'served' });

    await waitFor(() => expect(rows()).toHaveLength(1));
    const before = sentTo(sent, '/logistics/inbound-receipt-lines').length;

    await user.click(screen.getByRole('button', { name: t.table.refresh }));

    await waitFor(() =>
      expect(sentTo(sent, '/logistics/inbound-receipt-lines').length).toBeGreaterThan(before),
    );
  });

  it.each(['served', 'missing'] as const)(
    '새로 고침을 누르면 그 사이 웹 · PDA 로 입하한 줄이 바로 선다(줄 목록 경로 %s)',
    async (lineList) => {
      const user = userEvent.setup();
      const receipts = [receipt(8101, 8201, '2026-08-27T09:00:00Z')];
      const lines = [line(8501, 8101, 8601, 500)];
      renderLabelScreen({ receipts, lines, lineList });

      expect(await supplierTiles()).toHaveLength(1);
      /* 화면이 연 뒤 다른 공급사의 입하가 들어왔다. */
      receipts.push(receipt(8102, 8202, '2026-08-27T09:30:00Z'));
      lines.push(line(8502, 8102, 8602, 700));

      await user.click(screen.getByRole('button', { name: t.table.refresh }));

      await waitFor(async () => expect(await supplierTiles()).toHaveLength(2));
    },
  );

  it('다시 인쇄를 보는 동안 새로 고침을 눌러도 발행 대기 장수가 바로 맞는다', async () => {
    const user = userEvent.setup();
    const receipts = [
      receipt(8101, 8201, '2026-08-27T09:00:00Z'),
      receipt(8102, 8201, '2026-08-27T09:10:00Z'),
    ];
    const lines = [line(8501, 8101, 8601, 500), line(8502, 8102, 8602, 700, { issued: true })];
    renderLabelScreen({ receipts, lines, lineList: 'served' });

    const count = (n: number) => new RegExp(`^${t.tabs.pending}\\s*${String(n)}$`, 'u');
    const pendingTab = await screen.findByRole('button', { name: count(1) });
    await user.click(screen.getByRole('button', { name: t.tabs.reprint }));
    receipts.push(receipt(8103, 8202, '2026-08-27T09:30:00Z'));
    lines.push(line(8503, 8103, 8602, 900));

    await user.click(screen.getByRole('button', { name: t.table.refresh }));

    await waitFor(() => expect(pendingTab).toHaveAccessibleName(count(2)));
  });

  it('입하 목록을 받지 못하면 사유와 다시 불러오기를 함께 보인다', async () => {
    renderLabelScreen({ receiptsFail: true });

    expect(await screen.findByText(t.table.loadFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.table.retry })).toBeInTheDocument();
  });

  it('발행할 줄이 하나도 없으면 빈 상태를 말한다', async () => {
    renderLabelScreen({ lines: [] });

    expect(await screen.findByText(t.suppliers.pendingEmpty)).toBeInTheDocument();
  });

  it('새로 고침은 한 자리에만 있고, 옆에 서버에서 마지막으로 받은 시각(공장 시각)을 적는다', async () => {
    renderLabelScreen({ lineList: 'served' });

    expect(
      await screen.findByText(t.table.refreshedAt(formatPlantClock(HARNESS_NOW))),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: t.table.refresh })).toHaveLength(1);
  });
});

/**
 * 입하 기간(사용자 지시 2026-10-27) — 지금은 08-28(금)이라 이번 주는 08-24(월)부터다.
 * 공급사 가(8201)는 이번 주, 나(8202)는 지난 주(08-20 · 08-21)에 들어왔다.
 */
const THIS_AND_LAST_WEEK = {
  receipts: [
    receipt(8101, 8201, '2026-08-27T02:00:00Z'),
    receipt(8102, 8202, '2026-08-20T02:00:00Z'),
    receipt(8103, 8202, '2026-08-21T02:00:00Z'),
  ],
  lines: [line(8501, 8101, 8601, 500), line(8502, 8102, 8602, 700), line(8503, 8103, 8601, 900)],
};

const periodButton = (name: string): HTMLElement =>
  within(screen.getByRole('group', { name: t.period.label })).getByRole('button', { name });

const tileNames = (tiles: readonly HTMLElement[]): (string | null | undefined)[] =>
  tiles.map((tile) => tile.querySelector('.pop-mlot-supplier-name')?.textContent);

describe('PopMaterialLotLabelScreen — 입하 기간', () => {
  it('기본은 이번 주다 — 지난 주 입하분은 목록에서 빼고, 띠로 장수와 날짜를 알린다', async () => {
    renderLabelScreen(THIS_AND_LAST_WEEK);

    expect(tileNames(await supplierTiles())).toEqual(['합성 공급사 가']);
    expect(periodButton(t.period.week)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(t.period.pastTitle(2))).toBeInTheDocument();
    expect(screen.getByText(t.period.pastRange('08-20', '08-21'))).toBeInTheDocument();
    /* 탭의 장수는 기간과 상관없이 남은 대기 전부다. */
    expect(
      screen.getByRole('button', { name: new RegExp(`^${t.tabs.pending}\\s*3$`, 'u') }),
    ).toBeInTheDocument();
  });

  it('「보기」로 지난 줄만 모아 보고, 「이번 주 보기」로 돌아온다', async () => {
    const user = userEvent.setup();
    renderLabelScreen(THIS_AND_LAST_WEEK);

    await supplierTiles();
    await user.click(screen.getByRole('button', { name: t.period.showPast }));

    await waitFor(async () => expect(tileNames(await supplierTiles())).toEqual(['합성 공급사 나']));
    expect(rows()).toHaveLength(2);
    /* 지난 줄을 보는 동안은 어느 기간도 눌리지 않았다. */
    expect(periodButton(t.period.week)).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: t.period.backTo(t.period.week) }));

    await waitFor(async () => expect(tileNames(await supplierTiles())).toEqual(['합성 공급사 가']));
    expect(periodButton(t.period.week)).toHaveAttribute('aria-pressed', 'true');
  });

  it('「전체」는 지난 줄까지 다 보이고 띠를 걷는다', async () => {
    const user = userEvent.setup();
    renderLabelScreen(THIS_AND_LAST_WEEK);

    await supplierTiles();
    await user.click(periodButton(t.period.all));

    await waitFor(async () =>
      expect(tileNames(await supplierTiles())).toEqual(['합성 공급사 나', '합성 공급사 가']),
    );
    expect(screen.queryByText(t.period.pastTitle(2))).toBeNull();
  });

  it('「오늘」 입하분이 없으면 그렇게 말하고, 어제 들어온 줄은 띠로 센다', async () => {
    const user = userEvent.setup();
    renderLabelScreen({
      receipts: [receipt(8101, 8201, '2026-08-27T02:00:00Z')],
      lines: [line(8501, 8101, 8601, 500)],
    });

    await supplierTiles();
    await user.click(periodButton(t.period.today));

    expect(await screen.findByText(t.period.empty(t.period.today))).toBeInTheDocument();
    expect(screen.getByText(t.period.pastTitle(1))).toBeInTheDocument();
    expect(screen.getByText(t.period.pastRange('08-27', '08-27'))).toBeInTheDocument();
  });

  it('찾기 칸은 기간을 보지 않는다 — 지난 주 입하분도 입하번호로 찾고, 찾는 동안 띠를 걷는다', async () => {
    const user = userEvent.setup();
    renderLabelScreen(THIS_AND_LAST_WEEK);

    await supplierTiles();
    await user.type(screen.getByRole('searchbox', { name: t.search.label }), 'SYN-IB-8102');

    await waitFor(async () => expect(tileNames(await supplierTiles())).toEqual(['합성 공급사 나']));
    expect(rows()).toHaveLength(1);
    expect(screen.queryByText(t.period.pastTitle(2))).toBeNull();
  });
});

describe('PopMaterialLotLabelScreen — 상세 목록의 품목코드 칸', () => {
  const itemFilter = (): HTMLElement =>
    screen.getByRole('searchbox', { name: t.table.itemFilter.label });

  it('고른 공급사의 줄 안에서만 품목코드로 거른다 — 공급사 목록은 그대로다', async () => {
    const user = userEvent.setup();
    renderLabelScreen(TWO_SUPPLIERS);

    await waitFor(() => expect(rows()).toHaveLength(2));
    await user.type(itemFilter(), 'item-02');

    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toHaveTextContent('SYN-ITEM-02');
    expect(await supplierTiles()).toHaveLength(2);
    /* 왼쪽 찾기 칸과 따로다 — 왼쪽은 비어 있다. */
    expect(screen.getByRole('searchbox', { name: t.search.label })).toHaveValue('');
  });

  it('전체 선택은 보이는 줄만 고른다', async () => {
    const user = userEvent.setup();
    renderLabelScreen(TWO_SUPPLIERS);

    await waitFor(() => expect(rows()).toHaveLength(2));
    await user.type(itemFilter(), 'ITEM-01');
    await waitFor(() => expect(rows()).toHaveLength(1));
    await user.click(screen.getByRole('checkbox', { name: t.table.selectAll }));

    expect(screen.getByText(t.bar.selected(1))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.bar.issue(1) })).toBeInTheDocument();
  });

  it('맞는 품목이 없으면 그렇게 말하고, 공급사를 바꾸면 칸을 비운다', async () => {
    const user = userEvent.setup();
    renderLabelScreen(TWO_SUPPLIERS);

    await waitFor(() => expect(rows()).toHaveLength(2));
    await user.type(itemFilter(), 'NOPE');

    expect(await screen.findByText(t.table.noMatch)).toBeInTheDocument();

    await user.click((await supplierTiles())[1] as HTMLElement);

    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(itemFilter()).toHaveValue('');
  });
});

describe('PopMaterialLotLabelScreen — 머리줄', () => {
  it('화면 이름이 화면 목록의 이름과 같다 — 가운뎃점으로 두 일을 잇지 않는다', async () => {
    renderLabelScreen();

    const title = await screen.findByRole('heading', { level: 1 });

    expect(title).toHaveTextContent(t.title);
    expect(POP_SCREENS.find((each) => each.code === 'P-01-01')?.name).toBe(t.title);
    expect(t.title).not.toContain('·');
  });

  it('지금 나갈 프린터를 머리줄에 보인다 — 브라우저에서는 눌러도 바꾸는 창을 열지 않는다', async () => {
    renderLabelScreen();

    expect(await screen.findByText(`${t.printer.label} 합성 라벨 프린터 가`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: new RegExp(t.printer.choose, 'u') })).toBeNull();
  });

  it('프린터 조회가 실패해도 목록은 그대로 쓴다', async () => {
    renderLabelScreen({ printersFail: true });

    expect(await screen.findByText(t.printer.unknown)).toBeInTheDocument();

    await waitFor(() => expect(rows()).toHaveLength(1));
  });
});
