import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { plantsInScope } from '../../patterns/oa-access';
import { MeasurementTable, specLines } from './measurement-table';

const scoped = vi.hoisted(() => ({ value: { status: 'checking' } as unknown, access: 'checking' }));

vi.mock('../../patterns/oa-access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../patterns/oa-access')>()),
  useScopedPlants: () => scoped.value,
  useOaAccess: () => scoped.access,
}));
vi.mock('../iqc-inspection/screen', () => ({ IqcInspectionScreen: () => <p>OA 화면</p> }));
vi.mock('./screen', () => ({
  PartsIqcInspectionScreen: ({ plants }: { plants: { plantCode: string }[] }) => (
    <p>부품 화면 {plants.map((p) => p.plantCode).join(',')}</p>
  ),
}));

const { IqcInspectionRoute } = await import('./iqc-route');

const PL11 = { plantId: 1, plantCode: 'PL11', plantName: '부품' };
const PL13 = { plantId: 2, plantCode: 'PL13', plantName: 'OA' };

describe('IQC 탭 — 사용자 설정의 공장으로 화면을 고른다 (omf-all-around#211)', () => {
  beforeEach(() => {
    scoped.value = { status: 'checking' };
    scoped.access = 'checking';
  });

  it('부품 공장만 있으면 부품 화면이다', () => {
    scoped.value = { status: 'ready', oa: [], parts: [PL11] };
    scoped.access = 'not-oa';
    render(<IqcInspectionRoute />);
    expect(screen.getByText('부품 화면 PL11')).toBeInTheDocument();
  });

  it('⭐ 범위에 OA 공장이 있으면 OA 화면이다 — 전환 단추를 두지 않는다', () => {
    scoped.value = { status: 'ready', oa: [PL13], parts: [PL11] };
    scoped.access = 'oa';
    render(<IqcInspectionRoute />);
    expect(screen.getByText('OA 화면')).toBeInTheDocument();
    expect(screen.queryByText(/부품 화면/)).toBeNull();
  });

  it('판단할 근거가 없으면 지금의 OA 화면이다', () => {
    scoped.value = { status: 'unknown' };
    scoped.access = 'unknown';
    render(<IqcInspectionRoute />);
    expect(screen.getByText('OA 화면')).toBeInTheDocument();
  });
});

describe('계정 범위의 공장', () => {
  const plants = [
    { plantId: 1, plantCode: 'PL11', businessUnitId: 1 },
    { plantId: 2, plantCode: 'PL13', businessUnitId: 1 },
    { plantId: 3, plantCode: 'KR01', businessUnitId: 2 },
  ];

  it('공장을 지정한 범위는 그 공장, 사업부만 있는 범위는 그 사업부의 모든 공장이다', () => {
    expect(
      plantsInScope([{ businessUnitId: 1, plantId: 1 }], plants).map((p) => p.plantCode),
    ).toEqual(['PL11']);
    expect(plantsInScope([{ businessUnitId: 1 }], plants).map((p) => p.plantCode)).toEqual([
      'PL11',
      'PL13',
    ]);
  });
});

describe('치수 측정 표', () => {
  const item = (over: Record<string, unknown>) =>
    ({
      inspectionItemSpecId: 11,
      inspectionPlanVersionId: 1,
      sequenceNo: 1,
      inspectionItemCode: 'DIM-01',
      inspectionItemName: 'Kích thước ① 6.76±0.10',
      dataTypeCode: 'NUMERIC',
      measurementCount: 3,
      requiredFlag: true,
      automaticJudgment: true,
      targetValue: 6.76,
      lowerLimit: 6.66,
      upperLimit: 6.86,
      acceptanceNumber: 0,
      ...over,
    }) as never;

  it('규격은 「목표 ±공차」와 범위 두 줄 — 공차가 다르면 「+a/-b」', () => {
    expect(specLines(item({}))).toEqual(['6.76 ±0.1', '6.66 ~ 6.86']);
    expect(specLines(item({ targetValue: 19, lowerLimit: 19, upperLimit: 19.5 }))).toEqual([
      '19 +0.5/-0',
      '19 ~ 19.5',
    ]);
  });

  it('⭐ 열은 가장 많이 재는 항목의 시료 수, 항목마다 자기 시료 수까지만 칸이 열리고 벗어난 값은 표시된다', () => {
    render(
      <MeasurementTable
        items={[item({}), item({ inspectionItemSpecId: 12, sequenceNo: 2, measurementCount: 5 })]}
        values={{ 11: ['6.7', '6.9', '6.7'] }}
        versionAcceptance={0}
        disabled={false}
        onChange={() => undefined}
      />,
    );
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      '항목',
      '규격',
      'n1',
      'n2',
      'n3',
      'n4',
      'n5',
      '판정',
    ]);
    expect(screen.queryByRole('textbox', { name: '항목 1 n4 측정값' })).toBeNull();
    expect(screen.getByRole('textbox', { name: '항목 2 n5 측정값' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '항목 1 n2 측정값' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    const [first] = screen.getAllByRole('row').slice(1);
    expect(within(first as HTMLElement).getByText('NG')).toBeInTheDocument();
    expect(screen.getByText('1/2 항목')).toBeInTheDocument();
  });
});
