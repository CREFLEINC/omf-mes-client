import { messages } from '@omf-mes/i18n';

import type { Connection, ConnectionFormValues, ConnectionReplace, SaveSection } from './types';

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

/**
 * `base` 위에 `section` 의 칸만 `draft` 값으로 얹는다. 저장 본문(마지막 저장 값 + 이 단위의 고친 값),
 * 단위별 [변경 취소](고친 값 + 이 단위만 저장 값), 단위별 고침 여부에 함께 쓴다(#358).
 */
export const withSection = (
  base: ConnectionFormValues,
  draft: ConnectionFormValues,
  section: SaveSection,
): ConnectionFormValues => {
  switch (section.kind) {
    case 'connection':
      return {
        ...base,
        appId: draft.appId,
        secretKey: draft.secretKey,
        refreshToken: draft.refreshToken,
      };
    case 'common':
      return { ...base, paramMaxLength: draft.paramMaxLength };
    case 'event':
      return {
        ...base,
        templates: { ...base.templates, [section.code]: draft.templates[section.code] ?? '' },
      };
    case 'handover':
      return base;
  }
};

const keepEdited = <V>(draft: V, before: V, after: V): V => (draft === before ? after : draft);

/**
 * 한 단위를 저장한 뒤 — 저장한 단위는 새 저장 값으로, 다른 단위는 고친 칸만 그대로 두고 고치지 않은 칸은
 * 새 저장 값으로 바꾼다(고친 표시가 남고, 다음 저장은 새 값 · 새 ETag 위에 얹힌다).
 */
export const rebaseValues = (
  draft: ConnectionFormValues,
  before: ConnectionFormValues,
  after: ConnectionFormValues,
  saved: SaveSection,
): ConnectionFormValues =>
  withSection(
    {
      appId: keepEdited(draft.appId, before.appId, after.appId),
      secretKey: keepEdited(draft.secretKey, before.secretKey, after.secretKey),
      refreshToken: keepEdited(draft.refreshToken, before.refreshToken, after.refreshToken),
      paramMaxLength: keepEdited(draft.paramMaxLength, before.paramMaxLength, after.paramMaxLength),
      templates: Object.fromEntries(
        Object.entries(after.templates).map(([code, value]) => [
          code,
          keepEdited(draft.templates[code] ?? '', before.templates[code] ?? '', value),
        ]),
      ),
    },
    after,
    saved,
  );
