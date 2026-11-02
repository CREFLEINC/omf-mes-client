import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useLocation } from 'react-router';

import { useApiClient } from '../patterns/api-context';
import { useOaAccess, useScopedPlants } from '../patterns/oa-access';
import { INSPECTION_HUB_COUNTS_KEY } from '../patterns/inspection-hub-counts';
import { runRequest } from '../patterns/request';

/** IQC 화면(W-01-01). 이 화면을 볼 수 있을 때만 수를 묻고 보인다(US4-3). */
export const IQC_PATH = '/logistics/iqc-inspection';
/** PQC 화면(W-03-11) · OQC 화면(W-04-03) — 검사 조회·판정 탭에도 같은 대기 수를 붙인다(사용자 지시 2026-10-29 · #197). */
export const PQC_PATH = '/quality/pqc-inspections';
export const OQC_PATH = '/shipment/oqc-inspection';

/** 다시 세는 간격 — 백그라운드 탭에서는 멈춘다(react-query 기본, 대시보드 선례). */
export const IQC_PENDING_INTERVAL_MS = 60_000;

type InspectionTypeCode = 'IQC' | 'PQC' | 'OQC';

/*
 * 건수 칩과 같은 앞머리에 둔다 — 판정 저장·확정·생략 실행이 칩을 다시 셀 때 배지도 함께 다시 센다.
 * 따로 두면 화면을 옮기거나 60초가 지나야 배지가 바뀐다(omf-all-around#216).
 */
const pendingKeyOf = (
  inspectionTypeCode: InspectionTypeCode,
  plantIds: readonly number[] | undefined,
) => [...INSPECTION_HUB_COUNTS_KEY, 'pending', inspectionTypeCode, plantIds ?? null] as const;

/**
 * 대기·진행 중 검사 의뢰 수(피처 002, US4-1) — 그 검사 화면 목록과 같은 조건의 `page.total`. 서버 변경 없음.
 *
 * - 화면을 옮길 때마다, 그리고 60초마다 다시 센다(US4-4).
 * - 실패·아직이면 `undefined` — 배지·점을 그리지 않는다(FR-018). 실패한 동안은 앞선 수도 보이지 않는다.
 */
export const useInspectionPendingCount = (
  inspectionTypeCode: InspectionTypeCode,
  enabled: boolean,
  /** 이 공장들 LOT 의 의뢰만 센다(합) — 부품 IQC 화면과 같은 범위(omf-all-around#225). 비면 전체다. */
  plantIds?: readonly number[],
): number | undefined => {
  const { client } = useApiClient();
  const { pathname } = useLocation();
  const query = useQuery({
    queryKey: pendingKeyOf(inspectionTypeCode, plantIds),
    enabled,
    refetchInterval: IQC_PENDING_INTERVAL_MS,
    queryFn: async () => {
      const countOf = async (plantId?: number) =>
        (
          await runRequest(() =>
            client.GET('/quality/inspection-requests', {
              params: {
                query: {
                  inspectionTypeCode,
                  pendingOnly: true,
                  ...(plantId === undefined ? {} : { plantId }),
                  size: 1,
                },
              },
            }),
          )
        ).page.total;
      if (plantIds === undefined) return countOf();
      const totals = await Promise.all(plantIds.map((plantId) => countOf(plantId)));
      return totals.reduce((sum, total) => sum + total, 0);
    },
  });
  const { refetch } = query;

  useEffect(() => {
    if (enabled) void refetch();
  }, [enabled, pathname, refetch]);

  return query.isError ? undefined : query.data;
};

/**
 * IQC 대기 수 — 「검사 조회·판정」 줄 · 닫힌 「품질 관리」 묶음 점 · IQC 탭(피처 002).
 * IQC 탭이 부품 화면을 여는 계정(범위에 OA 공장 없음 · #211)이면 그 화면처럼 범위의 부품 공장 의뢰만 센다 —
 * 전체를 세면 목록은 0건인데 탭에 수가 뜬다(omf-all-around#225). 범위를 아직 모르면 세지 않는다.
 */
export const useIqcPendingCount = (enabled: boolean): number | undefined => {
  const access = useOaAccess();
  const plants = useScopedPlants();
  const partsPlantIds =
    access === 'not-oa' && plants.status === 'ready' && plants.parts.length > 0
      ? plants.parts.map((plant) => plant.plantId)
      : undefined;
  return useInspectionPendingCount('IQC', enabled && access !== 'checking', partsPlantIds);
};
