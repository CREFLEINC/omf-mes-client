import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  codeLabel,
  codeListNote,
  DEFAULT_EXCEPTION_TYPE,
  defaultExceptionType,
  EXCEPTION_TYPE_GROUP,
  SUBSTITUTE_LOT_REASON_GROUP,
  toCodeOptions,
} from './code-options';
import { exceptionTypeFixtures } from './fixtures';

const t = messages.overReceiptSplit;

describe('toCodeOptions — 코드 사전을 선택지로', () => {
  it('쓰는 값만 표시 순서대로, 이름으로 낸다', () => {
    expect(toCodeOptions(exceptionTypeFixtures)).toEqual([
      { value: 'CUSTOMER_SUPPLY', label: '고객 사급' },
      { value: 'OVER_DELIVERY', label: '초과입하' },
    ]);
  });

  it('아직 받지 못했으면 비어 있다', () => {
    expect(toCodeOptions(undefined)).toEqual([]);
  });
});

describe('defaultExceptionType — 초과분의 기본 예외 유형', () => {
  it('초과입하가 목록에 있으면 그것이다', () => {
    expect(defaultExceptionType(toCodeOptions(exceptionTypeFixtures))).toBe(DEFAULT_EXCEPTION_TYPE);
  });

  /* 없는 코드를 보내면 400 이다 — 목록에 없으면 기본값을 두지 않는다. */
  it('목록에 없으면 비운다', () => {
    expect(defaultExceptionType([{ value: 'CUSTOMER_SUPPLY', label: '고객 사급' }])).toBe('');
    expect(defaultExceptionType([])).toBe('');
  });
});

describe('codeListNote — 선택지가 비어 있는 까닭', () => {
  it('불러오는 중 · 실패 · 값 없음을 가른다', () => {
    expect(codeListNote([], 'loading')).toBe(t.loading.codes);
    expect(codeListNote([], 'failed')).toBe(t.filters.lookupFailed);
    expect(codeListNote([], 'ready')).toBe(messages.pendingCode.note);
  });

  it('선택지가 있으면 안내가 없다', () => {
    expect(codeListNote(toCodeOptions(exceptionTypeFixtures), 'ready')).toBeUndefined();
  });
});

describe('codeLabel', () => {
  it('목록에 있으면 이름, 없으면 코드 그대로', () => {
    const options = toCodeOptions(exceptionTypeFixtures);

    expect(codeLabel(options, 'OVER_DELIVERY')).toBe('초과입하');
    expect(codeLabel(options, 'UNKNOWN_CODE')).toBe('UNKNOWN_CODE');
  });
});

describe('코드 그룹 — 채번 식별자가 아니라 그룹 코드로 부른다', () => {
  it('두 그룹 코드가 계약의 이름이다', () => {
    expect(EXCEPTION_TYPE_GROUP).toBe('INBOUND_RECEIPT_EXCEPTION_TYPE');
    expect(SUBSTITUTE_LOT_REASON_GROUP).toBe('SUBSTITUTE_LOT_REASON');
  });
});
