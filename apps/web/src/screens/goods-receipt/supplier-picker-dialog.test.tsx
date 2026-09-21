import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupplierPickerDialog } from './supplier-picker-dialog';

const t = messages.goodsReceipt.supplierPicker;
const search = vi.hoisted(() => vi.fn());

vi.mock('./lookups', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lookups')>()),
  useSupplierSearch: search,
}));

const row = (partnerId: number, isActive = true) => ({
  partnerId,
  partnerCode: `SUP-${String(partnerId)}`,
  partnerName: `합성 공급사 ${String(partnerId)}`,
  isActive,
});

beforeEach(() => {
  search.mockReset();
  search.mockReturnValue({
    data: { rows: [row(1), row(2, false)], total: 25 },
    isPending: false,
    isError: false,
  });
});

describe('SupplierPickerDialog', () => {
  it('opens on the full list and searches only with 찾기 or Enter', async () => {
    const user = userEvent.setup();
    render(<SupplierPickerDialog onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(search).toHaveBeenLastCalledWith('', 1);
    await user.type(screen.getByLabelText(t.keywordLabel), ' SUP-2 ');
    expect(search).toHaveBeenLastCalledWith('', 1);
    await user.click(screen.getByRole('button', { name: t.search }));
    expect(search).toHaveBeenLastCalledWith('SUP-2', 1);
    await user.type(screen.getByLabelText(t.keywordLabel), '9{Enter}');
    expect(search).toHaveBeenLastCalledWith('SUP-2 9', 1);
  });

  it('marks inactive suppliers and pages by 20', async () => {
    const user = userEvent.setup();
    render(<SupplierPickerDialog onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByText(`합성 공급사 2 · ${t.inactive}`)).toBeInTheDocument();
    expect(screen.getByText(t.page.range(1, 20, 25))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.page.previous })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: t.page.next }));
    expect(search).toHaveBeenLastCalledWith('', 2);
  });

  it('picks exactly one supplier and confirms it, with no footer hint text', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<SupplierPickerDialog onClose={vi.fn()} onConfirm={onConfirm} />);
    const pick = screen.getByRole('button', { name: t.pick });

    expect(pick).toBeDisabled();
    expect(screen.queryByText(/누를 수 있습니다/)).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'SUP-1' }));
    await user.click(screen.getByRole('checkbox', { name: 'SUP-2' }));
    expect(screen.getByRole('checkbox', { name: 'SUP-1' })).not.toBeChecked();
    await user.click(pick);
    expect(onConfirm).toHaveBeenCalledWith(row(2, false));
  });

  it('tells a failed search apart from an empty result', () => {
    search.mockReturnValue({ data: undefined, isPending: false, isError: true });
    const { unmount } = render(<SupplierPickerDialog onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText(t.searchFailed)).toBeInTheDocument();
    expect(screen.queryByText(t.noResult)).toBeNull();
    unmount();

    search.mockReturnValue({ data: { rows: [], total: 0 }, isPending: false, isError: false });
    render(<SupplierPickerDialog onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText(t.noResult)).toBeInTheDocument();
  });
});
