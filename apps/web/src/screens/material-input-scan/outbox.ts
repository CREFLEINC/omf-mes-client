import type { ApiClient, components } from '@omf-mes/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { MAX_AUTO_ATTEMPTS, isRejected, retryDelayOf } from '../../patterns/outbox-policy';
import { runRequest, toApiError } from '../../patterns/request';

/**
 * 투입 기록 outbox — **공유계약 C-1**(✓확정 2026-08-02) · 스펙 §5-7.
 *
 * 이 화면이 POP 오프라인 폴백의 첫 사례다(예외 E-14). 조항이 정한 것은 다섯이고 순서가 있다.
 *
 * | # | 규칙 | 여기서 |
 * | :-: | --- | --- |
 * | 1 | `idempotency_key`는 **클라이언트가 생성**해 outbox에 담는다 | 넣을 때 한 번 만든다 |
 * | 2 | **로컬 저장 후 즉시 성공 피드백** — 통신을 기다리지 않는다 | `enqueue`가 곧 성공이다 |
 * | 3 | `occurred_at`(발생)과 `recorded_at`(서버 수신) 분리 | 발생 시각은 넣을 때 박는다 |
 * | 4 | **연결 상태와 미동기 건수를 상시 표시** | `pendingCount`를 헤더가 낸다 |
 * | 5 | 재전송은 **같은 키로** | 키는 항목에 붙어 있고 시도마다 바뀌지 않는다 |
 *
 * ⭐ **4번이 2번의 전제다.** 결정 기록이 그렇게 적었다 — 「전송 대기로 구분 표시」 대신
 * 「즉시 성공 + 미전송 건수 상시 노출」을 택하면서, **미전송 건수가 없으면 서버에 도달하지
 * 않은 사실을 알 방법이 사라지므로 그 표시는 선택이 아니라 필수 요건**이라고 못박았다.
 *
 * ⛔ **전체 롤백을 하지 않는다**(C-2). 서버가 거부하면 **그 건만** 되돌린다 — 40건 중 1건
 * 때문에 39건을 버리면 현장이 마비된다.
 *
 * ⚠ **저장은 이 단말 안에서만 산다.** 브라우저 저장소에 담아 새로고침·재시작을 넘긴다 —
 * 큐가 메모리에만 있으면 화면을 한 번 되살리는 것으로 기록이 사라지고, 작업자는 이미 성공을
 * 보았으므로 사라진 줄 모른다.
 */

type Client = ApiClient['client'];
type MaterialConsumptionCreate = components['schemas']['MaterialConsumptionCreate'];
type MaterialConsumption = components['schemas']['MaterialConsumption'];

/** 큐에 담긴 한 건. **키가 항목에 붙어 있다** — 재전송해도 같은 키로 나간다(C-1 #5). */
export interface OutboxEntry {
  idempotencyKey: string;
  workerNo: string;
  body: MaterialConsumptionCreate;
}

const STORAGE_KEY = 'omf-mes.material-input-scan.outbox';

/**
 * 저장소에서 읽은 값이 **보낼 수 있는 모양인가.**
 *
 * ⛔ **믿고 넘기지 않는다.** 이 값은 지난 판의 화면이 썼거나 손으로 고쳐졌을 수 있고, 그
 * 끝에 있는 것은 **되돌릴 수 없는 원장 쓰기**다 — 모양이 깨진 항목을 그대로 보내면 서버가
 * 무엇을 기록할지 화면이 알 수 없다. 계약이 필수로 둔 것만 확인한다.
 */
const isSendableEntry = (value: unknown): value is OutboxEntry => {
  if (typeof value !== 'object' || value === null) return false;

  const entry = value as Record<string, unknown>;
  if (typeof entry.idempotencyKey !== 'string' || entry.idempotencyKey === '') return false;
  if (typeof entry.workerNo !== 'string' || entry.workerNo === '') return false;

  const body = entry.body;
  if (typeof body !== 'object' || body === null) return false;

  const fields = body as Record<string, unknown>;

  return (
    typeof fields.workOrderId === 'number' &&
    typeof fields.itemId === 'number' &&
    typeof fields.lotId === 'number' &&
    typeof fields.inputQty === 'number' &&
    typeof fields.uomId === 'number' &&
    typeof fields.occurredAt === 'string'
  );
};

/**
 * 저장소에서 큐를 읽는다.
 *
 * ⛔ **읽기가 화면을 세우지 못하게 하지 않는다.** 사생활 보호 모드·저장소 차단·손상된 값이
 * 전부 던질 수 있는 자리라, 실패하면 빈 큐로 시작한다 — 큐를 못 읽은 것이 화면이 뜨지 않을
 * 이유가 되면 작업자는 아무것도 할 수 없다.
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
    /*
     * ⚠ 저장에 실패해도 큐는 메모리에 남아 이 세션 동안은 나간다. 여기서 던지면 **이미 성공을
     * 본 작업자의 화면이 그 자리에서 무너진다.**
     */
  }
};

const postEntry = async (client: Client, entry: OutboxEntry): Promise<MaterialConsumption> =>
  runRequest(() =>
    client.POST('/production/material-consumptions', {
      params: {
        header: {
          /* ⛔ 시도마다 새로 만들지 않는다 — 재전송이 새 전표가 된다(C-1 #5). */
          'Idempotency-Key': entry.idempotencyKey,
          'X-Worker-No': entry.workerNo,
        },
      },
      body: entry.body,
    }),
  );

