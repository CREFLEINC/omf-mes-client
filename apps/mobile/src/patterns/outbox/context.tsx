import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { appendEntry, readQueue, writeQueue, type OutboxDraft, type OutboxEntry } from './queue';
import { flushQueue, type FlushResult, type OutboxTransport } from './send';

export interface Outbox {
  /** 아직 서버에 닿지 못한 건수. 상시 표시가 즉시 성공 표시의 전제다. */
  pending: number;
  /** 담고 곧바로 돌아온다. 통신을 기다리지 않는다. */
  enqueue: (draft: OutboxDraft) => Promise<void>;
  /** 보낼 수 있는 만큼 보낸다. 거부된 건을 돌려준다. */
  flush: () => Promise<FlushResult | null>;
}

const OutboxContext = createContext<Outbox | null>(null);

export interface OutboxProviderProps {
  send: OutboxTransport;
  children: ReactNode;
}

export const OutboxProvider = ({ send, children }: OutboxProviderProps) => {
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  /*
   * 큐를 만지는 일은 읽고 고쳐 쓰는 세 걸음이라 겹치면 나중 것이 먼저 것을 덮는다. 화면 둘이
   * 같이 담거나 보내는 중에 담기면 그 자리에서 한 건이 사라지고, 사라진 것은 보이지 않는다.
   */
  const turn = useRef<Promise<unknown>>(Promise.resolve());

  /*
   * 보내는 동안에는 큐를 잡지 않으므로, 그 사이에 다시 보내라 하면 같은 건이 두 번 나간다.
   * 서버가 멱등키로 흡수해도 보낸 건수가 거짓이 되고 왕복이 두 배가 된다.
   */
  const sending = useRef<Promise<FlushResult | null> | null>(null);

  const inTurn = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const next = turn.current.then(task, task);
    turn.current = next.catch(() => undefined);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;

    void readQueue()
      .catch(() => [])
      .then((stored) => {
        if (!cancelled) {
          setEntries(stored);
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const enqueue = useCallback(
    async (draft: OutboxDraft) => {
      await inTurn(async () => {
        const stored = await readQueue();
        const next = appendEntry(stored, draft);

        await writeQueue(next);
        setEntries(next);
      });
    },
    [inTurn],
  );

  const runFlush = useCallback(async (): Promise<FlushResult | null> => {
    const stored = await inTurn(() => readQueue());

    if (stored.length === 0) {
      return null;
    }

    /*
     * 보내는 동안에는 큐를 잡지 않는다. 잡고 있으면 통신이 끝날 때까지 담을 수 없어, 작업자가
     * 그 사이에 한 일이 어디에도 남지 않는다.
     */
    const result = await flushQueue(stored, send);

    await inTurn(async () => {
      const attempted = new Set(stored.map((entry) => entry.id));
      const latest = await readQueue();
      // 보내려던 것 밖에 있는 것은 그 사이에 담긴 것이다. 결과로 덮으면 그 건이 사라진다.
      const arrived = latest.filter((entry) => !attempted.has(entry.id));
      const next = [...result.remaining, ...arrived];

      await writeQueue(next);
      setEntries(next);
    });

    return result;
  }, [inTurn, send]);

  const flush = useCallback((): Promise<FlushResult | null> => {
    sending.current ??= runFlush().finally(() => {
      sending.current = null;
    });

    return sending.current;
  }, [runFlush]);

  const value = useMemo(
    () => ({ pending: loaded ? entries.length : 0, enqueue, flush }),
    [enqueue, entries.length, flush, loaded],
  );

  return <OutboxContext value={value}>{children}</OutboxContext>;
};

export const useOutbox = (): Outbox => {
  const outbox = use(OutboxContext);

  if (outbox === null) {
    throw new Error('useOutbox는 OutboxProvider 안에서만 쓸 수 있습니다.');
  }

  return outbox;
};
