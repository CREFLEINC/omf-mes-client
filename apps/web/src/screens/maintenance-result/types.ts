import type { components } from '@omf-mes/api-client';

/**
 * W-05-06이 다루는 모양들.
 *
 * ⛔ **이 화면은 물건을 움직이지 않는다.** 예비품 줄은 **이미 만들어진 출고 건을 가리키기만**
 * 하고, 재고를 깎는 것은 물류의 일이다. 그래서 예비품 줄에 「출고를 만들 값」이 없다.
 *
 * ⛔ **누계 리셋을 다루지 않는다.** 계약의 실적 본문에 그 칸이 있지만 툴 예방보전 실적
 * (W-05-03)의 몫이다 — 여기서 함께 다루면 낙관적 잠금이 필요한 쓰기와 아닌 쓰기가 한 폼에 섞인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type MaintenanceResult = components['schemas']['MaintenanceResult'];

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

/** 이 화면이 다루는 대상은 설비다 — 툴 실적은 카디널리티와 잠금이 달라 다른 화면이다. */
export const EQUIPMENT_TARGET = 'EQUIPMENT';

export interface ResultPartView {
  sparePartId: number;
  /** 계약이 선택으로 두었다 — 오지 않으면 `null`이고 표는 내부 번호를 대신 그리지 않는다. */
  partName: string | null;
  usedQty: number;
  goodsIssueId: number | null;
  goodsIssueNo: string | null;
  issuedAt: string | null;
  uomCode: string | null;
}

export interface ResultView {
  maintenanceResultId: number;
  maintenanceOrderId: number | null;
  breakdownId: number | null;
  targetTypeCode: string;
  targetId: number;
  startedAt: string;
  finishedAt: string | null;
  resultNote: string;
  performedByUserId: number | null;
  isOutsourced: boolean;
  outsourceVendorName: string | null;
  closed: boolean;
  parts: ResultPartView[];
}

export interface ResultListResult {
  items: ResultView[];
  page: PageMeta;
}

const nullable = <T>(value: T | null | undefined): T | null => value ?? null;

export const toResultView = (source: MaintenanceResult): ResultView => ({
  maintenanceResultId: source.maintenanceResultId,
  maintenanceOrderId: nullable(source.maintenanceOrderId),
  breakdownId: nullable(source.breakdownId),
  targetTypeCode: source.targetTypeCode,
  targetId: source.targetId,
  startedAt: source.startedAt,
  finishedAt: nullable(source.finishedAt),
  resultNote: source.resultNote,
  performedByUserId: nullable(source.performedByUserId),
  isOutsourced: source.isOutsourced ?? false,
  outsourceVendorName: nullable(source.outsourceVendorName),
  closed: source.closed ?? false,
  parts: (source.parts ?? []).map((part) => ({
    sparePartId: part.sparePartId,
    partName: nullable(part.partName),
    usedQty: part.usedQty,
    goodsIssueId: nullable(part.goodsIssueId),
    goodsIssueNo: nullable(part.goodsIssueNo),
    issuedAt: nullable(part.issuedAt),
    uomCode: nullable(part.uomCode),
  })),
});

const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/** 서버가 준 벽시계를 옮기지 않고 자른다. 알아볼 수 없으면 원문 그대로 낸다. */
export const formatMoment = (value: string): string => {
  const matched = RFC3339_PATTERN.exec(value);

  if (matched === null) return value;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};
