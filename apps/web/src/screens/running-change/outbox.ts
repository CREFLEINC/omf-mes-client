import type { ApiClient, components } from '@omf-mes/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';

/**
 * 교체 등록 outbox — **공유계약 C-1** · 스펙 §6(오프라인 → 큐잉).
 *
 * 조항이 정한 것은 다섯이고 순서가 있다.
 *
 * | # | 규칙 | 여기서 |
 * | :-: | --- | --- |
 * | 1 | `idempotency_key`는 **클라이언트가 생성**해 outbox 에 담는다 | 넣을 때 한 번 만든다 |
 * | 2 | **로컬 저장 후 즉시 성공 피드백** — 통신을 기다리지 않는다 | `enqueue`가 곧 성공이다 |
 * | 3 | `occurred_at`(발생)과 `recorded_at`(서버 수신) 분리 | 발생 시각은 넣을 때 박는다 |
 * | 4 | **연결 상태와 미동기 건수를 상시 표시** | `pendingCount`를 헤더가 낸다 |
 * | 5 | 재전송은 **같은 키로** | 키는 항목에 붙어 있고 시도마다 바뀌지 않는다 |
 *
 * ⭐ **4번이 2번의 전제다.** 「즉시 성공 + 미전송 건수 상시 노출」을 택한 결정 기록이,
 * **미전송 건수가 없으면 서버에 도달하지 않은 사실을 알 방법이 사라지므로 그 표시는 선택이
 * 아니라 필수 요건**이라고 못박았다.
 *
 * ⛔ **`202` 분기를 만들지 않는다**(통지 #97). 오프라인이면 HTTP 요청 자체가 일어나지 않아
 * 서버가 `202`를 보낼 수 없다 — 응답은 `201` 하나다.
 *
 * ⛔ **전체 롤백을 하지 않는다**(C-2). 서버가 거부하면 **그 건만** 되돌린다.
 *
 * ⚠ **저장은 이 단말 안에서만 산다.** 브라우저 저장소에 담아 새로고침·재시작을 넘긴다 —
 * 큐가 메모리에만 있으면 화면을 한 번 되살리는 것으로 기록이 사라지고, 작업자는 이미 성공을
 * 보았으므로 사라진 줄 모른다.
 *
 * ⚠ **저장소 키가 화면마다 다르다.** `P-02-03`의 큐와 섞이면 한쪽의 실패가 다른 쪽의 목록을
 * 막는다 — 같은 오퍼레이션을 부르지만 화면이 되돌리는 대상이 다르다.
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 * 경로 리터럴도 여기에만 둔다.
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

const STORAGE_KEY = 'omf-mes.running-change.outbox';

/**
 * 통신 실패 뒤 다시 시도하기까지.
 *
 * ⚠ **짧게 두지 않는다.** 끊긴 망에 대고 즉시 되던지면 단말이 요청을 쏟아 내고, 복구된 순간
 * 그 폭주가 서버로 향한다.
 */
const RETRY_DELAY_MS = 5_000;

/**
 * 저장소에서 읽은 값이 **보낼 수 있는 모양인가.**
 *
 * ⛔ **믿고 넘기지 않는다.** 이 값은 지난 판의 화면이 썼거나 손으로 고쳐졌을 수 있고, 그
 * 끝에 있는 것은 **지워지지 않는 원장 쓰기**다.
 *
 * ⭐ **`replacedConsumptionId`도 함께 잰다.** 그 칸이 빠진 항목이 나가면 같은 오퍼레이션이
 * **평범한 투입**으로 기록되어 이전 부품과 이어지지 않는다 — 오류 없이 조용히 어긋나고,
 * 교체는 지우지 않고 잇는 것이라 되돌릴 방법이 없다(§5-2).
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
    typeof fields.replacedConsumptionId === 'number' &&
    typeof fields.inputQty === 'number' &&
    typeof fields.uomId === 'number' &&
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
          /* ⛔ 필수다 — 없으면 서버가 거부한다. **인증이 아니라 귀속**이다(누가 한 일인가). */
          'X-Worker-No': entry.workerNo,
        },
      },
      body: entry.body,
    }),
  );

/**
 * 서버가 **받지 않기로 판정한** 실패인가.
 *
 * 갈래를 가르는 것이 이 큐의 핵심이다 — 통신이 끊긴 것은 **기다리면 풀리고**, 서버가 거부한
 * 것은 아무리 기다려도 풀리지 않는다. 뒤엣것을 계속 재전송하면 큐가 영원히 비지 않고 그 뒤에
 * 쌓인 정상 건까지 함께 막힌다.
 */
const isRejected = (error: unknown): boolean => toApiError(error).kind !== 'network';

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
  /** 서버가 받아 준 건. */
  accepted: readonly MaterialConsumption[];
  /** 서버가 거부한 건. **그 건만** 되돌린다(C-2). */
  rejections: readonly OutboxRejection[];
  /**
   * 이 회차의 결과를 지운다.
   *
   * ⛔ **큐를 비우는 것이 아니다.** 아직 서버에 닿지 않은 건은 그대로 남아 계속 나간다.
   */
  clearResults: () => void;
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

  useEffect(() => {
    const goOnline = (): void => {
      setIsOnline(true);
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
     */
  }, []);

  useEffect(() => {
    if (entries.length === 0 || !isOnline || draining.current) return;

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
            globalThis.setTimeout(() => {
              setRetryTick((tick) => tick + 1);
            }, RETRY_DELAY_MS);

            return;
          }

          setRejections((prev) => [...prev, { entry, error }]);
        }

        /* 받아졌든 거부됐든 큐에서는 내린다. 거부는 **그 건만** 내린다(C-2). */
        setEntries((prev) => {
          const next = prev.filter((one) => one.idempotencyKey !== entry.idempotencyKey);
          writeStored(next);

          return next;
        });
      } finally {
        draining.current = false;
      }
    })();
  }, [client, entries, isOnline, retryTick]);

  const enqueue = useCallback((workerNo: string, body: MaterialConsumptionCreate): void => {
    /*
     * ⛔ **키를 갱신 함수 밖에서 만든다.** 갱신 함수는 순수해야 하고 React 가 같은 갱신을
     * 여러 번 부를 수 있다 — 그 안에서 만들면 **한 건의 키가 호출마다 달라질 여지**가 열린다.
     * 재전송이 새 전표가 되는 것이 이 화면에서 가장 비싼 사고다(C-1 #5).
     */
    const entry: OutboxEntry = { idempotencyKey: crypto.randomUUID(), workerNo, body };

    setEntries((prev) => {
      const next = [...prev, entry];
      writeStored(next);

      return next;
    });
  }, []);

  const clearResults = useCallback((): void => {
    setAccepted([]);
    setRejections([]);
  }, []);

  return { pendingCount: entries.length, isOnline, enqueue, accepted, rejections, clearResults };
};
