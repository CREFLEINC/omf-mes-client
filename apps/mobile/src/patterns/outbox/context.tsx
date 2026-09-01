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
import {
  appendRejected,
  dropRejected,
  readRejected,
  writeRejected,
  type RejectedRecord,
} from './rejected';
import { flushQueue, type FlushResult, type OutboxTransport } from './send';

export interface Outbox {
  /** 아직 서버에 닿지 못한 건수. 상시 표시가 즉시 성공 표시의 전제다. */
  pending: number;
  /**
   * 담긴 파일이 차지하는 크기.
   *
   * 사진처럼 큰 것을 담는 화면이 더 받아도 되는지 정할 때 쓴다. 화면이 자기 것만 세면
   * 보고를 마칠 때마다 셈이 처음으로 돌아가 큐가 끝없이 커진다.
   */
  pendingBytes: number;
  /**
   * 서버가 되돌린 건. 큐에서 빠진 뒤에도 남는다.
   *
   * 못 보낸 건과 한 셈에 넣지 않는다 - 앞엣것은 기다리면 가고 뒤엣것은 기다려도 가지 않는다.
   */
  rejected: RejectedRecord[];
  /** 담고 곧바로 돌아온다. 통신을 기다리지 않는다. */
  enqueue: (draft: OutboxDraft) => Promise<void>;
  /** 보낼 수 있는 만큼 보낸다. 거부된 건을 돌려준다. */
  flush: () => Promise<FlushResult | null>;
  /** 되돌아온 건 하나를 목록에서 내린다. 사람이 보고 정리한 뒤다. */
  dismissRejected: (id: string) => Promise<void>;
}

const OutboxContext = createContext<Outbox | null>(null);

export interface OutboxProviderProps {
  send: OutboxTransport;
  children: ReactNode;
}

export const OutboxProvider = ({ send, children }: OutboxProviderProps) => {
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [rejected, setRejected] = useState<RejectedRecord[]>([]);
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

    void Promise.all([readQueue().catch(() => []), readRejected().catch(() => [])]).then(
      ([stored, returned]) => {
        if (!cancelled) {
          setEntries(stored);
          setRejected(returned);
          setLoaded(true);
        }
      },
    );

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

      /*
       * 되돌아온 건을 큐에서 빼기 전에 남긴다. 큐를 먼저 쓰면 그 사이에 보관소가 거절할 때
       * 큐에서도 빠지고 어디에도 남지 않는다 - 이 순서면 남는 것은 같은 건이 큐에 한 번 더
       * 남는 것뿐이고, 그것은 다음 회차에 다시 판정을 받는다.
       */
      if (result.rejected.length > 0) {
        const kept = appendRejected(
          await readRejected(),
          result.rejected,
          new Date().toISOString(),
        );

        await writeRejected(kept);
        setRejected(kept);
      }

      await writeQueue(next);
      setEntries(next);
    });

    return result;
  }, [inTurn, send]);

  const dismissRejected = useCallback(
    async (id: string) => {
      await inTurn(async () => {
        const next = dropRejected(await readRejected(), id);

        await writeRejected(next);
        setRejected(next);
      });
    },
    [inTurn],
  );

  const flush = useCallback((): Promise<FlushResult | null> => {
    sending.current ??= runFlush().finally(() => {
      sending.current = null;
    });

    return sending.current;
  }, [runFlush]);

  /*
   * 보내기를 부르는 자리가 화면마다 흩어지면 어느 화면도 열지 않은 동안 큐가 갇힌다. 셸이
   * 스스로 보낸다.
   *
   * 연결 사건만으로는 모자란다. 기기가 무선에 붙어 있는데 서버만 죽었다 살아나면 그 사건이
   * 아예 오지 않아 큐가 앱을 켜 둔 내내 갇힌다. 화면이 다시 앞으로 나오는 것도 신호로 쓴다 -
   * 단말을 내려놓았다 집어 드는 것이 현장에서 가장 흔한 재시도 시점이다.
   *
   * 되풀이해 두드리지는 않는다. 못 닿는 동안 계속 보내면 배터리만 쓴다.
   */
  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const attempt = () => {
      void flushRef.current().catch(() => undefined);
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        attempt();
      }
    };

    attempt();
    window.addEventListener('online', attempt);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('online', attempt);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loaded]);

  const pendingBytes = loaded
    ? entries.reduce((total, entry) => total + (entry.file?.data.length ?? 0), 0)
    : 0;

  const value = useMemo(
    () => ({
      pending: loaded ? entries.length : 0,
      pendingBytes,
      rejected,
      enqueue,
      flush,
      dismissRejected,
    }),
    [dismissRejected, enqueue, entries.length, flush, loaded, pendingBytes, rejected],
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
