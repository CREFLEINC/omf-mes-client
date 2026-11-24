import type {
  ApiClient,
  ApiError,
  MaterialLotBatchCreate,
  MaterialLotBatchCreated,
  MaterialLotVoidResult,
} from '@omf-mes/api-client';
import { createIdempotencyKey } from '@omf-mes/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import {
  createMaterialLotLabelIssue as createIssue,
  drawMaterialLotLabel as buildLabel,
  printMaterialLotLabel,
  reportMaterialLotLabelPrint as reportPrint,
  type IssueView,
} from '../../patterns/material-lot-label-print';
import { renditionShell } from '../../patterns/pop-print';
import { runRequest, toApiError } from '../../patterns/request';

import { toIssueFailure } from './failure';
import type { IssueUnit } from './issue-unit';
import { fetchWaitingGroups, waitingKeys } from './queries';

import type { LabelLot } from './types';

type Client = ApiClient['client'];

/**
 * 인쇄가 어디까지 갔는가 — **네 걸음이고 한 트랜잭션이 아니다.**
 *
 * ```
 * issue     POST /app/document-issues                           발행 기록을 만든다(회차는 서버)
 * render    (화면)                                              80 × 30 라벨을 직접 짠다
 * print     window.pop.rendition.save(...)                      셸이 보낸다
 * report    POST /app/document-issues/{id}:report-print         결과를 보고한다
 * ```
 *
 * ⭐ 005 부터 LOT 은 「자재 관리 LOT 만들기」(발행 묶음)가 이미 만들었다 — 옛 첫 걸음 「LOT 등록」
 *    (`POST /trace/lots` 입하 원천)은 없다(계약 §7 — 그 경로는 409).
 * ⛔ **어느 걸음에서 멈췄는지가 다음에 할 일을 정한다.** 기록이 남은 뒤 멈췄으면 다시 찍기는 재발행이다.
 */
export type IssueStep = 'issue' | 'render' | 'print' | 'report';

/**
 * 한 번의 인쇄가 남긴 것.
 *
 * ⭐ **성공만 결과가 아니다.** 중간에 멈춘 것도 결과이고, 그 자리마다 사용자가 할 일이 다르다.
 */
export interface IssueRunResult {
  /**
   * ⛔ **이 결과가 «어느 LOT 의 것인가».** 결과를 줄과 묶지 않으면, 끝난 뒤 다른 자재를 고른
   * 사람이 **남의 결과를 자기 것으로 읽는다** — 「인쇄했습니다」가 아직 찍지 않은 자재 밑에 선다.
   */
  lotId: number;
  /** 끝까지 갔는가. 인쇄까지 성공하고 보고를 마쳤을 때만 참이다. */
  isPrinted: boolean;
  /** 멈춘 걸음. 끝까지 갔으면 `null`. */
  failedAt: IssueStep | null;
  /**
   * ⚠ **라벨이 실제로 나왔는가.** 셸이 인쇄를 마친 뒤에도 결과 보고가 실패할 수 있는데
   * (`report` 걸음), 그것을 「끝내지 못했다」로만 말하면 작업자가 **같은 라벨을 한 장 더 찍는다.**
   * 종이는 이미 나왔다는 사실을 결과가 들고 있어야 그 말을 할 수 있다.
   */
  hasPrintedLabel: boolean;
  /** 만들어진 발행 기록. `issue` 를 넘겼을 때만 있다. */
  issue: IssueView | null;
  error: ApiError | null;
}

export interface IssueCommand {
  lot: LabelLot;
  /** 고른 프린터. 배정이 정해지기 전에는 서버 기본값에 맡긴다. */
  printerName: string | null;
  /** 재인쇄일 때만 채운다. 신규 발행에 사유가 붙으면 이력이 거짓이 된다. */
  reissueReasonCode: string | null;
  /**
   * 첫 발행이면 참 — 보내기 직전에 목록을 다시 받아 **아직 라벨이 없는지** 본다(`verifyCommands`). 다른 단말
   * (POP 여러 대)이 먼저 찍었으면 보내지 않고 「이미 발행됨」으로 둔다.
   */
  verifyUnissued?: boolean;
  /** 다시 받을 공장 — `verifyUnissued` 와 함께 쓴다. */
  plantId?: number;
  /**
   * 셸에게 «이 프린터로 보내라»고 실을 이름 — 셸이 고른 프린터를 받을 때(`selectable`)만 채운다.
   * 없거나 `null` 이면 싣지 않는다(셸이 지금처럼 기동 시 지정값 → OS 기본으로 보낸다).
   */
  shellPrinterName?: string | null;
}

