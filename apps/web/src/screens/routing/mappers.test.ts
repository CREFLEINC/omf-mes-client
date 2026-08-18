import { describe, expect, it } from 'vitest';

import { routingFixtures } from './fixtures';
import {
  emptyHeaderFormValues,
  isSameHeaderValues,
  routingToFormValues,
  toRoutingCreate,
  toRoutingUpdate,
} from './mappers';
import type { Routing } from './types';

const draftRevision = routingFixtures[0] as Routing;
const confirmedRevision = routingFixtures[1] as Routing;

describe('routingToFormValues', () => {
  it('응답 값을 폼 값으로 옮긴다', () => {
    expect(routingToFormValues(confirmedRevision)).toEqual({
      routingCode: 'STANDARD',
      effectiveFrom: '2026-02-01',
      effectiveTo: '2026-02-28',
    });
  });

  it('유효종료가 널이면 빈 문자열로 모은다 — 입력칸의 「없음」이 하나의 값이어야 한다', () => {
    expect(routingToFormValues(draftRevision).effectiveTo).toBe('');
  });

  it('유효종료 키 자체가 없어도 빈 문자열이 된다', () => {
    const { effectiveTo: _ignored, ...withoutEffectiveTo } = draftRevision;

    expect(routingToFormValues(withoutEffectiveTo).effectiveTo).toBe('');
  });

  /*
   * 계약이 유효시작을 선택으로 풀었다(#201 과 같은 리비전) — 화면은 아직 필수로 막지만
   * 응답에는 키가 없을 수 있다. 널·없음을 빈 문자열로 모으지 않으면 undefined 가 입력칸으로 새어
   * 제어 컴포넌트가 비제어로 바뀐다.
   */
  it('유효시작 키 자체가 없어도 빈 문자열이 된다', () => {
    const { effectiveFrom: _ignored, ...withoutEffectiveFrom } = draftRevision;

    expect(routingToFormValues(withoutEffectiveFrom).effectiveFrom).toBe('');
  });

  it('유효시작이 없는 응답에서도 폼 값에 undefined 가 하나도 없다', () => {
    const { effectiveFrom: _ignored, ...withoutEffectiveFrom } = draftRevision;
    const values = routingToFormValues(withoutEffectiveFrom);

    expect(values.routingCode).toBe(draftRevision.routingCode);
    expect(Object.values(values).some((value) => value === undefined)).toBe(false);
  });
});

describe('toRoutingUpdate', () => {
  it('앞뒤 공백이 붙은 코드를 다듬어 보낸다 — 눈으로 구분되지 않는 다른 코드가 된다', () => {
    const body = toRoutingUpdate({
      routingCode: '  STANDARD  ',
      effectiveFrom: '2026-02-01',
      effectiveTo: '2026-02-28',
    });

    expect(body.routingCode).toBe('STANDARD');
  });

  it('비운 유효종료는 널로 되돌린다', () => {
    const body = toRoutingUpdate({
      routingCode: 'STANDARD',
      effectiveFrom: '2026-02-01',
      effectiveTo: '',
    });

    expect(body.effectiveTo).toBeNull();
  });

  /*
   * 품목은 신규만, 판 번호는 시스템 채번, 상태는 전이 전용이다.
   * 실어 보내면 계약 위반이며 서버가 거부한다.
   */
  it('요청 본문에 품목·판 번호·상태를 싣지 않는다', () => {
    const body = toRoutingUpdate(routingToFormValues(confirmedRevision));

    expect(Object.keys(body).sort()).toEqual(['effectiveFrom', 'effectiveTo', 'routingCode']);
  });
});

describe('emptyHeaderFormValues', () => {
  it('빈 폼은 모든 칸이 빈 문자열이다', () => {
    expect(emptyHeaderFormValues()).toEqual({
      routingCode: '',
      effectiveFrom: '',
      effectiveTo: '',
    });
  });
});

describe('isSameHeaderValues', () => {
  it('같은 값이면 참, 한 칸이라도 다르면 거짓이다', () => {
    const values = routingToFormValues(confirmedRevision);

    expect(isSameHeaderValues(values, { ...values })).toBe(true);
    expect(isSameHeaderValues(values, { ...values, effectiveTo: '' })).toBe(false);
    expect(isSameHeaderValues(values, { ...values, routingCode: 'OTHER' })).toBe(false);
  });
});

describe('toRoutingCreate', () => {
  it('수정 본문에 품목만 더한다 — 판 번호와 상태는 서버가 채운다', () => {
    const body = toRoutingCreate(
      { routingCode: ' STANDARD ', effectiveFrom: '2026-03-01', effectiveTo: '' },
      5001,
    );

    expect(body).toEqual({
      itemId: 5001,
      routingCode: 'STANDARD',
      effectiveFrom: '2026-03-01',
      effectiveTo: null,
    });
  });

  /* 판 번호·상태를 실어 보내면 계약 위반이다 — 키가 늘면 이 단언이 먼저 깨진다. */
  it('본문 키가 정확히 넷이다', () => {
    const body = toRoutingCreate(
      { routingCode: 'STANDARD', effectiveFrom: '2026-03-01', effectiveTo: '2026-03-31' },
      5001,
    );

    expect(Object.keys(body).sort()).toEqual([
      'effectiveFrom',
      'effectiveTo',
      'itemId',
      'routingCode',
    ]);
  });
});
