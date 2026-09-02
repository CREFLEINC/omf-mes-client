import type { ApiClient, components } from '@omf-mes/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';

/**
 * 비가동 outbox — **공유계약 C-1** · 스펙 §6-2.
 *
 * 통신이 끊긴 것 자체가 비가동 사유가 될 수 있는 화면이다. 온라인 전용으로 두면 **정작 그때
 * 쓰지 못한다.**
 *
 * | # | 규칙 | 여기서 |
 * | :-: | --- | --- |
 * | 1 | 멱등키는 **클라이언트가 생성**해 큐에 담는다 | 넣을 때 한 번 만든다 |
 * | 2 | **로컬 저장 후 즉시 성공 피드백** | `enqueue`가 곧 성공이다 |
 * | 3 | 발생 시각과 서버 수신 시각을 가른다 | 시작·끝은 본문에, 수신은 서버가 |
 * | 4 | **연결 상태와 미전송 건수를 상시 표시** | `pendingCount`를 헤더가 낸다 |
 * | 5 | 재전송은 **같은 키로** | 키는 항목에 붙어 시도마다 바뀌지 않는다 |
 *
 * ⛔ **오프라인이라고 202로 갈래를 나누지 않는다.** 요청 자체가 일어나지 않으므로 그런 응답이
 * 있을 수 없다 — 큐에 담기고, 나갈 때는 온라인과 같은 201을 받는다.
 *
 * ⚠ **큐는 브라우저 저장소에 담아 새로고침·재시작을 넘긴다.** 메모리에만 두면 단말을 한 번
 * 되살리는 것으로 기록이 사라지고, 작업자는 이미 성공을 보았으므로 사라진 줄 모른다.
 */

type Client = ApiClient['client'];
type DowntimeCreate = components['schemas']['DowntimeCreate'];
type Downtime = components['schemas']['Downtime'];

/**
 * 큐에 담긴 한 건. **두 갈래를 한 큐에 담는다** — 등록과 종료의 순서가 뒤집히면 아직 만들어지지
 * 않은 구간을 종료하려 들 수 있다.
 */
export type OutboxEntry =
  | { kind: 'create'; idempotencyKey: string; workerNo: string; body: DowntimeCreate }
  | { kind: 'close'; idempotencyKey: string; workerNo: string; downtimeId: number };

const STORAGE_KEY = 'omf-mes.downtime-register.outbox';

/**
 * 통신 실패 뒤 다시 시도하기까지.
 *
 * ⚠ **짧게 두지 않는다.** 끊긴 망에 대고 즉시 되던지면 단말이 요청을 쏟아 내고, 복구된 순간
 * 그 폭주가 서버로 향한다.
 */
export const RETRY_DELAY_MS = 5_000;

/**
 * 저장소에서 읽은 값이 **보낼 수 있는 모양인가.**
 *
 * ⛔ **믿고 넘기지 않는다.** 지난 판의 화면이 썼거나 손으로 고쳐졌을 수 있고, 그 끝에 있는
 * 것은 되돌릴 수 없는 기록이다. 계약이 필수로 둔 것만 확인한다.
 */
const isSendableEntry = (value: unknown): value is OutboxEntry => {
  if (typeof value !== 'object' || value === null) return false;

  const entry = value as Record<string, unknown>;
  if (typeof entry.idempotencyKey !== 'string' || entry.idempotencyKey === '') return false;
  if (typeof entry.workerNo !== 'string' || entry.workerNo === '') return false;

  if (entry.kind === 'close') return typeof entry.downtimeId === 'number';
  if (entry.kind !== 'create') return false;

  const body = entry.body;
  if (typeof body !== 'object' || body === null) return false;

  const fields = body as Record<string, unknown>;

  return (
    typeof fields.equipmentId === 'number' &&
    typeof fields.reasonCode === 'string' &&
    fields.reasonCode !== '' &&
    typeof fields.startedAt === 'string'
  );
};

