import type { ApiClient } from '@omf-mes/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { splitError, type SplitError } from '../../patterns/master';
import { runRequest, toApiError } from '../../patterns/request';
import { SAVE_FIELDS } from './queries';
import type { ProductionResultCreate } from './types';

/**
 * 작업실적 outbox — **공유계약 C-1** · 스펙 §5-3.
 *
 * 스펙 §5-3 이 이 화면을 오프라인 대상으로 못박았다. 조항이 정한 다섯을 여기서 지킨다.
 *
 * | # | 규칙 | 여기서 |
 * | :-: | --- | --- |
 * | 1 | `idempotency_key` 는 **클라이언트가 생성**해 outbox 에 담는다 | 담을 때 한 번 만든다 |
 * | 2 | **로컬 저장 후 즉시 성공 피드백** — 통신을 기다리지 않는다 | `enqueue` 가 곧 성공이다 |
 * | 3 | 발생 시각과 서버 수신 시각을 분리 | `occurredAt` 을 담을 때 박는다 |
 * | 4 | **연결 상태와 미동기 건수를 상시 표시** | `pendingCount` 를 머리가 낸다 |
 * | 5 | 재전송은 **같은 키로** | 키가 항목에 붙어 있고 시도마다 바뀌지 않는다 |
 *
 * ⭐ **4번이 2번의 전제다.** 미전송 건수가 없으면 서버에 도달하지 않은 사실을 알 방법이
 * 사라지므로, 그 표시는 선택이 아니라 필수 요건이다.
 *
 * ⛔ **`202` 분기를 만들지 않는다.** 오프라인이면 요청 자체가 나가지 않아 서버가 `202` 를 보낼
 * 수 없다 — 이 경로의 성공 응답은 `201` 하나다(변경 통지 #97).
 *
 * ⛔ **`If-Match` 를 싣지 않는다**(C-9). 새로 만드는 쓰기라 잠글 판본이 없고, 큐에 쌓인 요청은
 * 토큰을 싣지 않는다.
 *
 * ⚠ **사번을 항목에 함께 담는다.** 재전송은 화면이 다시 그려진 뒤에 일어날 수 있는데, 그때
 * 진입값이 비어 있으면 헤더를 채울 수 없어 **서버가 거부한다.** 담을 때의 사번이 그 실적을
 * 「누가 한 일」로 만드는 값이므로 나중 값으로 대신할 수도 없다(귀속 조항 D-5).
 *
 * ⚠ **키를 저장소에 함께 담는 이유** — 훅이 들고 있는 멱등 키는 메모리에만 살아서 새로고침을
 * 넘기지 못한다. 넘기지 못하면 같은 실적이 **두 건**으로 기록된다.
 */

type Client = ApiClient['client'];

/** 큐에 담긴 한 건. */
export interface OutboxEntry {
  idempotencyKey: string;
  /** 이 쓰기의 귀속 사번. 헤더로만 나가고 본문에는 실리지 않는다. */
  workerNo: string;
  body: ProductionResultCreate;
}

export const STORAGE_KEY = 'omf-mes.production-result.outbox';

/**
 * 통신 실패 뒤 다시 시도하기까지.
 *
 * ⚠ **짧게 두지 않는다.** 끊긴 망에 대고 즉시 되던지면 단말이 요청을 쏟아 내고, 복구된 순간
 * 그 폭주가 서버로 향한다.
 */
const RETRY_DELAY_MS = 5_000;

/**
 * 재시도 간격의 상한. 시도마다 두 배로 늘리되 여기서 멈춘다.
 *
 * ⚠ **간격을 고정하면 장애가 길어질수록 손해가 커진다.** 밤새 켜 둔 단말이 5초마다 던지면
 * 장애 중인 서버가 그 폭주를 함께 받는다.
 */
const MAX_RETRY_DELAY_MS = 60_000;

/**
 * 같은 항목을 몇 번까지 **자동으로** 다시 보낼 것인가.
 *
 * ⛔ **넘었다고 큐에서 내리지 않는다.** 내리면 작업자가 친 실적이 사라진다 — 그것이 이 큐가
 * 막으려는 바로 그 일이다. 자동 재전송만 멈추고 항목은 그대로 두며, 대신 **막혀 있다는 사실을
 * 화면이 말한다.** 연결 이벤트가 오면 다시 센다.
 */
export const MAX_AUTO_ATTEMPTS = 6;

