import { describe, expect, it } from 'vitest';

import {
  buildSessionEnd,
  isRetryableEndFailure,
  judgeSessionEnd,
  pickOwnOpenSession,
  type EndDecision,
} from './session';

/**
 * 작업 세션 자동 종료의 **판정**만 재는 시험.
 *
 * ⭐ **화면 시험으로는 이 자리를 지킬 수 없다.** 화면 쪽에서는 보호 장치를 지워도 전건이
 *    통과했다 — 통과의 근거가 「효과 의존성이 마운트 뒤 다시 안 바뀐다」는 우연이었기 때문이다
 *    (독립 검증 2026-09-16 뮤테이션 ④·⑤). 되돌릴 수 없는 전이를 여는 판정이라, 지우면 실제로
 *    실패하는 감지기가 있어야 한다.
 */

const base: EndDecision = {
  triggered: true,
  isFetching: false,
  hasLot: false,
  gate: 'allowed',
  hasSession: true,
  isSessionPending: false,
  hasWorkerNo: true,
};

describe('judgeSessionEnd', () => {
  it('마지막 LOT 을 마감하고 더 남지 않았으면 보낸다', () => {
    expect(judgeSessionEnd(base)).toBe('send');
  });

  /*
   * ⛔ **이 화면이 마감하지 않았으면 닫지 않는다.** 이미 다 돌린 작업지시를 «열어 보기만» 해도
   *    닫히면, 구경하던 단말이 남의 구간을 끊는다. 되돌릴 수 없다.
   */
  it('방아쇠가 없으면 LOT 이 비어 있어도 닫지 않는다', () => {
    expect(judgeSessionEnd({ ...base, triggered: false })).toBe('wait');
  });

  it('생산할 LOT 이 남아 있으면 닫지 않는다', () => {
    expect(judgeSessionEnd({ ...base, hasLot: true })).toBe('wait');
  });

  it('현재 LOT 을 다시 읽는 중이면 판정하지 않는다 — 그 구간에는 옛 값이 나온다', () => {
    expect(judgeSessionEnd({ ...base, isFetching: true, hasLot: true })).toBe('wait');
  });

  it('작업 완료 권한이 거부되면 닫지 않고 사유를 낸다', () => {
    expect(judgeSessionEnd({ ...base, gate: 'denied' })).toBe('denied');
  });

  /*
   * ⛔ **「모른다」를 「권한이 없다」로 말하지 않는다.** 조회 중·조회 실패·단말 미식별은 판정이
   *    아직 없는 상태다 — 한데 묶으면 권한 있는 단말에 「권한이 없습니다」가 뜬다.
   */
  it.each(['unavailable', 'unidentified'] as const)(
    '권한 판정이 %s 면 「권한 없음」이 아니라 「못 닫았다」다',
    (gate) => {
      expect(judgeSessionEnd({ ...base, gate })).toBe('unknown');
    },
  );

  /* 아직 판정 중이면 기다린다 — 곧 셋 중 하나로 정해진다. */
  it('권한을 확인하는 중이면 기다린다', () => {
    expect(judgeSessionEnd({ ...base, gate: 'checking' })).toBe('wait');
  });

  /*
   * ⛔ **단말을 모르면 세션 조회가 «아예 돌지 않는다».** 그때 「곧 온다」로 읽으면 판정이 영원히
   *    기다림에 갇혀 요청도 배너도 없이 방아쇠만 남는다(리뷰 지적 ①). 권한 축이 먼저 서서
   *    「못 닫았다」로 떨어져야 한다.
   */
  it('단말 미식별이면 세션 조회가 안 돌아도 「못 닫았다」로 떨어진다', () => {
    expect(
      judgeSessionEnd({ ...base, gate: 'unidentified', hasSession: false, isSessionPending: true }),
    ).toBe('unknown');
  });

  /*
   * ⛔ **답을 기다리는 중에는 「없다」로 읽지 않는다.** 잠시 뒤 도착할 세션을 두고 「못 닫았다」가
   *    먼저 뜨면, 작업자는 멀쩡한 흐름에서 실패를 본다.
   */
  it('세션 조회가 아직 답을 주지 않았으면 기다린다', () => {
    expect(judgeSessionEnd({ ...base, hasSession: false, isSessionPending: true })).toBe('wait');
  });

  /*
   * ⭐ **닫아야 하는데 닫을 것을 모르면 «말한다».** 조용히 넘어가면 작업자는 닫힌 줄 알고,
   *    관리웹의 W/O 마감은 계속 막힌다(독립 검증 지적 ②).
   */
  it('세션을 끝내 찾지 못했으면 조용히 넘어가지 않고 「못 닫았다」로 낸다', () => {
    expect(judgeSessionEnd({ ...base, hasSession: false })).toBe('unknown');
  });

  it('사번이 없으면 보내지 않는다 — 서버가 귀속 헤더 없이는 거부한다', () => {
    expect(judgeSessionEnd({ ...base, hasWorkerNo: false })).toBe('unknown');
  });
});