/**
 * 저장소에서 큐를 읽는다.
 *
 * ⛔ **읽기가 화면을 세우지 못하게 하지 않는다.** 저장소 차단·손상된 값이 전부 던질 수 있는
 * 자리라, 실패하면 빈 큐로 시작한다 — 큐를 못 읽은 것이 화면이 뜨지 않을 이유가 되면 설비가
 * 멈춘 자리에서 아무것도 남기지 못한다.
 *
 * ⚠ **모양이 깨진 항목은 조용히 버린다.** 남겨 두면 큐 맨 앞에서 매번 거부돼 **그 뒤에 쌓인
 * 정상 건까지 함께 막는다.**
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
    /* 저장에 실패해도 큐는 메모리에 남아 이 세션 동안은 나간다. 여기서 던지면 이미 성공을
       본 작업자의 화면이 그 자리에서 무너진다. */
  }
};

const sendEntry = async (client: Client, entry: OutboxEntry): Promise<Downtime> => {
  /* ⛔ 시도마다 새로 만들지 않는다 — 재전송이 새 기록이 된다(C-1 #5). */
  const header = {
    'Idempotency-Key': entry.idempotencyKey,
    'X-Worker-No': entry.workerNo,
  };

  if (entry.kind === 'close') {
    return runRequest(() =>
      client.POST('/maintenance/downtimes/{downtimeId}:close', {
        /*
         * 잠금 토큰은 싣지 않는다 — 큐에 쌓인 요청은 그것을 가질 수 없고, 계약도 이
         * 오퍼레이션에서만 선택으로 완화했다(공유계약 C-9).
         */
        params: { path: { downtimeId: entry.downtimeId }, header },
      }),
    );
  }

  return runRequest(() =>
    client.POST('/maintenance/downtimes', { params: { header }, body: entry.body }),
  );
};

/**
 * 서버가 **받지 않기로 판정한** 실패인가.
 *
 * 통신이 끊긴 것은 기다리면 풀리고, 서버가 거부한 것은 아무리 기다려도 풀리지 않는다.
 * 뒤엣것을 계속 재전송하면 큐가 영원히 비지 않고 그 뒤에 쌓인 정상 건까지 함께 막힌다.
 */
const isRejected = (error: unknown): boolean => toApiError(error).kind !== 'network';

export interface OutboxRejection {
  entry: OutboxEntry;
  error: unknown;
}

export interface Outbox {
  /** 아직 서버에 닿지 않은 건수. **상시 표시가 필수 요건이다**(C-1 #4). */
  pendingCount: number;
  /**
   * 아직 나가지 않은 등록 건 — 오프라인에서 ④가 「내 단말 입력분」으로 그릴 근거다.
   *
   * 멱등키를 함께 낸다: 서버 번호가 아직 없는 줄이라 **목록의 안정된 이름이 이것뿐**이다.
   * 순번을 이름으로 쓰면 앞 건이 나간 순간 뒤 줄들의 이름이 한 칸씩 밀린다.
   */
  pendingCreates: readonly { idempotencyKey: string; body: DowntimeCreate }[];
  isOnline: boolean;
  /** 등록을 큐에 담는다. **이것이 곧 성공이다**(C-1 #2). */
  enqueueCreate: (workerNo: string, body: DowntimeCreate) => void;
  /** 「지금 종료」를 큐에 담는다. */
  enqueueClose: (workerNo: string, downtimeId: number) => void;
  /** 서버가 받아 준 건. */
  accepted: readonly Downtime[];
  /** 서버가 거부한 건. **그 건만** 되돌린다. */
  rejections: readonly OutboxRejection[];
  /** 이 회차의 결과를 지운다. ⛔ **큐를 비우는 것이 아니다.** */
  clearResults: () => void;
}

