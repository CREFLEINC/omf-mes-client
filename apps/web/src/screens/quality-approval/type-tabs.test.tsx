import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PendingChip, TypeTabs, toTypeTabOptions } from './type-tabs';

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

describe('PendingChip(#186)', () => {
  it('켜져 있으면 「결재 대기 N」이 눌린 상태이고, 누르면 끈다', async () => {
    const onChange = vi.fn();
    render(<PendingChip selected count={3} onChange={onChange} />);
    const chip = screen.getByRole('button', { name: t.pendingChip.filterOff });

    expect(chip).toHaveTextContent(t.pendingChip.count(3));
    expect(chip).toHaveAttribute('aria-pressed', 'true');

    await userEvent.setup().click(chip);

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('꺼져 있으면 누를 때 켠다 — 건수를 아직 모르면 이름만 보인다', async () => {
    const onChange = vi.fn();
    render(<PendingChip selected={false} count={undefined} onChange={onChange} />);
    const chip = screen.getByRole('button', { name: t.fields.pendingOnly });

    expect(chip).toHaveTextContent(t.pendingChip.label);
    expect(chip).toHaveAttribute('aria-pressed', 'false');

    await userEvent.setup().click(chip);

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('유형 탭이 없어도 탭 줄 오른쪽 칩은 선다', () => {
    render(
      <TypeTabs
        options={[]}
        value=""
        onChange={vi.fn()}
        trailing={<PendingChip selected count={0} onChange={vi.fn()} />}
      />,
    );

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.pendingChip.filterOff })).toBeInTheDocument();
  });
});
