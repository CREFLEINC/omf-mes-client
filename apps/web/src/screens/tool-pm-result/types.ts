import type { components } from '@omf-mes/api-client';

/**
 * W-05-03이 다루는 모양들.
 *
 * ⭐ **리셋 직전 누계는 서버가 얼린다.** 화면은 그 값을 **읽기만** 한다 — 「이번 예방보전까지
 * 얼마나 썼는지」가 수명 분석의 유일한 재료이고, 화면이 보내면 서버 값과 갈릴 수 있다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type MaintenanceResult = components['schemas']['MaintenanceResult'];
type Mold = components['schemas']['Mold'];

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

export interface ToolView {
  moldId: number;
  moldCode: string;
  moldName: string;
  currentShotCount: number;
  /** 없으면 예방보전이 돌지 않는다 — ⛔ 0으로 채우지 않는다. */
  guaranteedShotCount: number | null;
}

export interface ToolResultView {
  maintenanceResultId: number;
  maintenanceOrderId: number | null;
  startedAt: string;
  finishedAt: string | null;
  resultNote: string;
  resetCounter: boolean;
  /** 서버가 얼린 값. 화면은 읽기만 한다. */
  shotCountBeforeReset: number | null;
  shotCountAfterReset: number | null;
  closed: boolean;
}

export interface ToolResultListResult {
  items: ToolResultView[];
  page: PageMeta;
}

const nullable = <T>(value: T | null | undefined): T | null => value ?? null;

export const toToolView = (source: Mold): ToolView => ({
  moldId: source.moldId,
  moldCode: source.moldCode,
  moldName: source.moldName,
  currentShotCount: source.currentShotCount,
  guaranteedShotCount: nullable(source.guaranteedShotCount),
});

export const toToolResultView = (source: MaintenanceResult): ToolResultView => ({
  maintenanceResultId: source.maintenanceResultId,
  maintenanceOrderId: nullable(source.maintenanceOrderId),
  startedAt: source.startedAt,
  finishedAt: nullable(source.finishedAt),
  resultNote: source.resultNote,
  resetCounter: source.resetCounter ?? false,
  shotCountBeforeReset: nullable(source.shotCountBeforeReset),
  shotCountAfterReset: nullable(source.shotCountAfterReset),
  closed: source.closed ?? false,
});

const groupThousands = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const formatCount = (value: number): string => groupThousands(String(Math.round(value)));

const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/** 서버가 준 벽시계를 옮기지 않고 자른다. 알아볼 수 없으면 원문 그대로 낸다. */
export const formatMoment = (value: string): string => {
  const matched = RFC3339_PATTERN.exec(value);

  if (matched === null) return value;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};
