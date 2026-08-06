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

  it('유효시작이 비면 필수 오류를 낸다', () => {
    expect(validateRoutingHeader({ ...VALID, effectiveFrom: '' }).effectiveFrom).toBe(
      '필수 입력 항목입니다.',
    );
  });

  /*
   * 짝 제약이라 한쪽만 표시하면 어느 쪽을 고쳐야 하는지 알 수 없다 — 두 칸 모두에 낸다.
   */
  it('유효종료가 유효시작보다 빠르면 두 칸 모두에 오류를 낸다', () => {
    const errors = validateRoutingHeader({
      ...VALID,
      effectiveFrom: '2026-03-01',
      effectiveTo: '2026-02-28',
    });

    expect(errors.effectiveFrom).toBe('유효종료는 유효시작과 같거나 그 뒤여야 합니다.');
    expect(errors.effectiveTo).toBe('유효종료는 유효시작과 같거나 그 뒤여야 합니다.');
  });

  it('같은 날짜는 허용한다 — 계약이 「이상」으로 정했다', () => {
    expect(
      validateRoutingHeader({ ...VALID, effectiveFrom: '2026-02-01', effectiveTo: '2026-02-01' }),
    ).toEqual({});
  });

  it('유효종료를 비우면 짝 제약을 보지 않는다', () => {
    expect(validateRoutingHeader({ ...VALID, effectiveTo: '' })).toEqual({});
  });

  it('유효시작이 비어 있으면 짝 제약 대신 필수 오류만 낸다', () => {
    const errors = validateRoutingHeader({
      ...VALID,
      effectiveFrom: '',
      effectiveTo: '2026-02-28',
    });

    expect(errors.effectiveFrom).toBe('필수 입력 항목입니다.');
    expect(errors.effectiveTo).toBeUndefined();
  });
});
