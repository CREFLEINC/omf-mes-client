import type { components } from '@omf-mes/api-client';

type ZaloConnectionForward = components['schemas']['ZaloConnection'];
type ZaloConnectionReplaceForward = components['schemas']['ZaloConnectionReplace'];

/**
 * W-CO-12 알림 연결 설정. api-client 는 `import type` 으로만 참조한다.
 * 인계 템플릿 칸(`handoverTemplates`, 피처 002)은 서버 병합 전까지 덧댄 타입이다.
 */
export type Connection = ZaloConnectionForward;
export type ConnectionReplace = ZaloConnectionReplaceForward;

/**
 * 폼 값. 비밀값은 `null` 이면 「바꾸지 않음」이다 — 원문은 다시 내려오지 않으므로(FR-028)
 * [바꾸기]를 연 때만 문자열이 되고, 그때만 본문에 실린다.
 */
export interface ConnectionFormValues {
  appId: string;
  secretKey: string | null;
  refreshToken: string | null;
  paramMaxLength: string;
  /** 이벤트 코드 → 템플릿 ID. 비우면 미설정(null) */
  templates: Record<string, string>;
}

/**
 * 저장 단위 — 고치는 상자마다 따로 저장한다(#358). 본문은 늘 전체(PUT)지만, 마지막 저장 값 위에 이 단위의
 * 고친 값만 얹는다 — 다른 상자의 저장 안 한 값은 실리지 않는다.
 */
export type SaveSection =
  | { kind: 'connection' }
  | { kind: 'common' }
  | { kind: 'event'; code: string }
  | { kind: 'handover'; code: string };
