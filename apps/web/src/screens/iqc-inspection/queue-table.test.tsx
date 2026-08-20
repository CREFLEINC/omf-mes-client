import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { queueItems } from './fixtures';
import { QueueTable } from './queue-table';
import { toInspectionQueueRow } from './types';

const t = messages.iqcInspection.queue;
const rows = queueItems.map(toInspectionQueueRow);

const renderTable = (overrides: Partial<Parameters<typeof QueueTable>[0]> = {}) => {
  const onSelect = vi.fn();

  renderWithProviders(
    <QueueTable
      rows={rows}
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

  it('의뢰 일시를 연·월·일 시·분으로 낸다 — 실행 환경 시간대로 옮기지 않는다', () => {
    renderTable();

    expect(screen.getByText('2026-08-18 09:15')).toBeInTheDocument();
  });

  it('결과가 없으면 받은 빈 상태를 그 자리에 그린다', () => {
    renderTable({ rows: [] });

    expect(screen.getByText(t.empty)).toBeInTheDocument();
  });
});
