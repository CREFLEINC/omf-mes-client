import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ permissions: ['W-06-02'] as string[] | undefined }));
vi.mock('../../patterns/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../patterns/session')>()),
  useSession: () => ({ session: { permissions: session.permissions } }),
}));

const { PlanDialog } = await import('./plan-dialog');

const version = {
  inspectionPlanVersionId: 11,
  inspectionPlanId: 7,
  planVersion: 2,
  effectiveFrom: '2026-01-01',
  samplingMethodCode: 'SAMPLE_BY_LOT',
  samplingRatio: 10,
  aqlValue: 0.65,
  acceptanceNumber: 1,
  inspectionFrequencyCode: 'PRODUCTION_LOT',
  statusCode: 'CONFIRMED',
} as never;
const specs = [
  {
    inspectionItemSpecId: 1,
    inspectionPlanVersionId: 11,
    sequenceNo: 1,
    inspectionItemCode: 'D1',
    inspectionItemName: 'Kích thước ① Đường kính ngoài',
    dataTypeCode: 'NUMERIC',
    inspectionMethodCode: 'MEASUREMENT',
    measurementCount: 10,
    requiredFlag: true,
    automaticJudgment: true,
    targetValue: 4,
    lowerLimit: 3.9,
    upperLimit: 4.1,
    acceptanceNumber: 0,
  },
  {
    inspectionItemSpecId: 2,
    inspectionPlanVersionId: 11,
    sequenceNo: 2,
    inspectionItemCode: 'V1',
    inspectionItemName: 'Ngoại quan (외관)',
    dataTypeCode: 'BOOLEAN',
    inspectionMethodCode: 'VISUAL',
    measurementCount: 1,
    requiredFlag: true,
    automaticJudgment: true,
  },
] as never[];

const renderDialog = () =>
  render(
    <PlanDialog
      planCode="IQC-AA205-1"
      planName="0090040302 수입검사"
      itemLabel="0090040302 · BUSH"
      version={version}
      specs={specs}
      drawings={null}
      onClose={() => undefined}
    />,
  );

describe('검사 기준 조회 팝업 (사용자 지시 2026-10-30)', () => {
  afterEach(() => {
    session.permissions = ['W-06-02'];
    vi.restoreAllMocks();
  });

  it('기준 · 버전 · 샘플링 · 항목별 규격 · n · c 를 보인다', () => {
    renderDialog();
    expect(screen.getByText('IQC-AA205-1')).toBeInTheDocument();
    expect(screen.getByText('2판 · 2026-01-01 부터')).toBeInTheDocument();
    expect(screen.getByText('LOT 의 10%')).toBeInTheDocument();
    expect(screen.getByText('AQL 0.65 · C=1')).toBeInTheDocument();
    expect(screen.getByText('4 ±0.1 (3.9 ~ 4.1)')).toBeInTheDocument();
    expect(screen.getByText('OK / NG')).toBeInTheDocument();
  });

  it('「수정」은 검사 기준 화면을 새 탭으로 그 기준 · 버전에 연다', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: '수정' }));
    expect(open).toHaveBeenCalledWith(
      '/master-data/inspection-standard?plan=7&ver=11',
      '_blank',
      'noopener',
    );
  });

  it('검사 기준 화면 권한이 없으면 「수정」이 없다', () => {
    session.permissions = ['W-01-01'];
    renderDialog();
    expect(screen.queryByRole('button', { name: '수정' })).toBeNull();
  });
});
