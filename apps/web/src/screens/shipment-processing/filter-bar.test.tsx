import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_SHIPMENT_PROCESSING_FILTERS } from './candidate-screen-model';
import { ShipmentProcessingFilterBar } from './filter-bar';

describe('ShipmentProcessingFilterBar', () => {
  it('출하일 시작이 비어 있으면 조회를 막고 사유를 낸다', () => {
    render(
      <ShipmentProcessingFilterBar
        appliedFilters={EMPTY_SHIPMENT_PROCESSING_FILTERS}
        onSearch={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '조회' })).toBeDisabled();
    expect(screen.getByText('출하일 시작은 필수입니다.')).toBeInTheDocument();
  });

  it('시작일을 채우고 조회를 누르면 값을 그대로 올린다', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();

    render(
      <ShipmentProcessingFilterBar
        appliedFilters={EMPTY_SHIPMENT_PROCESSING_FILTERS}
        onSearch={onSearch}
        onReset={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('출하일 시작'), '2026-08-24');
    await user.click(screen.getByRole('checkbox', { name: '피킹완료만' }));
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onSearch).toHaveBeenCalledWith({
      shipDateFrom: '2026-08-24',
      shipDateTo: '',
      pickingCompleteOnly: false,
    });
  });

  it('종료일이 시작일보다 앞서면 조회를 막는다', async () => {
    const user = userEvent.setup();

    render(
      <ShipmentProcessingFilterBar
        appliedFilters={{ shipDateFrom: '2026-08-24', shipDateTo: '', pickingCompleteOnly: true }}
        onSearch={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('출하일 종료'), '2026-08-01');

    expect(screen.getByRole('button', { name: '조회' })).toBeDisabled();
    expect(screen.getByText('출하일 종료는 시작보다 앞설 수 없습니다.')).toBeInTheDocument();
  });

  it('초기화를 누르면 onReset을 부른다', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();

    render(
      <ShipmentProcessingFilterBar
        appliedFilters={{ shipDateFrom: '2026-08-24', shipDateTo: '', pickingCompleteOnly: true }}
        onSearch={vi.fn()}
        onReset={onReset}
      />,
    );

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(onReset).toHaveBeenCalled();
  });

  it('적용된 필터가 바뀌면 편집 중인 값을 되돌린다', () => {
    const { rerender } = render(
      <ShipmentProcessingFilterBar
        appliedFilters={EMPTY_SHIPMENT_PROCESSING_FILTERS}
        onSearch={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    rerender(
      <ShipmentProcessingFilterBar
        appliedFilters={{
          shipDateFrom: '2026-08-24',
          shipDateTo: '2026-08-31',
          pickingCompleteOnly: false,
        }}
        onSearch={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('출하일 시작')).toHaveValue('2026-08-24');
    expect(screen.getByLabelText('출하일 종료')).toHaveValue('2026-08-31');
    expect(screen.getByRole('checkbox', { name: '피킹완료만' })).not.toBeChecked();
  });
});
