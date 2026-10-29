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

import { readLocal, writeLocal } from '../patterns/local-store';
import { useWorkerSession } from '../patterns/worker-session';

/** 사번별로 어느 작업에 몇 번, 언제 마지막으로 들어갔는가. */
type Usage = Record<string, { count: number; last: number }>;
type UsageByWorker = Record<string, Usage>;

export const FREQUENT_SCREENS_KEY = 'frequent-screens';

/* 공용 단말을 거쳐 간 사람이 끝없이 쌓이지 않게, 오래 안 쓴 사번부터 버린다. */
const MAX_WORKERS = 50;

interface FrequentScreens {
  usage: Usage;
  record: (path: string) => void;
}

const FrequentScreensContext = createContext<FrequentScreens | null>(null);

const parse = (stored: string | null): UsageByWorker => {
  if (stored === null) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    return typeof parsed === 'object' && parsed !== null ? (parsed as UsageByWorker) : {};
  } catch {
    return {};
  }
};

const lastUse = (usage: Usage): number =>
  Math.max(0, ...Object.values(usage).map((each) => each.last));

/**
 * 사번마다 많이 쓰는 작업을 센다. 홈의 「자주 쓰는 작업」이 이것을 읽는다.
 *
 * 한 사람이 하루에 쓰는 작업은 서너 개다. 스무 개 가까운 작업 중에서 그것을 매번 업무 묶음을
 * 열어 찾게 하지 않는다.
 *
 * 단말 보관소에 둔다 - 다음 근무에도 이어져야 쓸모가 있다. 담는 것은 화면 주소와 횟수뿐이라
 * 공용 장비에 남아도 앞사람이 적던 내용이 드러나지 않는다(그것은 `task-draft` 가 메모리에만 둔다).
 */
export const FrequentScreensProvider = ({ children }: { children: ReactNode }) => {
  const { worker } = useWorkerSession();
  const workerNo = worker?.workerNo ?? null;
  const [all, setAll] = useState<UsageByWorker>({});
  const dirty = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void readLocal(FREQUENT_SCREENS_KEY)
      .catch(() => null)
      .then((stored) => {
        if (!cancelled) {
          /* 읽기 전에 센 것이 있으면 그것을 살린다. */
          setAll((current) => ({ ...parse(stored), ...current }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const record = useCallback(
    (path: string) => {
      if (workerNo === null) {
        return;
      }

      setAll((current) => {
        const mine = current[workerNo] ?? {};
        const before = mine[path];
        const next: UsageByWorker = {
          ...current,
          [workerNo]: { ...mine, [path]: { count: (before?.count ?? 0) + 1, last: Date.now() } },
        };

        return Object.fromEntries(
          Object.entries(next)
            .sort(([, a], [, b]) => lastUse(b) - lastUse(a))
            .slice(0, MAX_WORKERS),
        );
      });
      dirty.current = true;
    },
    [workerNo],
  );

  /* 센 것만 남긴다. 읽기만 한 값을 다시 쓰면 다른 탭·다음 실행이 쓴 것을 덮을 수 있다. */
  useEffect(() => {
    if (!dirty.current) {
      return;
    }

    dirty.current = false;
    /* 못 남겨도 작업은 그대로 된다. 다음 근무에 목록이 비어 보일 뿐이다. */
    void writeLocal(FREQUENT_SCREENS_KEY, JSON.stringify(all)).catch(() => undefined);
  }, [all]);

  const value = useMemo(
    () => ({ usage: workerNo === null ? {} : (all[workerNo] ?? {}), record }),
    [all, record, workerNo],
  );

  return <FrequentScreensContext value={value}>{children}</FrequentScreensContext>;
};

/** 들어간 작업을 센다. 공급자가 없으면(시험의 일부 셸) 아무것도 하지 않는다. */
export const useRecordScreenVisit = (): ((path: string) => void) =>
  use(FrequentScreensContext)?.record ?? noop;

const noop = (): void => undefined;

/** 많이 쓴 차례로 주소를 낸다. 횟수가 같으면 최근 것이 앞이다. */
export const useFrequentScreens = (limit: number): string[] => {
  const usage = use(FrequentScreensContext)?.usage;

  return useMemo(
    () =>
      Object.entries(usage ?? {})
        .sort(([, a], [, b]) => b.count - a.count || b.last - a.last)
        .slice(0, limit)
        .map(([path]) => path),
    [limit, usage],
  );
};
