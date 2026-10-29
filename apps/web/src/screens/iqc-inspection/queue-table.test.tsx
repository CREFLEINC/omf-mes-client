import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { queueItems } from './fixtures';
import { QueueTable } from './queue-table';
import type { ItemNameLookup, NameLookup } from './reference-lookup';
import { toInspectionQueueRow } from './types';

const t = messages.iqcInspection.queue;
const rows = queueItems.map(toInspectionQueueRow);

/**
 * LOT 번호 풀이. **내부 번호가 아니라 라벨에 찍히는 번호**를 낸다(omf-all-around#40).
 *
 * 번호를 라벨에 섞지 않는다 — 「번호가 남지 않는다」를 재는 단언이 제 꼬리를 물면 안 된다.
 */
const LOT_IDS = [
  ...new Set(rows.map((row) => row.lotId).filter((lotId): lotId is number => lotId !== null)),
];

const LOT_LABELS = new Map<number, string>(
  LOT_IDS.map((lotId, index) => [lotId, `SAMPLE-LOT|${'ABCDEFGH'[index] ?? 'Z'}|CCC`]),
);

const LOT_NO = (lotId: number) => LOT_LABELS.get(lotId) ?? 'SAMPLE-LOT|Z|CCC';

/**
 * 품목 풀이. 첫 칸이 **이름과 코드를 두 줄로** 세운다(사용자 지시 2026-09-21).
 * 번호를 라벨에 섞지 않는다 — 「번호가 남지 않는다」를 재는 단언이 제 꼬리를 물면 안 된다.
 */
const ITEM_NAME = '합성 품목 가';
const ITEM_CODE = 'SAMPLE-ITEM-AA';

const itemNames: ItemNameLookup = {
  labelOf: () => `${ITEM_CODE} · ${ITEM_NAME}`,
  partsOf: () => ({ code: ITEM_CODE, name: ITEM_NAME }),
};

/** 못 푼 갈래 — 줄이 하나뿐이라 풀이가 그 자리에 사유를 낸다. */
const unresolvedItems: ItemNameLookup = {
  labelOf: () => messages.common.reference.failed,
  partsOf: () => null,
};

const lotNumbers: NameLookup = {
  labelOf: (id) => (id === null || id === undefined ? '—' : LOT_NO(id)),
};

const suppliers: NameLookup = {
  labelOf: (id) => (id === null || id === undefined ? '—' : '(주)합성공급'),
};

const renderTable = (overrides: Partial<Parameters<typeof QueueTable>[0]> = {}) => {
  const onSelect = vi.fn();

  renderWithProviders(
    <QueueTable
      rows={rows}
      itemNames={itemNames}
      lotNumbers={lotNumbers}
      suppliers={suppliers}
      selectedId={null}
      onSelect={onSelect}
      empty={<p>{t.empty}</p>}
      {...overrides}
    />,
  );

  return onSelect;
};

const openButton = (inspectionRequestNo: string) =>
  screen.getByRole('button', {
    name: t.openRow(`${ITEM_NAME} ${ITEM_CODE}`, inspectionRequestNo),
  });

