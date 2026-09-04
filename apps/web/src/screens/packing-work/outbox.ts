import type { ApiClient, ApiError } from '@omf-mes/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { MAX_AUTO_ATTEMPTS, isRejected, retryDelayOf } from '../../patterns/outbox-policy';
import { runRequest, toApiError } from '../../patterns/request';
import type { HandlingUnitPack } from './types';

/**
 * 포장 확정 outbox — **공유계약 C-1** · 스펙 §6 「오프라인 → 큐잉」.
 *
 * ⭐ **큐에 담는 것은 확정(`:pack`) 하나다.** 이 화면의 쓰기는 둘인데 앞의 등록
 * (`POST …/handling-units`)은 서버가 번호를 매겨 돌려주는 쓰기라 오프라인에서 부를 수 없고,
 * 계약도 그것을 오프라인 대상으로 표시하지 않았다 — 오프라인 표시가 붙은 것은 `:pack` 뿐이다.
 * 번호를 이미 받은 뒤라면 경로 인자가 갖춰져 있어 큐잉이 성립한다. 성립하지 않는 것은
 * **오프라인 상태에서 포장을 새로 시작하는 것** 하나이며, 그 자리는 화면이 막고 말한다.
 *
 * ⚠ **등록 호출의 시점 자체는 설계 회신에 달려 있다**(#796). 회신이 「확정 시점에 만든다」로
 * 오면 등록이 이 큐 앞으로 합쳐지고, 그때 바뀌는 것은 담기는 항목의 모양이지 이 훅의 골격이
 * 아니다.
 *
 * 조항이 정한 다섯을 여기서 지킨다.
 *
 * | # | 규칙 | 여기서 |
 * | :-: | --- | --- |
 * | 1 | `idempotency_key` 는 **클라이언트가 생성**해 outbox 에 담는다 | 담을 때 한 번 만든다 |
 * | 2 | **로컬 저장 후 즉시 성공 피드백** | `enqueue` 가 곧 확정이다 |
 * | 3 | 발생 시각과 서버 수신 시각을 분리 | `occurredAt`·`businessDate` 를 담을 때 박는다 |
 * | 4 | **연결 상태와 미동기 건수를 상시 표시** | `pendingCount`·`isOnline` 을 화면이 낸다 |
 * | 5 | 재전송은 **같은 키로** | 키가 항목에 붙어 시도마다 바뀌지 않는다 |
 *
 * ⛔ **`If-Match` 를 싣지 않는다**(C-9). 계약이 확정의 잠금 토큰을 선택으로 두었고, 큐에 쌓인
 * 요청은 잠글 판본을 들고 있을 수 없다 — 담긴 뒤 서버가 앞서 나가면 **기다렸다는 이유로**
 * 거부된다.
 *
 * ⚠ **사번을 항목에 함께 담는다** — 헤더를 채우지 못하면 서버가 거부하고, 나중 값으로 대신할
 * 수도 없다. 그 포장을 「누가 한 일」로 만드는 값이다(귀속 조항 D-5).
 *
 * ⚠ **판정은 `patterns/outbox-policy` 것을 쓴다** — 「기다릴 것인가 버릴 것인가」를 화면마다
 * 다시 쓰지 않는다(#772).
 */

type Client = ApiClient['client'];

/** 큐에 담긴 확정 한 건. */
export interface OutboxEntry {
  idempotencyKey: string;
  /** 확정할 포장 단위. **담을 때의 번호다** — 재전송 시점에 다시 고르지 않는다. */
  handlingUnitId: number;
  /** 이 쓰기의 귀속 사번. 헤더로만 나가고 본문에는 실리지 않는다. */
  workerNo: string;
  body: HandlingUnitPack;
}

export const STORAGE_KEY = 'omf-mes.packing-work.outbox';

/**
 * 저장소에서 읽은 값이 **보낼 수 있는 모양인가.**
 *
 * ⛔ **믿고 넘기지 않는다.** 지난 판의 화면이 썼거나 손으로 고쳐졌을 수 있고, 그 끝에 있는
 * 것은 해체 경로가 없는 확정이다(스펙 §8-4). 계약이 필수로 둔 것과 헤더가 요구하는 것만
 * 확인한다.
 */
export const isSendableEntry = (value: unknown): value is OutboxEntry => {
  if (typeof value !== 'object' || value === null) return false;

  const entry = value as Record<string, unknown>;
  if (typeof entry.idempotencyKey !== 'string' || entry.idempotencyKey === '') return false;
  if (typeof entry.handlingUnitId !== 'number') return false;
  if (typeof entry.workerNo !== 'string' || entry.workerNo === '') return false;

  const body = entry.body;
  if (typeof body !== 'object' || body === null) return false;

  const fields = body as Record<string, unknown>;

  /* 내용물이 비면 서버가 400 이다(계약) — 빈 확정을 큐에 남겨 두면 매번 거부된다. */
  if (!Array.isArray(fields.contents) || fields.contents.length === 0) return false;

  return typeof fields.businessDate === 'string' && typeof fields.occurredAt === 'string';
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

    return Array.isArray(parsed) ? parsed.filter(isSendableEntry) : [];
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

const postEntry = async (client: Client, entry: OutboxEntry): Promise<void> => {
  await runRequest(() =>
    client.POST('/inventory/handling-units/{handlingUnitId}:pack', {
      params: {
        path: { handlingUnitId: entry.handlingUnitId },
        header: {
          /* ⛔ 시도마다 새로 만들지 않는다 — 재전송이 새 확정이 된다(C-1 #5). */
          'Idempotency-Key': entry.idempotencyKey,
          /* ⛔ 없으면 서버가 거부한다. 인증이 아니라 귀속이다(D-5). */
          'X-Worker-No': entry.workerNo,
        },
      },
      body: entry.body,
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
  /** 큐에 담는다. **이것이 곧 확정이다** — 통신을 기다리지 않는다(C-1 #2). */
  enqueue: (entry: Omit<OutboxEntry, 'idempotencyKey'>) => void;
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
  const enqueue = useCallback((entry: Omit<OutboxEntry, 'idempotencyKey'>): void => {
    const queued: OutboxEntry = { idempotencyKey: crypto.randomUUID(), ...entry };

    setRejection(null);
    setEntries((prev) => {
      const next = [...prev, queued];
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
    isOnline,
    enqueue,
    rejection,
    clearRejection,
    isStalled,
    retryNow,
  };
};
