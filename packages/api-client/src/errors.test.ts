import { describe, expect, it } from 'vitest';

import { normalizeApiError } from './errors';

describe('normalizeApiError', () => {
  it('409 + ConflictResponse는 저장 충돌로 정규화한다 — 재로드하면 풀린다', () => {
    const result = normalizeApiError(409, {
      conflictCause: 'erpSync',
      message: 'ERP 재동기화로 원본이 갱신됐습니다',
    });
    expect(result).toEqual({
      kind: 'conflict',
      cause: 'erpSync',
      message: 'ERP 재동기화로 원본이 갱신됐습니다',
    });
  });

  it('409인데 충돌 원인이 없으면 원인을 user로 두지 않고 http로 남긴다', () => {
    const result = normalizeApiError(409, { message: '중복' });
    expect(result.kind).toBe('http');
  });

  it('STATE_LOCKED 오류는 상태 잠김으로 정규화한다 — 재로드해도 안 풀린다', () => {
    const result = normalizeApiError(400, {
      errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '확정된 Rev는 수정할 수 없습니다' }],
    });
    expect(result.kind).toBe('stateLocked');
    if (result.kind === 'stateLocked') {
      expect(result.errors[0]?.message).toBe('확정된 Rev는 수정할 수 없습니다');
    }
  });

  it('필드 오류 목록은 validation으로 정규화하고 scope·field를 보존한다', () => {
    const result = normalizeApiError(400, {
      errors: [
        {
          scope: 'field',
          field: 'warehouseCode',
          code: 'UNIQUE_VIOLATION',
          message: '같은 공장에 이미 있는 창고코드입니다',
          uniqueScope: ['plantId', 'warehouseCode'],
        },
      ],
    });
    expect(result.kind).toBe('validation');
    if (result.kind === 'validation') {
      expect(result.errors[0]?.scope).toBe('field');
      expect(result.errors[0]?.field).toBe('warehouseCode');
      expect(result.errors[0]?.uniqueScope).toEqual(['plantId', 'warehouseCode']);
    }
  });

  it('STATE_LOCKED가 다른 오류와 섞여 있어도 상태 잠김이 우선한다', () => {
    const result = normalizeApiError(400, {
      errors: [
        { scope: 'field', field: 'name', code: 'REQUIRED', message: '필수' },
        { scope: 'screen', code: 'STATE_LOCKED', message: '폐기된 항목입니다' },
      ],
    });
    expect(result.kind).toBe('stateLocked');
  });

  it('오류 본문이 계약 형태가 아니면 http로 남긴다', () => {
    expect(normalizeApiError(500, undefined).kind).toBe('http');
    expect(normalizeApiError(500, 'Internal Server Error').kind).toBe('http');
    expect(normalizeApiError(404, { detail: 'not found' }).kind).toBe('http');
  });

  it('http 정규화는 상태 코드를 보존한다', () => {
    const result = normalizeApiError(403, undefined);
    expect(result).toEqual({ kind: 'http', status: 403 });
  });
});
