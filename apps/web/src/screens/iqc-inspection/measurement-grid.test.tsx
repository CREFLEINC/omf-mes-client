import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import {
  appearanceSpec,
  dimensionSpec,
  expiredMeasurement,
  itemSpecs,
  normalMeasurement,
  optionalSpec,
} from './fixtures';
import { MeasurementGrid } from './measurement-grid';
import { toMeasurementRows } from './measurement-rows';

const t = messages.iqcInspection.measurements;

const renderGrid = (
  specs = itemSpecs,
  measurements: Parameters<typeof toMeasurementRows>[1] = [],
  isLoading = false,
) => {
  renderWithProviders(
    <MeasurementGrid rows={toMeasurementRows(specs, measurements)} isLoading={isLoading} />,
  );
};

describe('MeasurementGrid', () => {
  it('항목마다 요구하는 샘플 수만큼 줄을 그린다', () => {
    renderGrid([dimensionSpec]);

    expect(screen.getAllByText(t.sampleOf(1, 3))).toHaveLength(1);
    expect(screen.getByText(t.sampleOf(3, 3))).toBeInTheDocument();
  });

  it('채번 값이 아니라 목록 내 위치로 1부터 보인다', () => {
    renderGrid(itemSpecs);

    /* 시퀀스는 5·10·20 이지만 화면에는 1·2·3 으로 선다. */
    expect(screen.getByText(`1. ${optionalSpec.inspectionItemName}`)).toBeInTheDocument();
    expect(screen.getByText(`3. ${appearanceSpec.inspectionItemName}`)).toBeInTheDocument();
  });

  it('필수 항목을 표시한다', () => {
    renderGrid([appearanceSpec]);

    expect(screen.getByText(t.requiredMark)).toBeInTheDocument();
  });

  it('필수가 아닌 항목에는 표시하지 않는다', () => {
    renderGrid([optionalSpec]);

    expect(screen.queryByText(t.requiredMark)).not.toBeInTheDocument();
  });

  it('규격을 목표와 상하한으로 보인다', () => {
    renderGrid([dimensionSpec]);

    expect(screen.getAllByText(`${t.target(10)} · ${t.range(9.9, 10.1)}`).length).toBeGreaterThan(
      0,
    );
  });

  it('규격이 없으면 지어내지 않는다', () => {
    renderGrid([appearanceSpec]);

    expect(screen.getAllByText(t.notMeasured).length).toBeGreaterThan(0);
  });

  it('아직 재지 않은 자리는 없음 표시를 낸다 — 감추면 무엇을 더 재야 하는지 알 수 없다', () => {
    renderGrid([dimensionSpec], [expiredMeasurement]);

    /* 3샘플 중 1개만 쟀다 — 남은 둘의 측정치·판정이 없음 표시다. */
    expect(screen.getAllByText(t.notMeasured).length).toBeGreaterThanOrEqual(4);
  });

  it('저장된 측정치를 그 줄에 보인다', () => {
    renderGrid([dimensionSpec], [normalMeasurement]);

    expect(screen.getByText('9.95')).toBeInTheDocument();
  });

  /*
   * ⛔ 서버가 판정한 값을 그대로 보인다(공유계약 L-2). 화면이 계산하지 않고, 차단도 하지
   * 않는다 — 무효화 정책이 미결이다(스펙 §8-6).
   */
  it('교정 만료로 잰 줄을 표시하고 경고를 세운다', () => {
    renderGrid([dimensionSpec], [expiredMeasurement]);

    expect(screen.getByText(t.calibrationExpired)).toBeInTheDocument();
    expect(screen.getByText(t.calibrationWarningTitle)).toBeInTheDocument();
    expect(screen.getByText(t.calibrationWarning)).toBeInTheDocument();
  });

  it('멀쩡한 장비로만 쟀으면 경고하지 않는다', () => {
    renderGrid([dimensionSpec], [normalMeasurement]);

    expect(screen.queryByText(t.calibrationWarningTitle)).not.toBeInTheDocument();
  });

  it('교정 만료를 표시할 뿐 그 줄을 지우지 않는다 — 알리기만 하고 차단하지 않는다', () => {
    renderGrid([dimensionSpec], [expiredMeasurement]);

    const row = screen.getByText(t.calibrationExpired).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('10.05')).toBeInTheDocument();
  });

  it('기준 버전에 항목이 없으면 담당자에게 문의하라고 말한다 — 화면이 고칠 수 있는 것이 아니다', () => {
    renderGrid([]);

    expect(screen.getByText(t.noItems)).toBeInTheDocument();
  });

  it('부르는 중에는 「없다」고 단언하지 않는다', () => {
    renderGrid([], [], true);

    expect(screen.getByText(t.loading)).toBeInTheDocument();
    expect(screen.queryByText(t.noItems)).not.toBeInTheDocument();
  });
});
