import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { appearanceSpec, dimensionSpec } from './fixtures';
import { toMeasurementRows } from './measurement-rows';
import { MeasurementSheet } from './measurement-sheet';

const t = messages.iqcInspection.measurements;
const NAMES = { NUMERIC: '수치', BOOLEAN: '선택형', TEXT: '텍스트' };
const edit = { draft: {}, onChange: vi.fn(), judgmentOptions: [], disabled: false };
const flagSpec = {
  ...appearanceSpec,
  inspectionItemSpecId: 7009,
  inspectionItemName: '포장',
  dataTypeCode: 'BOOLEAN',
};

const render = (specs: Parameters<typeof toMeasurementRows>[0]) =>
  renderWithProviders(
    <MeasurementSheet rows={toMeasurementRows(specs, [])} dataTypeNames={NAMES} edit={edit} />,
  );

describe('MeasurementSheet', () => {
  it('치수 측정 · 기타 검사 항목 · 텍스트를 표로 나누고, 규격 열은 치수 측정 표에만 둔다', () => {
    render([appearanceSpec, flagSpec, dimensionSpec]);

    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(3);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      '치수 측정',
      '기타 검사 항목',
      '텍스트',
    ]);
    const [numeric, flag] = tables as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(numeric).getByText(t.columns.spec)).toBeInTheDocument();
    expect(within(numeric).getByText('n3')).toBeInTheDocument();
    expect(within(flag).queryByText(t.columns.spec)).not.toBeInTheDocument();
    expect(within(flag).queryByText('n2')).not.toBeInTheDocument();
  });

  it('표마다 입력한 항목 수를 보이고 항목 번호는 1부터 센다', () => {
    render([appearanceSpec, { ...appearanceSpec, inspectionItemSpecId: 7010, sequenceNo: 30 }]);

    expect(screen.getByText('0/2 항목')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: new RegExp(t.columns.no) }),
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '2' })).toBeInTheDocument();
  });

  it('폭 조절 · 열 순서 손잡이를 두지 않는다', () => {
    const { container } = render([dimensionSpec]);

    expect(container.querySelector('.col-resizer')).toBeNull();
    expect(container.querySelector('.col-grip')).toBeNull();
  });

  it('없는 유형의 표는 그리지 않는다', () => {
    render([dimensionSpec]);

    expect(screen.getAllByRole('table')).toHaveLength(1);
  });

  it('공차가 위아래로 다르면 기준 +a/-b 로 보인다', () => {
    render([{ ...dimensionSpec, uomId: undefined, lowerLimit: 9.8, upperLimit: 10.1 }]);

    expect(screen.getAllByText('10 +0.1/-0.2').length).toBeGreaterThan(0);
    expect(screen.getByText('9.8 ~ 10.1')).toBeInTheDocument();
  });

  it('공차가 같으면 기준 ± 공차로 보인다', () => {
    render([{ ...dimensionSpec, uomId: undefined }]);

    expect(screen.getByText(t.tolerance(10, 0.1))).toBeInTheDocument();
  });
});
