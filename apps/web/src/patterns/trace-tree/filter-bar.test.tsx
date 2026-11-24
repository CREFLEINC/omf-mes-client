import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@omf-mes/i18n';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { TraceFilterBar, type TraceFilterBarProps } from './filter-bar';
import { defaultPeriod } from './period';

const t = messages.traceTree;

const source = {
  title: '공급사 선택',
  key: ['test', 'partner'],
  columns: { code: '공급사 코드', name: '공급사명' },
  search: () => Promise.resolve({ items: [], total: 0 }),
};

const setup = (props: Partial<TraceFilterBarProps> = {}) => {
  const onScan = vi.fn();
  const onSearch = vi.fn();
  const onReset = vi.fn();
  renderWithProviders(
    <TraceFilterBar
      direction="FORWARD"
      scanning={false}
      onScan={onScan}
      condition={null}
      defaultPeriod={defaultPeriod('2026-11-24')}
      partnerSource={source}
      partnerLabel=""
      onSearch={onSearch}
      canReset={false}
      onReset={onReset}
      {...props}
    />,
  );
  return { onScan, onSearch, onReset };
};

describe('조건 줄(FR-004·FR-013·FR-024)', () => {
  it('Q3 번호 칸 Enter 로 번호를 한 번 푼다(앞뒤 공백 뺌)', async () => {
    const { onScan } = setup();
    await userEvent.type(screen.getByLabelText(t.material.scanLabel), '  A-0001  {Enter}');
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('A-0001');
  });

  it('번호 칸이 비면 풀지 않는다', async () => {
    const { onScan } = setup();
    await userEvent.type(screen.getByLabelText(t.material.scanLabel), '   {Enter}');
    expect(onScan).not.toHaveBeenCalled();
  });

  it('제품 기준은 제품 LOT · 출하번호 · 시리얼 번호 칸과 고객 + 출하일이다', () => {
    setup({ direction: 'BACKWARD' });
    expect(screen.getByLabelText(t.product.scanLabel)).toHaveAttribute(
      'placeholder',
      t.product.scanPlaceholder,
    );
    expect(screen.getByText(t.product.period)).toBeInTheDocument();
  });

  it('US3-5 기간 처음 값은 최근 30일이고, 상대 없이 [찾기]는 막고 알린다', async () => {
    const { onSearch } = setup();
    expect(screen.getByLabelText(new RegExp(t.material.period))).toHaveTextContent(
      /2026-10-26.*2026-11-24/,
    );
    await userEvent.click(screen.getByRole('button', { name: t.search }));
    expect(onSearch).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(t.material.partnerRequired);
  });

  it('US3-5 걸린 조건(상대 + 기간)으로 [찾기]하면 그 조건으로 찾는다', async () => {
    const { onSearch } = setup({
      condition: { partnerId: 7, from: '2026-11-01', to: '2026-11-20' },
      partnerLabel: '공급사 S (SUP-S)',
    });
    await userEvent.click(screen.getByRole('button', { name: t.search }));
    expect(onSearch).toHaveBeenCalledWith({ partnerId: 7, from: '2026-11-01', to: '2026-11-20' });
  });

  it('366일을 넘는 기간은 찾지 않고 사유를 보인다', async () => {
    const { onSearch } = setup({
      condition: { partnerId: 7, from: '2025-01-01', to: '2026-11-20' },
    });
    await userEvent.click(screen.getByRole('button', { name: t.search }));
    expect(onSearch).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(t.period.tooLong);
  });

  it('Q8 [최근 목록으로]는 최근 상태에서 막히고, 바뀌면 누를 수 있다', async () => {
    const { onReset } = setup({ canReset: true });
    await userEvent.click(screen.getByRole('button', { name: t.backToRecent }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
