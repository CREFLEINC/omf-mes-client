import type { ApiClient } from '@omf-mes/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { MAX_AUTO_ATTEMPTS, isRejected, retryDelayOf } from '../../patterns/outbox-policy';
import type { ApiError } from '@omf-mes/api-client';

import { runRequest, toApiError } from '../../patterns/request';
import type { HoldDirection } from './codes';
import type {
  WorkOrderHoldCreate,
  WorkOrderResumeCreate,
  WorkSessionEndCreate,
  WorkSessionEventCreate,
} from './types';

/**
 * 중단·재개·종료 outbox — **공유계약 C-1** · 스펙 §5-4.
 *
 * 중단·재개는 **설비가 멈춘 순간에 눌린다.** 그 순간 망이 끊겨 있다고 기록이 사라지면, 다시
 * 돌기 시작한 뒤에는 무엇 때문에 멈췄는지 아무도 말할 수 없다 — 사건은 정정 경로가 없다.
 *
 * 조항이 정한 다섯을 여기서 지킨다.
 *
 * | # | 규칙 | 여기서 |
 * | :-: | --- | --- |
 * | 1 | `idempotency_key` 는 **클라이언트가 생성**해 outbox 에 담는다 | 담을 때 한 번 만든다 |
 * | 2 | **로컬 저장 후 즉시 성공 피드백** | `enqueue` 가 곧 성공이다 |
 * | 3 | 발생 시각과 서버 수신 시각을 분리 | `occurredAt` 을 담을 때 박는다 |
 * | 4 | **연결 상태와 미동기 건수를 상시 표시** | `pendingCount` 를 머리가 낸다 |
 * | 5 | 재전송은 **같은 키로** | 키가 항목에 붙어 시도마다 바뀌지 않는다 |
 *
 * ⛔ **`If-Match` 를 싣지 않는다**(C-9). 큐에 쌓인 요청은 잠글 판본을 들고 있을 수 없다 —
 * 담긴 뒤 서버의 세션이 앞서 나가면 토큰이 낡아 **기다렸다는 이유로 거부된다.**
 *
 * ⭐ **한 조작이 항목 «둘»을 담는다**(2026-09-06 게이트 승인) — W/O 층 전환과 세션 사건이다.
 * 둘은 한 트랜잭션이 아니므로 **순서와 묶음을 큐가 진다**: 같은 `groupId` 안에서 앞 건이
 * 거부되면 뒤 건은 **보내지 않고 함께 내린다.** 앞이 거부됐는데 뒤가 나가면 중단된 적 없는
 * W/O 에 중단 사건만 남아, 정정 경로가 없는 기록이 서로 어긋난 채 굳는다.
 *
 * ⚠ **세션 번호·작업지시 번호를 항목에 함께 담는다.** 재전송은 화면이 다시 그려진 뒤에
 * 일어날 수 있고, 그때 열린 세션이 다른 것으로 바뀌어 있으면 **중단이 엉뚱한 세션에
 * 기록된다.** 사건이 매인 곳은 담을 때의 세션이다.
 *
 * ⚠ **사번도 함께 담는다** — 헤더를 채우지 못하면 서버가 거부하고, 나중 값으로 대신할 수도
 * 없다. 그 사건을 「누가 한 일」로 만드는 값이기 때문이다(귀속 조항 D-5).
 *
 * ⚠ **판정은 `patterns/outbox-policy` 것을 쓴다** — 「기다릴 것인가 버릴 것인가」를 화면마다
 * 다시 쓰지 않는다(#772).
 */

type Client = ApiClient['client'];

/** 큐에 담긴 한 건이 **어느 경로로 나가는가.** */
export type OutboxKind =
  | 'work-order-hold'
  | 'work-order-resume'
  | 'session-event'
  | 'session-end';

