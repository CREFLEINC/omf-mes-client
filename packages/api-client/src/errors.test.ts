import { describe, expect, it } from 'vitest';

import { NETWORK_ERROR, isTransientStatus, isUnauthenticated, normalizeApiError } from './errors';

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

  /*
   * `ShipmentConflictResponse`·`StockReinstatementConflictResponse`도 `conflictCause`가
   * 필수가 됐다(통보 221). 이 함수는 응답 스키마 이름을 보지 않고 몸체 모양(`conflictCause`
   * 값)만 보므로 세 스키마 모두 같은 경로로 처리된다 — 세 값(user·erpSync·workerLease)이
   * 전부 다뤄지는지 여기서 함께 확인한다.
   */
  it.each(['user', 'erpSync', 'workerLease'] as const)(
    '409 + conflictCause=%s 는 그 원인 그대로 보존한다 — 통보 221',
    (cause) => {
      const result = normalizeApiError(409, { conflictCause: cause, message: '충돌' });

      expect(result).toEqual({ kind: 'conflict', cause, message: '충돌' });
    },
  );

  /*
   * ⭐ **원인과 코드는 다른 축이라 둘 다 남긴다.** `cause`는 「누가 먼저 손댔는가」이고
   * `code`는 「무엇이 어긋났는가」다. 서버가 공용 충돌 봉투에 둘을 함께 싣는데(통보 221)
   * 여기서 코드를 버리면 `ALREADY_REINSTATED`처럼 **다시 불러도 안 풀리는** 사유가
   * 「다른 사용자가 먼저 수정했습니다」로 안내되고, 사용자는 새로고침을 되풀이한다.
   */
  it('409에서 업무 코드를 원인과 «함께» 보존한다 — 통보 221·222', () => {
    expect(
      normalizeApiError(409, {
        code: 'ALREADY_REINSTATED',
        conflictCause: 'user',
        message: '이미 재등록된 건입니다',
      }),
    ).toEqual({
      kind: 'conflict',
      cause: 'user',
      code: 'ALREADY_REINSTATED',
      message: '이미 재등록된 건입니다',
    });
  });

  it('코드가 없는 충돌에는 code 키를 만들지 않는다', () => {
    expect(
      normalizeApiError(409, { conflictCause: 'workerLease', message: '충돌' }),
    ).not.toHaveProperty('code');
  });

  it('품질 충돌의 구조화된 현재 LOT 상태를 자유 문구와 분리해 보존한다', () => {
    expect(
      normalizeApiError(409, {
        conflictCause: 'user',
        currentLotStatusCode: 'DEFECTIVE',
        message: '합성 충돌 문구',
      }),
    ).toEqual({
      kind: 'conflict',
      cause: 'user',
      currentLotStatusCode: 'DEFECTIVE',
      message: '합성 충돌 문구',
    });
  });

  it('409인데 충돌 원인이 없으면 원인을 user로 두지 않고 http로 남긴다', () => {
    const result = normalizeApiError(409, {
      currentLotStatusCode: 'SCRAPPED',
      message: '중복',
    });
    expect(result).toEqual({
      kind: 'http',
      status: 409,
      message: '중복',
      currentLotStatusCode: 'SCRAPPED',
    });
  });

  it('업무 충돌의 구조화된 코드를 http 오류에 보존한다', () => {
    const result = normalizeApiError(409, {
      code: 'ALREADY_REINSTATED',
      message: '이미 재등록됐습니다.',
    });

    expect(result).toEqual({
      kind: 'http',
      status: 409,
      code: 'ALREADY_REINSTATED',
      message: '이미 재등록됐습니다.',
    });
  });

  it('STATE_LOCKED 오류는 상태 잠김으로 정규화한다 — 재로드해도 안 풀린다', () => {
    const result = normalizeApiError(400, {
      errors: [
        { scope: 'screen', code: 'STATE_LOCKED', message: '확정된 Rev는 수정할 수 없습니다' },
      ],
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

  /*
   * #789 — 봉투보다 상태 코드가 먼저다.
   *
   * 서버가 「잠시 뒤 풀린다」고 말한 실패를 계약 오류 봉투에 담아 보내도 `validation` 으로 접으면
   * 상태 코드가 버려지고, 오프라인 큐가 그것을 거부로 읽어 작업자가 친 값을 내린다.
   */
  it.each([500, 502, 503, 504, 429, 408])(
    '%i 은 계약 오류 봉투가 실려 와도 http 로 남기고 상태 코드를 보존한다',
    (status) => {
      const result = normalizeApiError(status, {
        errors: [{ scope: 'screen', code: 'UNAVAILABLE', message: '잠시 뒤 다시 시도하세요' }],
      });

      expect(result).toEqual({ kind: 'http', status });
    },
  );

  it('일시 상태에 STATE_LOCKED 가 실려 와도 상태 잠김으로 접지 않는다', () => {
    const result = normalizeApiError(503, {
      errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '합성 문구' }],
    });

    expect(result).toEqual({ kind: 'http', status: 503 });
  });

  /*
   * ⚠ 401은 이 목록에서 뺐다 — 대응표 P0 「세션 인증」으로 새로 갈렸다. 예전에는 401도 여느
   * 400과 같이 몸체 모양만 보고 `validation`으로 접었는데, 그러면 세션이 끊긴 것을 「입력을
   * 고치세요」로 안내하게 된다. 아래 `normalizeApiError — 401` 묶음이 바뀐 동작을 검증한다.
   */
  it.each([400, 403, 404, 413, 422, 423])(
    '계약이 오류 봉투를 두는 %i 의 validation 정규화는 그대로다',
    (status) => {
      const result = normalizeApiError(status, {
        errors: [{ scope: 'field', field: 'name', code: 'REQUIRED', message: '필수' }],
      });

      expect(result.kind).toBe('validation');
    },
  );

  it('http 정규화는 상태 코드를 보존한다', () => {
    const result = normalizeApiError(403, undefined);
    expect(result).toEqual({ kind: 'http', status: 403 });
  });

  it('계약 형태가 아닌 본문의 message를 http에 보존한다 — 서버가 준 유일한 단서를 버리지 않는다', () => {
    const result = normalizeApiError(500, { message: '일시적인 오류가 발생했습니다' });

    expect(result).toEqual({
      kind: 'http',
      status: 500,
      message: '일시적인 오류가 발생했습니다',
    });
  });

  it('message가 문자열이 아니면 http에 넣지 않는다 — 화면이 기본 문구를 쓰게 둔다', () => {
    const result = normalizeApiError(500, { message: { detail: '객체' } });

    expect(result.kind).toBe('http');
    if (result.kind === 'http') {
      expect(result.message).toBeUndefined();
    }
  });

  /*
   * 품질 조회 7건·출하 조회 5건이 원본 계약에 없던 400을 낼 수 있다(대응표 P0 「조회 오류
   * 봉투」 · 통보 074·186·201·219). 이 GET 오퍼레이션들도 쓰기 요청과 같은 `ErrorResponse`
   * (`errors[]`)를 쓰므로 위 400 validation 정규화가 그대로 적용된다 — 조회 전용 갈래를
   * 새로 만들 필요가 없다. 여기서는 그 전제(모양이 같다)가 깨지지 않는지만 확인한다.
   */
  it('조회(GET)의 400도 쓰기와 같은 ErrorResponse 모양이면 validation으로 남는다 — 통보 074·186·201·219', () => {
    const result = normalizeApiError(400, {
      errors: [
        { scope: 'screen', code: 'REQUIRED', field: 'shipDateFrom', message: '기간을 입력하세요' },
      ],
    });

    expect(result.kind).toBe('validation');
  });
});

