import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DetailDrawer } from './detail-drawer';

describe('DetailDrawer(T-W-A)', () => {
  it('머리의 대상 번호가 드로어 이름이 되고 요약 한 줄과 본문을 보인다', () => {
    render(
      <DetailDrawer
        title="WO-20261021-001"
        summary="생산 마감, 2026-10-21 14:10"
        onClose={() => {}}
      >
        <p>본문</p>
      </DetailDrawer>,
    );

    const drawer = screen.getByRole('dialog', { name: 'WO-20261021-001' });
    expect(within(drawer).getByText('생산 마감, 2026-10-21 14:10')).toBeInTheDocument();
    expect(within(drawer).getByText('본문')).toBeInTheDocument();
  });

  it('닫기는 onClose 로 알린다 — 선택 해제는 부르는 쪽이 한다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <DetailDrawer title="WO-1" onClose={onClose}>
        <p>본문</p>
      </DetailDrawer>,
    );

    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /닫기|close/i }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
