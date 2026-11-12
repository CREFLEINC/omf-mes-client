import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SessionProvider, type Session } from '../../patterns/session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';

/**
 * 005 — W-01-01 상세가 의뢰 대상으로 길을 가른다(`isInboundLotInspection` · FR-051 · R18-1).
 * - 이전 데이터 IQC(대상 LOT): 지금 상세 그대로 — 결과 단위 확정([제출]), 판정 확정 단추 없음
 * - 새 흐름(대상 = 입하 LOT): 결과 목록 상세 — 검사 단위 [판정 확정], [제출] 없음
 *
 * 기준 · 도면 · 품목 풀이 같은 무거운 조회는 같은 값을 돌려주는 가짜로 둔다 — 여기서 재는 것은 갈림길 하나다.
 * 값은 전부 지어낸 것이다.
 */

const detailOf = vi.hoisted(() => ({ value: null as unknown, slow: false }));

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
    useInspectionItemSpecs: () => done([]),
    useDefectCodes: () => done([]),
    useRejectedLotFollowUp: () => done(undefined),
    useMeasurements: () => done([]),
  };
});

vi.mock('./queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./queries')>()),
  usePlanVersion: () =>
    done({
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

const t = messages.iqcInboundLot;
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

const request = (targetTypeCode: string) => ({
  inspectionRequestId: 501,
  inspectionRequestNo: 'TST-REQ-0501',
  inspectionTypeCode: 'IQC',
  inspectionPlanVersionId: 3,
  lotId: targetTypeCode === 'LOT' ? 61 : null,
  itemId: 31,
  targetQty: 1000,
  uomId: 1,
  statusCode: 'IN_PROGRESS',
  requestedAt: '2099-11-11T01:00:00Z',
  fourMChange: null,
  skipBasisCode: null,
  /* main #264 — AQL 시료 계획(없으면 null). */
  aqlPlan: null,
  targetTypeCode,
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
    {
      session,
      fetch: createStubFetch([
        {
          match: (r) => new URL(r.url).pathname === '/quality/inspection-requests/501',
          respond: () =>
            jsonResponse({
              ...request('INBOUND_LOT'),
              targetId: 77,
              inboundLotId: 77,
              inboundLotNo: 'IL-20991111-0003',
              versionNo: 5,
              confirmedAt: null,
              previewJudgmentCode: 'ACCEPTED',
              lots: [],
              results: [
                {
                  inspectionResultId: 701,
                  inspectionResultNo: 'TST-IR-1',
                  seqNo: 1,
                  overallJudgmentCode: 'ACCEPTED',
                  inspectedQty: 5,
                  rejectedQty: 0,
                  defectNames: [],
                  matchedLotIds: [],
                  inspectorName: '합성 검사자',
                  inspectedAt: '2099-11-11T01:00:00Z',
                  statusCode: 'DRAFT',
                  versionNo: 1,
                },
              ],
            }),
        },
      ]),
    },
  );

describe('W-01-01 상세의 갈림길 — 이전 데이터 IQC 와 새 흐름', () => {
  it('R18-1 이전 데이터 IQC(대상 LOT)는 지금 상세 그대로 — 결과 단위 확정 [제출]이 있고 판정 확정은 없다', async () => {
    detailOf.value = request('LOT');
    mount();

    expect(await screen.findByRole('button', { name: tp.footer.submit })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.confirm.open })).toBeNull();
    expect(screen.queryByRole('button', { name: t.results.add })).toBeNull();
  });

  it('G2 H1 새 흐름 의뢰를 불러오는 중 → 도착해도 화면이 깨지지 않는다(훅 개수가 같다)', async () => {
    detailOf.value = request('INBOUND_LOT');
    detailOf.slow = true;
    try {
      mount();

      expect(await screen.findByRole('button', { name: t.confirm.open })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: t.results.add })).toBeInTheDocument();
    } finally {
      detailOf.slow = false;
    }
  });

  it('새 흐름(대상 = 입하 LOT)은 결과 목록 상세 — 검사 단위 [판정 확정], 결과 단위 [제출]은 없다', async () => {
    detailOf.value = request('INBOUND_LOT');
    mount();

    expect(await screen.findByRole('button', { name: t.confirm.open })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.results.add })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: tp.footer.submit })).toBeNull();
  });
});
