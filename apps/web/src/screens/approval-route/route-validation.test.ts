import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { DuplicateCheck } from './duplicate-check';
import {
  ROUTE_FORM_FIELDS,
  activateBlockedReason,
  parseRangeValue,
  saveBlockedReason,
  validateRouteForm,
} from './route-validation';
import type { RouteFormValues } from './types';

const t = messages.approvalRoute;

const values = (overrides: Partial<RouteFormValues> = {}): RouteFormValues => ({
  approvalTypeCode: 'GOODS_ISSUE_DISPOSAL',
  businessUnitId: '9101',
  minValue: '',
  maxValue: '',
  ...overrides,
});

const CLEAR: DuplicateCheck = { kind: 'clear' };
const BLOCKED: DuplicateCheck = { kind: 'blocked', existingCount: 1, existingRouteId: 9001 };
const UNKNOWN: DuplicateCheck = { kind: 'unknown', reason: 'loading' };

describe('parseRangeValue — 세 갈래', () => {
  it.each(['', '   '])('빈 칸 「%s」은 오류가 아니라 비움이다', (raw) => {
    expect(parseRangeValue(raw)).toEqual({ kind: 'empty' });
  });

  it.each(['abc', 'Infinity', '-Infinity', '.', '1,000', '1 2'])(
    '숫자가 아닌 「%s」는 형식 오류다',
    (raw) => {
      expect(parseRangeValue(raw)).toEqual({ kind: 'invalid' });
    },
  );

  /** 0은 값이다. `??`가 아니라 `||`로 줄이면 여기서 「없음」이 된다. */
  it('0은 비움이 아니라 값이다', () => {
    expect(parseRangeValue('0')).toEqual({ kind: 'number', value: 0 });
  });

  it('음수와 소수도 값이다 — 계약에 하한이 없다', () => {
    expect(parseRangeValue('-5')).toEqual({ kind: 'number', value: -5 });
    expect(parseRangeValue('1.5')).toEqual({ kind: 'number', value: 1.5 });
  });

  it('앞뒤 공백을 턴 값으로 읽는다', () => {
    expect(parseRangeValue('  100  ')).toEqual({ kind: 'number', value: 100 });
  });
});

describe('validateRouteForm — 승인 유형', () => {
  it('등록에서 승인 유형은 필수다', () => {
    expect(validateRouteForm(values({ approvalTypeCode: '' }), 'create').approvalTypeCode).toBe(
      t.validation.approvalTypeRequired,
    );
  });

  /**
   * **목이 공백만인 유형을 201로 받는다**(계약에 `minLength`가 없다 — 계획 §6.3).
   * 막는 곳이 화면뿐이라 이 감지기가 그 자리를 고정한다.
   */
  it('공백만인 승인 유형은 등록할 수 없다', () => {
    expect(validateRouteForm(values({ approvalTypeCode: '   ' }), 'create').approvalTypeCode).toBe(
      t.validation.approvalTypeRequired,
    );
  });

  /** 계약의 수정 본문에 승인 유형이 없다 — 검사할 대상 자체가 없다. */
  it('수정에서는 승인 유형을 검사하지 않는다', () => {
    expect(validateRouteForm(values({ approvalTypeCode: '' }), 'edit')).toEqual({});
  });

  it('승인 유형이 있으면 오류가 없다', () => {
    expect(validateRouteForm(values(), 'create')).toEqual({});
  });
});

describe('validateRouteForm — 값 구간', () => {
  it('한쪽만 있는 구간은 정상이다', () => {
    expect(validateRouteForm(values({ minValue: '100' }), 'edit')).toEqual({});
    expect(validateRouteForm(values({ maxValue: '100' }), 'edit')).toEqual({});
  });

  it('둘 다 있고 상한이 하한보다 작으면 상한 칸에 오류가 선다', () => {
    expect(validateRouteForm(values({ minValue: '500', maxValue: '100' }), 'edit')).toEqual({
      maxValue: t.validation.maxLessThanMin,
    });
  });

  it('상한과 하한이 같으면 정상이다 — 계약이 max >= min을 검사한다', () => {
    expect(validateRouteForm(values({ minValue: '100', maxValue: '100' }), 'edit')).toEqual({});
  });

  /**
   * **한쪽만 있을 때는 비교하지 않는다.** 비교하면 비어 있는 쪽이 `0`으로 읽혀
   * 「100 이상」이 「상한 0보다 크다」로 판정된다.
   */
  it('하한만 있고 상한이 비었으면 비교하지 않는다', () => {
    expect(validateRouteForm(values({ minValue: '500', maxValue: '' }), 'edit')).toEqual({});
  });

  it('숫자가 아닌 값은 각 칸에 형식 오류를 낸다', () => {
    expect(validateRouteForm(values({ minValue: 'abc', maxValue: 'Infinity' }), 'edit')).toEqual({
      minValue: t.validation.valueNotNumber,
      maxValue: t.validation.valueNotNumber,
    });
  });

  /** 형식 오류가 짝 제약보다 앞선다 — 읽을 수 없는 값끼리 비교해 봐야 뜻이 없다. */
  it('상한이 숫자가 아니면 짝 제약 오류로 덮지 않는다', () => {
    expect(validateRouteForm(values({ minValue: '100', maxValue: 'abc' }), 'edit')).toEqual({
      maxValue: t.validation.valueNotNumber,
    });
  });
});

