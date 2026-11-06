import { normalizeApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { forbiddenLines } from './forbidden-lines';

const contract = (message: string) =>
  normalizeApiError(403, { errors: [{ scope: 'screen', code: 'PERMISSION_DENIED', message }] });

describe('forbiddenLines', () => {
  it('몸체 없는 403 은 권한 문구 한 줄이다', () => {
    expect(forbiddenLines({ kind: 'http', status: 403 })).toEqual([messages.httpError.forbidden]);
  });

  it('봉투에 사유가 있으면 둘째 줄로 덧붙인다', () => {
    expect(forbiddenLines(contract('승인자도 상신자도 아닙니다.'))).toEqual([
      messages.httpError.forbidden,
      '승인자도 상신자도 아닙니다.',
    ]);
  });

  it('사유가 비었거나 공용 문구와 같으면 한 줄만 낸다', () => {
    expect(forbiddenLines(contract('  '))).toEqual([messages.httpError.forbidden]);
    expect(forbiddenLines(contract(messages.httpError.forbidden))).toEqual([
      messages.httpError.forbidden,
    ]);
  });
});
