import type { ApiClient, ApiError } from '@omf-mes/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { MAX_AUTO_ATTEMPTS, isRejected, retryDelayOf } from '../../patterns/outbox-policy';
import { runRequest, toApiError } from '../../patterns/request';
import type { HandlingUnitCreate, HandlingUnitPack } from './types';

/**
 * 포장 확정 outbox — **공유계약 C-1** · 스펙 §6 「오프라인 → 큐잉」.
 *
 * ⭐ **큐에 담는 것은 «확정»뿐이다**(스펙 §6 · 2026-09-06 게이트 승인). 담기 시작(포장 단위
 * 생성)은 오프라인에서 성립하지 않는다 — 포장번호를 서버가 매기고 확정이 그 번호를 **경로
 * 인자**로 받으므로 단말이 만들 수 없는 값이다. 그래서 연결이 없는 동안에는 새 포장 시작을
 * 막고 사유를 보이며, **담던 포장의 확정만** 큐가 받는다.
 *
 * 조항이 정한 다섯을 여기서 지킨다.
 *
 * | # | 규칙 | 여기서 |
 * | :-: | --- | --- |
 * | 1 | `idempotency_key` 는 **클라이언트가 생성**해 outbox 에 담는다 | 담을 때 한 번 만든다 |
 * | 2 | **로컬 저장 후 즉시 성공 피드백** | `enqueue` 가 곧 확정이다 |
 * | 3 | 발생 시각과 서버 수신 시각을 분리 | `businessDate`·`occurredAt` 을 담을 때 박는다 |
 * | 4 | **연결 상태와 미동기 건수를 상시 표시** | `pendingCount`·`isOnline` 을 화면이 낸다 |
 * | 5 | 재전송은 **같은 키로** | 키가 항목에 붙어 시도마다 바뀌지 않는다 |
 *
 * ⭐ **#3 이 이번에 닫혔다.** 앞선 판(한 건 쓰기)은 본문에 시각 칸이 없어 큐에 밀린 확정이
 * 서버가 받은 때로 기록됐고, 자정을 넘기면 원장의 `(멱등키, 영업일)` 제약을 둘 다 통과해
 * **두 건으로 적재될 수 있었다.** `:pack` 이 두 칸을 받아 그 구멍이 닫혔다(C-8).
 *
 * ⚠ **사번을 항목에 함께 담는다** — 헤더를 채우지 못하면 서버가 거부하고, 나중 값으로 대신할
 * 수도 없다. 그 포장을 「누가 한 일」로 만드는 값이다(귀속 조항 D-5).
 *
 * ⚠ **판정은 `patterns/outbox-policy` 것을 쓴다** — 「기다릴 것인가 버릴 것인가」를 화면마다
 * 다시 쓰지 않는다(#772).
 */

type Client = ApiClient['client'];

/**
 * 큐에 담긴 한 건이 **어느 경로로 나가는가.**
 *
 * ⭐ **`create` 는 지난 판이 남긴 것뿐이다** — 지금 화면은 담기 시작을 큐에 담지 않는다.
 * 그 항목은 계약상 여전히 유효한 요청이라(`HandlingUnitCreate.contents` 가 살아 있다) 그대로
 * 보낸다 — 버리면 작업자가 확정한 포장이 조용히 사라진다.
 */
export type OutboxKind = 'pack' | 'create';

/** 큐에 담긴 확정 한 건. */
export interface OutboxEntry {
  idempotencyKey: string;
  kind: OutboxKind;
  /**
   * 확정할 포장 단위. `kind === 'pack'` 일 때만 있다.
   *
   * ⚠ **담을 때의 값이다** — 재전송은 화면이 다시 그려진 뒤에 일어날 수 있고, 그때 담던
   * 포장이 다른 것으로 바뀌어 있으면 **엉뚱한 포장이 닫힌다.**
   */
  handlingUnitId: number | null;
  /** 이 쓰기의 귀속 사번. 헤더로만 나가고 본문에는 실리지 않는다. */
  workerNo: string;
  body: HandlingUnitPack | HandlingUnitCreate;
}