/*
 * 401은 「세션이 끊겼다」는 별개의 사실이다(대응표 P0 「세션 인증」). 로그인 외 API가 세션
 * 쿠키 없이 불리면 이 갈래로 떨어져야 하고, `errors[]`를 가진 몸체라도 `validation`으로
 * 접히지 않아야 한다 — 화면이 「입력을 고치세요」를 잘못 안내하는 것을 막는다.
 */
describe('normalizeApiError — 401', () => {
  it('본문이 ErrorResponse(errors[]) 모양이어도 validation으로 접지 않고 http로 남긴다', () => {
    const result = normalizeApiError(401, {
      errors: [{ scope: 'screen', code: 'UNAUTHENTICATED', message: '로그인이 필요합니다' }],
    });

    expect(result).toEqual({ kind: 'http', status: 401, message: '로그인이 필요합니다' });
  });

  it('본문이 평문 {code, message} 모양이어도 http로 남긴다', () => {
    const result = normalizeApiError(401, {
      code: 'UNAUTHENTICATED',
      message: '로그인이 필요합니다',
    });

    expect(result).toEqual({
      kind: 'http',
      status: 401,
      code: 'UNAUTHENTICATED',
      message: '로그인이 필요합니다',
    });
  });

  it('메시지를 어디서도 못 찾으면 상태 코드만 남긴다', () => {
    const result = normalizeApiError(401, undefined);

    expect(result).toEqual({ kind: 'http', status: 401 });
  });
});

describe('isUnauthenticated', () => {
  it('401로 정규화된 http 오류를 세션 끊김으로 판정한다', () => {
    expect(isUnauthenticated(normalizeApiError(401, undefined))).toBe(true);
  });

  it('다른 http 상태 코드는 세션 끊김이 아니다', () => {
    expect(isUnauthenticated(normalizeApiError(403, undefined))).toBe(false);
  });

  it('http이 아닌 갈래는 세션 끊김이 아니다', () => {
    expect(isUnauthenticated(NETWORK_ERROR)).toBe(false);
    expect(isUnauthenticated(normalizeApiError(409, { conflictCause: 'user', message: '' }))).toBe(
      false,
    );
  });
});

describe('isTransientStatus — 기다리면 풀리는가', () => {
  it.each([500, 502, 503, 504, 599, 429, 408])('%i 은 기다리면 풀린다', (status) => {
    expect(isTransientStatus(status)).toBe(true);
  });

  it.each([400, 403, 404, 409, 422, 423, 499, 0])('%i 은 기다려도 풀리지 않는다', (status) => {
    expect(isTransientStatus(status)).toBe(false);
  });
});

describe('NETWORK_ERROR', () => {
  it('응답이 없는 실패를 나타내는 network 변형이다 — 상태 코드를 갖지 않는다', () => {
    expect(NETWORK_ERROR).toEqual({ kind: 'network' });
  });
});
