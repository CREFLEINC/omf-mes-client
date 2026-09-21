import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { queueItems } from './fixtures';
import { QueueTable } from './queue-table';
import type { NameLookup } from './reference-lookup';
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

const lotNumbers: NameLookup = {
  labelOf: (id) => (id === null || id === undefined ? '—' : LOT_NO(id)),
};

const renderTable = (overrides: Partial<Parameters<typeof QueueTable>[0]> = {}) => {
  const onSelect = vi.fn();

  renderWithProviders(
    <QueueTable
      rows={rows}
      lotNumbers={lotNumbers}
      selectedId={null}
      onSelect={onSelect}
      empty={<p>{t.empty}</p>}
      {...overrides}
    />,
  );

  return onSelect;
};

const openButton = (inspectionRequestNo: string) =>
  screen.getByRole('button', { name: t.openRow(inspectionRequestNo) });

describe('QueueTable', () => {
  it('의뢰마다 한 줄을 그린다', () => {
    renderTable();

    expect(screen.getByText('IR-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('IR-2026-0002')).toBeInTheDocument();
    expect(screen.getByText('IR-2026-0003')).toBeInTheDocument();
  });

  it('의뢰번호를 누르면 그 의뢰를 고른다 — 코드 칸이 곧 「이 줄을 연다」다', async () => {
    const onSelect = renderTable();

    await userEvent.click(openButton('IR-2026-0002'));

    expect(onSelect).toHaveBeenCalledWith(1002);
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
    expect(within(row as HTMLElement).getByText(t.emptyValue)).toBeInTheDocument();
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
      expect(within(table).getAllByText(LOT_NO(lotId)).length).toBeGreaterThan(0);
      /* 짝 방향 — 번호가 글자로도 남지 않는다. */
      expect(table.textContent ?? '').not.toContain(String(lotId));
    }
  });

  /** 없는 것이 정상이다(작업지시 대상 검사 등) — 풀이가 그 갈래의 글자를 정한다. */
  it('LOT 이 없는 줄은 풀이가 정한 빈 값 표기를 낸다', () => {
    renderTable({ rows: rows.map((row) => ({ ...row, lotId: null })) });

    const table = screen.getByRole('table');

    expect(within(table).getAllByText('—').length).toBe(rows.length);
  });
});