export const STORAGE_KEY = 'omf-mes.packing-work.outbox';

/**
 * 저장소에서 읽은 값이 **보낼 수 있는 모양인가.**
 *
 * ⛔ **믿고 넘기지 않는다.** 지난 판의 화면이 썼거나 손으로 고쳐졌을 수 있고, 그 끝에 있는
 * 것은 해체 경로가 없는 확정이다(스펙 §8-4). 계약이 필수로 둔 것과 헤더가 요구하는 것만
 * 확인한다.
 *
 * ⭐ **지난 판(한 건 쓰기)이 남긴 항목을 버리지 않는다.** 그 판은 `kind` 없이
 * `HandlingUnitCreate`(유형 + 내용물)를 담았고, 그 요청은 계약상 **여전히 유효하다** —
 * `kind` 가 없으면 그 판으로 읽어 생성 경로로 보낸다. 버리면 작업자가 이미 확정을 본 포장이
 * 조용히 사라진다(저장 키는 그대로라 값이 남아 있다).
 */
export const normalizeEntry = (value: unknown): OutboxEntry | null => {
  if (typeof value !== 'object' || value === null) return null;

  const entry = value as Record<string, unknown>;
  const { idempotencyKey, workerNo, body } = entry;

  if (typeof idempotencyKey !== 'string' || idempotencyKey === '') return null;
  if (typeof workerNo !== 'string' || workerNo === '') return null;
  if (typeof body !== 'object' || body === null) return null;

  const fields = body as Record<string, unknown>;
  /* 내용물이 비면 확정이 아니다 — 빈 포장을 큐에 남겨 두면 뜻 없는 포장이 선다. */
  const hasContents = Array.isArray(fields.contents) && fields.contents.length > 0;

  if (!hasContents) return null;

  if (entry.kind === 'pack') {
    if (typeof entry.handlingUnitId !== 'number') return null;
    /* ⛔ 시각 두 칸이 없으면 보내지 않는다 — 서버가 받은 때로 잡히면 원장이 두 건이 된다(C-8). */
    if (typeof fields.businessDate !== 'string' || fields.businessDate === '') return null;
    if (typeof fields.occurredAt !== 'string' || fields.occurredAt === '') return null;

    return {
      idempotencyKey,
      kind: 'pack',
      handlingUnitId: entry.handlingUnitId,
      workerNo,
      body: fields as unknown as HandlingUnitPack,
    };
  }

  /* `kind` 가 없거나 `create` 면 지난 판이다 — 그 판이 담던 것은 유형 + 내용물이었다. */
  if (entry.kind !== undefined && entry.kind !== 'create') return null;
  if (typeof fields.handlingUnitTypeCode !== 'string' || fields.handlingUnitTypeCode === '') {
    return null;
  }

  return {
    idempotencyKey,
    kind: 'create',
    handlingUnitId: null,
    workerNo,
    body: fields as unknown as HandlingUnitCreate,
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
    /* ⚠ 저장에 실패해도 큐는 메모리에 남아 이 세션 동안은 나간다. 여기서 던지면 이미 확정을
     * 본 작업자의 화면이 그 자리에서 무너진다. */
  }
};

/**
 * 한 건을 그 종류의 경로로 보낸다.
 *
 * ⛔ **경로 리터럴을 변수로 넘기지 않는다** — `openapi-fetch` 가 경로를 리터럴 타입으로 요구해
 * 문자열로 접으면 본문 타입 검사가 통째로 풀린다.
 *
 * ⛔ **`If-Match` 를 싣지 않는다**(C-9). 큐에 쌓인 요청은 잠글 판본을 들고 있을 수 없다.
 */