export const retryDelayOf = (attempts: number): number =>
  Math.min(RETRY_DELAY_MS * 2 ** (attempts - 1), MAX_RETRY_DELAY_MS);

/**
 * 저장소에서 읽은 값이 **보낼 수 있는 모양인가.**
 *
 * ⛔ **믿고 넘기지 않는다.** 지난 판의 화면이 썼거나 손으로 고쳐졌을 수 있고, 그 끝에 있는
 * 것은 **되돌릴 수 없는 실적 기록**이다. 계약이 필수로 둔 것과 헤더가 요구하는 것만 확인한다.
 */
export const isSendableEntry = (value: unknown): value is OutboxEntry => {
  if (typeof value !== 'object' || value === null) return false;

  const entry = value as Record<string, unknown>;
  if (typeof entry.idempotencyKey !== 'string' || entry.idempotencyKey === '') return false;
  if (typeof entry.workerNo !== 'string' || entry.workerNo === '') return false;

  const body = entry.body;
  if (typeof body !== 'object' || body === null) return false;

  const fields = body as Record<string, unknown>;

  return (
    typeof fields.workOrderId === 'number' &&
    typeof fields.goodQty === 'number' &&
    typeof fields.uomId === 'number' &&
    typeof fields.resultSourceCode === 'string' &&
    typeof fields.occurredAt === 'string'
  );
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
    /* ⚠ 저장에 실패해도 큐는 메모리에 남아 이 세션 동안은 나간다. 여기서 던지면 이미 성공을
     * 본 작업자의 화면이 그 자리에서 무너진다. */
  }
};

const postEntry = async (client: Client, entry: OutboxEntry): Promise<void> => {
  await runRequest(() =>
    client.POST('/production/production-results', {
      params: {
        header: {
          /* ⛔ 시도마다 새로 만들지 않는다 — 재전송이 새 실적이 된다(C-1 #5). */
          'Idempotency-Key': entry.idempotencyKey,
          /* ⛔ 없으면 서버가 거부한다. 인증이 아니라 귀속이다(D-5). */
          'X-Worker-No': entry.workerNo,
        },
      },
      body: entry.body,
    }),
  );
};

/**
 * 기다리면 풀리는 상태 코드 — 서버가 「지금은 못 받는다」고 말한 것이지 「이 실적은 안 된다」고
 * 판정한 것이 아니다. 408 요청 시간초과 · 429 요청 과다 · 5xx 서버 오류가 여기 든다.
 */
const isTransientStatus = (status: number): boolean =>
  status >= 500 || status === 429 || status === 408;

/**
 * 서버가 **받지 않기로 판정한** 실패인가.
 *
 * 통신이 끊긴 것은 기다리면 풀리고, 서버가 거부한 것은 아무리 기다려도 풀리지 않는다.
 * 뒤엣것을 계속 재전송하면 큐가 영원히 비지 않는다.
 *
 * ⛔ **연결이 끊긴 것만 「기다림」으로 보면 안 된다.** 서버 재기동(502·503·504)·과부하(429)도
 * 기다리면 풀리는 실패인데, 이것을 거부로 읽으면 항목이 큐에서 내려간다. 그 시점의 화면은 이미
 * 「저장했습니다」를 띄우고 초안을 비운 뒤라 **작업자가 친 값을 되돌릴 방법이 없다** — 처음부터
 * 다시 쳐야 한다. 큐에 남겨 두면 서버가 돌아왔을 때 같은 멱등 키로 나간다.
 *
 * ⚠ 상태 코드를 모르는 실패(`status === 0`)는 그대로 거부로 다룬다. 무엇이 잘못됐는지 말해 주지
 * 못하는 실패를 무한히 재전송하면 큐가 그 한 건에 영원히 막힌다.
 */
export const isRejected = (error: unknown): boolean => {
  const apiError = toApiError(error);

  if (apiError.kind === 'network') return false;

  return !(apiError.kind === 'http' && isTransientStatus(apiError.status));
};

