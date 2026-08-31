import type { components } from '@omf-mes/api-client';

import { ALL_CLOSED, FLAG_KEYS, type FlagKey } from './flags';

/**
 * W-CO-06 이 다루는 모양들.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Terminal = components['schemas']['Terminal'];
type TerminalProcess = components['schemas']['TerminalProcess'];
type TerminalRegistrationToken = components['schemas']['TerminalRegistrationToken'];

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

export interface TerminalView {
  terminalId: number;
  terminalCode: string;
  plantId: number;
  terminalTypeCode: string;
  statusCode: string;
  isActive: boolean;
  equipmentId: number | null;
  /** 설비 코드·이름은 짝이다 — 헤더가 「코드 · 이름」으로 그리므로 함께 내려온다. */
  equipmentLabel: string | null;
  /**
   * 재발급 세대. 계약이 「재발급마다 서버가 +1 하고 이전 토큰을 거부한다」로 둔다 —
   * 화면은 읽지도 보내지도 않지만, 재발급 경고 문구가 이 사실 위에 서 있다.
   */
  tokenVersion: number | null;
}

export interface ProcessRowView extends Record<FlagKey, boolean> {
  processId: number;
  processName: string;
}

export interface TerminalListResult {
  items: TerminalView[];
  page: PageMeta;
}

export interface TokenView {
  token: string;
  issuedAt: string;
  expiresAt: string | null;
}

const nullable = <T>(value: T | null | undefined): T | null => value ?? null;

const equipmentLabelOf = (source: Terminal): string | null => {
  const code = nullable(source.equipmentCode);
  const name = nullable(source.equipmentName);

  if (code === null && name === null) return null;
  if (code === null) return name;
  if (name === null) return code;

  return `${code} · ${name}`;
};

export const toTerminalView = (source: Terminal): TerminalView => ({
  terminalId: source.terminalId,
  terminalCode: source.terminalCode,
  plantId: source.plantId,
  terminalTypeCode: source.terminalTypeCode,
  statusCode: source.statusCode,
  isActive: source.isActive,
  equipmentId: nullable(source.equipmentId),
  equipmentLabel: equipmentLabelOf(source),
  tokenVersion: nullable(source.tokenVersion),
});

/** 응답에 없는 플래그는 **닫힘**으로 읽는다 — 없는 것을 열린 것으로 읽지 않는다. */
export const toProcessRowView = (source: TerminalProcess): ProcessRowView => {
  const row = {
    processId: source.processId,
    processName: source.processName ?? String(source.processId),
    ...ALL_CLOSED,
  };

  for (const key of FLAG_KEYS) row[key] = source[key] ?? false;

  return row;
};

export const toTokenView = (source: TerminalRegistrationToken): TokenView => ({
  token: source.token,
  issuedAt: source.issuedAt,
  expiresAt: nullable(source.expiresAt),
});

const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/** 서버가 준 벽시계를 옮기지 않고 자른다. 알아볼 수 없으면 원문 그대로 낸다. */
export const formatMoment = (value: string): string => {
  const matched = RFC3339_PATTERN.exec(value);

  if (matched === null) return value;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};