const postEntry = async (client: Client, entry: OutboxEntry): Promise<void> => {
  const header = {
    /* ⛔ 시도마다 새로 만들지 않는다 — 재전송이 새 확정이 된다(C-1 #5). */
    'Idempotency-Key': entry.idempotencyKey,
    /* ⛔ 없으면 서버가 거부한다. 인증이 아니라 귀속이다(D-5). */
    'X-Worker-No': entry.workerNo,
  } as const;

  if (entry.kind === 'pack') {
    await runRequest(() =>
      client.POST('/inventory/handling-units/{handlingUnitId}:pack', {
        params: { path: { handlingUnitId: entry.handlingUnitId ?? 0 }, header },
        body: entry.body as HandlingUnitPack,
      }),
    );

    return;
  }

  await runRequest(() =>
    client.POST('/inventory/handling-units', {
      params: { header },
      body: entry.body as HandlingUnitCreate,
    }),
  );
};

export interface Outbox {
  /** 아직 서버에 닿지 않은 건수. **상시 표시가 필수 요건이다**(C-1 #4). */
  pendingCount: number;
  /** 서버가 받은 횟수. 늘어나면 화면이 조회를 다시 한다. */
  sentCount: number;
  /** 지금 연결돼 있는가. 건수와 함께 낸다 — 끊긴 것과 밀리는 것은 다르다. */
  isOnline: boolean;
  /**
   * 큐에 담는다. **이것이 곧 확정이다** — 통신을 기다리지 않는다(C-1 #2).
   *
   * `idempotencyKey` 를 주면 그 키로 담는다 — **온라인으로 이미 던졌으나 적용 여부를 모르는
   * 확정을 큐가 이어받는 자리다.** 그때는 «그 시도의 본문»을 함께 넘겨야 한다. 주지 않으면
   * 새로 만든다.
   */
  enqueue: (
    entry: Omit<OutboxEntry, 'idempotencyKey'> & { idempotencyKey?: string | null },
  ) => void;
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
 * ⚠ **한 번에 한 건씩 보낸다.** 포장은 서로 독립한 자원이라 순서가 뜻을 바꾸지는 않지만,
 * 끊긴 망에 여러 건을 한꺼번에 던지면 복구된 순간 그 폭주가 서버로 향한다.
 */
export const usePackingWorkOutbox = (): Outbox => {
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
   * 서버가 실제로 받은 횟수. **화면이 조회를 다시 할 계기다** — 확정이 닿으면 그 포장이 상위
   * 포장 후보로 올라오고, 화면이 옛 목록을 들고 있으면 방금 만든 팔레트를 고를 수 없다.
   */
  const [sentTick, setSentTick] = useState(0);

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
             * 작업자가 담은 포장이 사라지고, 그것이 이 큐가 막으려는 일이다.
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
           * 서버가 받지 않기로 판정했다 — 그 건만 내리고 **뒤엣것은 계속 보낸다.** 포장은
           * 서로 다른 취급 단위라 앞 건이 거부돼도 뒤 건의 뜻이 달라지지 않는다(중단·재개처럼
           * 순서가 뜻인 큐와 다른 자리다). 다만 **거부 사실은 사람에게 남긴다** — 담은 순간을
           * 확정으로 본 작업자가 아니면 알 방법이 없다.
           */
          setRejection(toApiError(error));
        }

        /* 받아졌든 거부됐든 «그 건»은 큐에서 내린다. */
        attempts.current.delete(entry.idempotencyKey);
        if (sent) setSentTick((tick) => tick + 1);
        setEntries((prev) => {
          const next = prev.filter((one) => one.idempotencyKey !== entry.idempotencyKey);
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
  const enqueue = useCallback(
    (entry: Omit<OutboxEntry, 'idempotencyKey'> & { idempotencyKey?: string | null }): void => {
      const queued: OutboxEntry = {
        ...entry,
        idempotencyKey: entry.idempotencyKey ?? crypto.randomUUID(),
      };

      setRejection(null);
      setEntries((prev) => {
        const next = [...prev, queued];
        pendingWrite.current = next;

        return next;
      });
    },
    [],
  );

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
    isOnline,
    enqueue,
    rejection,
    clearRejection,
    isStalled,
    retryNow,
  };
};