/** 발행 사이에 붙잡아 두는 멱등 키 — LOT 마다(`useBatchIssue` 머리말). */
interface IssueKeys {
  issue: Map<number, { key: string; signature: string }>;
}

interface IssueDeps {
  client: Client;
  workerNo: string;
  keys: IssueKeys;
  onStep: (step: IssueStep) => void;
}

/**
 * 한 인쇄 작업(스풀러 작업 하나)에 싣는 최대 장수(사용자 지시 2026-11-23 「출력 속도 개선 1번」).
 *
 * ⭐ 장마다 셸 · 스풀러 작업을 따로 세우던 것을 묶는다 — 프린터가 멈춤 없이 이어 찍는다.
 * ⚠ 묶음 안에서 프린터가 서면 어느 장까지 나왔는지 알 수 없다 — 그 묶음은 통째로 인쇄 실패로 보고하고
 *    「다시 발행」(사유 PRINT_FAILURE)으로 잇는다. 그래서 너무 크게 잡지 않는다.
 */
export const PRINT_CHUNK = 10;

/** 발행 기록을 만들고 라벨을 짠 장 — 아직 인쇄 전. */
interface PreparedLabel {
  command: IssueCommand;
  issue: IssueView;
  bytes: Uint8Array;
}

/**
 * 한 장의 발행 기록을 만들고 라벨을 짠다 — 인쇄는 묶음이 한 번에 한다(`printChunk`).
 * 실패하면 그 장의 결과를 돌려준다(던지지 않는다).
 *
 * ⛔ **인쇄에 실패해도 발행 기록을 되돌리지 않는다.** 실패는 보고하고 재발행으로 처리한다 — 그 재발행의
 *    사유가 「인쇄 실패」다(계약 명시).
 */
const prepareLabel = async (
  deps: IssueDeps,
  command: IssueCommand,
): Promise<PreparedLabel | IssueRunResult> => {
  const { client, workerNo, keys, onStep } = deps;
  const { lot, printerName, reissueReasonCode } = command;
  const lotId = lot.lotId;
  let at: IssueStep = 'issue';
  let issue: IssueView | null = null;

  try {
    onStep('issue');
    /*
     * 발행의 멱등 키 — **같은 본문을 다시 보낼 때만 같은 값을 쓴다**(스펙 §5-2). 본문을 가르는 값이
     * 하나라도 다르면 다른 쓰기다 — 사유 없는 발행이 재인쇄로 둔갑하는 길을 막는다.
     */
    const signature = `${String(lotId)}|${printerName ?? ''}|${reissueReasonCode ?? ''}`;
    const held = keys.issue.get(lotId);
    const issueKey = held?.signature === signature ? held.key : createIdempotencyKey();
    keys.issue.set(lotId, { key: issueKey, signature });

    issue = await createIssue(
      client,
      { lotId, printerName, reissueReasonCode },
      workerNo,
      issueKey,
    );
    // 기록이 남았다 — 다음 재인쇄는 새 회차라 새 키여야 한다.
    keys.issue.delete(lotId);

    at = 'render';
    onStep('render');
    const bytes = buildLabel({ lot, issue });

    return { command, issue, bytes };
  } catch (cause) {
    return {
      lotId,
      isPrinted: false,
      failedAt: at,
      hasPrintedLabel: false,
      issue,
      error: toApiError(cause),
    };
  }
};

const isPrepared = (value: PreparedLabel | IssueRunResult): value is PreparedLabel =>
  'bytes' in value;

/** 여러 장의 TSPL 을 한 덩이로 — 장마다 `CLS … PRINT` 가 이어진다(셸이 장마다 용지 머리를 다시 세운다). */
const concatLabels = (parts: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;

  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }

  return out;
};

