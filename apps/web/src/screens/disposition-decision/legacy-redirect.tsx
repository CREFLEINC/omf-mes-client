import { SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { readSelectedNonconformanceId } from './filters';
import { useNonconformanceDetail } from './queries';
import type { Nonconformance } from './types';

/**
 * 옛 「부적합 처분 관리」 주소(`/quality/dispositions`)를 검사 조회·판정의 탭으로 넘긴다(omf-all-around#354).
 * 메뉴를 없앴어도 대시보드 · 판정 의뢰 「판정 결과 보기」 · 즐겨찾기가 이 주소로 온다.
 *   - `?nonconformanceId=` — IQC 부적합은 IQC 탭, OQC 불합격(LOT 교체)은 OQC 탭에서 그 검사 건을 고른 채로,
 *     검사 건이 없는 부적합(판정 의뢰로 올린 반품 · 제품)은 OQC 탭 「판정 의뢰」에서 그 부적합을 고른 채로
 *   - `?item=` — 그 품목의 가장 최근 부적합이 속한 탭을 그 품목으로 걸러서
 *   - 그 밖 — IQC 탭
 */
const IQC_PATH = '/logistics/iqc-inspection';
const OQC_PATH = '/shipment/oqc-inspection';
/** OQC 탭의 「구분」 주소 이름 · 판정 의뢰 값 — `oqc-inspection/kind.tsx` 와 같다. */
const OQC_KIND_KEY = 'kind';
const OQC_KIND_REQUEST = 'request';
/** 검사 목록의 「대기·진행만 보기」를 끈 값 — 처분할 건은 이미 판정이 끝난 검사다. */
const PENDING_ONLY_OFF = '0';
/** 계약이 접수 기간을 필수로 둔다 — 품목의 «가장 최근» 부적합을 찾는 자리라 넓게 연다. */
const OPENED_FROM_ANY = '2000-01-01T00:00:00.000Z';

const readId = (value: string | null): number | null =>
  value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : null;

const Loading = () => (
  <div role="status" aria-label={messages.dispositionDecision.detail.loading}>
    <SkeletonText lines={3} />
  </div>
);

const query = (entries: Record<string, string>): string =>
  `?${new URLSearchParams(entries).toString()}`;

const requestPath = (nonconformance: Nonconformance | null, itemId: number | null): string =>
  `${OQC_PATH}${query({
    [OQC_KIND_KEY]: OQC_KIND_REQUEST,
    ...(nonconformance === null
      ? {}
      : { nonconformanceId: String(nonconformance.nonconformanceId) }),
    ...(itemId === null ? {} : { item: String(itemId) }),
  })}`;

/** 부적합 하나가 갈 자리 — 검사 건이 있으면 그 검사의 탭, 없으면 OQC 「판정 의뢰」. */
const ToNonconformance = ({
  nonconformance,
  itemId,
}: {
  nonconformance: Nonconformance;
  itemId: number | null;
}) => {
  const { client } = useApiClient();
  /* 「판정 의뢰」 목록과 같은 기준 — 검사 의뢰가 없으면 그쪽에 선다(서버 `withoutInspectionRequestOnly`). */
  const requestId = nonconformance.inspectionRequestId ?? null;
  const request = useQuery({
    queryKey: ['disposition-decision', 'legacy-request', requestId],
    enabled: requestId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/inspection-requests/{inspectionRequestId}', {
          params: { path: { inspectionRequestId: requestId as number } },
        }),
      ),
  });
  if (requestId === null || request.isError)
    return <Navigate to={requestPath(nonconformance, itemId)} replace />;
  if (request.data === undefined) return <Loading />;
  const path = request.data.inspectionTypeCode === 'IQC' ? IQC_PATH : OQC_PATH;
  /* 품목으로 왔으면 그 품목 목록, 부적합으로 왔으면 그 검사 건을 고른 채로. */
  const params: Record<string, string> =
    itemId === null
      ? { ir: String(requestId), pd: PENDING_ONLY_OFF }
      : { it: String(itemId), pd: PENDING_ONLY_OFF };
  return <Navigate to={`${path}${query(params)}`} replace />;
};

const ByNonconformance = ({ nonconformanceId }: { nonconformanceId: number }) => {
  const detail = useNonconformanceDetail(nonconformanceId);
  if (detail.isError)
    return (
      <Navigate
        to={`${OQC_PATH}${query({ [OQC_KIND_KEY]: OQC_KIND_REQUEST, nonconformanceId: String(nonconformanceId) })}`}
        replace
      />
    );
  if (detail.data === undefined) return <Loading />;
  return <ToNonconformance nonconformance={detail.data} itemId={null} />;
};

const ByItem = ({ itemId }: { itemId: number }) => {
  const { client } = useApiClient();
  const latest = useQuery({
    queryKey: ['disposition-decision', 'legacy-item', itemId],
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/nonconformances', {
          params: {
            query: {
              itemId,
              openedFrom: OPENED_FROM_ANY,
              openedTo: new Date(Date.now() + 86_400_000).toISOString(),
              page: 1,
              size: 1,
            },
          },
        }),
      ),
  });
  if (latest.isError) return <Navigate to={requestPath(null, itemId)} replace />;
  if (latest.data === undefined) return <Loading />;
  const first = latest.data.items[0];
  if (first === undefined) return <Navigate to={requestPath(null, itemId)} replace />;
  return <ToNonconformance nonconformance={first as Nonconformance} itemId={itemId} />;
};

export const DispositionLegacyRedirect = () => {
  const [params] = useSearchParams();
  const nonconformanceId = readSelectedNonconformanceId(params);
  if (nonconformanceId !== null) return <ByNonconformance nonconformanceId={nonconformanceId} />;
  const itemId = readId(params.get('item'));
  if (itemId !== null) return <ByItem itemId={itemId} />;
  return <Navigate to={IQC_PATH} replace />;
};
