import { messages } from '@omf-mes/i18n';

import type { HandoverTemplate, ZaloConnectionForward } from '@omf-mes/api-client';

const t = messages.zaloConnection.errors;

/** 기존 템플릿 칸과 같은 규칙(서버도 같은 규칙으로 400). */
const TEMPLATE_ID = /^[A-Za-z0-9]{1,40}$/;

/**
 * 인계 작업 템플릿 칸(피처 002, FR-022). 기존 6종 폼 값(`ConnectionFormValues`)과 따로 든다 —
 * 기존 저장 본문·검증은 그대로 두고 저장할 때 `handoverTemplates` 만 더한다.
 */
export type HandoverTemplateValues = Record<string, string>;

/** 병합 전 서버는 칸을 싣지 않는다 — 그때는 모두 빈 칸으로 본다. */
export const toHandoverValues = (
  connection: ZaloConnectionForward,
  order: readonly string[],
): HandoverTemplateValues => {
  const saved = new Map(
    (connection.handoverTemplates ?? []).map((item) => [item.alertTypeCode, item.templateId]),
  );
  return Object.fromEntries(order.map((code) => [code, saved.get(code) ?? '']));
};

/** 오류 키는 `handoverTemplates.<코드>`. */
export const validateHandover = (values: HandoverTemplateValues): Record<string, string> => {
  const errors: Record<string, string> = {};
  for (const [code, templateId] of Object.entries(values)) {
    const value = templateId.trim();
    if (value !== '' && !TEMPLATE_ID.test(value))
      errors[`handoverTemplates.${code}`] = t.templateId;
  }
  return errors;
};

export const toHandoverBody = (
  values: HandoverTemplateValues,
  order: readonly string[],
): HandoverTemplate[] =>
  order.map((alertTypeCode) => {
    const templateId = (values[alertTypeCode] ?? '').trim();
    return { alertTypeCode, templateId: templateId === '' ? null : templateId };
  });

export const sameHandover = (
  left: HandoverTemplateValues,
  right: HandoverTemplateValues,
): boolean =>
  Object.keys({ ...left, ...right }).every((code) => (left[code] ?? '') === (right[code] ?? ''));
