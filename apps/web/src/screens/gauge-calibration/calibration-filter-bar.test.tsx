import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CalibrationFilterBar, type CalibrationFilterBarProps } from './calibration-filter-bar';
import { EMPTY_FILTERS } from './filters';

const t = messages.gaugeCalibration;

const renderBar = (overrides: Partial<CalibrationFilterBarProps> = {}) =>
  render(
    <CalibrationFilterBar
      appliedFilters={EMPTY_FILTERS}
      equipmentOptions={[]}
      onSearch={vi.fn()}
      onReset={vi.fn()}
      {...overrides}
    />,
  );

describe('CalibrationFilterBar — 초기화(C-6)', () => {
  it('처음 값 그대로면 초기화를 세우지 않는다', () => {
    renderBar();

    expect(screen.getByRole('button', { name: t.filters.search })).toBeEnabled();
    expect(screen.queryByRole('button', { name: t.filters.reset })).toBeNull();
  });

  it('조회에 쓰인 조건이 처음 값과 다르면 초기화가 보인다', () => {
    renderBar({ appliedFilters: { ...EMPTY_FILTERS, from: '2026-11-01', to: '2026-11-20' } });

    expect(screen.getByRole('button', { name: t.filters.reset })).toBeVisible();
  });
});
