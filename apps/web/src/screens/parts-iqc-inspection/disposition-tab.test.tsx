import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SessionProvider, type Session } from '../../patterns/session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';

/**
 * omf-all-around#354 — 부품 화면 단일 의뢰 상세의 「부적합 처분」 탭. 탭의 부적합은 의뢰 상세가 확정 시각으로 고정해 내리는
 * `nonconformanceId` 다 — 처분을 마쳐 부적합이 판정 완료가 되고 LOT 이 불량에서 벗어나도(불합격 안내 조회가 null) 탭과 이력이 남는다.
 * 값은 전부 지어낸 것이다.
 */

const detailOf = vi.hoisted(() => ({ value: null as unknown, slow: false }));
const roundsOf = vi.hoisted(() => ({ value: [] as unknown[] }));
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
    useInspectionRounds: () => done(roundsOf.value),
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

/* 상자 속은 처분 화면 시험이 본다 — 여기서는 어느 부적합을 넘기는지만 본다. */
vi.mock('../disposition-decision/disposition-box', () => ({
  DispositionBox: ({ nonconformanceId }: { nonconformanceId: number | null }) => (
    <p data-testid="disposition-box">{`NC ${nonconformanceId}`}</p>
  ),
}));

const { InspectionDetail } = await import('./inspection-detail');

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

const request = (nonconformanceId: number | null) => ({
  inspectionRequestId: 501,
  inspectionRequestNo: 'TST-REQ-0501',
  inspectionTypeCode: 'IQC',
  inspectionPlanVersionId: 3,
  lotId: 61,
  itemId: 31,
  targetQty: 1000,
  uomId: 1,
  statusCode: 'COMPLETED',
  requestedAt: '2099-11-11T01:00:00Z',
  fourMChange: null,
  skipBasisCode: null,
  aqlPlan: null,
  targetTypeCode: 'LOT',
  nonconformanceId,
});

const confirmedRound = (overallJudgmentCode: string) => ({
  inspectionResultId: 901,
  inspectionRound: 1,
  inspectedQty: 5,
  acceptedQty: overallJudgmentCode === 'REJECTED' ? 0 : 5,
  rejectedQty: overallJudgmentCode === 'REJECTED' ? 5 : 0,
  heldQty: 0,
  overallJudgmentCode,
  statusCode: 'CONFIRMED',
  confirmedAt: '2099-11-11T02:00:00Z',
  previousResultId: null,
  remarks: '',
  inspectedAt: '2099-11-11T01:30:00Z',
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

const tp = messages.partsIqcInspection;
const tabLabel = messages.dispositionDecision.box.title;

describe('부품 단일 의뢰 「부적합 처분」 탭(omf-all-around#354)', () => {
  it('불합격 확정 건은 이 탭부터 열고, 처분을 마쳐 불합격 안내 조회가 비어도 의뢰의 부적합으로 남는다', async () => {
    detailOf.value = request(77);
    roundsOf.value = [confirmedRound('REJECTED')];
    mount();

    expect(await screen.findByRole('tab', { name: tabLabel, selected: true })).toBeInTheDocument();
    expect(screen.getByTestId('disposition-box')).toHaveTextContent('NC 77');
  });

  it('확정이 부적합을 만들지 않았으면 탭이 없고 이력부터 연다', async () => {
    detailOf.value = request(null);
    roundsOf.value = [confirmedRound('ACCEPTED')];
    mount();

    expect(
      await screen.findByRole('tab', { name: new RegExp(`^${tp.tabs.history}`), selected: true }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: tabLabel })).toBeNull();
  });
});