/**
 * 짠 장들을 **한 인쇄 작업으로** 보내고, 결과 보고는 기다리지 않고 넘긴다.
 *
 * - `failureReason` — 인쇄가 실패했으면 그 사유(묶음 전체가 같은 답이다). 묶음을 멈출지 이것으로 본다.
 * - `done` — 장마다 보고까지 끝난 결과. 보고는 다음 묶음의 발행 기록과 겹쳐 간다.
 *
 * ⛔ 다음 묶음의 발행 기록을 미리 만들지는 않는다 — 프린터가 서면 찍히지 않은 장의 기록이 남는다.
 */
const printChunk = async (
  deps: IssueDeps,
  prepared: readonly PreparedLabel[],
): Promise<{ failureReason: string | null; done: Promise<IssueRunResult[]> }> => {
  const { client, workerNo, onStep } = deps;
  const first = prepared[0];

  if (first === undefined) return { failureReason: null, done: Promise.resolve([]) };

  onStep('print');
  const label = `lots-${String(first.issue.documentIssueLogId)}-x${String(prepared.length)}`;
  const bytes = concatLabels(prepared.map((each) => each.bytes));
  /* ⛔ 통로가 없으면 실패 사유(`NO_SHELL_REASON`)로 보고한다 — 나오지 않은 라벨이 나온 것으로 남지 않게. */
  const failureReason = await printMaterialLotLabel(
    renditionShell(),
    bytes,
    label,
    first.command.shellPrinterName,
  );
  const isPrinted = failureReason === null;

  onStep('report');
  const done = Promise.all(
    prepared.map(({ command, issue }) =>
      reportPrint(client, issue.documentIssueLogId, failureReason, workerNo).then(
        (): IssueRunResult => ({
          lotId: command.lot.lotId,
          isPrinted,
          failedAt: isPrinted ? null : 'print',
          hasPrintedLabel: isPrinted,
          issue,
          error: null,
        }),
        (cause: unknown): IssueRunResult => ({
          lotId: command.lot.lotId,
          isPrinted: false,
          failedAt: 'report',
          hasPrintedLabel: isPrinted,
          issue,
          error: toApiError(cause),
        }),
      ),
    ),
  );

  return { failureReason, done };
};

/**
 * 한 장이 이렇게 끝나면 **남은 장을 보내지 않는다** — 프린터가 응답하지 않았거나(셸 통로 없음 포함),
 * 이 단말에 발행 권한이 없다. 다음 장도 같은 답이 온다.
 *
 * ⭐ 그 밖의 실패(발행할 수 없는 LOT 등)는 **그 LOT 만의 사정**이라 나머지는 계속
 *    보낸다(개편안 결정 2026-10-24).
 */
export const stopsBatch = (result: IssueRunResult): boolean => {
  const failure = toIssueFailure(result);

  return failure === 'printFailed' || failure === 'issueForbidden';
};

export interface IssueRunOptions {
  /**
   * 귀속 사번. **없으면 부르지 않는다** — 서버가 거부한다(공유계약 D-5).
   *
   * ⛔ **모르면 `null` 이다.** 빈 문자열로 떨어뜨리지 않는다 — 빈 값은 서버에 「사번이 있다」로
   * 나가고, 거절이 화면이 아니라 서버에서 난다.
   */
  workerNo: string | null;
}

export interface BatchIssueHandle {
  /**
   * 고른 줄을 차례로 보낸다. 이미 돌고 있으면 무시한다.
   * `every` 를 주면 그만큼 보내고 쉰다 — 남은 장은 `resume` 이 다음 단위만큼 이어 보낸다(`issue-unit`).
   */
  run: (commands: readonly IssueCommand[], every?: IssueUnit) => void;
  /** 단위 사이에 쉬는 중이면 다음 단위를 보낸다. 쉬는 중이 아니면 할 일이 없다. */
  resume: () => void;
  /**
   * 지금 장까지 끝내고 멈춘다. 남은 장은 `notRun` 으로 남는다.
   * 단위 사이에 쉬는 중에 부르면 아직 보내지 않은 장을 `notRun` 으로 돌린다 — 「다시 발행」으로 이어 간다.
   */
  stop: () => void;
  /** 결과를 걷는다 — 「확인」. 돌고 있으면 무시한다. */
  reset: () => void;
  isRunning: boolean;
  isStopping: boolean;
  /** 지금 보내는 LOT. 쉬는 중이면 `null`. */
  currentLotId: number | null;
  step: IssueStep | null;
  /** 이번 묶음에서 보내기로 한 줄의 차례. 「확인」 전까지 다시 보내도 자리를 지킨다. */
  order: readonly number[];
  results: ReadonlyMap<number, IssueRunResult>;
  /** 보내기 직전에 보니 다른 단말이 먼저 찍었다 — 보내지 않았다. */
  skipped: ReadonlySet<number>;
  /** 멈춤·프린터 고장으로 보내지 않은 줄. */
  notRun: ReadonlySet<number>;
  /** 단위로 나눠 보내는 중 아직 보내지 않은 장수. 0 이면 쉬는 중이 아니다. */
  remaining: number;
  /** 「다음 N장 발행」의 N — 다음 단위와 남은 장 가운데 작은 것. 쉬는 중이 아니면 0. */
  nextCount: number;
}

