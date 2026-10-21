import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { BulkResult } from './bulk-result';

const t = messages.screenPatterns.bulkResult;

describe('BulkResult(C-18)', () => {
  it('건수 요약, 건별 사유와 고칠 곳, 결과별 좁히기를 준다', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    renderWithProviders(
      <BulkResult
        title="일괄 배포 결과"
        filter={null}
        onFilterChange={onFilterChange}
        onClose={vi.fn()}
        outcomes={[
          { id: '1', label: 'PO-1', status: 'processed', reason: null },
          { id: '2', label: 'PO-2', status: 'skipped', reason: '4M 배정 미완', fixHref: '/x/PO-2' },
          { id: '3', label: 'PO-3', status: 'failed', reason: '실패 사유', fixHref: '/x/PO-3' },
        ]}
      />,
    );
    expect(screen.getByText(`일괄 배포 결과: ${t.summary(1, 0, 1, 1)}`)).toBeVisible();
    expect(screen.getByText('4M 배정 미완')).toBeVisible();
    expect(screen.getByRole('link', { name: t.fixFor('PO-2') })).toHaveAttribute('href', '/x/PO-2');
    await user.click(screen.getByRole('button', { name: t.onlyFailed }));
    expect(onFilterChange).toHaveBeenCalledWith('failed');
  });
});
