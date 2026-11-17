import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SessionProvider, type Session } from '../../patterns/session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';

/**
 * omf-all-around#290 — 새 흐름(대상 = 입하 LOT) 의뢰의 [결과 추가] 창에도 OA 는 「4M 변경 정보」를 보인다. 부품 화면에는 없다.
 * 적어 둔 4M 은 입하 LOT 의 맨 앞 자재 관리 LOT 조회(`GET /trace/lots`)에서 읽어 창에 채운다.
 *
 * 기준 · 도면 · 품목 풀이 같은 무거운 조회는 flow-branch.test 와 같은 가짜로 둔다. 값은 전부 지어낸 것이다.
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
const four = messages.iqcInspection.result.fourMChange;

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

const FIRST_LOT_NO = 'TST-ITEM|1000|991111|TS01|0001';

const request = {
  inspectionRequestId: 501,
  inspectionRequestNo: 'TST-REQ-0501',
  inspectionTypeCode: 'IQC',
  inspectionPlanVersionId: 3,
  lotId: null,
  itemId: 31,
  targetQty: 1000,
  uomId: 1,
  statusCode: 'IN_PROGRESS',
  requestedAt: '2099-11-11T01:00:00Z',
  fourMChange: null,
  skipBasisCode: null,
  aqlPlan: null,
  targetTypeCode: 'INBOUND_LOT',
};

const lot = (lotId: number) => ({
  lotId,
  lotNo: `TST-ITEM|1000|991111|TS01|${String(lotId).padStart(4, '0')}`,
  lotQty: 1000,
  package: null,
  statusCode: 'INSPECTION_PENDING',
  goodsReceived: false,
});

const result = {
  inspectionResultId: 701,
  inspectionResultNo: 'TST-IR-1',
  seqNo: 1,
  overallJudgmentCode: 'ACCEPTED',
  inspectedQty: 5,
  rejectedQty: 0,
  defectNames: [],
  matchedLotIds: [1, 2],
  inspectorName: '합성 검사자',
  inspectedAt: '2099-11-11T01:00:00Z',
  statusCode: 'DRAFT',
  versionNo: 1,
};

const mount = (oa: boolean, stored: { remarks: string } | null, withResult = false) => {
  const lotQueries: URL[] = [];
  const posts: { path: string; body: unknown }[] = [];
  detailOf.value = request;
  renderWithProviders(
    <SessionProvider>
      <InspectionDetail
        oa={oa}
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
              ...request,
              targetId: 77,
              inboundLotId: 77,
              inboundLotNo: 'IL-20991111-0003',
              versionNo: 5,
              confirmedAt: null,
              previewJudgmentCode: withResult ? 'ACCEPTED' : null,
              lots: [lot(1), lot(2)],
              results: withResult ? [result] : [],
              nextResultSeqNo: withResult ? 2 : 1,
            }),
        },
        {
          match: (r) => new URL(r.url).pathname === '/trace/lots',
          respond: (r) => {
            lotQueries.push(new URL(r.url));
            return jsonResponse({
              items: [
                {
                  lotId: 1,
                  lotNo: FIRST_LOT_NO,
                  ...(stored === null ? {} : { fourMChange: stored }),
                },
              ],
              page: 1,
              size: 1,
              totalCount: 1,
            });
          },
        },
        {
          match: (r) => r.method === 'POST',
          respond: async (r) => {
            posts.push({ path: new URL(r.url).pathname, body: await r.clone().json() });
            return jsonResponse({});
          },
        },
        {
          match: () => true,
          respond: () => jsonResponse({ items: [], page: 1, size: 20, totalCount: 0 }),
        },
      ]),
    },
  );
  return { lotQueries, posts };
};

const openAdd = async () => {
  await userEvent.click(await screen.findByRole('button', { name: t.results.add }));
  return screen.findByRole('dialog');
};

describe('#290 새 흐름 [결과 추가] 창의 4M 변경 정보', () => {
  it('OA — 창에 4M 칸이 있고, 맨 앞 자재 관리 LOT 에 적어 둔 비고가 채워져 있다', async () => {
    const { lotQueries } = mount(true, { remarks: '합성 — 사출 금형 변경' });

    const drawer = await openAdd();

    expect(await within(drawer).findByRole('group', { name: four.label })).toBeInTheDocument();
    expect(within(drawer).getByRole('checkbox', { name: four.label })).toBeChecked();
    expect(within(drawer).getByText('합성 — 사출 금형 변경')).toBeInTheDocument();
    expect(lotQueries[0]?.searchParams.get('lotNo')).toBe(FIRST_LOT_NO);
    expect(lotQueries[0]?.searchParams.get('itemId')).toBe('31');
  });

  it('OA — 적어 둔 4M 이 없으면 체크가 풀린 채로 보인다', async () => {
    mount(true, null);

    const drawer = await openAdd();

    expect(await within(drawer).findByRole('checkbox', { name: four.label })).not.toBeChecked();
  });

  it('OA — 골라 둔 검사 수준은 [판정 확정]이 끝난 뒤 저장한다', async () => {
    window.localStorage.setItem(
      'omf-mes:iqc-inspection:pending-level:501',
      JSON.stringify({ itemId: 31, level: 'TIGHTENED', reason: '' }),
    );
    try {
      const { posts } = mount(true, null, true);

      await userEvent.click(await screen.findByRole('button', { name: t.confirm.open }));
      const dialog = await screen.findByRole('dialog', { name: messages.judgmentConfirm.title });
      await userEvent.click(
        within(dialog).getByRole('button', { name: messages.judgmentConfirm.confirm }),
      );

      await vi.waitFor(() =>
        expect(posts.map((post) => post.path)).toEqual([
          '/quality/inspection-requests/501:confirm',
          '/quality/item-inspection-levels',
        ]),
      );
      expect(posts[1]?.body).toEqual({ itemId: 31, inspectionLevelCode: 'TIGHTENED' });
      expect(window.localStorage.getItem('omf-mes:iqc-inspection:pending-level:501')).toBeNull();
    } finally {
      window.localStorage.removeItem('omf-mes:iqc-inspection:pending-level:501');
    }
  });

  it('부품 화면 — 4M 칸이 없고 4M 을 읽지도 않는다', async () => {
    const { lotQueries } = mount(false, { remarks: '합성 — 읽으면 안 됨' });

    const drawer = await openAdd();

    expect(
      await within(drawer).findByText(messages.partsIqcInspection.visual.remarks),
    ).toBeInTheDocument();
    expect(within(drawer).queryByRole('group', { name: four.label })).toBeNull();
    expect(lotQueries).toHaveLength(0);
  });
});