export const useOutbox = (): Outbox => {
  const { client } = useApiClient();

  const [entries, setEntries] = useState<OutboxEntry[]>(readStored);
  const [accepted, setAccepted] = useState<Downtime[]>([]);
  const [rejections, setRejections] = useState<OutboxRejection[]>([]);
  const [isOnline, setIsOnline] = useState(() => globalThis.navigator.onLine);

  /* 비우는 작업이 겹쳐 돌면 같은 항목이 두 번 나간다 — 키가 같아 서버가 흡수하지만, 굳이. */
  const draining = useRef(false);

  /*
   * 스스로 깨우는 타이머의 손잡이. **화면이 사라질 때 끊어야 한다** — 남겨 두면 이미 없는
   * 화면의 상태를 건드리고, 시험에서는 다음 시험 위로 요청이 하나 더 날아간다.
   */
  const retryTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (retryTimer.current !== null) globalThis.clearTimeout(retryTimer.current);
    },
    [],
  );

  /*
   * ⭐ **다시 시도할 계기를 만드는 자리다.** 통신이 끊겨 실패하면 큐도 연결 상태도 그대로라
   * 비우기 효과가 다시 돌 이유가 없다 — 그러면 큐는 연결이 살아 있는데도 영원히 멈춰 서고,
   * 작업자는 이미 성공을 보았으므로 멈춘 줄 모른다.
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
    /* 의존성이 비어 있는 것은 의도다 — 이 리스너는 단말이 사는 동안 한 벌만 있으면 된다. */
  }, []);

  useEffect(() => {
    if (entries.length === 0 || !isOnline || draining.current) return;

    draining.current = true;

    void (async () => {
      try {
        /*
         * 맨 앞 한 건만 보낸다 — 결과가 상태를 바꾸고 이 효과가 다시 돌아 다음 건을 집는다.
         * **순서를 지키는 것이 이 화면에서는 특히 중요하다**: 등록보다 종료가 먼저 나가면
         * 아직 없는 구간을 닫으려 든다.
         */
        const entry = entries[0];
        if (entry === undefined) return;

        try {
          const recorded = await sendEntry(client, entry);
          setAccepted((prev) => [...prev, recorded]);
        } catch (error) {
          /*
           * 통신이 끊긴 것이면 큐에 그대로 둔다 — 기다리면 풀린다. 다만 **가만히 두지는
           * 않는다**: 잠시 뒤 스스로 깨워 다시 시도한다. 연결 이벤트만 믿으면 「끊긴 적 없이
           * 실패한」 요청이 큐를 영원히 막는다.
           */
          if (!isRejected(error)) {
            retryTimer.current = globalThis.setTimeout(() => {
              retryTimer.current = null;
              setRetryTick((tick) => tick + 1);
            }, RETRY_DELAY_MS);

            return;
          }

          setRejections((prev) => [...prev, { entry, error }]);
        }

        /* 받아졌든 거부됐든 큐에서는 내린다. 거부는 **그 건만** 내린다. */
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

  const push = useCallback((entry: OutboxEntry): void => {
    setEntries((prev) => {
      const next = [...prev, entry];
      writeStored(next);

      return next;
    });
  }, []);

  const enqueueCreate = useCallback(
    (workerNo: string, body: DowntimeCreate): void => {
      push({ kind: 'create', idempotencyKey: crypto.randomUUID(), workerNo, body });
    },
    [push],
  );

  const enqueueClose = useCallback(
    (workerNo: string, downtimeId: number): void => {
      push({ kind: 'close', idempotencyKey: crypto.randomUUID(), workerNo, downtimeId });
    },
    [push],
  );

  const clearResults = useCallback((): void => {
    setAccepted([]);
    setRejections([]);
  }, []);

  return {
    pendingCount: entries.length,
    pendingCreates: entries.flatMap((entry) =>
      entry.kind === 'create' ? [{ idempotencyKey: entry.idempotencyKey, body: entry.body }] : [],
    ),
    isOnline,
    enqueueCreate,
    enqueueClose,
    accepted,
    rejections,
    clearResults,
  };
};
