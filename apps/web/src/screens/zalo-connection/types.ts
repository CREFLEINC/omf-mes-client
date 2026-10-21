import type { ZaloConnection, ZaloConnectionReplace } from '@omf-mes/api-client';

/** W-CO-12 알림 연결 설정. api-client 는 `import type` 으로만 참조한다. */
export type Connection = ZaloConnection;
export type ConnectionReplace = ZaloConnectionReplace;

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