describe('ROUTE_FORM_FIELDS', () => {
  /**
   * **입력칸이 있는 필드 이름만 담는다.** 입력칸 없는 이름을 채우면 그 서버 오류가
   * 인라인으로 흘러가 어디에도 보이지 않는다.
   */
  it('폼에 입력칸이 있는 넷만 담는다', () => {
    expect([...ROUTE_FORM_FIELDS]).toEqual([
      'approvalTypeCode',
      'businessUnitId',
      'minValue',
      'maxValue',
    ]);
  });

  it('사용 여부·단계는 폼 필드가 아니다', () => {
    expect(ROUTE_FORM_FIELDS).not.toContain('isActive');
    expect(ROUTE_FORM_FIELDS).not.toContain('steps');
  });
});

describe('saveBlockedReason — 등록', () => {
  it('승인 유형 선택지가 비어 있으면 등록이 막히고 사유가 나온다', () => {
    expect(
      saveBlockedReason({
        mode: 'create',
        values: values({ approvalTypeCode: '' }),
        approvalTypeOptionCount: 0,
        isDirty: true,
        duplicate: CLEAR,
      }),
    ).toBe(t.actionReasons.createPendingCode);
  });

  /**
   * **선택지 배열이 차면 등록이 열린다.** 잠금을 상수로 굳히면 값 목록이 확정돼도
   * 화면이 살아나지 않는다 — `code-options.ts`의 배열만 채우면 되는 상태를 여기서 고정한다.
   */
  it('선택지가 차고 유형을 고르면 등록이 열린다', () => {
    expect(
      saveBlockedReason({
        mode: 'create',
        values: values(),
        approvalTypeOptionCount: 2,
        isDirty: true,
        duplicate: CLEAR,
      }),
    ).toBeNull();
  });

  it('선택지가 차 있어도 유형을 고르지 않으면 막힌다', () => {
    expect(
      saveBlockedReason({
        mode: 'create',
        values: values({ approvalTypeCode: '' }),
        approvalTypeOptionCount: 2,
        isDirty: true,
        duplicate: CLEAR,
      }),
    ).toBe(t.actionReasons.createNoType);
  });

  /** 등록은 고친 것이 없어도 열린다 — 유형만 고르면 만들 수 있는 자원이다. */
  it('등록은 고친 것이 없어도 막히지 않는다', () => {
    expect(
      saveBlockedReason({
        mode: 'create',
        values: values(),
        approvalTypeOptionCount: 2,
        isDirty: false,
        duplicate: CLEAR,
      }),
    ).toBeNull();
  });
});

describe('saveBlockedReason — 수정', () => {
  it('고친 것이 없으면 저장이 막힌다', () => {
    expect(
      saveBlockedReason({
        mode: 'edit',
        values: values(),
        approvalTypeOptionCount: 0,
        isDirty: false,
        duplicate: CLEAR,
      }),
    ).toBe(t.actionReasons.saveNoChanges);
  });

  /** 값 목록 미확정은 **등록만** 막는다 — 수정 본문에 승인 유형이 없다. */
  it('승인 유형 선택지가 비어 있어도 수정은 열린다', () => {
    expect(
      saveBlockedReason({
        mode: 'edit',
        values: values(),
        approvalTypeOptionCount: 0,
        isDirty: true,
        duplicate: CLEAR,
      }),
    ).toBeNull();
  });
});

describe('saveBlockedReason — 활성 중복', () => {
  it('활성 중복이면 등록·수정이 모두 막힌다', () => {
    for (const mode of ['create', 'edit'] as const) {
      expect(
        saveBlockedReason({
          mode,
          values: values(),
          approvalTypeOptionCount: 2,
          isDirty: true,
          duplicate: BLOCKED,
        }),
      ).toBe(t.actionReasons.duplicateActive);
    }
  });

  /** 판정하지 못한 것은 막을 근거가 아니다 — 서버가 400으로 다시 검사한다. */
  it('판정하지 못했으면 막지 않는다', () => {
    expect(
      saveBlockedReason({
        mode: 'edit',
        values: values(),
        approvalTypeOptionCount: 2,
        isDirty: true,
        duplicate: UNKNOWN,
      }),
    ).toBeNull();
  });
});

describe('activateBlockedReason', () => {
  it('단계가 0이면 다시 사용이 막힌다', () => {
    expect(activateBlockedReason({ stepCount: 0, duplicate: CLEAR })).toBe(
      t.actionReasons.activateNoSteps,
    );
  });

  it('활성 중복이면 다시 사용이 막힌다', () => {
    expect(activateBlockedReason({ stepCount: 2, duplicate: BLOCKED })).toBe(
      t.actionReasons.activateDuplicate,
    );
  });

  /** 둘 다 걸리면 단계 0을 먼저 낸다 — 그것이 사용자가 먼저 해야 할 일이다. */
  it('둘 다 걸리면 단계 0 사유를 먼저 낸다', () => {
    expect(activateBlockedReason({ stepCount: 0, duplicate: BLOCKED })).toBe(
      t.actionReasons.activateNoSteps,
    );
  });

  it('단계가 있고 중복이 없으면 열린다', () => {
    expect(activateBlockedReason({ stepCount: 1, duplicate: CLEAR })).toBeNull();
  });

  it('판정하지 못했으면 막지 않는다', () => {
    expect(activateBlockedReason({ stepCount: 1, duplicate: UNKNOWN })).toBeNull();
  });
});
