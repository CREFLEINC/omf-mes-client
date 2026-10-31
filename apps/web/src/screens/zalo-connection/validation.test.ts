import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { paramsOf } from './template-params';
import type { ConnectionFormValues } from './types';
import { sameValues, toFormValues, toReplaceBody, validateConnection } from './validation';

const t = messages.zaloConnection.errors;

const values = (overrides: Partial<ConnectionFormValues> = {}): ConnectionFormValues => ({
  appId: '1234567890',
  secretKey: null,
  refreshToken: null,
  paramMaxLength: '100',
  templates: { WORK_SESSION_STARTED: 'TPL01', WORK_ORDER_CLOSED: '' },
  ...overrides,
});

describe('toFormValues', () => {
  it('비밀값은 「바꾸지 않음」(null)으로 두고 템플릿은 코드별 문자열로 든다', () => {
    expect(
      toFormValues({
        appId: null,
        secretKeySet: true,
        refreshTokenSet: false,
        status: 'NOT_CONFIGURED',
        accessTokenExpiresAt: null,
        lastRefreshedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        paramMaxLength: 100,
        templates: [{ eventCode: 'WORK_ORDER_CLOSED', templateId: null }],
        deliveryEnabled: true,
        handoverTemplates: [],
      }),
    ).toEqual({
      appId: '',
      secretKey: null,
      refreshToken: null,
      paramMaxLength: '100',
      templates: { WORK_ORDER_CLOSED: '' },
    });
  });
});

describe('validateConnection', () => {
  it('상한 그 자체는 허용한다 — 비밀 키 200자, 갱신 토큰 2000자(서버 계약)', () => {
    expect(
      validateConnection(values({ secretKey: 'x'.repeat(200), refreshToken: 'x'.repeat(2000) })),
    ).toEqual({});
  });

  it('맞는 값이면 오류가 없다 — 앱 ID 와 템플릿은 비워 둘 수 있다', () => {
    expect(validateConnection(values())).toEqual({});
    expect(validateConnection(values({ appId: '' }))).toEqual({});
  });

  it.each([
    ['앱 ID 숫자 아님', { appId: '12ab' }, 'appId', t.appId],
    ['앱 ID 41자', { appId: '1'.repeat(41) }, 'appId', t.appId],
    ['비밀 키를 열고 비움', { secretKey: '' }, 'secretKey', t.secretRequired],
    ['비밀 키 201자', { secretKey: 'x'.repeat(201) }, 'secretKey', t.secretTooLong(200)],
    ['갱신 토큰 2001자', { refreshToken: 'x'.repeat(2001) }, 'refreshToken', t.secretTooLong(2000)],
    ['길이 19', { paramMaxLength: '19' }, 'paramMaxLength', t.paramMaxLength],
    ['길이 401', { paramMaxLength: '401' }, 'paramMaxLength', t.paramMaxLength],
    ['길이 소수', { paramMaxLength: '20.5' }, 'paramMaxLength', t.paramMaxLength],
    [
      '템플릿 특수문자',
      { templates: { WORK_ORDER_CLOSED: 'TPL-1' } },
      'templates.WORK_ORDER_CLOSED',
      t.templateId,
    ],
  ] as const)('%s 는 그 칸의 오류다', (_label, patch, key, message) => {
    expect(validateConnection(values(patch as Partial<ConnectionFormValues>))).toEqual({
      [key]: message,
    });
  });
});

describe('toReplaceBody', () => {
  const ORDER = ['WORK_SESSION_STARTED', 'WORK_ORDER_CLOSED'];

  it('US7-1 비밀값을 바꾸지 않으면 키 자체를 싣지 않는다 — 생략은 「유지」다', () => {
    const body = toReplaceBody(values(), ORDER);

    expect('secretKey' in body).toBe(false);
    expect('refreshToken' in body).toBe(false);
    expect(body).toEqual({
      appId: '1234567890',
      paramMaxLength: 100,
      templates: [
        { eventCode: 'WORK_SESSION_STARTED', templateId: 'TPL01' },
        { eventCode: 'WORK_ORDER_CLOSED', templateId: null },
      ],
    });
  });

  it('US7-1 바꾸기를 열고 넣은 비밀값만 싣는다', () => {
    const body = toReplaceBody(values({ secretKey: 'sk', refreshToken: 'rt' }), ORDER);

    expect(body.secretKey).toBe('sk');
    expect(body.refreshToken).toBe('rt');
  });

  it('비운 앱 ID 는 null 이다', () => {
    expect(toReplaceBody(values({ appId: '  ' }), ORDER).appId).toBeNull();
  });
});

describe('sameValues', () => {
  it('템플릿 하나만 달라도 다르다', () => {
    expect(sameValues(values(), values())).toBe(true);
    expect(
      sameValues(
        values(),
        values({ templates: { WORK_SESSION_STARTED: 'TPL02', WORK_ORDER_CLOSED: '' } }),
      ),
    ).toBe(false);
  });
});

describe('paramsOf', () => {
  it('이벤트별 고정 파라미터 이름에 공통 두 칸이 붙는다', () => {
    expect(paramsOf('WORK_SESSION_STOPPED')).toBe(
      'wo_no, item, process, line, reason, event_time, actor',
    );
  });
});
