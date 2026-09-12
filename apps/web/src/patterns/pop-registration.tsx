import type { ApiClient } from '@omf-mes/api-client';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { useApiClient } from './api-context';
import { PopIdentityProvider } from './pop-identity';
import {
  currentTerminalToken,
  discardStoredTerminalToken,
  setCandidateTerminalToken,
  writeTerminalToken,
} from './pop-terminal-token';
import { ApiRequestError, runRequest, toApiError } from './request';
import { useWorkerSession } from './worker-session';

/**
 * POP 단말 등록 — **셸 선행 상태 A**(P-CO-01 §3-A · 공유계약 F-4).
 *
 * ## 어떻게 토큰이 단말에 들어오는가
 *
 * 관리웹이 발급 대화상자에서 **POP 에는 토큰 필드·복사 버튼**으로 한 번 내주고, 설치
 * 담당자가 그것을 이 패널에 **붙여넣는다**(F-4 · 요청 #536 반영 2026-09-10). 모바일만 QR 을
 * 읽는다 — POP 패널 PC 에는 카메라가 없다. 긴 토큰 수기 입력·짧은 등록코드 교환 API 는
 * 채택되지 않았다. 대화상자를 닫으면 재조회가 없으므로 **잃어버리면 재발급**이다.
 *
 * ## 왜 입력과 검증을 가르는가
 *
 * 토큰의 `sub` 는 단말 번호(`terminalId`)다. 그런데 **붙여넣은 값은 아직 아무것도 증명하지
 * 않는다** — 셸은 최초 조회 주소를 만들기 위해서만 그것을 읽고, 신원으로 믿지 않는다.
 * 서버가 서명·`kind=terminal`·현재 세대·활성·만료를 검증하고 200 을 주어야 비로소 신원이다.
 *
 * ⛔ **코드에서 번호를 추측하지 않는다.** `terminalCode` 는 표시용 문자열이고 번호가 아니다.
 * ⛔ **부정확하게 반올림한 int64 를 쓰지 않는다** — 안전 정수 범위를 벗어난 `sub` 는 거부한다.
 *    반올림된 번호로 조회하면 **다른 단말의 정보를 받아 그것으로 등록된다.**
 *
 * ## 등록과 준비는 다른 층이다
 *
 * 검증 200 은 「이 단말이 누구인가」까지다. 업무로 넘기려면 **자기 공정 목록**을 받아야 하고,
 * 그 둘을 한 덩이로 다루면 준비 실패가 등록 실패처럼 보여 설치 담당자가 토큰부터 다시
 * 의심한다(F-4 「등록 성공과 준비 실패는 구분하고 재시도한다」).
 *
 * ## 큐는 신원에 매여 있다
 *
 * 미전송 기록은 **어느 단말이 만든 것인가**를 갖는다. 다른 단말·공장으로 바꾸는데 큐가
 * 남아 있으면 그 기록은 갈 곳을 잃는다 — 그래서 **적용을 막는다**. ⛔ 큐를 비우는 우회
 * 버튼을 두지 않는다(F-4). 같은 단말·공장이면 큐는 그대로 새 토큰으로 재전송된다.
 */

type Client = ApiClient['client'];

/** 검증이 확인해 준 단말. **이 값만이 신원이다** — 후보 토큰에서 읽은 것은 여기 오지 않는다. */
export interface VerifiedTerminal {
  terminalId: number;
  terminalCode: string;
  plantId: number;
  terminalTypeCode: string;
  equipmentCode: string | null;
  equipmentName: string | null;
  equipmentId: number | null;
  locationId: number | null;
}

/** 이 단말이 어느 공정에서 무엇을 할 수 있는가. 셸은 **전체 행**을 그대로 들고 있는다. */
export interface TerminalProcessRow {
  processId: number;
  processName?: string;
  canStartWork?: boolean;
  canCompleteWork?: boolean;
  canInputMaterial?: boolean;
  canInputResult?: boolean;
  canInspect?: boolean;
  canRegisterDowntime?: boolean;
  canPrintLabel?: boolean;
  canMoveStock?: boolean;
}

