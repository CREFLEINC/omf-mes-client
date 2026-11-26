import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SessionProvider, type Session } from '../../patterns/session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';

/**
 * omf-all-around#351 — 검사 기준이 없는 IQC 의뢰도 양식을 열어 검사 항목 없이 종합 판정을 직접 고른다.
 * 기준이 있든 없든 「바뀐 기준은 새로 발행되는 건부터」 안내를 둔다. 값은 전부 지어낸 것이다.
 */

const detailOf = vi.hoisted(() => ({ value: null as unknown, slow: false }));
const PENDING = {
  data: undefined,
  isPending: true,
  isError: false,
  isSuccess: false,
  error: null,
  refetch: () => Promise.resolve({ data: undefined }),
};

const done = <T,>(data: T) => ({
  data,
  isPending: false,
  isError: false,
  isSuccess: true,
  error: null,
  refetch: () => Promise.resolve({ data }),
});

vi.mock('../iqc-inspection/queries', async (importOriginal) => {
  const { useEffect, useState } = await import('react');

  return {
    ...(await importOriginal<typeof import('../iqc-inspection/queries')>()),
    /* `slow` 면 처음엔 불러오는 중, 다음 틀에 도착 — 실제 앱처럼 로딩 → 데이터 순서(G2 H1). */
    useInspectionRequestDetail: () => {
      const [ready, setReady] = useState(!detailOf.slow);
      useEffect(() => {
        if (ready) return undefined;
        const id = setTimeout(() => setReady(true), 0);
        return () => clearTimeout(id);
      }, [ready]);
      return ready
        ? done(detailOf.value)
        : {
            data: undefined,
            isPending: true,
            isError: false,
            isSuccess: false,
            error: null,
            refetch: () => Promise.resolve({ data: undefined }),
          };
    },
    useInspectionRounds: () => done([]),
    useInspectionItemSpecs: (id: number | null) =>
      id === null
        ? PENDING
        : done([
            {
              inspectionItemSpecId: 1,
              inspectionPlanVersionId: 3,
              sequenceNo: 1,
              inspectionItemCode: 'TST-VIS',
              inspectionItemName: '합성 외관',
              dataTypeCode: 'BOOLEAN',
              measurementCount: 1,
              requiredFlag: true,
              automaticJudgment: false,
            },
          ]),
    useDefectCodes: () => done([]),
    useRejectedLotFollowUp: () => done(undefined),
    useMeasurements: () => done([]),
  };
});

vi.mock('./queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./queries')>()),
  /* 꺼진 조회(react-query)는 「불러오는 중」으로 남는다 — 실제 앱과 같게. */
  usePlanVersion: (id: number | null) =>
    id === null
      ? PENDING
      : done({
          inspectionPlanVersionId: 3,
          inspectionPlanId: 4,
          samplingMethodCode: 'FIXED',
          samplingQty: 5,
          samplingRatio: null,
          acceptanceNumber: 0,
          aqlValue: null,
        }),
  useInspectionPlan: () =>
    done({ inspectionPlanCode: 'TST-PLAN', inspectionPlanName: '합성 기준' }),
  useDrawings: () => done([]),
  useInboundInfo: () => done({ supplierLabel: '합성 공급사', receivedAt: null }),
}));

vi.mock('../iqc-inspection/reference-lookup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../iqc-inspection/reference-lookup')>()),
  useItemNames: () => ({ partsOf: () => ({ code: 'TST-ITEM', name: '합성 자재' }) }),
  useLotNumbers: () => ({ labelOf: () => 'TST-LOT-0001' }),
}));

vi.mock('../iqc-inspection/uom-lookup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../iqc-inspection/uom-lookup')>()),
  useUomLookup: () => ({ codeOf: () => 'EA' }),
}));

vi.mock('../inspection-documents/attachment-panel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../inspection-documents/attachment-panel')>()),
  useAttachments: () => done([]),
}));

vi.mock('../../patterns/inspection-guide', () => ({ InspectionGuideNotice: () => null }));

const { InspectionDetail } = await import('./inspection-detail');

const tp = messages.partsIqcInspection;

const session: Session = {
  userId: 8101,
  loginId: 'TST-LOGIN-01',
  userName: '합성 사용자',
  scopes: [{ businessUnitId: 8301 }],
  mustChangePassword: false,
  roles: [],
  permissions: ['W-01-01', 'W-01-15'],
  worker: { workerNo: '900028', workerName: '합성 검사자' },
} as unknown as Session;

const request = (inspectionPlanVersionId: number | null) => ({
  inspectionRequestId: 501,
  inspectionRequestNo: 'TST-REQ-0501',
  inspectionTypeCode: 'IQC',
  inspectionPlanVersionId,
  lotId: 61,
  itemId: 31,
  targetQty: 1000,
  uomId: 1,
  statusCode: 'REQUESTED',
  requestedAt: '2099-11-11T01:00:00Z',
  fourMChange: null,
  skipBasisCode: null,
  aqlPlan: null,
  targetTypeCode: 'LOT',
});

const mount = () =>
  renderWithProviders(
    <SessionProvider>
      <InspectionDetail
        inspectionRequestId={501}
        onSubmitted={() => undefined}
        onDirtyChange={() => undefined}
      />
    </SessionProvider>,
    { session, fetch: createStubFetch([]) },
  );

describe('#351 검사 기준이 없는 IQC', () => {
  it('양식을 열고 항목 없이 종합 판정을 직접 고른다 — 자동 판정 없이 빈 채로 시작, 기준 변경 안내는 없다', async () => {
    detailOf.value = request(null);
    mount();

    expect(await screen.findByText(tp.dialog.noPlan)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: tp.dialog.planVersionNote })).toBeNull();
    expect(screen.getByRole('button', { name: tp.footer.submit })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: tp.plan.open })).toBeNull();
    expect(screen.getByText(tp.verdict.noPlan)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: tp.verdict.overall })).toBeEnabled();
  });

  it('기준이 있으면 지금 양식 그대로 — 「검사 항목」 옆에 기준 변경 안내를 더한다', async () => {
    detailOf.value = request(3);
    mount();

    expect(
      await screen.findByRole('button', { name: tp.dialog.planVersionNote }),
    ).toBeInTheDocument();
    expect(screen.queryByText(tp.dialog.noPlan)).toBeNull();
    expect(screen.getByRole('button', { name: tp.plan.open })).toBeInTheDocument();
    expect(screen.getByText(tp.verdict.pending)).toBeInTheDocument();
  });
});