/** 큐에 담긴 한 건. */
export interface OutboxEntry {
  idempotencyKey: string;
  kind: OutboxKind;
  /**
   * 같은 조작에서 나온 건들을 묶는 표식.
   *
   * ⭐ **한 쌍의 뒷건이 앞건 없이 나가지 않게 하는 유일한 근거다.** 큐는 담긴 차례대로 보내지만
   * 거부는 아무 자리에서나 날 수 있다 — 그때 무엇을 함께 내려야 하는지를 이 값이 말한다.
   */
  groupId: string;
  /** 이 조작이 세션을 미는 방향. 버튼 활성 판정이 읽는다. */
  direction: HoldDirection;
  /** 이 사건이 매인 세션. **담을 때의 세션이다** — 재전송 시점에 다시 고르지 않는다. */
  workSessionId: number;
  /** W/O 층 호출의 대상. 세션 사건·종료에는 쓰이지 않는다. */
  workOrderId: number;
  /** 이 쓰기의 귀속 사번. 헤더로만 나가고 본문에는 실리지 않는다. */
  workerNo: string;
  body: WorkOrderHoldCreate | WorkOrderResumeCreate | WorkSessionEventCreate | WorkSessionEndCreate;
}

/** 화면이 담는 한 건 — 키는 큐가 만들고, 묶음은 `enqueueGroup` 이 붙인다. */
export type OutboxDraft = Omit<OutboxEntry, 'idempotencyKey' | 'groupId'>;

export const STORAGE_KEY = 'omf-mes.work-hold-register.outbox';

/** 지난 판(단건 세션 사건)의 항목을 지금 모양으로 읽는다. */
const isSessionEventBody = (body: Record<string, unknown>): boolean =>
  typeof body.eventTypeCode === 'string' && typeof body.occurredAt === 'string';

/**
 * 지난 판이 «실제로» 담던 유형인가.
 *
 * ⛔ **모르는 유형을 중단으로 접지 않는다.** 앞선 판이 담는 것은 `STOP`·`RESUME` 둘뿐이었으므로
 * 그 밖의 값은 저장값이 손상된 것이다 — 방향을 임의로 정해 내보내면 **돌고 있는 세션에 중단이**
 * **기록되고** 그 기록에는 정정 경로가 없다.
 */
const isLegacyEventType = (value: unknown): value is 'STOP' | 'RESUME' =>
  value === 'STOP' || value === 'RESUME';

const KINDS: readonly OutboxKind[] = [
  'work-order-hold',
  'work-order-resume',
  'session-event',
  'session-end',
];

/**
 * 저장소에서 읽은 값을 **보낼 수 있는 모양으로 맞춘다.** 못 맞추면 `null` 이다.
 *
 * ⛔ **믿고 넘기지 않는다.** 지난 판의 화면이 썼거나 손으로 고쳐졌을 수 있고, 그 끝에 있는
 * 것은 정정할 수 없는 사건 기록이다. 계약이 필수로 둔 것과 헤더가 요구하는 것만 확인한다.
 *
 * ⭐ **지난 판 항목을 버리지 않는다.** 호출이 하나였던 판이 남긴 항목에는 `kind`·`groupId`·
 * `direction`·`workOrderId` 가 없다 — 그 모양은 **세션 사건 단건**이었으므로 그대로 읽어
 * 보낸다. 버리면 작업자가 남긴 중단 기록이 조용히 사라지고, 그것이 이 큐가 막으려는 일이다.
 */
