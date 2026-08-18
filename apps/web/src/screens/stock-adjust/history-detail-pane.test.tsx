import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { adjustmentDetailBody, itemFixtures, lotFixtures, uomFixtures } from './fixtures';
import {
  buildHistoryLineColumns,
  describeErp,
  HISTORY_LINE_ABSORBING_COLUMN_BUDGET_PX,
  HISTORY_LINE_TABLE_MIN_WIDTH_PX,
  HistoryDetailPane,
  type HistoryDetailPaneProps,
} from './history-detail-pane';
import type { LotLookupResult, ReferenceSource } from './lookups';
import { toAdjustmentDetailView } from './types';

const t = messages.stockAdjust;

const ITEM_LABEL = 'SAMPLE-ITEM-A · 합성 품목 가';
const UOM_LABEL = 'SAMPLE-EA · 합성 단위 개';
const LOT_LABEL = 'SAMPLE-LOT-0001';
const COUNT_NAME = 'SAMPLE-IC-A · 2026-08-17';

const source = (
  entries: { value: string; label: string }[],
  overrides: Partial<ReferenceSource> = {},
): ReferenceSource => ({
  entries: entries.map((entry) => ({ ...entry, isActive: true })),
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

const itemSource = (overrides: Partial<ReferenceSource> = {}): ReferenceSource =>
  source(
    itemFixtures.map((item) => ({
      value: String(item.itemId),
      label: `${item.itemCode} · ${item.itemName}`,
    })),
    overrides,
  );

const uomSource = (overrides: Partial<ReferenceSource> = {}): ReferenceSource =>
  source(
    uomFixtures.map((uom) => ({
      value: String(uom.uomId),
      label: `${uom.uomCode} · ${uom.uomName}`,
    })),
    overrides,
  );

const lotSource = (overrides: Partial<LotLookupResult> = {}): LotLookupResult => ({
  entries: lotFixtures.map((lot) => ({
    value: String(lot.lotId),
    label: lot.lotNo,
    itemId: String(lot.itemId),
    isActive: true,
  })),
  isError: false,
  isLoading: false,
  truncated: false,
  refetch: vi.fn(),
  ...overrides,
});

const baseProps = (overrides: Partial<HistoryDetailPaneProps> = {}): HistoryDetailPaneProps => ({
  detail: toAdjustmentDetailView(
    adjustmentDetailBody({ lineCount: 2, adjustedAt: '2026-08-18T14:05:00+09:00' }),
  ),
  countName: COUNT_NAME,
  itemLookup: itemSource(),
  uomLookup: uomSource(),
  lotLookup: lotSource(),
  hasReferenceError: false,
  onRetryReferences: vi.fn(),
  ...overrides,
});

const renderPane = (overrides: Partial<HistoryDetailPaneProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<HistoryDetailPane {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

const bodyRows = (): HTMLElement[] =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1);

const cellsOf = (rowIndex: number): string[] =>
  within(bodyRows()[rowIndex] ?? document.createElement('tr'))
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '');

const summaryValue = (label: string): string => {
  const term = within(screen.getByRole('group', { name: t.historySummary.label })).getByText(label);

  return term.parentElement?.querySelector('dd')?.textContent ?? '';
};

describe('buildHistoryLineColumns — 세 열과 폭 예산', () => {
  const columns = buildHistoryLineColumns({
    itemLookup: itemSource(),
    uomLookup: uomSource(),
    lotLookup: lotSource(),
  });

  /**
   * ⭐ 조심 ③ · C44의 자리. **장부 · 실물 · 차이 세 열을 그대로 둔다** — 차이 하나만 남기면
   * 그 수가 「조정 뒤의 수량」으로 읽히는 길이 열린다.
   */
  it('열이 여섯이고 장부·실물·차이가 그 차례로 있다', () => {
    expect(columns.map((column) => column.key)).toEqual([
      'lineNo',
      'item',
      'lot',
      'bookQty',
      'actualQty',
      'adjustmentQty',
    ]);
  });

  /** **위치 열이 없다** — 창고를 알 통로가 없어 이름을 풀 수 없고, 번호는 그리지 않는다. */
  it('위치 열을 두지 않는다', () => {
    expect(columns.map((column) => column.key)).not.toContain('location');
  });

  /** 라인 사유 열도 없다(D-7 · 미결 #87) — 이 화면은 라인 사유를 보내지 않는다. */
  it('라인 사유 열을 두지 않는다', () => {
    expect(columns.map((column) => column.key)).not.toContain('reasonCode');
  });

  it('흡수 열이 하나이고 지정 폭 합이 표 하한 안에 든다', () => {
    const fixed = columns.reduce(
      (sum, column) => sum + Number.parseInt(column.width ?? '0px', 10),
      0,
    );

    expect(columns.filter((column) => column.width === undefined)).toHaveLength(1);
    expect(fixed).toBe(536);
    expect(HISTORY_LINE_TABLE_MIN_WIDTH_PX - fixed).toBeGreaterThanOrEqual(
      HISTORY_LINE_ABSORBING_COLUMN_BUDGET_PX,
    );
  });
});

describe('describeErp — 세 갈래', () => {
  it('값이 오지 않는 갈래를 거짓으로 접지 않는다', () => {
    expect(describeErp(true)).toBe(t.result.erpQueued);
    expect(describeErp(false)).toBe(t.result.erpNotQueued);
    expect(describeErp(null)).toBe(t.result.erpUnknown);
  });
});

describe('HistoryDetailPane — 제목줄', () => {
  it('전표번호와 코드를 서버가 준 글자 그대로 낸다', () => {
    renderPane();

    expect(summaryValue(t.historySummary.inventoryAdjustmentNo)).toBe('SAMPLE-IA-9301');
    expect(summaryValue(t.historySummary.reason)).toBe('SAMPLE_AR_A');
    expect(summaryValue(t.historySummary.status)).toBe('SAMPLE_IA_STATUS_A');
  });

  it('실사 참조를 화면이 풀어 준 이름으로 낸다', () => {
    renderPane();

    expect(summaryValue(t.historySummary.countRef)).toBe(COUNT_NAME);
  });

  /**
   * **전기 여부의 판정 근거가 전기 시각의 유무 하나다**(C35). 양성 앵커(시각이 있는 갈래)를
   * 먼저 재고 그 뒤에 없는 갈래를 잰다.
   */
  it('전기 시각이 있으면 그 시각을, 없으면 「전기 전」을 낸다', () => {
    const { rerender } = renderPane();

    expect(summaryValue(t.historySummary.adjustedAt)).toBe('2026-08-18 14:05');

    rerender(
      <HistoryDetailPane
        {...baseProps({ detail: toAdjustmentDetailView(adjustmentDetailBody({ lineCount: 2 })) })}
      />,
    );

    expect(summaryValue(t.historySummary.adjustedAt)).toBe(t.historyTable.notPosted);
  });

  it('ERP 적재를 세 갈래로 가른다 — 값이 없는 것을 거짓으로 접지 않는다', () => {
    renderPane({
      detail: toAdjustmentDetailView(adjustmentDetailBody({ erpMessageQueued: null })),
    });

    expect(summaryValue(t.historySummary.erp)).toBe(t.result.erpUnknown);
  });

  it('줄 수가 표의 줄 수와 같다 — 두 자리에서 각자 세지 않는다', () => {
    renderPane();

    expect(summaryValue(t.historySummary.lines)).toBe(t.historySummary.lineCount(2));
    expect(bodyRows()).toHaveLength(2);
  });
});

describe('HistoryDetailPane — 라인 표', () => {
  it('줄번호와 이름을 낸다 — 서버가 부여한 줄번호를 그대로 쓴다', () => {
    renderPane();

    expect(cellsOf(0)[0]).toBe('1');
    expect(cellsOf(1)[0]).toBe('2');
    expect(cellsOf(0)[1]).toBe(ITEM_LABEL);
    expect(cellsOf(0)[2]).toBe(LOT_LABEL);
  });

  /**
   * ⭐ C44의 자리. **장부와 실물은 「—」다** — 계약이 그 값을 주지 않고, 지금 잔액으로 채우면
   * 조정 시점의 값이 아니다. 양성 앵커(차이가 실제로 서 있다)를 먼저 재고 그 뒤에 잰다.
   */
  it('차이는 서버 값 그대로이고 장부·실물은 「—」다', () => {
    renderPane();

    expect(cellsOf(0)[5]).toBe(`-20 ${UOM_LABEL}`);
    expect(cellsOf(0)[3]).toBe(t.values.empty);
    expect(cellsOf(0)[4]).toBe(t.values.empty);
  });

  /** ⭐ 조심 ②의 자리 — 줄이는 조정이 정상 경로라 부호를 다듬지 않는다. */
  it('음수 차이의 부호를 다듬지 않는다', () => {
    renderPane();

    expect(cellsOf(0)[5]).toContain('-20');
  });

  it('두 열이 왜 비는지와 위치 열이 왜 없는지를 함께 적는다', () => {
    renderPane();

    expect(screen.getByText(t.historyLineTable.qtyNote)).toBeInTheDocument();
    expect(screen.getByText(t.historyLineTable.locationNote)).toBeInTheDocument();
  });

  it('LOT이 없는 줄은 「—」이고 못 푼 줄과 갈린다', () => {
    renderPane({ lotLookup: lotSource({ entries: [] }) });

    expect(cellsOf(0)[2]).toBe(t.values.unknown);
  });

  /**
   * ⛔ C42의 자리. **승인·반려 조작이 없다** — 이 구획에는 되찾아 읽는 것 말고 아무 조작도
   * 없다. 양성 앵커(표가 실제로 섰다)를 먼저 재고 그 뒤에 잰다.
   */
  it('조작 버튼이 하나도 없다 — 결재는 결재함이 소유한다', () => {
    renderPane();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('HistoryDetailPane — 이름 풀이 실패', () => {
  /** **말하는 셋과 되살리는 셋이 같다** — 이 구획에 없는 위치를 문구가 가리키지 않는다. */
  it('안내가 이 구획에 있는 셋만 말한다', () => {
    renderPane({ hasReferenceError: true });

    expect(screen.getByText(t.reasons.historyReferencesFailed)).toBeInTheDocument();
    expect(t.reasons.historyReferencesFailed).not.toContain('위치');
    expect(t.reasons.lineReferencesFailed).toContain('위치');
  });

  it('실패 사유와 복구 경로가 그 자리에 함께 선다', async () => {
    const { onRetryReferences, user } = renderPane({ hasReferenceError: true });

    expect(screen.getByText(t.reasons.historyReferencesFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
  });

  it('실패하지 않았으면 복구 경로를 내지 않는다', () => {
    renderPane();

    expect(screen.queryByText(t.reasons.historyReferencesFailed)).not.toBeInTheDocument();
  });
});
