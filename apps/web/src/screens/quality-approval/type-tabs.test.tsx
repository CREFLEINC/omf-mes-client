import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StatusChips, TypeTabs, activeStatusChip, statusChipChoice } from './type-tabs';

const t = messages.qualityApproval;
const OPTIONS = [
  { value: 'CONCESSION', label: t.typeLabels.CONCESSION },
  /* 두 번째 탭은 합성 유형이다 — 품질 승인 유형은 특채 하나뿐이다(#353). */
  { value: 'SAMPLE_TYPE', label: '합성 유형' },
];

describe('TypeTabs', () => {
  it('「전체」와 유형 탭을 세우고 적용된 값만 고른 상태로 보인다', () => {
    render(<TypeTabs options={OPTIONS} value="SAMPLE_TYPE" onChange={vi.fn()} />);
    const list = screen.getByRole('tablist', { name: t.fields.approvalTypeCode });

    expect(list).toHaveTextContent(`${t.all}${t.typeLabels.CONCESSION}합성 유형`);
    expect(screen.getByRole('tab', { name: '합성 유형' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: t.all })).toHaveAttribute('aria-selected', 'false');
  });

  it('탭을 누르면 그 유형 코드를, 「전체」는 빈 값을 알린다', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    /* 제어 탭이라 이미 고른 탭을 다시 눌러도 알리지 않는다 — 고르지 않은 두 탭을 누른다. */
    render(<TypeTabs options={OPTIONS} value="SAMPLE_TYPE" onChange={onChange} />);

    await user.click(screen.getByRole('tab', { name: t.typeLabels.CONCESSION }));
    await user.click(screen.getByRole('tab', { name: t.all }));

    expect(onChange.mock.calls).toEqual([['CONCESSION'], ['']]);
  });

  it('고를 유형이 없으면 탭을 세우지 않는다', () => {
    const { container } = render(<TypeTabs options={[]} value="" onChange={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('StatusChips(#186)', () => {
  const pending = t.statusLabels.PENDING;
  const approved = t.statusLabels.APPROVED;

  it('건수가 있는 상태를 건수와 함께 세우고(0 건은 세우지 않는다), 켜진 칩은 누르면 끈다', async () => {
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
    expect(screen.queryByRole('button', { name: t.statusChips.filterOn(approved) })).toBeNull();
    expect(
      screen.getByRole('button', { name: t.statusChips.filterOn(t.statusLabels.REJECTED) }),
    ).toHaveTextContent(t.statusChips.count(t.statusLabels.REJECTED, 1));

    await userEvent.setup().click(chip);

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('켜진 칩은 0 건이어도 남아 풀 수 있다', () => {
    render(
      <StatusChips active="APPROVED" counts={{ PENDING: 3, APPROVED: 0 }} onChange={vi.fn()} />,
    );

    expect(
      screen.getByRole('button', { name: t.statusChips.filterOff(approved) }),
    ).toHaveTextContent(t.statusChips.count(approved, 0));
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
