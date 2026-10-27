import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  StatusChips,
  TypeTabs,
  activeStatusChip,
  statusChipChoice,
  toTypeTabOptions,
} from './type-tabs';

const t = messages.qualityApproval;
const OPTIONS = [
  { value: 'CONCESSION', label: t.typeLabels.CONCESSION },
  { value: 'OQC_SKIP', label: t.typeLabels.OQC_SKIP },
];

describe('TypeTabs', () => {
  it('「전체」와 유형 탭을 세우고 적용된 값만 고른 상태로 보인다', () => {
    render(<TypeTabs options={OPTIONS} value="OQC_SKIP" onChange={vi.fn()} />);
    const list = screen.getByRole('tablist', { name: t.fields.approvalTypeCode });

    expect(list).toHaveTextContent(`${t.all}${t.typeLabels.CONCESSION}${t.typeLabels.OQC_SKIP}`);
    expect(screen.getByRole('tab', { name: t.typeLabels.OQC_SKIP })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: t.all })).toHaveAttribute('aria-selected', 'false');
  });

  it('탭을 누르면 그 유형 코드를, 「전체」는 빈 값을 알린다', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    /* 제어 탭이라 이미 고른 탭을 다시 눌러도 알리지 않는다 — 고르지 않은 두 탭을 누른다. */
    render(<TypeTabs options={OPTIONS} value="OQC_SKIP" onChange={onChange} />);

    await user.click(screen.getByRole('tab', { name: t.typeLabels.CONCESSION }));
    await user.click(screen.getByRole('tab', { name: t.all }));

    expect(onChange.mock.calls).toEqual([['CONCESSION'], ['']]);
  });

  it('IQC 생략 탭을 OQC 생략 앞에 끼운다(#144) — OQC 생략이 없으면 끝에 둔다', () => {
    expect(toTypeTabOptions(['CONCESSION', 'OQC_SKIP']).map((option) => option.label)).toEqual([
      t.typeLabels.CONCESSION,
      t.typeLabels.IQC_SKIP,
      t.typeLabels.OQC_SKIP,
    ]);
    expect(toTypeTabOptions(['CONCESSION']).map((option) => option.value)).toEqual([
      'CONCESSION',
      'IQC_SKIP',
    ]);
  });

  it('고를 유형이 없으면 탭을 세우지 않는다', () => {
    const { container } = render(<TypeTabs options={[]} value="" onChange={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('StatusChips(#186)', () => {
  const pending = t.statusLabels.PENDING;
  const approved = t.statusLabels.APPROVED;

  it('세 상태를 건수와 함께 세우고, 켜진 칩은 누르면 끈다', async () => {
    const onChange = vi.fn();
    render(
      <StatusChips
        active="PENDING"
        counts={{ PENDING: 3, APPROVED: 0, REJECTED: 1 }}
        onChange={onChange}
      />,
    );
    const chip = screen.getByRole('button', { name: t.statusChips.filterOff(pending) });

    expect(chip).toHaveTextContent(t.statusChips.count(pending, 3));
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: t.statusChips.filterOn(approved) }),
    ).toHaveTextContent(t.statusChips.count(approved, 0));
    expect(
      screen.getByRole('button', { name: t.statusChips.filterOn(t.statusLabels.REJECTED) }),
    ).toHaveTextContent(t.statusChips.count(t.statusLabels.REJECTED, 1));

    await userEvent.setup().click(chip);

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('꺼진 칩을 누르면 그 상태를 켠다 — 건수를 아직 모르면 이름만 보인다', async () => {
    const onChange = vi.fn();
    render(<StatusChips active="" counts={{}} onChange={onChange} />);
    const chip = screen.getByRole('button', { name: t.statusChips.filterOn(approved) });

    expect(chip).toHaveTextContent(new RegExp(`^${approved}$`));
    expect(chip).toHaveAttribute('aria-pressed', 'false');

    await userEvent.setup().click(chip);

    expect(onChange).toHaveBeenCalledWith('APPROVED');
  });

  it('결재 대기는 「대기만 보기」, 승인·반려는 상태 조건이다 — 한 번에 하나만 켜진다', () => {
    expect(activeStatusChip(true, '')).toBe('PENDING');
    expect(activeStatusChip(false, 'APPROVED')).toBe('APPROVED');
    expect(activeStatusChip(false, '')).toBe('');
    expect(statusChipChoice('PENDING')).toEqual({ pendingOnly: true, statusCode: '' });
    expect(statusChipChoice('REJECTED')).toEqual({ pendingOnly: false, statusCode: 'REJECTED' });
    expect(statusChipChoice('')).toEqual({ pendingOnly: false, statusCode: '' });
  });

  it('유형 탭이 없어도 탭 줄 오른쪽 칩은 선다', () => {
    render(
      <TypeTabs
        options={[]}
        value=""
        onChange={vi.fn()}
        trailing={<StatusChips active="PENDING" counts={{}} onChange={vi.fn()} />}
      />,
    );

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: t.statusChips.filterOff(pending) }),
    ).toBeInTheDocument();
  });
});
