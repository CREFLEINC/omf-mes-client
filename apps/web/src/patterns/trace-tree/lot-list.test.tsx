import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@omf-mes/i18n';
import { describe, expect, it, vi } from 'vitest';

import { TraceLotList, type TraceLotListProps } from './lot-list';
import type { ListEntry } from './lot-list-state';
import type { TraceLotRow } from './types';

const t = messages.traceTree;
const thisYear = new Date().getFullYear();

const row = (lotId: number, overrides: Partial<TraceLotRow> = {}): TraceLotRow => ({
  lot: {
    lotId,
    lotNo: `ITEM-A|100|261120|SUP-S|${String(lotId).padStart(4, '0')}`,
    lotTypeCode: 'MATERIAL',
    statusCode: 'NORMAL',
    lifecycleStatusCode: 'ACTIVE',
  },
  item: { itemId: 1, code: 'ITEM-A', name: '품목 A' },
  qty: 100,
  uomCode: 'EA',
  partner: { partnerId: 7, code: 'SUP-S', name: '공급사 S' },
  inboundLotNo: 'IL-0001',
  sortDate: `${String(thisYear)}-11-20T02:12:00Z`,
  sortDateKind: 'CONSUMED',
  ...overrides,
});

const entry = (r: TraceLotRow, source: ListEntry['source'] = null): ListEntry => ({
  row: r,
  source,
  serialNo: null,
});

const setup = (props: Partial<TraceLotListProps> = {}) => {
  const onSelect = vi.fn();
  render(
    <TraceLotList
      direction="FORWARD"
      mode="RECENT"
      entries={[entry(row(1)), entry(row(2))]}
      selectedLotId={null}
      onSelect={onSelect}
      status="ready"
      statusName={(code) => (code === 'NORMAL' ? '정상' : code)}
      collapse={{
        collapsed: false,
        onToggle: vi.fn(),
        collapseLabel: '목록 접기',
        expandLabel: '목록 펼치기',
      }}
      {...props}
    />,
  );
  return { onSelect };
};

describe('LOT 목록(FR-025)', () => {
  it('US3-1 자재 최근 목록 — 번호 · 품목 · 공급사 · 최근 투입일 · 상태, 고른 것 없음, 투입 전 LOT 안내', () => {
    setup();
    const table = screen.getByRole('table');
    expect(within(table).getByText(t.list.columns.lotNo)).toBeInTheDocument();
    expect(within(table).getByText(t.material.partnerName)).toBeInTheDocument();
    expect(within(table).getByText(t.material.recentDate)).toBeInTheDocument();
    expect(within(table).getAllByText('공급사 S')).toHaveLength(2);
    expect(within(table).getAllByText('11-20 09:12')).toHaveLength(2);
    expect(table.querySelector('[aria-selected="true"]')).toBeNull();
    expect(screen.getByText(t.material.recentFoot)).toBeInTheDocument();
    expect(screen.getByText(t.list.recentTitle)).toBeInTheDocument();
  });

  it('US3-2 제품 최근 목록 — 기준일 앞에 「출하」·「입고」, 고객, 반제품 안내', () => {
    setup({
      direction: 'BACKWARD',
      entries: [
        entry(
          row(1, {
            sortDateKind: 'SHIPPED',
            partner: { partnerId: 9, code: 'C1', name: '고객 X' },
          }),
        ),
        entry(row(2, { sortDateKind: 'RECEIVED', partner: null })),
      ],
    });
    const table = screen.getByRole('table');
    expect(within(table).getByText(t.product.recentDate)).toBeInTheDocument();
    expect(within(table).getByText(t.list.sortKinds.SHIPPED)).toBeInTheDocument();
    expect(within(table).getByText(t.list.sortKinds.RECEIVED)).toBeInTheDocument();
    expect(within(table).getByText('고객 X')).toBeInTheDocument();
    expect(screen.getByText(t.product.recentFoot)).toBeInTheDocument();
  });

  it('줄 전체를 눌러 고른다(C-1)', async () => {
    const { onSelect } = setup();
    await userEvent.click(screen.getByRole('row', { name: t.list.openRow(row(2).lot.lotNo) }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ row: row(2) }));
  });

  it('US3-3 스캔 줄은 들어온 번호를 보이고 제목에 「n / 200」', () => {
    setup({
      mode: 'SCAN',
      entries: [entry(row(1), { matchedBy: 'INBOUND_LOT_NO', label: 'IL-1' })],
      selectedLotId: 1,
    });
    expect(screen.getByText(`${t.matchedBy.INBOUND_LOT_NO} IL-1`)).toBeInTheDocument();
    expect(screen.getByText(t.list.scanTitle)).toBeInTheDocument();
    expect(screen.getByText(t.list.scanCount(1, 200))).toBeInTheDocument();
    expect(screen.getByRole('table').querySelector('[aria-selected="true"]')).not.toBeNull();
  });

  it('Q7 조건 목록 — 입하일 칸, 「150개 중 100개」, [더 보기]가 다음 쪽을 부른다', async () => {
    const onMore = vi.fn();
    setup({
      mode: 'CONDITION',
      entries: Array.from({ length: 100 }, (_, index) =>
        entry(row(index + 1, { sortDateKind: 'INBOUND' })),
      ),
      condition: {
        partnerLabel: '공급사 S (SUP-S)',
        from: '2026-10-25',
        to: '2026-11-24',
        total: 150,
        hasMore: true,
        loadingMore: false,
        onMore,
      },
    });
    expect(screen.getByText(t.list.ofTotal(100, 150))).toBeInTheDocument();
    expect(
      screen.getByText(t.material.conditionDate, { selector: 'th *, th' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t.list.more(50) }));
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it('조건 결과가 비면 「조건에 맞는 LOT 이 없습니다」', () => {
    setup({
      mode: 'CONDITION',
      entries: [],
      condition: {
        partnerLabel: '공급사 S',
        from: '2026-10-25',
        to: '2026-11-24',
        total: 0,
        hasMore: false,
        loadingMore: false,
        onMore: vi.fn(),
      },
    });
    expect(screen.getByText(t.list.emptyCondition)).toBeInTheDocument();
  });

  it('불러오는 중 · 실패 모습', () => {
    setup({ status: 'loading' });
    expect(screen.getByRole('status', { name: t.list.loading })).toBeInTheDocument();
  });

  it('실패면 넘겨받은 실패 안내를 그린다', () => {
    setup({ status: 'error', error: <p>목록 실패</p> });
    expect(screen.getByText('목록 실패')).toBeInTheDocument();
  });
});