describe('pickOwnOpenSession', () => {
  const session = (over: Partial<Parameters<typeof pickOwnOpenSession>[0][number]>) => ({
    workSessionId: 1,
    workOrderId: 701,
    sessionNo: 1,
    terminalId: 10,
    startedAt: '2026-09-16T09:00:00+09:00',
    statusCode: 'RUNNING',
    ...over,
  });

  /*
   * ⛔ **옆 단말의 구간을 끊지 않는다.** 한 작업지시를 여러 단말이 나눠 돌 수 있는데, 단말로
   *    좁히지 않으면 «더 늦게 시작한» 남의 세션이 닫힌다 — 그쪽은 작업 중이고, 내 세션은 열린
   *    채 남아 W/O 마감도 여전히 막힌다(독립 검증 지적 ①).
   */
  it('다른 단말의 세션이 더 늦게 시작했어도 내 단말 것을 고른다', () => {
    const picked = pickOwnOpenSession(
      [
        session({ workSessionId: 100, terminalId: 10, startedAt: '2026-09-16T09:00:00+09:00' }),
        session({ workSessionId: 200, terminalId: 11, startedAt: '2026-09-16T09:30:00+09:00' }),
      ],
      10,
    );

    expect(picked?.workSessionId).toBe(100);
  });

  /*
   * ⛔ **중단해 둔 세션을 닫지 않는다.** 설계가 「진행 중 세션만 종료 대상」으로 좁혔다
   *    (`P-02-10` §3). 중단은 작업자가 일부러 건 상태인데 끝 시각이 비어 있어 「열린 세션」으로도
   *    잡힌다 — 상태를 안 보면 그 자리를 말없이 닫는다(리뷰 지적 ④).
   */
  it('중단 중인 세션은 고르지 않는다', () => {
    expect(pickOwnOpenSession([session({ statusCode: 'STOPPED' })], 10)).toBeNull();
  });

  it('내 단말의 열린 세션이 없으면 아무것도 고르지 않는다', () => {
    expect(pickOwnOpenSession([session({ terminalId: 11 })], 10)).toBeNull();
  });

  /*
   * ⛔ **「비어 있다」가 세 모양으로 온다.** 계약 타입은 칸이 빠진 모양만 말하는데 실제 서버와
   *    목은 `null` 을 명시해 보낸다 — 놓치면 열린 세션이 통째로 걸러져 «닫을 것이 없다»가 된다.
   *    타입 검사로는 드러나지 않아 화면이 조용히 멈췄다(브라우저 실측 2026-09-16).
   */
  it('끝 시각이 null 이면 열린 세션이다', () => {
    const picked = pickOwnOpenSession(
      [session({ workSessionId: 100, endedAt: null as unknown as undefined })],
      10,
    );

    expect(picked?.workSessionId).toBe(100);
  });

  it('이미 닫힌 세션은 고르지 않는다', () => {
    const picked = pickOwnOpenSession(
      [session({ workSessionId: 100, endedAt: '2026-09-16T10:00:00+09:00' })],
      10,
    );

    expect(picked).toBeNull();
  });

  /*
   * ⛔ **시각을 사전순으로 비교하지 않는다.** 오프셋이 섞이면(`+09:00` 과 `Z`) 사전순과 시간순이
   *    갈린다 — `2026-09-16T01:00:00Z`(=10:00 KST)가 `2026-09-16T09:00:00+09:00` 보다 «뒤»인데,
   *    글자로 재면 앞선다.
   */
  it('오프셋이 섞여도 실제로 늦게 시작한 것을 고른다', () => {
    const picked = pickOwnOpenSession(
      [
        session({ workSessionId: 100, startedAt: '2026-09-16T09:00:00+09:00' }),
        session({ workSessionId: 200, startedAt: '2026-09-16T01:00:00Z' }),
      ],
      10,
    );

    expect(picked?.workSessionId).toBe(200);
  });
});

describe('buildSessionEnd', () => {
  /*
   * ⛔ **`stopReasonCode` 를 싣지 않는다** — 계약이 「비우기로 정했다」로 못박은 칸이다
   *    (공유계약 A-21 · A-25). 자리가 있다고 채우면 정한 것을 화면이 되돌린다.
   */
  it('본문은 끝 시각 하나뿐이다', () => {
    const body = buildSessionEnd(new Date('2026-09-16T10:00:00+09:00'));

    expect(Object.keys(body)).toEqual(['endedAt']);
    expect(body.endedAt).toBe('2026-09-16T01:00:00.000Z');
  });
});

/*
 * ⛔ **다시 보내도 같은 답이 오는 실패에는 [다시 시도] 를 내지 않는다.** 재시도는 같은 본문·같은
 *    멱등 키로 같은 요청을 보내므로, 서버가 상태·권한·대상 때문에 거절한 것이면 몇 번을 눌러도
 *    같다 — 작업자는 될 때까지 누르고 정작 해야 할 일을 하지 않는다(리뷰 지적 ②).
 */
describe('isRetryableEndFailure', () => {
  it('연결이 끊긴 실패는 다시 보낼 값이 있다', () => {
    expect(isRetryableEndFailure({ kind: 'network' })).toBe(true);
  });

  it('서버가 잠시 넘어진 것도 다시 보낼 값이 있다', () => {
    expect(isRetryableEndFailure({ kind: 'http', status: 503 })).toBe(true);
  });

  it.each([
    ['상태 잠김', { kind: 'stateLocked' as const, errors: [], status: 400 }],
    ['충돌', { kind: 'conflict' as const, cause: 'user' as const, message: '', status: 409 }],
    ['없는 대상', { kind: 'http' as const, status: 404 }],
    ['권한 거부', { kind: 'http' as const, status: 403 }],
    ['검증 실패', { kind: 'validation' as const, errors: [], status: 400 }],
  ])('%s 는 다시 보내도 같다', (_label, error) => {
    expect(isRetryableEndFailure(error)).toBe(false);
  });

  it('오류가 없으면 재시도 대상도 아니다', () => {
    expect(isRetryableEndFailure(null)).toBe(false);
  });
});
