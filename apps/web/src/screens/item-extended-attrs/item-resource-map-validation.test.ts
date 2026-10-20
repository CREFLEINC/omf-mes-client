import { describe, expect, it } from 'vitest';

import { itemResourceMapFixtures } from './fixtures';
import {
  createItemResourceMapFormValues,
  type ItemResourceMapFormValues,
} from './item-resource-map-draft';
import {
  restateItemResourceMapApiError,
  restateItemResourceMapError,
  validateItemResourceMap,
} from './item-resource-map-validation';

const values = (overrides: Partial<ItemResourceMapFormValues> = {}): ItemResourceMapFormValues => ({
  ...createItemResourceMapFormValues(),
  ...overrides,
});

describe('validateItemResourceMap', () => {
  it('설비나 금형 중 하나가 있으면 통과한다', () => {
    expect(validateItemResourceMap(values({ equipmentId: '8003' }), [], null)).toEqual({});
    expect(validateItemResourceMap(values({ moldId: '8503' }), [], null)).toEqual({});
  });

  /* 서버가 같은 오류를 `equipmentId`에 붙인다 — 같은 칸을 짚어야 한다. */
  it('설비·금형이 둘 다 비면 설비 칸에 오류가 난다', () => {
    expect(validateItemResourceMap(values(), [], null)).toEqual({
      equipmentId: '설비나 금형 중 하나는 골라야 합니다.',
    });
  });

  it('우선순위는 비울 수 없고 0 이상의 정수여야 한다', () => {
    const base = { moldId: '8503' };

    expect(validateItemResourceMap(values({ ...base, priorityNo: '' }), [], null).priorityNo).toBe(
      '필수 입력 항목입니다.',
    );
    for (const bad of ['-1', '1.5', 'abc']) {
      expect(
        validateItemResourceMap(values({ ...base, priorityNo: bad }), [], null).priorityNo,
      ).toBe('0 이상의 정수로 입력하세요.');
    }
    expect(validateItemResourceMap(values({ ...base, priorityNo: '0' }), [], null)).toEqual({});
  });

  /* 유일 제약은 사용 중지한 줄도 센다 — 6003은 사용 중지한 줄이다. */
  it('사용 중지한 줄과 같은 조합도 중복이다', () => {
    const errors = validateItemResourceMap(
      values({ processId: '3001', equipmentId: '8002' }),
      itemResourceMapFixtures,
      null,
    );

    expect(errors.moldId).toMatch(/같은 공정·설비·금형 줄이 이미 있습니다/);
  });

  it('빈 공정끼리도 같은 조합으로 센다', () => {
    const errors = validateItemResourceMap(
      values({ moldId: '8502' }),
      itemResourceMapFixtures,
      null,
    );

    expect(errors.moldId).toBeDefined();
  });

  it('고치는 줄 자신은 중복으로 세지 않는다', () => {
    expect(
      validateItemResourceMap(values({ moldId: '8502' }), itemResourceMapFixtures, 6002),
    ).toEqual({});
  });
});

describe('restateItemResourceMapError', () => {
  it('설비·금형 누락과 중복을 화면의 말로 되말한다', () => {
    expect(
      restateItemResourceMapError({
        scope: 'field',
        field: 'equipmentId',
        code: 'REQUIRED',
        message: '서버 문구',
      }),
    ).toBe('설비나 금형 중 하나는 골라야 합니다.');
    expect(
      restateItemResourceMapError({
        scope: 'screen',
        code: 'UNIQUE_VIOLATION',
        message: '서버 문구',
      }),
    ).toMatch(/같은 공정·설비·금형 줄이 이미 있습니다/);
  });

  /* 서버가 중복을 화면 범위로 낸다 — 배너로 가는 오류도 화면의 말로 바뀌어야 한다. */
  it('배너로 가는 화면 범위 중복도 되말하고 나머지는 그대로 둔다', () => {
    const restated = restateItemResourceMapApiError({
      kind: 'validation',
      status: 400,
      errors: [
        { scope: 'screen', code: 'UNIQUE_VIOLATION', message: '서버 중복 문구' },
        { scope: 'screen', code: 'SOMETHING_ELSE', message: '서버 다른 문구' },
      ],
    });

    expect(restated).toMatchObject({
      kind: 'validation',
      status: 400,
      errors: [
        {
          code: 'UNIQUE_VIOLATION',
          message: expect.stringMatching(/같은 공정·설비·금형 줄이 이미 있습니다/),
        },
        { code: 'SOMETHING_ELSE', message: '서버 다른 문구' },
      ],
    });
    expect(restateItemResourceMapApiError(null)).toBeNull();
  });

  it('모르는 오류는 서버 문구를 그대로 둔다', () => {
    expect(
      restateItemResourceMapError({
        scope: 'field',
        field: 'equipmentId',
        code: 'INVALID',
        message: '이 공장의 설비가 아닙니다.',
      }),
    ).toBeUndefined();
  });
});
