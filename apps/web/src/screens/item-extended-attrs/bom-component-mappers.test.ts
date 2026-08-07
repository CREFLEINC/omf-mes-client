import { describe, expect, it } from 'vitest';

import {
  BOM_COMPONENT_FORM_FIELDS,
  componentToFormValues,
  isSameBomComponentValues,
  toBomComponentUpdate,
  type BomComponentFormValues,
} from './bom-component-mappers';
import { bomComponentFixtures } from './fixtures';

const values = (overrides: Partial<BomComponentFormValues> = {}): BomComponentFormValues => ({
  routingOperationId: '8002',
  actualUseProcessId: '3001',
  lotTraceRequired: true,
  backflushAllowed: true,
  ...overrides,
});

describe('componentToFormValues', () => {
  it('확장 열 넷만 폼으로 옮긴다', () => {
    expect(componentToFormValues(bomComponentFixtures[0]!)).toEqual({
      routingOperationId: '8002',
      actualUseProcessId: '3001',
      lotTraceRequired: true,
      backflushAllowed: true,
    });
  });

  /* 「지정하지 않음」이 하나의 값이어야 한다 — 널과 없음을 같은 빈 문자열로 모은다. */
  it('널 공정을 빈 문자열로 모은다', () => {
    expect(componentToFormValues(bomComponentFixtures[1]!)).toEqual({
      routingOperationId: '',
      actualUseProcessId: '',
      lotTraceRequired: false,
      backflushAllowed: false,
    });
  });

  /**
   * **폼에 원본 열이 없다.** 담지 않으면 실수로도 요청 본문에 실을 수 없다 —
   * 서버가 그 경계를 막지 않으므로(실측 P) 형태가 방어다.
   */
  it('원본 열을 폼에 담지 않는다', () => {
    const form = componentToFormValues(bomComponentFixtures[0]!);

    for (const key of [
      'bomComponentId',
      'bomId',
      'componentItemId',
      'requiredQty',
      'uomId',
      'scrapRate',
      'isMandatory',
      'sequenceNo',
    ]) {
      expect(form).not.toHaveProperty(key);
    }
  });
});

/**
 * C14 — **저장 본문의 키 집합이 정확히 확장 4키다.**
 *
 * 계약의 `BomComponentUpdate`가 `additionalProperties: false`를 두지 않아 원본 열을 섞어
 * 보내도 서버가 200을 준다(실측 P). 이 자리가 유일한 방어다.
 */
describe('toBomComponentUpdate', () => {
  it('키 집합이 정확히 넷이다', () => {
    expect(Object.keys(toBomComponentUpdate(values())).sort()).toEqual([
      'actualUseProcessId',
      'backflushAllowed',
      'lotTraceRequired',
      'routingOperationId',
    ]);
  });

  it('고른 공정을 숫자로 싣는다', () => {
    expect(toBomComponentUpdate(values())).toEqual({
      routingOperationId: 8002,
      actualUseProcessId: 3001,
      lotTraceRequired: true,
      backflushAllowed: true,
    });
  });

  /**
   * **키를 빼지 않고 널을 명시한다.** 키를 빼면 서버가 이전 값을 남길 수 있어
   * 한 번 넣은 공정을 지울 방법이 사라진다.
   */
  it('비운 공정을 널로 명시해 싣는다', () => {
    const body = toBomComponentUpdate(values({ routingOperationId: '', actualUseProcessId: '' }));

    expect(body.routingOperationId).toBeNull();
    expect(body.actualUseProcessId).toBeNull();
    expect(Object.keys(body)).toHaveLength(4);
  });

  it('꺼진 확장 표시를 거짓으로 싣는다', () => {
    const body = toBomComponentUpdate(values({ lotTraceRequired: false, backflushAllowed: false }));

    expect(body.lotTraceRequired).toBe(false);
    expect(body.backflushAllowed).toBe(false);
  });

  /* 폼에 무엇이 더해지든 본문은 넷뿐이어야 한다 — 스프레드로 만들면 여기서 잡힌다. */
  it('폼에 없는 키가 섞여 들어와도 본문에 실리지 않는다', () => {
    const polluted = { ...values(), requiredQty: 9999, sequenceNo: 42 } as BomComponentFormValues;

    expect(Object.keys(toBomComponentUpdate(polluted)).sort()).toEqual([
      'actualUseProcessId',
      'backflushAllowed',
      'lotTraceRequired',
      'routingOperationId',
    ]);
  });
});

describe('BOM_COMPONENT_FORM_FIELDS', () => {
  /* 화면이 아는 필드가 아니면 서버 오류가 배너로 올라간다 — 본문의 키와 어긋나면 안 된다. */
  it('본문 키와 같은 집합이다', () => {
    expect([...BOM_COMPONENT_FORM_FIELDS].sort()).toEqual(
      Object.keys(toBomComponentUpdate(values())).sort(),
    );
  });
});

describe('isSameBomComponentValues', () => {
  it('같은 값이면 참이다', () => {
    expect(isSameBomComponentValues(values(), values())).toBe(true);
  });

  it.each([
    ['routingOperationId', values({ routingOperationId: '8001' })],
    ['actualUseProcessId', values({ actualUseProcessId: '' })],
    ['lotTraceRequired', values({ lotTraceRequired: false })],
    ['backflushAllowed', values({ backflushAllowed: false })],
  ])('%s 가 달라지면 거짓이다', (_field, next) => {
    expect(isSameBomComponentValues(values(), next)).toBe(false);
  });
});