export interface OutboxRejection {
  entry: OutboxEntry;
  error: unknown;
}

export interface Outbox {
  /** 아직 서버에 닿지 않은 건수. **상시 표시가 필수 요건이다**(C-1 #4). */
  pendingCount: number;
  /** 지금 연결돼 있는가. 건수와 함께 낸다. */
  isOnline: boolean;
  /** 큐에 담는다. **이것이 곧 성공이다** — 통신을 기다리지 않는다(C-1 #2). */
  enqueue: (workerNo: string, body: MaterialConsumptionCreate) => void;
  /** 서버가 받아 준 건. 화면이 「기록만 된 것」을 표시할 근거다(§5-3). */
  accepted: readonly MaterialConsumption[];
  /** 서버가 거부한 건. **그 건만** 되돌린다(C-2). */
  rejections: readonly OutboxRejection[];
  /**
   * 이 회차의 결과를 지운다 — 「투입 확정」으로 목록을 닫을 때 부른다.
   *
   * ⛔ **큐를 비우는 것이 아니다.** 아직 서버에 닿지 않은 건은 그대로 남아 계속 나간다.
   * 여기서 지우는 것은 **이미 끝난 건의 응답**뿐이다 — 남겨 두면 다음 회차에 같은 LOT을
   * 다시 담았을 때 지난 회차의 판정이 딸려와 표시가 겹친다.
   */
  clearResults: () => void;
  /**
   * 자동 재전송을 멈춘 상태인가. **항목은 큐에 그대로 있다** — 사라진 것이 아니라 멈춘 것이다.
   * 연결이 살아나거나 사람이 다시 시도하면 풀린다.
   */
  isStalled: boolean;
  /** 멈춘 큐를 사람이 깨운다. */
  retryNow: () => void;
}

/**
 * outbox 훅.
 *
 * ⚠ **한 번에 한 건씩 순서대로 보낸다.** 계보가 이 순서로 쌓이고, 병렬로 보내면 하나가
 * 실패했을 때 어디까지 갔는지 알 수 없다.
 */
export const useOutbox = (): Outbox => {
  const { client } = useApiClient();

  const [entries, setEntries] = useState<OutboxEntry[]>(readStored);
  const [accepted, setAccepted] = useState<MaterialConsumption[]>([]);
  const [rejections, setRejections] = useState<OutboxRejection[]>([]);
  const [isOnline, setIsOnline] = useState(() => globalThis.navigator.onLine);

  /* 비우는 작업이 겹쳐 돌면 같은 항목이 두 번 나간다 — 키가 같아 서버가 흡수하지만, 굳이. */
  const draining = useRef(false);

  /*
   * ⭐ **다시 시도할 계기를 만드는 자리다.** 통신이 끊겨 실패하면 큐도 연결 상태도 그대로라
   * 비우기 효과가 **다시 돌 이유가 없다** — 그러면 큐는 연결이 살아 있는데도 영원히 멈춰
   * 서고, 작업자는 이미 성공을 보았으므로 멈춘 줄 모른다. 이 값을 올려 효과를 깨운다.
   */
  const [retryTick, setRetryTick] = useState(0);

  /**
   * 예약해 둔 재시도. **언마운트에서 지운다** — 남겨 두면 화면을 떠난 뒤에도 최장 1분간
   * 클로저가 살아 있다.
   */
  const retryTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (retryTimer.current !== null) globalThis.clearTimeout(retryTimer.current);
    },
    [],
  );

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
    /*
     * 의존성이 비어 있는 것은 의도다 — 이 리스너는 **단말이 사는 동안 한 벌만** 있으면 된다.
     * 무엇에도 의존하지 않고 상태 갱신 함수만 부르므로 다시 걸 이유가 없고, 다시 걸면 등록·
     * 해제가 렌더마다 오간다.
     */
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
          const recorded = await postEntry(client, entry);
          setAccepted((prev) => [...prev, recorded]);
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
             * 작업자가 스캔한 것이 사라지고, 그것이 이 큐가 막으려는 일이다.
             */
            if (tried >= MAX_AUTO_ATTEMPTS) {
              setIsStalled(true);

              return;
            }

            /*
             * ⛔ **앞 예약을 덮어쓰지 않는다.** 손잡이를 하나만 들고 있으므로 확인 없이 덮으면
             * 앞 타이머는 아무도 끊지 못한 채 남아, 화면이 사라진 뒤에 발화한다.
             */
            if (retryTimer.current !== null) globalThis.clearTimeout(retryTimer.current);

            retryTimer.current = globalThis.setTimeout(() => {
              retryTimer.current = null;
              setRetryTick((tick) => tick + 1);
            }, retryDelayOf(tried));

            return;
          }

          setRejections((prev) => [...prev, { entry, error }]);
        }

        /* 받아졌든 거부됐든 큐에서는 내린다. 거부는 **그 건만** 내린다(C-2). */
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

  const enqueue = useCallback((workerNo: string, body: MaterialConsumptionCreate): void => {
    setEntries((prev) => {
      const next = [...prev, { idempotencyKey: crypto.randomUUID(), workerNo, body }];
      writeStored(next);

      return next;
    });
  }, []);

  const clearResults = useCallback((): void => {
    setAccepted([]);
    setRejections([]);
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
    accepted,
    rejections,
    clearResults,
    isStalled,
    retryNow,
  };
};
