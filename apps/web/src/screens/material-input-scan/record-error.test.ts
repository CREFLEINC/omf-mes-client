import { normalizeApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { ApiRequestError } from '../../patterns/request';
import { describeRecordError } from './record-error';

describe('describeRecordError', () => {
  it('몸체 없는 403 은 권한 문구를 낸다', () => {
    expect(describeRecordError(new ApiRequestError({ kind: 'http', status: 403 }))).toBe(
      messages.httpError.forbidden,
    );
  });

  /* omf-all-around#242 — 실제 서버는 403 을 오류 봉투에 담아 보내 정규화가 validation 으로 접는다. */
  it('오류 봉투에 담긴 403 은 권한 문구 뒤에 서버 사유를 잇는다', () => {
    const error = new ApiRequestError(
      normalizeApiError(403, {
        errors: [
          { scope: 'screen', code: 'PERMISSION_DENIED', message: '이 기능을 쓸 권한이 없습니다.' },
        ],
      }),
      { httpStatus: 403 },
    );

    expect(describeRecordError(error)).toBe(
      `${messages.httpError.forbidden} 이 기능을 쓸 권한이 없습니다.`,
    );
  });

  it('403 이 아닌 검증 거부는 서버 문구를 그대로 낸다', () => {
    const error = new ApiRequestError(
      normalizeApiError(422, {
        errors: [{ scope: 'screen', code: 'BOM_MISMATCH', message: 'BOM 에 없는 자재입니다.' }],
      }),
    );

    expect(describeRecordError(error)).toBe('BOM 에 없는 자재입니다.');
  });

  it('US2-5 반제품 남은 수량 초과(409)는 남은·실적·이미 투입을 시안 문구로 말한다', () => {
    const error = new ApiRequestError(
      normalizeApiError(409, {
        errors: [
          {
            scope: 'field',
            field: 'inputQty',
            code: 'WIP_QTY_EXCEEDED',
            message: '남은 수량을 넘습니다 (남은 40)',
          },
        ],
        meta: { remainingQty: 40, producedQty: 100 },
      }),
    );

    expect(describeRecordError(error, 'EA')).toBe(
      '남은 수량(40 EA)보다 많이 넣었습니다. 실적 100 중 60 은 이미 투입했습니다.',
    );
    expect(describeRecordError(error)).toBe(
      '남은 수량(40)보다 많이 넣었습니다. 실적 100 중 60 은 이미 투입했습니다.',
    );
  });

  it('US2-3 반제품 400(다른 품목·앞 공정 아님)은 서버 문구를 그대로 낸다', () => {
    const error = new ApiRequestError(
      normalizeApiError(400, {
        errors: [
          { scope: 'field', field: 'lotId', code: 'INVALID', message: '다른 품목의 반제품입니다' },
        ],
      }),
    );

    expect(describeRecordError(error, 'EA')).toBe('다른 품목의 반제품입니다');
  });
});
