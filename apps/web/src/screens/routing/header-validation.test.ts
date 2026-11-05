import { describe, expect, it } from 'vitest';

import { validateRoutingHeader } from './header-validation';
import type { RoutingHeaderFormValues } from './types';

const VALID: RoutingHeaderFormValues = {
  routingCode: 'STANDARD',
  effectiveFrom: '2026-02-01',
  effectiveTo: '2026-02-28',
};

describe('validateRoutingHeader', () => {
  it('정상 값은 오류를 내지 않는다', () => {
    expect(validateRoutingHeader(VALID)).toEqual({});
  });

  it('Routing 코드가 비면 필수 오류를 낸다', () => {
    expect(validateRoutingHeader({ ...VALID, routingCode: '' }).routingCode).toBe(
      '필수 입력 항목입니다.',
    );
  });

  it('Routing 코드가 공백만이면 공백 오류를 낸다 — 비어 있는 것과 다른 실수다', () => {
    expect(validateRoutingHeader({ ...VALID, routingCode: '   ' }).routingCode).toBe(
      'Routing 코드는 공백만으로 지정할 수 없습니다.',
    );
  });

  /* 유효 시작일 · 종료일은 화면에서 받지 않는다 — 검사하지 않는다(#231). */
  it('날짜는 비어 있거나 순서가 뒤바뀌어도 오류를 내지 않는다', () => {
    expect(validateRoutingHeader({ ...VALID, effectiveFrom: '', effectiveTo: '' })).toEqual({});
    expect(
      validateRoutingHeader({ ...VALID, effectiveFrom: '2026-03-01', effectiveTo: '2026-02-28' }),
    ).toEqual({});
  });
});
