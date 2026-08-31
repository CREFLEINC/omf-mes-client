import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { queueItems, waitingRequest } from './fixtures';
import { QueueTable } from './queue-table';
import { toInspectionQueueRow } from './types';

const t = messages.oqcInspection.queue;
const rows = queueItems.map(toInspectionQueueRow);

describe('QueueTable', () => {
  const renderTable = () => {
    const onSelect = vi.fn();

    renderWithProviders(
      <QueueTable rows={rows} selectedId={null} onSelect={onSelect} empty={<p>{t.empty}</p>} />,
    );

    return onSelect;
  };

  it('의뢰번호·품목·검사수량·상태 네 열을 그린다', () => {
    renderTable();

    for (const header of Object.values(t.columns)) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }

    /* 같은 값이 여러 줄에 있을 수 있으므로 그 의뢰의 줄 안에서 찾는다. */
    const row = screen.getByText(waitingRequest.inspectionRequestNo).closest('tr');

    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText(String(waitingRequest.itemId))).toBeInTheDocument();
    expect(
      within(row as HTMLElement).getByText(String(waitingRequest.targetQty)),
    ).toBeInTheDocument();
  });

  it('의뢰번호 칸이 이 줄을 여는 자리다', async () => {
    const onSelect = renderTable();

    await userEvent.click(
      screen.getByRole('button', { name: t.openRow(waitingRequest.inspectionRequestNo) }),
    );

    expect(onSelect).toHaveBeenCalledWith(waitingRequest.inspectionRequestId);
  });

  it('결과가 없으면 부르는 쪽이 준 빈 자리를 그린다 — 실패와 빈 결과는 여기서 가르지 않는다', () => {
    renderWithProviders(
      <QueueTable rows={[]} selectedId={null} onSelect={vi.fn()} empty={<p>{t.empty}</p>} />,
    );

    expect(screen.getByText(t.empty)).toBeInTheDocument();
  });
});