/**
 * 등록이 지금 어디까지 왔는가.
 *
 * - `unregistered` 후보 토큰이 없다. 붙여넣기를 기다린다
 * - `verifying` 후보 토큰으로 서버에 묻는 중
 * - `verified` 서버가 확인했다. **설치 담당자가 단말 코드를 확인하고 적용해야 한다**
 * - `preparing` 적용했고 자기 공정 목록을 받는 중
 * - `prepare-failed` 등록은 됐는데 준비가 실패했다 — 토큰 문제가 아니다
 * - `ready` 업무로 넘어갈 수 있다
 */
export type RegistrationPhase =
  'unregistered' | 'verifying' | 'verified' | 'preparing' | 'prepare-failed' | 'ready';

/**
 * 왜 막혔는가. 문구는 화면이 고르고 여기서는 **사유만** 낸다.
 *
 * ⛔ 서버 원문을 그대로 올리지 않는다 — 작업자가 할 수 있는 일로 번역하는 것은 화면 몫이다.
 */
export type RegistrationFailure =
  | 'malformed' // 토큰 모양이 아니다 — sub 를 읽을 수 없다
  | 'rejected' // 401 — 위조·만료·세대 폐기·비활성이거나 없는 단말
  | 'unreachable' // 서버가 답하지 않았다 — 토큰을 판정한 적이 없다
  | 'foreign' // 403 — 다른 단말을 가리킨다
  | 'wrong-type' // POP 단말이 아니다
  | 'offline' // 신규 등록은 온라인 전용이다
  | 'no-store' // 셸이 없어 자격증명 저장소에 보관할 수 없다
  | 'queue-blocked'; // 미전송 기록이 있는데 다른 신원으로 바꾸려 한다

/**
 * 판정이 **어느 토큰에 대한 것인가.**
 *
 * ⛔ **없으면 화면이 무엇을 말하는지 알 수 없다**(#1137). 켤 때 보관된 토큰을 스스로 확인하는데
 *    (`app/pop-main` 의 `PopRegistrationGate`), 그 실패가 입력란이 «빈» 등록 화면에 그대로
 *    떴다 — 설치 담당자는 한 글자도 넣지 않았는데 「이 토큰은 더 이상 쓸 수 없습니다」를
 *    받았다(실측 2026-09-12 · 사용자 지적 · 실서버 설치본).
 */
export type FailureSource =
  | 'stored' // 켤 때 스스로 확인한 보관 토큰
  | 'entered'; // 설치 담당자가 방금 붙여넣은 값

export interface RegistrationState {
  phase: RegistrationPhase;
  failure: RegistrationFailure | null;
  /** 위 `failure` 가 «어느» 토큰 이야기인가. 실패가 없으면 뜻이 없다. */
  failureSource: FailureSource;
  /** 적용을 막은 미전송 건수. `queue-blocked` 일 때만 값이 있다. */
  pendingCount: number;
  /** 검증이 확인해 준 단말. `verified` 이후에만 있다. */
  terminal: VerifiedTerminal | null;
  /** 자기 공정 목록. `ready` 에서만 값이 있다 — **빈 배열은 정상이다**(창고 단말). */
  processes: readonly TerminalProcessRow[] | null;
}

export interface PopRegistration extends RegistrationState {
  /**
   * 후보 토큰을 서버에 확인시킨다.
   *
   * ⚠ `source` 는 **실패 문구가 누구 이야기인지**를 정한다. 기본은 사람이 방금 넣은 값이고,
   *   켤 때 보관 토큰을 스스로 확인하는 자리만 `'stored'` 로 부른다(#1137).
   */
  verify: (token: string, source?: FailureSource) => Promise<void>;
  /** 확인된 바로 그 후보 토큰을 적용한다. 설치 담당자가 단말 코드를 본 뒤에 부른다. */
  apply: () => Promise<void>;
  /** 준비만 다시 시도한다 — 토큰은 그대로다. */
  retryPrepare: () => Promise<void>;
  /** 등록 정보를 바꾸러 간다. 후보·검증 결과를 버리고 입력 상태로 되돌린다. */
  restart: () => void;
}

const INITIAL: RegistrationState = {
  phase: 'unregistered',
  failure: null,
  failureSource: 'entered',
  pendingCount: 0,
  terminal: null,
  processes: null,
};