export const normalizeEntry = (value: unknown): OutboxEntry | null => {
  if (typeof value !== 'object' || value === null) return null;

  const entry = value as Record<string, unknown>;
  const { idempotencyKey, workSessionId, workerNo, body } = entry;

  if (typeof idempotencyKey !== 'string' || idempotencyKey === '') return null;
  if (typeof workSessionId !== 'number') return null;
  if (typeof workerNo !== 'string' || workerNo === '') return null;
  if (typeof body !== 'object' || body === null) return null;

  const fields = body as Record<string, unknown>;
  const kind = KINDS.find((candidate) => candidate === entry.kind);

  /* `kind` 가 없는 것은 지난 판이다 — 그 판이 담던 것은 세션 사건 하나뿐이었다. */
  if (kind === undefined) {
    if (!isSessionEventBody(fields)) return null;
    if (!isLegacyEventType(fields.eventTypeCode)) return null;

    return {
      idempotencyKey,
      kind: 'session-event',
      /* 혼자 선 건이므로 자기 자신이 묶음이다 — 함께 내릴 짝이 없다. */
      groupId: idempotencyKey,
      direction: fields.eventTypeCode,
      workSessionId,
      workOrderId: 0,
      workerNo,
      body: fields as unknown as WorkSessionEventCreate,
    };
  }

  const isWorkOrderCall = kind === 'work-order-hold' || kind === 'work-order-resume';

  if (isWorkOrderCall && typeof entry.workOrderId !== 'number') return null;
  if (kind === 'session-event' && !isSessionEventBody(fields)) return null;
  if (kind === 'session-end' && typeof fields.endedAt !== 'string') return null;
  if (isWorkOrderCall && typeof fields.occurredAt !== 'string') return null;

  /*
   * ⛔ **중단 사유는 계약 필수다**(`WorkOrderHold.reasonCode`). 빠진 채로 나가면 400 을 받고,
   * 이 큐는 거부에서 전체를 멈추므로 **뒤에 쌓인 정상 건까지 함께 막힌다.**
   */
  if (
    kind === 'work-order-hold' &&
    (typeof fields.reasonCode !== 'string' || fields.reasonCode === '')
  ) {
    return null;
  }

  const direction = entry.direction;
  if (direction !== 'STOP' && direction !== 'RESUME' && direction !== 'END') return null;

  /*
   * ⛔ **방향과 본문이 어긋나면 보내지 않는다.** 방향은 버튼 활성 판정이 읽는 값이라, 손상된
   * 값이 통과하면 **중단 중인데 [중단]이 열리는** 식으로 반대 방향이 한 번 더 나간다.
   */
  if (kind === 'session-event' && fields.eventTypeCode !== direction) return null;
  if (kind === 'work-order-hold' && direction !== 'STOP') return null;
  if (kind === 'work-order-resume' && direction !== 'RESUME') return null;
  if (kind === 'session-end' && direction !== 'END') return null;

  return {
    idempotencyKey,
    kind,
    groupId: typeof entry.groupId === 'string' ? entry.groupId : idempotencyKey,
    direction,
    workSessionId,
    workOrderId: typeof entry.workOrderId === 'number' ? entry.workOrderId : 0,
    workerNo,
    body: fields as OutboxEntry['body'],
  };
};

/**
 * 저장소에서 큐를 읽는다.
 *
 * ⛔ **읽기가 화면을 세우지 못하게 하지 않는다.** 사생활 보호 모드·저장소 차단·손상된 값이
 * 전부 던질 수 있는 자리라, 실패하면 빈 큐로 시작한다.
 *
 * ⚠ **모양이 깨진 항목은 조용히 버린다.** 되살릴 방법이 없고, 남겨 두면 큐 맨 앞에서 매번
 * 거부돼 **그 뒤에 쌓인 정상 건까지 함께 막는다.**
 */
const readStored = (): OutboxEntry[] => {
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((one) => {
      const entry = normalizeEntry(one);

      return entry === null ? [] : [entry];
    });
  } catch {
    return [];
  }
};

const writeStored = (entries: readonly OutboxEntry[]): void => {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ⚠ 저장에 실패해도 큐는 메모리에 남아 이 세션 동안은 나간다. 여기서 던지면 이미 성공을
     * 본 작업자의 화면이 그 자리에서 무너진다. */
  }
};

/**
 * 한 건을 그 종류의 경로로 보낸다.
 *
 * ⛔ **경로 리터럴을 변수로 넘기지 않는다** — `openapi-fetch` 가 경로를 리터럴 타입으로 요구해
 * 문자열로 접으면 본문 타입 검사가 통째로 풀린다. 그래서 갈래마다 호출을 따로 적는다.
 */