export interface Outbox {
  /** 아직 서버에 닿지 않은 건수. **상시 표시가 필수 요건이다**(C-1 #4). */
  pendingCount: number;
  /** 지금 연결돼 있는가. 건수와 함께 낸다 — 끊긴 것과 밀리는 것은 다르다. */
  isOnline: boolean;
  /** 큐에 담는다. **이것이 곧 성공이다** — 통신을 기다리지 않는다(C-1 #2). */
  enqueue: (workerNo: string, body: ProductionResultCreate) => void;
  /** 서버가 거부한 것 — 인라인용·배너용으로 갈라 둔다. 없으면 `null`. */
  rejection: SplitError | null;
  clearRejection: () => void;
  /**
   * 자동 재전송을 멈춘 상태인가. **항목은 큐에 그대로 있다** — 사라진 것이 아니라 멈춘 것이다.
   * 연결이 살아나거나 사용자가 다시 시도하면 풀린다.
   */
  isStalled: boolean;
  /** 멈춘 큐를 사람이 깨운다. */
  retryNow: () => void;
}

/**
 * outbox 훅.
 *
 * ⚠ **한 번에 한 건씩 순서대로 보낸다.** 병렬로 보내면 하나가 실패했을 때 어디까지 갔는지
 * 알 수 없다.
 */
export const useOutbox = (): Outbox => {
  const { client } = useApiClient();

  const [entries, setEntries] = useState<OutboxEntry[]>(readStored);
  const [rejection, setRejection] = useState<SplitError | null>(null);
  const [isOnline, setIsOnline] = useState(() => globalThis.navigator.onLine);

  /* 비우는 작업이 겹쳐 돌면 같은 항목이 두 번 나간다 — 키가 같아 서버가 흡수하지만, 굳이. */
  const draining = useRef(false);

  /*
   * ⭐ **다시 시도할 계기를 만드는 자리다.** 통신이 끊겨 실패하면 큐도 연결 상태도 그대로라
   * 비우기 효과가 다시 돌 이유가 없다 — 그러면 큐는 연결이 살아 있는데도 영원히 멈춰 선다.
   */
  const [retryTick, setRetryTick] = useState(0);

  /** 항목별 자동 재전송 시도 횟수. 메모리에만 둔다 — 새로 뜨면 다시 세는 것이 맞다. */
  const attempts = useRef(new Map<string, number>());
  const [isStalled, setIsStalled] = useState(false);

  useEffect(() => {
    const goOnline = (): void => {
      setIsOnline(true);
      /* 연결이 새로 섰으면 사정이 달라졌을 수 있다 — 시도 횟수를 다시 센다. */
      attempts.current.clear();
      setIsStalled(false);
      /* 이미 온라인으로 알고 있었더라도 깨운다 — 상태가 그대로면 효과가 돌지 않는다. */
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

        try {
          await postEntry(client, entry);
        } catch (error) {
          /*
           * 통신이 끊긴 것이면 큐에 그대로 둔다 — 기다리면 풀린다. 다만 **가만히 두지는
           * 않는다**: 잠시 뒤 스스로 깨워 다시 시도한다. 연결 이벤트만 믿으면 「끊긴 적 없이
           * 실패한」 요청이 큐를 영원히 막는다.
           */
          if (!isRejected(error)) {
            const tried = (attempts.current.get(entry.idempotencyKey) ?? 0) + 1;
            attempts.current.set(entry.idempotencyKey, tried);

            /*
             * 상한을 넘었다 — 자동 재전송만 멈춘다. ⛔ 항목은 큐에 남긴다: 여기서 내리면
             * 작업자가 친 실적이 사라지고, 그것이 이 큐가 막으려는 일이다.
             */
            if (tried >= MAX_AUTO_ATTEMPTS) {
              setIsStalled(true);

              return;
            }

            globalThis.setTimeout(() => {
              setRetryTick((tick) => tick + 1);
            }, retryDelayOf(tried));

            return;
          }

          setRejection(splitError(toApiError(error), SAVE_FIELDS, undefined));
        }

        /* 받아졌든 거부됐든 큐에서는 내린다. 거부는 **그 건만** 내린다. */
        attempts.current.delete(entry.idempotencyKey);
        setEntries((prev) => {
          const next = prev.filter((one) => one.idempotencyKey !== entry.idempotencyKey);
          writeStored(next);

          return next;
        });
      } finally {
        draining.current = false;
      }
    })();
  }, [client, entries, isOnline, isStalled, retryTick]);

  const enqueue = useCallback((workerNo: string, body: ProductionResultCreate): void => {
    setRejection(null);
    setEntries((prev) => {
      const next = [...prev, { idempotencyKey: crypto.randomUUID(), workerNo, body }];
      writeStored(next);

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
    isOnline,
    enqueue,
    rejection,
    clearRejection,
    isStalled,
    retryNow,
  };
};