describe('QueueTable', () => {
  it('의뢰마다 한 줄을 그린다', () => {
    renderTable();

    expect(screen.getAllByRole('row')).toHaveLength(rows.length + 1);
  });

  /*
   * **첫 칸은 품목이다**(사용자 지시 2026-09-21). 의뢰번호는 고르는 데 필요한 값이 아니고
   * 고른 뒤 우측 창이 먼저 보여 준다 — 좁은 칸의 자리를 검사자가 실제로 찾는 값에 내줬다.
   */
  it('첫 칸에 품목 이름과 코드를 두 줄로 세운다', () => {
    renderTable();

    const table = screen.getByRole('table');

    expect(within(table).getAllByText(ITEM_NAME).length).toBe(rows.length);
    expect(within(table).getAllByText(ITEM_CODE).length).toBe(rows.length);
  });

  /** 열에서 뺐다 — 화면에 남으면 그 자리를 도로 차지한다. */
  it('의뢰번호를 열로 보인다(사용자 지시 2026-10-27 · #185)', () => {
    renderTable();

    const table = screen.getByRole('table');

    expect(within(table).getByText('IR-2026-0001')).toBeInTheDocument();
    expect(within(table).getByText(t.columns.inspectionRequestNo)).toBeInTheDocument();
  });

  /**
   * 열에서 뺐다고 **줄을 가릴 수 없게 되면 안 된다** — 같은 품목의 의뢰가 여럿일 수 있어
   * 보이는 글자만으로는 줄이 갈리지 않는다. 접근 이름이 의뢰번호를 함께 담는다.
   */
  it('줄을 여는 단추의 접근 이름이 보이는 품목과 의뢰번호를 함께 담는다', () => {
    renderTable();

    const button = openButton('IR-2026-0002');

    expect(button).toHaveAccessibleName(
      expect.stringContaining('IR-2026-0002') as unknown as string,
    );
    expect(button).toHaveAccessibleName(expect.stringContaining(ITEM_NAME) as unknown as string);
  });

  /** 못 푼 갈래는 줄이 하나뿐이다 — 그 자리에 사유가 선다. */
  it('품목을 못 풀면 그 자리에 사유를 낸다', () => {
    renderTable({ itemNames: unresolvedItems });

    const table = screen.getByRole('table');

    expect(within(table).getAllByText(messages.common.reference.failed).length).toBe(rows.length);
  });

  it('품목 칸을 누르면 그 의뢰를 고른다 — 첫 칸이 곧 「이 줄을 연다」다', async () => {
    const onSelect = renderTable();

    await userEvent.click(openButton('IR-2026-0002'));

    expect(onSelect).toHaveBeenCalledWith(1002);
  });

  /* omf-all-around#133 — 줄의 다른 칸(LOT·상태·일시)을 눌러도 그 줄을 고른다. */
  it('줄의 다른 칸을 눌러도 그 의뢰를 고른다', async () => {
    const onSelect = renderTable();
    const row = openButton('IR-2026-0002').closest('tr') as HTMLElement;

    await userEvent.click(within(row).getAllByRole('cell')[1] as HTMLElement);

    expect(onSelect).toHaveBeenCalledWith(1002);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('고른 줄만 현재로 표시한다', () => {
    renderTable({ selectedId: 1002 });

    expect(openButton('IR-2026-0002')).toHaveAttribute('aria-current', 'true');
    expect(openButton('IR-2026-0001')).not.toHaveAttribute('aria-current');
  });

  it('자재 LOT 이 없으면 빈 칸이 아니라 없음 표시를 낸다 — 못 불러온 것과 구분한다', () => {
    renderTable();

    const row = openButton('IR-2026-0003').closest('tr');
    expect(row).not.toBeNull();
    /* LOT 칸 · 공급사 칸(LOT 으로 푼다) 둘 다 없음 표시다(#197). */
    expect(within(row as HTMLElement).getAllByText(t.emptyValue)).toHaveLength(2);
  });

  it('대기와 진행을 서로 다른 문구로 가른다', () => {
    renderTable();

    const waiting = openButton('IR-2026-0001').closest('tr');
    const inProgress = openButton('IR-2026-0002').closest('tr');

    expect(
      within(waiting as HTMLElement).getByText(messages.iqcInspection.status.requested),
    ).toBeInTheDocument();
    expect(
      within(inProgress as HTMLElement).getByText(messages.iqcInspection.status.inProgress),
    ).toBeInTheDocument();
  });

  it('의뢰 일시를 공장 시각(UTC+7)의 연·월·일 시·분으로 낸다 — 실행 환경 시간대와 무관하다', () => {
    renderTable();

    /* 픽스처 `2026-08-18T09:15:00+09:00` 은 공장 시각 07:15 다(omf-all-around#20). */
    expect(screen.getByText('2026-08-18 07:15')).toBeInTheDocument();
  });

  it('결과가 없으면 받은 빈 상태를 그 자리에 그린다', () => {
    renderTable({ rows: [] });

    expect(screen.getByText(t.empty)).toBeInTheDocument();
  });
});

describe('QueueTable — 자재 LOT 표기', () => {
  /**
   * ⛔ **내부 번호를 화면에 내지 않는다**(`omf-mes#44`). 이 칸은 종전에 `lotId` 를 그대로 찍어
   * 「44」·「45」가 나왔다 — 검사자가 손에 든 라벨과 대조할 수 없었다(omf-all-around#40).
   */
  it('LOT 번호를 보이고 내부 번호는 어디에도 없다', () => {
    renderTable();

    const table = screen.getByRole('table');

    expect(LOT_IDS.length).toBeGreaterThan(0);

    for (const lotId of LOT_IDS) {
      /* 번호는 앞 마디 · 끝 마디 두 조각으로 그려진다(#133) — 칸 전체 글자와 title 로 잰다. */
      const cells = within(table).getAllByTitle(LOT_NO(lotId));
      expect(cells.length).toBeGreaterThan(0);
      expect(cells[0]).toHaveTextContent(LOT_NO(lotId));
      /* 짝 방향 — 번호가 글자로도 남지 않는다. */
      expect(table.textContent ?? '').not.toContain(String(lotId));
    }
  });

  /** 없는 것이 정상이다(작업지시 대상 검사 등) — 풀이가 그 갈래의 글자를 정한다. */
  it('LOT 이 없는 줄은 풀이가 정한 빈 값 표기를 낸다', () => {
    renderTable({ rows: rows.map((row) => ({ ...row, lotId: null })) });

    const table = screen.getByRole('table');

    /* LOT 칸 · 공급사 칸(LOT 으로 푼다) 둘 다(#197). */
    expect(within(table).getAllByText('—').length).toBe(rows.length * 2);
  });

  it('공급사 열이 자재 LOT 의 공급사 이름을 보인다(#197)', () => {
    renderTable();

    expect(screen.getByRole('columnheader', { name: t.columns.supplier })).toBeInTheDocument();
    expect(screen.getAllByText('(주)합성공급').length).toBeGreaterThan(0);
  });
});
