import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
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

  const enqueue = useCallback(async (draft: OutboxDraft) => {
    // 보관된 것을 다시 읽어 담는다. 화면이 여럿 떠 있어도 한쪽이 다른 쪽을 덮지 않는다.
    const stored = await readQueue().catch(() => [] as OutboxEntry[]);
    const next = appendEntry(stored, draft);

    await writeQueue(next);
    setEntries(next);
  }, []);

  const flush = useCallback(async (): Promise<FlushResult | null> => {
    const stored = await readQueue().catch(() => [] as OutboxEntry[]);

    if (stored.length === 0) {
      return null;
    }

    const result = await flushQueue(stored, send);

    await writeQueue(result.remaining);
    setEntries(result.remaining);

    return result;
  }, [send]);

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
