import type { components } from '@omf-mes/api-client';
import { activeLocale } from '@omf-mes/i18n';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { runRequest } from './request';

type HandoverAlertType = components['schemas']['HandoverAlertType'];

/**
 * 인계 작업 종류 10종(피처 002, omf-all-around#190) — 기존 알림 이벤트 6종과 **다른 목록**이다(research R-1).
 *
 * 여러 화면(W-CO-14 설정, W-CO-12 템플릿, W-CO-03·W-CO-13·대시보드 이름 풀이)이 같은 조회를 쓴다.
 * 이름은 서버 목록이 정본이고, 화면에 세우는 차례는 업무 흐름 순서다(확정 2026-10-28).
 */
export const HANDOVER_ALERT_ORDER = [
  'IQC_INSPECTION_REQUESTED',
  'PUTAWAY_REQUESTED',
  'MATERIAL_PICKING_REQUESTED',
  'STOCK_TRANSFER_ARRIVAL_PENDING',
  'WORK_ORDER_RELEASED',
  'EMERGENCY_WORK_ORDER_RELEASED',
  'REWORK_WORK_ORDER_CREATED',
  'OQC_INSPECTION_REQUESTED',
  'SHIPMENT_PICKING_REQUESTED',
  'SHIPMENT_PACKING_REQUESTED',
] as const;

export type HandoverAlertCode = (typeof HANDOVER_ALERT_ORDER)[number];

export const handoverAlertTypeKeys = { all: ['handover-alert-types'] as const };

/** 업무 흐름 순서로 세운다. 차례에 없는 코드(서버가 먼저 더한 종류)는 뒤에 받은 순서대로 둔다. */
export const sortHandoverTypes = (types: readonly HandoverAlertType[]): HandoverAlertType[] => {
  const rank = (code: string): number => {
    const index = (HANDOVER_ALERT_ORDER as readonly string[]).indexOf(code);
    return index === -1 ? HANDOVER_ALERT_ORDER.length : index;
  };
  return [...types].sort((left, right) => rank(left.alertTypeCode) - rank(right.alertTypeCode));
};

export const useHandoverAlertTypes = (): UseQueryResult<HandoverAlertType[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: handoverAlertTypeKeys.all,
    queryFn: async () =>
      sortHandoverTypes((await runRequest(() => client.GET('/app/handover-alert-types'))).items),
  });
};

/** 활성 언어의 이름. 비었으면 코드를 그대로 보인다 — 빈 칸보다 담당자에게 전할 단서가 낫다. */
export const handoverTypeName = (type: HandoverAlertType | undefined, code: string): string => {
  if (type === undefined) return code;
  const name = activeLocale() === 'vi' ? type.nameVi : type.name;
  return name.trim() === '' ? code : name;
};
