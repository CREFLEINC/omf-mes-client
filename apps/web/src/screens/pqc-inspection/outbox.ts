import type { ApiClient, components } from '@omf-mes/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { splitError, type SplitError } from '../../patterns/master';
import { runRequest, toApiError } from '../../patterns/request';

import { SAVE_FIELDS } from './queries';

/**
 * 검사 결과 outbox — **공유계약 C-1**(✓확정 2026-08-02) · 스펙 §5-7.
 *
 * 스펙 §5-7 이 이 화면을 오프라인 대상으로 못박았다(「현장 검사가 통신에 묶이면 안 된다」).
 * 조항이 정한 다섯을 여기서 지킨다.
 *
 * | # | 규칙 | 여기서 |
 * | :-: | --- | --- |
 * | 1 | `idempotency_key` 는 **클라이언트가 생성**해 outbox 에 담는다 | 담을 때 한 번 만든다 |
 * | 2 | **로컬 저장 후 즉시 성공 피드백** — 통신을 기다리지 않는다 | `enqueue` 가 곧 성공이다 |
 * | 3 | 발생 시각과 서버 수신 시각을 분리 | `inspectedAt` 을 담을 때 박는다 |
 * | 4 | **연결 상태와 미동기 건수를 상시 표시** | `pendingCount` 를 머리가 낸다 |
 * | 5 | 재전송은 **같은 키로** | 키가 항목에 붙어 있고 시도마다 바뀌지 않는다 |
 *
 * ⭐ **4번이 2번의 전제다.** 「즉시 성공 + 미전송 건수 상시 노출」을 택한 결정 기록이
 * **미전송 건수가 없으면 서버에 도달하지 않은 사실을 알 방법이 사라지므로 그 표시는 선택이
 * 아니라 필수 요건**이라고 못박았다.
 *
 * ⛔ **`If-Match` 를 싣지 않는다**(C-9). 이 경로는 언제나 새로 만들기라 견줄 판본이 없다.
 *
 * ⚠ **키를 저장소에 함께 담는 이유** — 훅이 들고 있는 멱등 키는 메모리에만 살아서 새로고침을
 * 넘기지 못한다. 넘기지 못하면 같은 검사가 **두 건의 결과**로 기록된다. 확정은 되돌릴 수
 * 없는 쓰기라 그 사고가 특히 비싸다.
 */

type Client = ApiClient['client'];
type InspectionResultCreate = components['schemas']['InspectionResultCreate'];
type InspectionResultResponse = components['schemas']['InspectionResult'];

/** 큐에 담긴 한 건. 검사 결과는 회차마다 한 건이지만 큐는 밀릴 수 있어 배열로 든다. */
export interface OutboxEntry {
  idempotencyKey: string;
  /** 무엇으로 눌렀나 — 화면이 「임시 저장됨」과 「확정됨」을 가르는 근거다. */
  statusCode: InspectionResultCreate['statusCode'];
  body: InspectionResultCreate;
}

const STORAGE_KEY = 'omf-mes.pqc-inspection.outbox';

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
 * ⛔ **믿고 넘기지 않는다.** 지난 판의 화면이 썼거나 손으로 고쳐졌을 수 있고, 그 끝에 있는
 * 것은 **되돌릴 수 없는 판정 기록**이다. 계약이 필수로 둔 것만 확인한다.
 */
const isSendableEntry = (value: unknown): value is OutboxEntry => {
  if (typeof value !== 'object' || value === null) return false;

  const entry = value as Record<string, unknown>;
  if (typeof entry.idempotencyKey !== 'string' || entry.idempotencyKey === '') return false;
  if (typeof entry.statusCode !== 'string' || entry.statusCode === '') return false;

  const body = entry.body;
  if (typeof body !== 'object' || body === null) return false;

  const fields = body as Record<string, unknown>;

  return (
    typeof fields.inspectionRequestId === 'number' &&
    typeof fields.inspectedQty === 'number' &&
    typeof fields.acceptedQty === 'number' &&
    typeof fields.rejectedQty === 'number' &&
    typeof fields.heldQty === 'number' &&
    typeof fields.uomId === 'number' &&
    typeof fields.inspectedAt === 'string' &&
    typeof fields.statusCode === 'string'
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
     * 본 검사자의 화면이 그 자리에서 무너진다. */
  }
};

const postEntry = async (client: Client, entry: OutboxEntry): Promise<InspectionResultResponse> =>
  runRequest(() =>
    client.POST('/quality/inspection-results', {
      /* ⛔ 시도마다 새로 만들지 않는다 — 재전송이 새 검사 결과가 된다(C-1 #5). */
      params: { header: { 'Idempotency-Key': entry.idempotencyKey } },
      body: entry.body,
    }),
  );

/**
 * 서버가 **받지 않기로 판정한** 실패인가.
 *
 * 통신이 끊긴 것은 기다리면 풀리고, 서버가 거부한 것은 아무리 기다려도 풀리지 않는다.
 * 뒤엣것을 계속 재전송하면 큐가 영원히 비지 않는다.
 */
const isRejected = (error: unknown): boolean => toApiError(error).kind !== 'network';

export interface Outbox {
  /** 아직 서버에 닿지 않은 건수. **상시 표시가 필수 요건이다**(C-1 #4). */
  pendingCount: number;
  /** 지금 연결돼 있는가. 건수와 함께 낸다 — 끊긴 것과 밀리는 것은 다르다. */
  isOnline: boolean;
  /** 큐에 담는다. **이것이 곧 성공이다** — 통신을 기다리지 않는다(C-1 #2). */
  enqueue: (statusCode: InspectionResultCreate['statusCode'], body: InspectionResultCreate) => void;
  /** 서버가 거부한 것 — 인라인용·배너용으로 갈라 둔다. 없으면 `null`. */
  rejection: SplitError | null;
  /** 거부 표시를 지운다 — 사용자가 값을 고쳐 다시 저장할 때 부른다. */
  clearRejection: () => void;
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
    /* 의존성이 비어 있는 것은 의도다 — 리스너는 단말이 사는 동안 한 벌만 있으면 된다. */
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
          await postEntry(client, entry);
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

          setRejection(splitError(toApiError(error), SAVE_FIELDS, undefined));
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

  const enqueue = useCallback(
    (statusCode: InspectionResultCreate['statusCode'], body: InspectionResultCreate): void => {
      setRejection(null);
      setEntries((prev) => {
        const next = [...prev, { idempotencyKey: crypto.randomUUID(), statusCode, body }];
        writeStored(next);

        return next;
      });
    },
    [],
  );

  const clearRejection = useCallback((): void => {
    setRejection(null);
  }, []);

  return { pendingCount: entries.length, isOnline, enqueue, rejection, clearRejection };
};
