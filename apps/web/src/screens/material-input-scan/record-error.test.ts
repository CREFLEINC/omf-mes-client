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
});
