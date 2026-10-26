import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TypeTabs, toTypeTabOptions } from './type-tabs';

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
