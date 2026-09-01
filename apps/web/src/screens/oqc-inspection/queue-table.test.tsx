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

  /**
   * ⭐ **대상번호가 줄의 «둘째 행»에 선다.** 스펙 §3 이 한 줄을 두 행으로 그린 자리다.
   *
   * ⚠ **부분 일치로는 못 잡는다** — 붙어 있어도 통과한다. jsdom 에는 배치가 없어 「두 행으로
   * 보이는가」를 잴 수 없으므로, 그 갈라짐을 만드는 구조를 본다(회차 이력과 같은 규율).
   */
  it('대상번호를 줄의 둘째 행에 세운다 — 붙으면 번호 둘이 한 값처럼 읽힌다', () => {
    renderTable();

    const cell = screen
      .getByRole('button', { name: t.openRow(waitingRequest.inspectionRequestNo) })
      .closest('.stacked-cell');

    expect(cell).not.toBeNull();

    const lines = within(cell as HTMLElement);

    expect(lines.getByText(waitingRequest.inspectionRequestNo)).toBeInTheDocument();
    expect(lines.getByText(t.targetId(waitingRequest.targetId))).toBeInTheDocument();
  });

  it('결과가 없으면 부르는 쪽이 준 빈 자리를 그린다 — 실패와 빈 결과는 여기서 가르지 않는다', () => {
    renderWithProviders(
      <QueueTable rows={[]} selectedId={null} onSelect={vi.fn()} empty={<p>{t.empty}</p>} />,
    );

    expect(screen.getByText(t.empty)).toBeInTheDocument();
  });
});