/** 단위로 나눠 보낼 때 아직 보내지 않은 장과 그 단위. */
interface LaterQueue {
  commands: IssueCommand[];
  every: IssueUnit;
}

const NO_LATER: LaterQueue = { commands: [], every: null };

const without = <T>(set: ReadonlySet<T>, drop: readonly T[]): Set<T> => {
  const next = new Set(set);

  for (const value of drop) next.delete(value);

  return next;
};

/**
 * 라벨 여러 장을 **한 번에, 한 장씩 차례로** 보낸다(개편안 승인 2026-10-24 · omf-all-around#184).
 *
 * ⭐ 한 장마다 하는 일(발행 기록 → 라벨 짜기 → 인쇄 → 결과 보고)은 옛
 *    화면 그대로다. 묶음은 그것을 줄마다 되풀이하고 결과를 줄마다 남길 뿐이다.
 *
 * ⛔ **한 번에 하나만 돈다.** 단추의 비활성만으로는 막지 못한다 — 장갑 낀 손이 빠르게 두 번 누르면
 *    **같은 렌더에서 두 번** 들어온다. 그러면 같은 LOT 의 발행 기록이 두 번 남아 라벨이 두 장 돈다.
 */
export const useBatchIssue = ({ workerNo }: IssueRunOptions): BatchIssueHandle => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const running = useRef(false);
  const stopRequested = useRef(false);
  /*
   * 멱등 키는 묶음을 넘어 붙잡아 둔다 — 실패한 장을 다시 보낼 때(같은 줄 · 같은 본문) 같은 키로
   * 나가야 서버가 같은 쓰기로 본다(`prepareLabel` 머리말).
   */
  const keys = useRef<IssueKeys>({ issue: new Map() });

  const [isRunning, setIsRunning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [currentLotId, setCurrentLotId] = useState<number | null>(null);
  const [step, setStep] = useState<IssueStep | null>(null);
  const [order, setOrder] = useState<readonly number[]>([]);
  const [results, setResults] = useState<ReadonlyMap<number, IssueRunResult>>(new Map());
  const [skipped, setSkipped] = useState<ReadonlySet<number>>(new Set());
  const [notRun, setNotRun] = useState<ReadonlySet<number>>(new Set());
  /*
   * 단위로 나눠 보낼 때 다음 차례를 기다리는 장. 화면이 다시 그려져도 남아야 하고 `resume` 이 같은
   * 단위로 꺼낸다 — 그래서 ref 다. 장수는 그리기에 쓰이므로 따로 상태로 둔다.
   */
  const later = useRef<LaterQueue>(NO_LATER);
  const [laterCount, setLaterCount] = useState({ remaining: 0, next: 0 });

  const holdLater = useCallback((queue: LaterQueue) => {
    later.current = queue;
    setLaterCount({
      remaining: queue.commands.length,
      next: Math.min(queue.every ?? queue.commands.length, queue.commands.length),
    });
  }, []);

  /** 기다리던 장을 꺼내 줄 번호로 — 멈추면 그 장들은 「보내지 않음」으로 돌린다. */
  const dropLater = useCallback((): number[] => {
    const ids = later.current.commands.map((command) => command.lot.lotId);

    holdLater(NO_LATER);

    return ids;
  }, [holdLater]);

  const run = useCallback(
    (commands: readonly IssueCommand[], every: IssueUnit = null) => {
      /*
       * ⛔ **사번을 모르면 아무것도 부르지 않는다**(공유계약 D-5 · F-6). 단추도 함께 막혀
       * 있지만 판정을 나가는 자리에 두어, 다른 경로가 생겨도 빈 사번이 새지 않게 한다.
       */
      if (workerNo === null || commands.length === 0) return;
      if (running.current) return;

      running.current = true;
      stopRequested.current = false;
      setIsRunning(true);
      setIsStopping(false);

      /* 이번에 보낼 단위와 기다릴 장 — 기다리는 장도 차례(`order`)에는 지금 넣어 「대기」로 선다. */
      const now = every === null ? [...commands] : commands.slice(0, every);
      holdLater({ commands: every === null ? [] : commands.slice(every), every });

      const ids = commands.map((command) => command.lot.lotId);

      setOrder((previous) => [...previous, ...ids.filter((id) => !previous.includes(id))]);
      setResults((previous) => {
        const next = new Map(previous);

        for (const id of ids) next.delete(id);

        return next;
      });
      setSkipped((previous) => without(previous, ids));
      setNotRun((previous) => without(previous, ids));

      const execute = async (): Promise<void> => {
        const deps: IssueDeps = {
          client,
          workerNo,
          keys: keys.current,
          onStep: setStep,
        };

        try {
          const queue = await verifyCommands(client, now, (gone) => {
            setSkipped((previous) => new Set([...previous, ...gone]));
          });
          let halted = false;
          /* 보고 중인 묶음 — 다음 묶음과 겹쳐 가고, 끝나기 전에 모두 기다린다. */
          const reporting: Promise<void>[] = [];
          const record = (result: IssueRunResult): void => {
            setResults((previous) => new Map(previous).set(result.lotId, result));
          };
          /* 남은 장과 다음 단위까지 「보내지 않음」으로 돌린다. */
          const haltFrom = (index: number): void => {
            const rest = queue.slice(index).map((left) => left.lot.lotId);
            const dropped = dropLater();

            setNotRun((previous) => new Set([...previous, ...rest, ...dropped]));
            halted = true;
          };

          /* 묶음(최대 PRINT_CHUNK 장)마다: 발행 기록 · 라벨 짜기 → 한 인쇄 작업 → 보고는 겹쳐서. */
          for (let start = 0; start < queue.length && !halted; start += PRINT_CHUNK) {
            const chunk = queue.slice(start, start + PRINT_CHUNK);
            const prepared: PreparedLabel[] = [];

            for (const [offset, command] of chunk.entries()) {
              /* 멈춤 — 이미 기록을 만든 장은 아래에서 찍고, 나머지는 보내지 않는다. */
              if (stopRequested.current) {
                haltFrom(start + offset);
                break;
              }

              setCurrentLotId(command.lot.lotId);
              const outcome = await prepareLabel(deps, command);

              if (isPrepared(outcome)) {
                prepared.push(outcome);
                continue;
              }

              record(outcome);
              /* 이 단말에 발행 권한이 없다 — 다음 장도 같은 답이다. */
              if (stopsBatch(outcome)) {
                haltFrom(start + offset + 1);
                break;
              }
            }

            const printed = await printChunk(deps, prepared);

            reporting.push(
              printed.done.then((results) => {
                for (const result of results) record(result);
              }),
            );

            /* 프린터가 서면 다음 묶음 · 다음 단위도 같은 답이다 — 남은 장까지 「보내지 않음」이다. */
            if (printed.failureReason !== null && !halted) haltFrom(start + chunk.length);
          }

          /* 이 단위의 마지막 장을 찍는 사이에 「멈춤」을 눌렀다 — 쉬지 않고 남은 단위를 접는다. */
          if (!halted && stopRequested.current) {
            const dropped = dropLater();

            setNotRun((previous) => new Set([...previous, ...dropped]));
          }

          /* 겹쳐 보낸 결과 보고를 모두 받고 끝낸다 — 결과 표가 「보고 중」에 머물지 않게. */
          await Promise.all(reporting);
        } finally {
          running.current = false;
          stopRequested.current = false;
          setIsRunning(false);
          setIsStopping(false);
          setCurrentLotId(null);
          setStep(null);
          // LOT 의 발행 여부가 바뀌었다 — 끝나면 언제나 목록을 다시 읽는다.
          await queryClient.invalidateQueries({ queryKey: waitingKeys.all });
        }
      };

      void execute();
    },
    [client, queryClient, workerNo, holdLater, dropLater],
  );

  const resume = useCallback(() => {
    const { commands, every } = later.current;

    run(commands, every);
  }, [run]);

  const stop = useCallback(() => {
    if (running.current) {
      stopRequested.current = true;
      setIsStopping(true);

      return;
    }

    const dropped = dropLater();

    if (dropped.length > 0) setNotRun((previous) => new Set([...previous, ...dropped]));
  }, [dropLater]);

  const reset = useCallback(() => {
    if (running.current) return;

    holdLater(NO_LATER);
    setOrder([]);
    setResults(new Map());
    setSkipped(new Set());
    setNotRun(new Set());
  }, [holdLater]);

  return {
    run,
    resume,
    stop,
    reset,
    isRunning,
    isStopping,
    currentLotId,
    step,
    order,
    results,
    skipped,
    notRun,
    remaining: laterCount.remaining,
    nextCount: laterCount.next,
  };
};

