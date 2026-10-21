import { messages } from '@omf-mes/i18n';

import type { Connection, ConnectionFormValues, ConnectionReplace } from './types';

const t = messages.zaloConnection.errors;

const APP_ID = /^[0-9]{1,40}$/;
const TEMPLATE_ID = /^[A-Za-z0-9]{1,40}$/;
const INTEGER = /^[0-9]+$/;
/** 서버 계약(P-96)의 상한 — 비밀 키 200자, 갱신 토큰 2000자. */
const SECRET_KEY_MAX = 200;
const REFRESH_TOKEN_MAX = 2000;

export const toFormValues = (connection: Connection): ConnectionFormValues => ({
  appId: connection.appId ?? '',
  secretKey: null,
  refreshToken: null,
  paramMaxLength: String(connection.paramMaxLength),
  templates: Object.fromEntries(
    connection.templates.map((item) => [item.eventCode, item.templateId ?? '']),
  ),
});

const secretError = (value: string | null, max: number): string | undefined => {
  if (value === null) return undefined;
  if (value === '') return t.secretRequired;
  return value.length > max ? t.secretTooLong(max) : undefined;
};

/** 화면 검증 — 서버도 같은 규칙으로 400 을 낸다. 키는 계약 칸 이름(템플릿은 `templates.<코드>`). */
export const validateConnection = (values: ConnectionFormValues): Record<string, string> => {
  const errors: Record<string, string> = {};
  const appId = values.appId.trim();
  if (appId !== '' && !APP_ID.test(appId)) errors.appId = t.appId;

  const secretKey = secretError(values.secretKey, SECRET_KEY_MAX);
  if (secretKey !== undefined) errors.secretKey = secretKey;
  const refreshToken = secretError(values.refreshToken, REFRESH_TOKEN_MAX);
  if (refreshToken !== undefined) errors.refreshToken = refreshToken;

  const length = values.paramMaxLength.trim();
  if (!INTEGER.test(length) || Number(length) < 20 || Number(length) > 400) {
    errors.paramMaxLength = t.paramMaxLength;
  }

  for (const [eventCode, templateId] of Object.entries(values.templates)) {
    const value = templateId.trim();
    if (value !== '' && !TEMPLATE_ID.test(value)) errors[`templates.${eventCode}`] = t.templateId;
  }

  return errors;
};

/**
 * 저장 본문. ⭐ **비밀값은 [바꾸기]를 연 때만 싣는다** — 생략은 「유지」다. 비운 채 싣으면
 * 서버가 400 으로 막고, 실수로 다른 값이 실리면 연결이 끊긴다.
 */
export const toReplaceBody = (
  values: ConnectionFormValues,
  eventOrder: readonly string[],
): ConnectionReplace => ({
  appId: values.appId.trim() === '' ? null : values.appId.trim(),
  ...(values.secretKey === null ? {} : { secretKey: values.secretKey }),
  ...(values.refreshToken === null ? {} : { refreshToken: values.refreshToken }),
  paramMaxLength: Number(values.paramMaxLength.trim()),
  templates: eventOrder.map((eventCode) => {
    const templateId = (values.templates[eventCode] ?? '').trim();
    return { eventCode, templateId: templateId === '' ? null : templateId };
  }),
});

export const sameValues = (left: ConnectionFormValues, right: ConnectionFormValues): boolean =>
  left.appId === right.appId &&
  left.secretKey === right.secretKey &&
  left.refreshToken === right.refreshToken &&
  left.paramMaxLength === right.paramMaxLength &&
  Object.keys({ ...left.templates, ...right.templates }).every(
    (code) => (left.templates[code] ?? '') === (right.templates[code] ?? ''),
  );
