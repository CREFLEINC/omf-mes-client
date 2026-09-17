import { describe, expect, it } from 'vitest';

import { ApiRequestError } from '../../patterns/request';

import { toAddBoxRejection } from './add-box-rejection';

/**
 * 상자 등록 실패를 가르는 감지기.
 *
 * ⭐ **이 갈래가 없으면 화면이 다섯 사유를 하나로 뭉갠다.** 검사 여섯이 세 종류 코드로 겹치기
 *    때문이다 — 「마감된 단위」와 「포장 안 된 상자」가 둘 다 `STATE_LOCKED` 다. `field` 를
 *    함께 봐야 갈린다(통합 담당 확정 2026-09-16).
 *
 * ⛔ **모르는 사유를 다섯 중 하나로 접지 않는다.** 엉뚱한 안내는 담당에게 **할 수 없는 조치**를
 *    되풀이하게 만든다.
 */

const locked = (errors: { code?: string; field?: string; message?: string }[], status = 409) =>
  new ApiRequestError(
    { kind: 'stateLocked', status, errors: errors as never },
    { httpStatus: status },
  );

const invalid = (errors: { code?: string; field?: string; message?: string }[], status = 400) =>
  new ApiRequestError(
    { kind: 'validation', status, errors: errors as never },
    { httpStatus: status },
  );

describe('상자 등록 실패 가르기', () => {
  it.each([
    ['마감된 단위', 'STATE_LOCKED', 'shippingUnitId', 'unitClosed'],
    ['취소된 출하', 'STATE_LOCKED', 'shipmentId', 'shipmentCancelled'],
    ['포장이 끝나지 않은 상자', 'STATE_LOCKED', 'handlingUnitNo', 'notPacked'],
  ])('%s — %s / %s', (_what, code, field, kind) => {
    expect(toAddBoxRejection(locked([{ code, field }]))).toEqual({ kind });
  });

  it.each([
    ['포장 실적이 없는 상자', 'INVALID', 'handlingUnitNo', 'noAllocation'],
    ['다른 출하의 상자', 'PAIR', 'handlingUnitNo', 'otherShipment'],
    ['이미 다른 단위에 든 상자', 'UNIQUE_VIOLATION', 'handlingUnitNo', 'alreadyAssigned'],
  ])('%s — %s / %s', (_what, code, field, kind) => {
    expect(toAddBoxRejection(invalid([{ code, field }]))).toEqual({ kind });
  });

  /*
   * ⛔⛔ **같은 코드가 자리에 따라 다른 뜻이다.** 이 한 쌍이 `field` 를 보는 까닭이다 —
   *    `code` 만 보면 담당에게 「마감됐습니다」라고 말하고, 담당은 멀쩡한 단위를 새로 만든다.
   */
  it('같은 `STATE_LOCKED` 라도 자리가 다르면 다른 사유다', () => {
    const unit = toAddBoxRejection(locked([{ code: 'STATE_LOCKED', field: 'shippingUnitId' }]));
    const box = toAddBoxRejection(locked([{ code: 'STATE_LOCKED', field: 'handlingUnitNo' }]));

    expect(unit).not.toEqual(box);
  });

  it('없는 상자는 상태로 가른다', () => {
    expect(toAddBoxRejection(locked([], 404))).toEqual({ kind: 'notFound' });
  });

  /*
   * ⚠ **첫 건을 그냥 집지 않는다.** 서버가 여러 건을 실을 수 있고 아는 짝이 뒤에 올 수 있다 —
   *   첫 건만 보면 아는 사유를 놓치고 「모름」으로 떨어진다.
   */
  it('아는 짝이 뒤에 있어도 찾아낸다', () => {
    const rejection = toAddBoxRejection(
      locked([
        { code: 'SOMETHING_ELSE', field: 'other' },
        { code: 'UNIQUE_VIOLATION', field: 'handlingUnitNo' },
      ]),
    );

    expect(rejection).toEqual({ kind: 'alreadyAssigned' });
  });

  it('모르는 짝은 모른다고 하고 서버가 준 말을 남긴다', () => {
    const rejection = toAddBoxRejection(
      locked([{ code: 'NEW_RULE', field: 'handlingUnitNo', message: '아직 모르는 규칙입니다' }]),
    );

    expect(rejection).toEqual({ kind: 'unknown', message: '아직 모르는 규칙입니다' });
  });

  it('코드가 맞아도 자리가 다르면 접지 않는다', () => {
    expect(toAddBoxRejection(invalid([{ code: 'PAIR', field: 'somethingElse' }]))).toMatchObject({
      kind: 'unknown',
    });
  });

  it('계약 봉투가 아니면 서버 말만 남긴다', () => {
    const rejection = toAddBoxRejection(
      new ApiRequestError({ kind: 'http', status: 500, message: '서버 오류' }, { httpStatus: 500 }),
    );

    expect(rejection).toEqual({ kind: 'unknown', message: '서버 오류' });
  });

  it('우리가 만든 오류가 아니면 모른다고 한다', () => {
    expect(toAddBoxRejection(new Error('그냥 오류'))).toEqual({ kind: 'unknown', message: null });
  });

  it('빈 말을 사유로 삼지 않는다', () => {
    const rejection = toAddBoxRejection(locked([{ code: 'NEW_RULE', field: 'x', message: '   ' }]));

    expect(rejection).toEqual({ kind: 'unknown', message: null });
  });
});