/**
 * 보내기 직전 확인 — 첫 발행(`verifyUnissued`)인 LOT 은 목록을 **지금** 다시 받아, 다른 단말이 먼저 찍었거나
 * 그사이 폐기된 LOT 은 빼고(`onGone`) 남은 것만 보낸다.
 *
 * ⚠ 확인을 못 했으면(조회 실패) 받은 그대로 보낸다 — 두 번째 발행은 서버가 회차로 남기고(재발행 사유 필수 422),
 *   폐기된 LOT 은 서버가 막는다(계약 §1 「생애 `VOIDED` 거절」).
 */
const verifyCommands = async (
  client: Client,
  commands: readonly IssueCommand[],
  onGone: (lotIds: number[]) => void,
): Promise<IssueCommand[]> => {
  const plantId = commands.find((command) => command.verifyUnissued === true)?.plantId;

  if (plantId === undefined) return [...commands];

  let fresh: Map<number, { unissued: boolean }>;

  try {
    const groups = await fetchWaitingGroups(client, plantId);

    fresh = new Map(
      groups.flatMap((group) =>
        group.lots.map(
          (lot) =>
            [
              lot.lotId,
              { unissued: lot.lifecycleStatusCode === 'WAITING' && lot.lastLabelIssue === null },
            ] as const,
        ),
      ),
    );
  } catch {
    /* 확인을 못 했다 — 받은 그대로 보낸다. */
    return [...commands];
  }

  const queue: IssueCommand[] = [];
  const gone: number[] = [];

  for (const command of commands) {
    if (command.verifyUnissued === true && fresh.get(command.lot.lotId)?.unissued !== true) {
      gone.push(command.lot.lotId);
    } else {
      queue.push(command);
    }
  }

  if (gone.length > 0) onGone(gone);

  return queue;
};

