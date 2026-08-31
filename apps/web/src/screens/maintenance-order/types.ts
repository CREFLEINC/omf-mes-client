import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

/**
 * W-05-05가 다루는 모양들.
 *
 * ⭐ **트리거 원천이 셋인데 성질이 다르다.** 고장과 점검 불합격은 **저장된 기록**이라 목록에서
 * 고르고, 주기 도래는 **파생 조건**이라 가리킬 행이 없다. 그 갈림을 타입이 드러내도록 트리거
 * 초안을 한 모양으로 두되 원천 식별자를 널 허용으로 둔다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.maintenanceOrder;

type MaintenanceOrder = components['schemas']['MaintenanceOrder'];
type Breakdown = components['schemas']['Breakdown'];
type Inspection = components['schemas']['Inspection'];

export interface PageMeta {
  page: number;
  size: number;
  total: number;
}

export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

/** 트리거 유형 — 계약이 이름을 준 셋이다. */
export const BREAKDOWN_TRIGGER = 'BREAKDOWN';
export const INSPECTION_NG_TRIGGER = 'INSPECTION_NG';
export const PM_DUE_TRIGGER = 'PM_DUE';

/** 대상 유형. 이 화면은 설비만 다룬다 — 툴 예방보전은 카디널리티가 반대라 다른 화면이다. */
export const EQUIPMENT_TARGET = 'EQUIPMENT';

export const ISSUED_STATUS = 'ISSUED';
export const DONE_STATUS = 'DONE';
export const CANCELLED_STATUS = 'CANCELLED';

export const ORDER_STATUS_CODES: readonly string[] = [ISSUED_STATUS, DONE_STATUS, CANCELLED_STATUS];

export const orderStatusLabel = (code: string): string => {
  switch (code) {
    case ISSUED_STATUS:
      return t.status.issued;
    case DONE_STATUS:
      return t.status.done;
    case CANCELLED_STATUS:
      return t.status.cancelled;
    default:
      return code;
  }
};

/**
 * 화면이 고른 트리거 하나.
 *
 * ⭐ **원천 식별자가 널 허용이다** — 주기 도래는 가리킬 기록이 없다. 계약도 같은 이유로 그 칸을
 * 널 허용으로 두었고, 나머지 두 유형에서는 반드시 채운다.
 *
 * `equipmentId`는 계약에 없는 **화면만의 칸**이다. 한 지시에 같은 설비만 묶는다는 규칙을
 * 화면이 판정해야 하는데, 그러려면 고른 트리거마다 어느 설비인지 들고 있어야 한다.
 */
export interface TriggerDraft {
  key: string;
  triggerTypeCode: string;
  sourceId: number | null;
  equipmentId: number;
  equipmentCode: string | null;
  /** 목록에 보일 한 줄. 무엇을 골랐는지 사람이 알아볼 수 있어야 한다. */
  label: string;
}

export interface BreakdownCandidateView {
  breakdownId: number;
  breakdownNo: string | null;
  equipmentId: number;
  equipmentCode: string | null;
  symptom: string;
  reportedAt: string;
}

export interface InspectionCandidateView {
  inspectionId: number;
  inspectionNo: string | null;
  equipmentId: number;
  equipmentCode: string | null;
  inspectionTypeCode: string;
  inspectedAt: string;
  inspectorWorkerNo: string;
}

export interface OrderView {
  maintenanceOrderId: number;
  maintenanceOrderNo: string | null;
  targetTypeCode: string;
  targetId: number;
  targetCode: string | null;
  maintenanceTypeCode: string;
  plannedDate: string;
  assigneeUserId: number | null;
  statusCode: string;
  itemCount: number;
  triggerCount: number;
}

export interface OrderListResult {
  items: OrderView[];
  page: PageMeta;
}

const nullable = <T>(value: T | null | undefined): T | null => value ?? null;

export const toBreakdownCandidate = (source: Breakdown): BreakdownCandidateView => ({
  breakdownId: source.breakdownId,
  breakdownNo: nullable(source.breakdownNo),
  equipmentId: source.equipmentId,
  equipmentCode: nullable(source.equipmentCode),
  symptom: source.symptom,
  reportedAt: source.reportedAt,
});

export const toInspectionCandidate = (source: Inspection): InspectionCandidateView => ({
  inspectionId: source.inspectionId,
  inspectionNo: nullable(source.inspectionNo),
  equipmentId: source.equipmentId,
  equipmentCode: nullable(source.equipmentCode),
  inspectionTypeCode: source.inspectionTypeCode,
  inspectedAt: source.inspectedAt,
  inspectorWorkerNo: source.inspectorWorkerNo,
});

export const toOrderView = (source: MaintenanceOrder): OrderView => ({
  maintenanceOrderId: source.maintenanceOrderId,
  maintenanceOrderNo: nullable(source.maintenanceOrderNo),
  targetTypeCode: source.targetTypeCode,
  targetId: source.targetId,
  targetCode: nullable(source.targetCode),
  maintenanceTypeCode: source.maintenanceTypeCode,
  plannedDate: source.plannedDate,
  assigneeUserId: nullable(source.assigneeUserId),
  statusCode: source.statusCode,
  itemCount: source.items?.length ?? 0,
  triggerCount: source.triggers?.length ?? 0,
});

const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/** 서버가 준 벽시계를 옮기지 않고 자른다. 알아볼 수 없으면 원문 그대로 낸다. */
export const formatMoment = (value: string): string => {
  const matched = RFC3339_PATTERN.exec(value);

  if (matched === null) return value;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};
