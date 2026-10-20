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

import { useWorkerSession } from './worker-session';

/** 홈의 「이어서 하기」에 세울 것. */
export interface ResumableTask {
  /** 돌아갈 주소. */
  to: string;
  /** 화면 이름. */
  title: string;
  /** 무엇을 적던 중인지 한 줄. 실물 라벨과 대조할 값(품목·발주)을 넣는다. */
  summary: string;
}

interface DraftEntry {
  value: unknown;
  resume: ResumableTask | null;
}

interface TaskDrafts {
  read: (key: string) => DraftEntry | undefined;
  write: (key: string, entry: DraftEntry) => void;
  clear: (key: string) => void;
  resumable: ResumableTask[];
  /** 지금 사번. 열쇠를 사번으로 가른다 - 교대한 사람에게 앞사람이 적던 것이 열리지 않게. */
  workerNo: string | null;
}

const TaskDraftContext = createContext<TaskDrafts | null>(null);

/**
 * 적던 작업을 화면 밖에 붙들어 둔다.
 *
 * 화면이 들고 있던 값은 화면을 떠나면 사라진다. 뒤로가기를 한 번 더 눌렀거나, 홈에서 위치를
 * 확인하고 돌아왔을 뿐인데 스캔·선택을 처음부터 다시 했다.
 *
 * ⛔ 앱 메모리에만 둔다 - 단말 보관소에 두지 않는다. 공용 장비라 앞사람이 적던 것이 다음 사람
 * 화면에 남는 것이 다시 적는 것보다 나쁘다(`worker-session` 과 같은 까닭). 사번이 바뀌면 모두
 * 지운다.
 */
export const TaskDraftProvider = ({ children }: { children: ReactNode }) => {
  const { worker } = useWorkerSession();
  const workerNo = worker?.workerNo ?? null;
  const [drafts, setDrafts] = useState<Map<string, DraftEntry>>(() => new Map());
  const owner = useRef(workerNo);

  /* 사번이 바뀌거나 풀리면 앞사람 것을 버린다. */
  useEffect(() => {
    if (owner.current !== workerNo) {
      owner.current = workerNo;
      setDrafts(new Map());
    }
  }, [workerNo]);

  const read = useCallback((key: string) => drafts.get(key), [drafts]);

  const write = useCallback((key: string, entry: DraftEntry) => {
    setDrafts((current) => new Map(current).set(key, entry));
  }, []);

  const clear = useCallback((key: string) => {
    setDrafts((current) => {
      if (!current.has(key)) {
        return current;
      }

      const next = new Map(current);
      next.delete(key);
      return next;
    });
  }, []);

  const resumable = useMemo(
    () =>
      [...drafts.values()]
        .map((entry) => entry.resume)
        .filter((resume): resume is ResumableTask => resume !== null),
    [drafts],
  );

  const value = useMemo(
    () => ({ read, write, clear, resumable, workerNo }),
    [clear, read, resumable, workerNo, write],
  );

  return <TaskDraftContext value={value}>{children}</TaskDraftContext>;
};

const useTaskDrafts = (): TaskDrafts => {
  const drafts = use(TaskDraftContext);

  if (drafts === null) {
    throw new Error('useTaskDraft는 TaskDraftProvider 안에서만 쓸 수 있습니다.');
  }

  return drafts;
};

export interface TaskDraftOptions<T> {
  /** 화면 주소와 이름. 홈에서 돌아올 길이다. */
  to: string;
  title: string;
  /**
   * 홈에 무엇을 적던 중이라고 말할지. 아직 아무것도 적지 않았으면 null — 그때는 「이어서 하기」에
   * 세우지 않는다. 빈 화면으로 돌아가는 길은 작업 목록 타일과 같다.
   */
  summarize: (draft: T) => string | null;
}

/**
 * 화면의 작성 중 값을 화면 밖에 둔다. `useState` 처럼 쓴다.
 *
 * 등록을 마쳤으면 `clear` 로 버린다 - 남겨 두면 홈이 이미 끝난 일을 이어서 하라고 한다.
 */
export const useTaskDraft = <T,>(
  key: string,
  initial: T,
  options: TaskDraftOptions<T>,
): [T, (next: T | ((current: T) => T)) => void, () => void] => {
  const { read, write, clear, workerNo } = useTaskDrafts();
  const slot = `${workerNo ?? ''}:${key}`;
  const stored = read(slot);
  const draft = stored === undefined ? initial : (stored.value as T);

  /* 갱신 함수가 가장 최근 값을 받도록 붙들어 둔다. 같은 틱에 두 번 고쳐도 앞 것을 덮지 않는다. */
  const latest = useRef(draft);
  latest.current = draft;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  /* 화면이 매번 새로 만들어 넘기는 값일 수 있다. 처음 받은 것을 버릴 때의 기준으로 쓴다. */
  const initialRef = useRef(initial);

  const set = useCallback(
    (next: T | ((current: T) => T)) => {
      const value = typeof next === 'function' ? (next as (current: T) => T)(latest.current) : next;
      latest.current = value;

      const { to, title, summarize } = optionsRef.current;
      const summary = summarize(value);

      write(slot, {
        value,
        resume: summary === null ? null : { to, title, summary },
      });
    },
    [slot, write],
  );

  const discard = useCallback(() => {
    latest.current = initialRef.current;
    clear(slot);
  }, [clear, slot]);

  return [draft, set, discard];
};

/** 홈의 「이어서 하기」. 지금 사번이 적다가 나간 작업들이다. */
export const useResumableTasks = (): ResumableTask[] => useTaskDrafts().resumable;