/**
 * 후보 토큰에서 **조회 주소를 만들 번호만** 읽는다.
 *
 * ⛔ **이것은 인증이 아니다.** 서명을 보지 않으므로 값이 참이라는 보장이 없고, 서버가 200 을
 *    줄 때까지 신원으로 쓰지 않는다. 여기서 하는 일은 「어느 주소로 물어볼까」뿐이다.
 *
 * ⚠ **안전 정수 밖이면 거부한다.** JavaScript 의 수는 int64 를 온전히 담지 못해, 큰 번호는
 *    조용히 반올림된다 — 그 번호로 조회하면 **옆 단말의 정보를 받아** 그것으로 등록된다.
 */
export const readTerminalIdFromToken = (token: string): number | null => {
  const parts = token.trim().split('.');

  const encoded = parts[1];

  if (encoded === undefined || encoded === '') return null;

  try {
    const base64 = encoded
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    const payload: unknown = JSON.parse(atob(base64));

    if (typeof payload !== 'object' || payload === null) return null;

    const sub = (payload as { sub?: unknown }).sub;
    const parsed =
      typeof sub === 'number' ? sub : typeof sub === 'string' ? Number(sub) : Number.NaN;

    if (!Number.isSafeInteger(parsed) || parsed < 1) return null;

    return parsed;
  } catch {
    return null;
  }
};

/** POP 셸에만 있는 미전송 큐. 통로가 없으면 `0` 이다 — 브라우저에는 큐 자체가 없다. */
const readPendingCount = async (): Promise<number> => {
  const pop = (globalThis as { pop?: { outbox?: { size?: () => Promise<number> } } }).pop;

  if (typeof pop?.outbox?.size !== 'function') return 0;

  try {
    return await pop.outbox.size();
  } catch {
    return 0;
  }
};

/**
 * HTTP 상태를 사유로 옮긴다. 401 과 403 이 뜻하는 것이 다르다(F-4).
 *
 * ⛔ **답이 «없는» 것을 거절로 읽지 않는다.** 상태가 없으면 요청이 서버에 닿지도 못한 것이라
 *    토큰은 판정된 적이 없다. 전부 `rejected` 로 뭉쳤더니 설치본이 서버에 못 닿는 동안 화면이
 *    「이 토큰은 더 이상 쓸 수 없습니다」를 말했고, 담당자는 멀쩡한 토큰을 몇 번씩 재발급
 *    받았다(실측 2026-09-12 · 사용자 지적 — 서버 CORS 가 닫혀 요청이 브라우저에서 막힌 건이다).
 *    ⚠ 사유가 다르면 사람이 할 일이 다르다 — 하나는 재발급, 하나는 연결 확인이다.
 */
const failureOf = (error: unknown): RegistrationFailure => {
  /*
   * ⛔ **오류에서 `status` 를 바로 읽지 않는다.** 요청 경로는 정규화된 봉투(`ApiRequestError`)
   *    를 던지므로 그 자리에 `status` 가 없다 — 그렇게 읽던 동안 403 갈래가 «한 번도» 서지
   *    못하고 모든 실패가 「토큰이 죽었다」로 떨어졌다.
   *
   * ⛔ **정규화된 갈래로도 상태를 못 읽는다.** 서버가 403 을 계약 오류 봉투로 보내면 정규화가
   *    그것을 `validation` 으로 접으면서 상태 코드를 버린다 — 봉투만 보고 고치면 403 갈래는
   *    «여전히» 죽어 있다(리뷰 2회차 지적). 정규화 전 상태를 남겨 둔 자리를 본다.
   */
  const status = error instanceof ApiRequestError ? error.httpStatus : undefined;

  if (status === 403) return 'foreign';

  /* 응답 자체가 없었다 — 토큰은 아직 판정된 적이 없다. */
  if (toApiError(error).kind === 'network') return 'unreachable';

  return 'rejected';
};

/**
 * 보관 토큰을 버릴 «판정» — 서버가 그 토큰을 보고 답했을 때만이다(#1137 ②).
 *
 * ⛔ `unreachable`·`offline` 은 들어오지 않는다 — 판정이 아니라 **못 물어본 것**이다.
 * ⛔ `no-store`·`queue-blocked` 도 아니다 — 토큰이 아니라 적용 단계의 사정이다.
 */
const DISCARDABLE_FAILURES: ReadonlySet<RegistrationFailure> = new Set([
  'malformed',
  'rejected',
  'foreign',
  'wrong-type',
]);