const postEntry = async (client: Client, entry: OutboxEntry): Promise<void> => {
  /* ⛔ 시도마다 새로 만들지 않는다 — 재전송이 새 기록이 된다(C-1 #5).
   * ⛔ 사번이 없으면 서버가 거부한다. 인증이 아니라 귀속이다(D-5). */
  const header = {
    'Idempotency-Key': entry.idempotencyKey,
    'X-Worker-No': entry.workerNo,
  } as const;

  if (entry.kind === 'work-order-hold') {
    await runRequest(() =>
      client.POST('/production/work-orders/{workOrderId}:hold', {
        params: { path: { workOrderId: entry.workOrderId }, header },
        body: entry.body as WorkOrderHoldCreate,
      }),
    );

    return;
  }

  if (entry.kind === 'work-order-resume') {
    await runRequest(() =>
      client.POST('/production/work-orders/{workOrderId}:resume', {
        params: { path: { workOrderId: entry.workOrderId }, header },
        body: entry.body as WorkOrderResumeCreate,
      }),
    );

    return;
  }

  if (entry.kind === 'session-end') {
    await runRequest(() =>
      client.POST('/production/work-sessions/{workSessionId}:end', {
        params: { path: { workSessionId: entry.workSessionId }, header },
        body: entry.body as WorkSessionEndCreate,
      }),
    );

    return;
  }

  await runRequest(() =>
    client.POST('/production/work-sessions/{workSessionId}/events', {
      params: { path: { workSessionId: entry.workSessionId }, header },
      body: entry.body as WorkSessionEventCreate,
    }),
  );
};

export interface Outbox {
  /** 아직 서버에 닿지 않은 건수. **상시 표시가 필수 요건이다**(C-1 #4). */
  pendingCount: number;
  /** 서버가 받은 횟수. 늘어나면 화면이 조회를 다시 한다. */
  sentCount: number;
  /**
   * 큐에 마지막으로 담긴 조작의 방향. 없으면 `null`.
   *
   * ⭐ **오프라인에서 「지금 상태」를 말하는 것은 이 값이다.** 서버가 아직 받지 못했으면 세션
   * 상태는 옛것 그대로라, 이 값이 없으면 중단을 담은 뒤 재개를 누를 방법이 사라진다.
   */
  lastQueuedType: HoldDirection | null;
  /**
   * 마지막으로 **서버가 받은** 조작의 방향. 없으면 `null`.
   *
   * ⭐ **큐가 빈 직후의 짧은 구간을 메운다.** 보낸 것이 닿으면 큐는 즉시 비지만 세션 조회는
   * 아직 돌아오지 않았다 — 그 사이 옛 상태(「진행」)를 그대로 믿으면 방금 건 중단이 한 번 더
   * 눌린다.
   */
  lastSentType: HoldDirection | null;
  /** 지금 연결돼 있는가. 건수와 함께 낸다 — 끊긴 것과 밀리는 것은 다르다. */
  isOnline: boolean;
  /**
   * 한 조작을 큐에 담는다. **이것이 곧 성공이다** — 통신을 기다리지 않는다(C-1 #2).
   *
   * ⭐ **여러 건을 한 번에 받는다** — 두 층 호출이 «따로» 담기면 그 사이에 다른 조작이 끼어들
   * 수 있고, 그러면 순서가 뜻을 잃는다.
   */
  enqueueGroup: (drafts: readonly OutboxDraft[]) => void;
  /** 서버가 거부한 것. 없으면 `null`. */
  rejection: ApiError | null;
  clearRejection: () => void;
  /**
   * 자동 재전송을 멈춘 상태인가. **항목은 큐에 그대로 있다** — 사라진 것이 아니라 멈춘 것이다.
   */
  isStalled: boolean;
  /** 멈춘 큐를 사람이 깨운다. */
  retryNow: () => void;
}