/**
 * 자재 관리 LOT 만들기(계약 §1 `POST /logistics/material-lot-batches`) — POP 은 사번을 함께 싣는다.
 *
 * ⭐ 멱등 키는 **창 하나에 하나**다 — 통신이 끊긴 뒤 같은 창에서 다시 누르면 서버가 같은 쓰기로 본다(묶음이 둘
 *    생기지 않는다). 창을 닫고 다시 열면 새 키다(부르는 쪽이 `idempotencyKey` 를 창마다 만든다).
 */
export const createMaterialLotBatch = async (
  client: Client,
  body: MaterialLotBatchCreate,
  workerNo: string,
  idempotencyKey: string,
): Promise<MaterialLotBatchCreated> =>
  runRequest(() =>
    client.POST('/logistics/material-lot-batches', {
      params: { header: { 'Idempotency-Key': idempotencyKey, 'X-Worker-No': workerNo } },
      body,
    }),
  );

/** 대기 자재 관리 LOT 폐기(계약 §1 `POST /trace/lots:void`) — 대기가 아닌 LOT 은 건별 실패로 온다. */
export const voidMaterialLots = async (
  client: Client,
  lotIds: readonly number[],
  workerNo: string,
): Promise<MaterialLotVoidResult> =>
  runRequest(() =>
    client.POST('/trace/lots:void', {
      params: { header: { 'Idempotency-Key': createIdempotencyKey(), 'X-Worker-No': workerNo } },
      body: { lotIds: [...lotIds] },
    }),
  );