const fetchTerminal = (client: Client, terminalId: number): Promise<VerifiedTerminal> =>
  runRequest(() =>
    client.GET('/mdm/terminals/{terminalId}', { params: { path: { terminalId } } }),
  ).then((data) => ({
    terminalId: data.terminalId,
    terminalCode: data.terminalCode,
    plantId: data.plantId,
    terminalTypeCode: data.terminalTypeCode,
    equipmentId: data.equipmentId ?? null,
    equipmentCode: data.equipmentCode ?? null,
    equipmentName: data.equipmentName ?? null,
    locationId: data.locationId ?? null,
  }));

const fetchProcesses = (client: Client, terminalId: number): Promise<TerminalProcessRow[]> =>
  runRequest(() =>
    client.GET('/mdm/terminals/{terminalId}/processes', { params: { path: { terminalId } } }),
  ).then((data) => [...data.items]);

const PopRegistrationContext = createContext<PopRegistration | null>(null);

/**
 * 이미 보관된 토큰이 있으면 그것으로 시작한다 — 단말을 껐다 켤 때마다 설치 담당자를 부르지
 * 않기 위해서다. 보관된 토큰의 검증·준비는 `verify` 와 같은 길을 그대로 지난다.
 */
export const PopRegistrationProvider = ({ children }: { children: ReactNode }) => {
  const { client } = useApiClient();
  const session = useWorkerSession();
  const [state, setState] = useState<RegistrationState>(INITIAL);
  /* 검증을 통과한 «바로 그» 후보. 적용은 이 값에만 한다(F-4). */
  const [approved, setApproved] = useState<string | null>(null);
  /**
   * **지금 등록되어 있는 단말.** 큐 보존 판정이 「갈 곳이 달라지는가」를 재는 기준점이다.
   *
   * ⛔ **`state` 로 대신하지 않는다.** `verify()` 가 새 후보를 받을 때마다 `state` 를 초기값으로
   *    갈아엎으므로, 적용 시점에는 직전 등록이 남아 있지 않다 — 그것으로 비교하면 판정이
   *    **언제나 「신원이 안 바뀐다」로 떨어져** 미전송 기록이 다른 단말 앞으로 전송된다.
   *    이 자리를 따로 둔 이유가 그것이고, 아래 감지기가 그 갈래를 잰다.
   */
  const [registered, setRegistered] = useState<VerifiedTerminal | null>(null);

  const prepare = useCallback(
    async (terminal: VerifiedTerminal) => {
      setState((prev) => ({ ...prev, phase: 'preparing', failure: null }));

      try {
        const processes = await fetchProcesses(client, terminal.terminalId);

        setRegistered(terminal);
        setState({
          phase: 'ready',
          failure: null,
          failureSource: 'entered',
          pendingCount: 0,
          terminal,
          processes,
        });
      } catch {
        /* ⛔ 준비 실패를 등록 실패로 되돌리지 않는다 — 토큰은 이미 확인됐다. */
        setState((prev) => ({ ...prev, phase: 'prepare-failed', failure: null, terminal }));
      }
    },
    [client],
  );

  /**
   * 보관된 토큰이 걸러졌으면 **그 자리에서 버린다**(#1137 ②).
   *
   * ⛔ **닿지 못한 것은 버리지 않는다.** 서버가 답하지 않아 확인하지 못한 것과 서버가 「이
   *    토큰은 끝났다」고 판정한 것은 다르다 — 잠깐 망이 끊긴 사이에 멀쩡한 토큰을 지우면
   *    설치 담당자를 현장으로 다시 불러야 한다(같은 근거로 `unreachable` 갈래를 만들었다).
   *
   * ⚠ 버리지 않으면 껐다 켤 때마다 같은 실패가 되풀이된다 — 화면은 매번 아무도 넣지 않은
   *   토큰의 부고를 전한다.
   */
  const discardIfStored = useCallback(
    async (source: FailureSource, failure: RegistrationFailure): Promise<void> => {
      if (source !== 'stored') return;
      if (!DISCARDABLE_FAILURES.has(failure)) return;

      await discardStoredTerminalToken();
    },
    [],
  );

  const verify = useCallback(
    async (token: string, source: FailureSource = 'entered') => {
      const trimmed = token.trim();
      const terminalId = readTerminalIdFromToken(trimmed);

      setApproved(null);

      if (terminalId === null) {
        setState({ ...INITIAL, failure: 'malformed', failureSource: source });
        await discardIfStored(source, 'malformed');

        return;
      }

      if (!navigator.onLine) {
        setState({ ...INITIAL, failure: 'offline', failureSource: source });

        return;
      }

      setState({ ...INITIAL, phase: 'verifying' });
      setCandidateTerminalToken(trimmed);

      try {
        const terminal = await fetchTerminal(client, terminalId);

        if (terminal.terminalTypeCode !== 'POP') {
          setState({ ...INITIAL, failure: 'wrong-type', failureSource: source, terminal });
          await discardIfStored(source, 'wrong-type');

          return;
        }

        setApproved(trimmed);
        setState({ ...INITIAL, phase: 'verified', terminal });
      } catch (error) {
        const failure = failureOf(error);

        setState({ ...INITIAL, failure, failureSource: source });
        await discardIfStored(source, failure);
      } finally {
        /* 후보 창을 닫는다 — 열어 두면 이후 업무 요청까지 후보 토큰으로 나간다. */
        setCandidateTerminalToken(null);
      }
    },
    [client, discardIfStored],
  );

  const apply = useCallback(async () => {
    const terminal = state.terminal;

    if (approved === null || terminal === null) return;

    /*
     * ⭐ **신원이 바뀌는데 미전송이 남아 있으면 막는다**(F-4). 같은 단말·공장이면 큐는 그대로
     *    새 토큰으로 재전송되므로 막지 않는다 — 막는 것은 **갈 곳이 달라지는** 경우뿐이다.
     */
    const changesIdentity =
      registered !== null &&
      (registered.terminalId !== terminal.terminalId || registered.plantId !== terminal.plantId);

    if (changesIdentity) {
      const pending = await readPendingCount();

      if (pending > 0) {
        setState((prev) => ({ ...prev, failure: 'queue-blocked', pendingCount: pending }));

        return;
      }
    }

    const stored = await writeTerminalToken(approved, {
      allowMemoryOnly: import.meta.env.MODE === 'development',
    });

    if (!stored) {
      setState((prev) => ({ ...prev, failure: 'no-store' }));

      return;
    }

    setApproved(null);
    await prepare(terminal);
  }, [approved, prepare, registered, state.terminal]);

  const retryPrepare = useCallback(async () => {
    if (state.terminal === null) return;

    await prepare(state.terminal);
  }, [prepare, state.terminal]);

  /**
   * 등록 정보를 바꾸러 간다(P-CO-01 §5-1 「재등록」).
   *
   * ⛔ **지금 등록된 신원은 지우지 않는다** — 큐 보존 판정의 기준점이다. 새 토큰을 적용할 때
   *    「갈 곳이 달라지는가」를 이 값과 비교해 재고, 실제로 바뀔 때만 미전송 건수를 본다.
   */
  const restart = useCallback(() => {
    setApproved(null);
    setCandidateTerminalToken(null);
    setState(INITIAL);
  }, []);

  const value = useMemo<PopRegistration>(
    () => ({ ...state, verify, apply, retryPrepare, restart }),
    [apply, restart, retryPrepare, state, verify],
  );

  return (
    <PopRegistrationContext.Provider value={value}>
      <PopIdentityProvider
        value={{
          /*
           * ⛔ **준비가 끝나기 전에는 신원을 내리지 않는다.** 중간 상태에서 단말 번호만
           *    먼저 나가면 화면이 조회를 시작하고, 공정 목록 없이 판정이 서 버린다.
           */
          terminalId: state.phase === 'ready' ? (state.terminal?.terminalId ?? null) : null,
          processes: state.phase === 'ready' ? state.processes : null,
          workerNo: session?.worker.workerNo ?? null,
        }}
      >
        {children}
      </PopIdentityProvider>
    </PopRegistrationContext.Provider>
  );
};

/** 보관된 토큰이 이미 있는가 — 셸을 다시 켰을 때 등록 패널을 건너뛸지 판정한다. */
export const hasStoredTerminalToken = (): boolean => currentTerminalToken() !== null;

export const usePopRegistration = (): PopRegistration => {
  const value = useContext(PopRegistrationContext);

  if (value === null) {
    throw new Error('PopRegistrationProvider 안에서만 부를 수 있습니다.');
  }

  return value;
};