/**
 * outbox 훅.
 *
 * ⚠ **한 번에 한 건씩 순서대로 보낸다.** 중단과 재개는 **순서가 곧 뜻이다** — 뒤엣것이 먼저
 * 닿으면 서버가 보는 세션 상태가 뒤집힌다. 한 쌍의 앞뒤도 같은 이유로 갈라 보내지 않는다.
 */
export const useWorkHoldOutbox = (): Outbox => {
  const { client } = useApiClient();

  const [entries, setEntries] = useState<OutboxEntry[]>(readStored);
  const [rejection, setRejection] = useState<ApiError | null>(null);
  const [isOnline, setIsOnline] = useState(() => globalThis.navigator.onLine);

  /* 비우는 작업이 겹쳐 돌면 같은 항목이 두 번 나간다 — 키가 같아 서버가 흡수하지만, 굳이. */
  const draining = useRef(false);

  /*
   * ⭐ **다시 시도할 계기를 만드는 자리다.** 통신이 끊겨 실패하면 큐도 연결 상태도 그대로라
   * 비우기 효과가 다시 돌 이유가 없다 — 그러면 큐는 연결이 살아 있는데도 영원히 멈춰 선다.
   */
  const [retryTick, setRetryTick] = useState(0);

  /** 예약해 둔 재시도. **언마운트에서 지운다.** */
  const retryTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (retryTimer.current !== null) globalThis.clearTimeout(retryTimer.current);
    },
    [],
  );

  /**
   * 서버가 실제로 받은 횟수. **화면이 조회를 다시 할 계기다** — 중단이 닿으면 세션 상태가
   * 서버에서 바뀌는데, 화면이 옛 상태를 들고 있으면 「중단」 버튼이 열린 채 남아 같은 중단을
   * 한 번 더 등록한다(사건은 정정 경로가 없다).
   */
  const [sentTick, setSentTick] = useState(0);
  const [lastSentType, setLastSentType] = useState<HoldDirection | null>(null);

  /** 갱신 «뒤에» 저장할 값. 갱신 함수를 순수하게 두기 위한 자리다. */
  const pendingWrite = useRef<OutboxEntry[] | null>(null);

  useEffect(() => {
    if (pendingWrite.current === null) return;

    writeStored(pendingWrite.current);
    pendingWrite.current = null;
  });

  /** 항목별 자동 재전송 시도 횟수. 메모리에만 둔다 — 새로 뜨면 다시 세는 것이 맞다. */
  const attempts = useRef(new Map<string, number>());
  const [isStalled, setIsStalled] = useState(false);

  useEffect(() => {
    const goOnline = (): void => {
      setIsOnline(true);
      /* 연결이 새로 섰으면 사정이 달라졌을 수 있다 — 시도 횟수를 다시 센다. */
      attempts.current.clear();
      setIsStalled(false);
      setRetryTick((tick) => tick + 1);
    };
    const goOffline = (): void => {
      setIsOnline(false);
    };

    globalThis.addEventListener('online', goOnline);
    globalThis.addEventListener('offline', goOffline);

    return () => {
      globalThis.removeEventListener('online', goOnline);
      globalThis.removeEventListener('offline', goOffline);
    };
    /* 의존성이 비어 있는 것은 의도다 — 리스너는 단말이 사는 동안 한 벌만 있으면 된다. */
  }, []);

  useEffect(() => {
    if (entries.length === 0 || !isOnline || draining.current || isStalled) return;

    draining.current = true;

    void (async () => {
      try {
        /* 맨 앞 한 건만 보낸다 — 결과가 상태를 바꾸고 이 효과가 다시 돌아 다음 건을 집는다. */
        const entry = entries[0];
        if (entry === undefined) return;

        let sent = false;
        let dropGroup = false;

        try {
          await postEntry(client, entry);
          sent = true;
        } catch (error) {
          /*
           * 통신이 끊긴 것이면 큐에 그대로 둔다 — 기다리면 풀린다. 다만 가만히 두지는 않는다:
           * 잠시 뒤 스스로 깨워 다시 시도한다.
           */
          if (!isRejected(error)) {
            const tried = (attempts.current.get(entry.idempotencyKey) ?? 0) + 1;
            attempts.current.set(entry.idempotencyKey, tried);

            /*
             * 상한을 넘었다 — 자동 재전송만 멈춘다. ⛔ 항목은 큐에 남긴다: 여기서 내리면
             * 작업자가 남긴 중단 기록이 사라지고, 그것이 이 큐가 막으려는 일이다.
             */
            if (tried >= MAX_AUTO_ATTEMPTS) {
              setIsStalled(true);

              return;
            }

            /* ⛔ **앞 예약을 덮어쓰지 않는다** — 끊지 못한 타이머가 화면 뒤에 남는다. */
            if (retryTimer.current !== null) globalThis.clearTimeout(retryTimer.current);

            retryTimer.current = globalThis.setTimeout(() => {
              retryTimer.current = null;
              setRetryTick((tick) => tick + 1);
            }, retryDelayOf(tried));

            return;
          }

          /*
           * ⛔ **거부가 나면 큐 전체를 멈춘다.** 이 큐에서는 **순서가 곧 뜻이다** — 중단이
           * 거부됐는데 뒤따르던 재개가 그대로 나가면, 멈춘 적 없는 세션에 재개가 기록된다.
           *
           * ⛔ **같은 조작의 남은 짝은 내린다.** 앞건이 거부된 뒤 사람이 [다시 보내기]를
           * 누르면 뒷건만 홀로 나가는데, 그러면 W/O 는 그대로인 채 세션 사건만 남아 두 층이
           * 어긋난다 — 정정 경로가 없는 기록이다. 사람이 다시 누르는 쪽이 옳다.
           */
          setRejection(toApiError(error));
          setIsStalled(true);
          dropGroup = true;
        }

        /* 받아졌든 거부됐든 «그 건»은 큐에서 내린다. 뒤엣것은 위에서 멈춰 세웠다. */
        attempts.current.delete(entry.idempotencyKey);
        if (sent) {
          setSentTick((tick) => tick + 1);
          setLastSentType(entry.direction);
        }
        setEntries((prev) => {
          const next = prev.filter((one) =>
            dropGroup ? one.groupId !== entry.groupId : one.idempotencyKey !== entry.idempotencyKey,
          );
          pendingWrite.current = next;

          return next;
        });
      } finally {
        draining.current = false;
      }
    })();
  }, [client, entries, isOnline, isStalled, retryTick]);

  /**
   * ⛔ **키 생성과 저장을 상태 갱신 «함수 안»에서 하지 않는다.** 갱신 함수는 순수해야 하고
   * StrictMode 는 그것을 두 번 부른다 — 안에서 키를 만들면 두 키가 생기고 저장도 두 번 돈다.
   * 키는 밖에서 한 번 만들고, 저장은 갱신이 끝난 뒤 효과가 한다.
   */
  const enqueueGroup = useCallback((drafts: readonly OutboxDraft[]): void => {
    if (drafts.length === 0) return;

    const groupId = crypto.randomUUID();
    const queued = drafts.map((draft) => ({
      idempotencyKey: crypto.randomUUID(),
      groupId,
      ...draft,
    }));

    setRejection(null);
    setEntries((prev) => {
      const next = [...prev, ...queued];
      pendingWrite.current = next;

      return next;
    });
  }, []);

  const clearRejection = useCallback((): void => {
    setRejection(null);
  }, []);

  const retryNow = useCallback((): void => {
    attempts.current.clear();
    setIsStalled(false);
    setRetryTick((tick) => tick + 1);
  }, []);

  return {
    pendingCount: entries.length,
    sentCount: sentTick,
    lastQueuedType: entries.at(-1)?.direction ?? null,
    lastSentType,
    isOnline,
    enqueueGroup,
    rejection,
    clearRejection,
    isStalled,
    retryNow,
  };
};
