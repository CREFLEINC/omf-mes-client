import type { ApiClient, ApiError } from '@omf-mes/api-client';
import { createIdempotencyKey } from '@omf-mes/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { renditionShell } from '../../patterns/pop-print';
import { runRequest, toApiError } from '../../patterns/request';

import type { LabelKind } from './codes';
import { toDocumentIssueBody, toPrintReportBody } from './issue-request';
import { toIssueView, type IssueView, type TargetRow } from './types';

type Client = ApiClient['client'];

/**
 * 발행과 인쇄가 **한 흐름이 아니다** — 계약이 셋으로 갈라 두었다(공유계약 K-4 · 스펙 §5-5).
 *
 * ```
 * ① 발행 기록 저장   POST /app/document-issues                  ← 트랜잭션 «안»
 * ─────────────────────────────────────────────────────────────
 * ② 그리기           POP 이 화면이 쥔 값으로 그린다              ← 밖
 * ③ 물리 인쇄        window.pop.rendition.save(...)              ← 밖
 * ④ 결과 보고        POST /app/document-issues/{id}:report-print ← 밖
 * ```
 *
 * ⛔ **②에 서버 렌디션 경로가 없다.** 서버는 이 화면의 두 종류를 **하나도 그려 주지 않는다** —
 * 포장 라벨은 준비 목록에 없었고(P2 에서 드러났다), 납품 라벨은 전달본 v4 에서 422 가 됐다.
 * 부를 수 없는 길을 남겨 두면 **그 길로 빠진 발행이 「실패」로만 보이고 기록은 남는다.**
 *
 * ⛔ **①이 성공했는데 ③이 실패할 수 있다.** 그것이 오류가 아니라 계약이 만든 **정상 상태**다 —
 * 기록은 남고 종이만 안 나온다. 되돌리지 않고 **재발행**으로 처리하며, 그 재발행의 사유가
 * 「인쇄 실패」다.
 *
 * ⭐ **화면 순서는 「발행 → 미리보기 → 인쇄」다.** 그리기 경로가 발행 기록 번호를 받으므로
 * **발행 전 미리보기는 이번 계약에 없다**(착수 이슈 §6 · 요구서 §3-4).
 */
export type IssueStep = 'issue' | 'render' | 'print' | 'report';

/**
 * 흐름이 지금 어디 있는가.
 *
 * | 상태 | 뜻 | 다음에 할 수 있는 것 |
 * | --- | --- | --- |
 * | `idle` | 아직 발행하지 않았다 | 발행 |
 * | `issuing` | 기록을 만들고 그린 것을 받는 중 | — |
 * | `issued` | **기록이 남았다.** 미리보기를 볼 수 있다 | 미리보기 · 인쇄 |
 * | `printing` | 셸로 보내고 결과를 보고하는 중 | — |
 * | `printed` | 끝났다 | 새 대상 고르기 |
 */
export type IssuePhase = 'idle' | 'issuing' | 'issued' | 'printing' | 'printed';

/** 발행된 라벨 한 장 — **기록과 그림이 짝이다.** */
export interface IssuedLabel {
  issue: IssueView;
  /**
   * 서버가 그린 바이트. **미리보기와 인쇄가 같은 것을 쓴다** — 두 번 받으면 서버가 두 번
   * 그리고, 그 사이 무언가 달라지면 **본 것과 나온 것이 달라진다.**
   */
  bytes: Uint8Array;
  /**
   * 이 바이트의 형식 — **언제나 `png` 다.**
   *
   * ⭐ POP 이 스스로 그리므로 형식이 셸 사정에 흔들리지 않는다. 명령형(TSPL)은 RAW 자리로만
   *    나가는데 그 자리는 win32 에서만 선다(WIP-CHAIN-01 D6 실측).
   *
   * ⛔ **인쇄 시점에 형식을 다시 묻지 않는다.** 한때 서버에서 받던 시절, 인쇄할 때 형식을 다시
   *    물으면 받아 온 것과 다른 값이 나올 수 있었다 — PNG 를 `label.tspl` 로 저장해 **깨진
   *    라벨이 나오는데 앱은 성공으로 보고했다**(전례 `production-result/flow-print`).
   */
  format: 'png';
  /** 미리보기 `<img>` 의 주소. 해제 책임이 이 훅에 있다(놓으면 단말 메모리에 쌓인다). */
  previewUrl: string;
}

export interface IssueRunResult {
  /** 인쇄까지 끝난 장수. 멈췄으면 거기까지의 수다. */
  printed: number;
  /** 멈춘 걸음. 끝까지 갔으면 `null`. */
  failedAt: IssueStep | null;
  /** 멈춘 사유. 서버 보고에도 같은 문자열이 실린다. */
  failureReason: string | null;
  error: ApiError | null;
}

const IDLE_RESULT: IssueRunResult = {
  printed: 0,
  failedAt: null,
  failureReason: null,
  error: null,
};

/** 인쇄를 못 한 사유 — 서버 보고에 그대로 실린다. `FAILED` 인데 사유가 없으면 422 다. */
const NO_SHELL_REASON = '셸 인쇄 통로가 없는 단말에서 실행됐습니다.';

/** 사유를 말하지 못한 실패에 붙이는 말. **빈 사유로 보고하면 서버가 422 로 막는다.** */
const UNSPOKEN_FAILURE = '셸 인쇄가 실패했습니다.';

/**
 * 셸이 던진 것을 보고할 사유로 옮긴다.
 *
 * ⛔ **빈 문자열을 사유로 삼지 않는다.** `new Error('')` 처럼 말 없는 실패가 오면 `message` 가
 * 빈 문자열인데, 그것은 `null` 이 아니라 **「사유가 있다」로 나가** 서버가 422 로 막는다 —
 * 인쇄도 실패하고 보고도 실패해 회차가 `PENDING` 인 채 남는다.
 */
const toFailureReason = (cause: unknown): string => {
  const spoken = cause instanceof Error ? cause.message.trim() : '';

  return spoken === '' ? UNSPOKEN_FAILURE : spoken;
};

const createIssues = async (
  client: Client,
  input: { kind: LabelKind; rows: readonly TargetRow[] } & {
    printerName: string | null;
    reissueReasonCode: string | null;
  },
  workerNo: string,
  idempotencyKey: string,
): Promise<IssueView[]> => {
  const data = await runRequest(() =>
    client.POST('/app/document-issues', {
      params: { header: { 'Idempotency-Key': idempotencyKey, 'X-Worker-No': workerNo } },
      body: toDocumentIssueBody(input),
    }),
  );

  /*
   * ⛔ **비어 온 것을 성공으로 삼지 않는다.** 기록 없이 다음 걸음으로 가면 인쇄할 식별자가
   * 없는데 화면은 진행 중으로 보인다 — 그 자리에서 멈추는 편이 낫다.
   */
  if (data.items.length === 0) throw new Error('발행 기록이 비어 왔습니다.');

  return data.items.map(toIssueView);
};

/**
 * `issue`·`render` 걸음이 멈춘 원인을 결과에 담는다.
 *
 * ⚠ **그리기가 던질 수 있다.** 값이 모자라면 그리개가 `null` 이 아니라 던지기로 했다
 * (`packing-label-drawer` · `delivery-label-drawer`) — 빈 칸이 찍힌 종이는 되돌릴 수 없어서다.
 * 그 실패는 서버 거부가 아니므로 `toApiError` 가 사람이 읽는 말로 옮긴다.
 */
const stepFailureOf = (cause: unknown): { failureReason: string | null; error: ApiError | null } => ({
  failureReason: null,
  error: toApiError(cause),
});

const reportPrint = async (
  client: Client,
  documentIssueLogId: number,
  failureReason: string | null,
  workerNo: string,
): Promise<void> => {
  await runRequest(() =>
    client.POST('/app/document-issues/{documentIssueLogId}:report-print', {
      params: {
        path: { documentIssueLogId },
        header: { 'Idempotency-Key': createIdempotencyKey(), 'X-Worker-No': workerNo },
      },
      body: toPrintReportBody(failureReason),
    }),
  );
};

export interface IssueCommand {
  kind: LabelKind;
  rows: readonly TargetRow[];
  printerName: string | null;
  reissueReasonCode: string | null;
}

export interface LabelIssueHandle {
  phase: IssuePhase;
  /** 지금 어느 걸음인가. 쉬는 중이면 `null`. */
  step: IssueStep | null;
  /** 발행된 라벨들. `issued` 이후에만 채워진다. */
  labels: IssuedLabel[];
  result: IssueRunResult;
  issue: (command: IssueCommand) => void;
  retryRendition: () => void;
  print: () => void;
  reset: () => void;
}

export interface LabelIssueOptions {
  /**
   * 귀속 사번. **없으면 부르지 않는다** — 서버가 거부한다(공유계약 D-5).
   *
   * ⛔ **모르면 `null` 이다.** 빈 문자열로 떨어뜨리지 않는다 — 빈 값은 서버에 「사번이 있다」로
   * 나가고, 거절이 화면이 아니라 서버에서 난다.
   */
  workerNo: string | null;
  /**
   * **POP 이 그리는 라벨.** 이 훅에 다른 그리기 경로는 없다 — 서버는 이 화면의 두 종류를
   * 하나도 그려 주지 않는다.
   *
   * ⭐ **값을 이 훅이 모으지 않는다.** 무엇을 라벨에 싣는지는 화면이 쥔 자료에 달렸고
   *    (상자 내용물·출하 번호·품목별 합), 훅이 그것을 알면 라벨 종류마다 훅이 하나씩 는다.
   *    출고 QR 이 같은 짜임을 쓴다(`goods-issue-qr/mutations` 의 `labelFieldsOf`).
   *
   * ⛔ **그리지 못하면 `null` 이 아니라 던진다.** `null` 을 돌려주면 이 훅은 **그 라벨을 빈
   *    바이트로 지나치는** 수밖에 없다 — 빈 칸이 찍힌 종이는 되돌릴 수 없다. 모자란 값은
   *    그 자리에서 멈춰야 담당이 무엇이 없는지 안다.
   */
  drawLabel: (kind: LabelKind, row: TargetRow, issue: IssueView) => Uint8Array<ArrayBuffer> | null;
}

/**
 * 이 발행 명령을 가리키는 지문 — **같은 명령이면 같은 문자열이다.**
 *
 * 대상 집합·프린터·사유가 하나라도 다르면 다른 명령이다. 대상 순서는 고름 순서라 뜻이 없어
 * 정렬해 지운다.
 */
const signatureOf = ({ kind, rows, printerName, reissueReasonCode }: IssueCommand): string =>
  [
    kind,
    [...new Set(rows.map((row) => row.issueTargetId))].sort((a, b) => a - b).join(','),
    printerName ?? '',
    reissueReasonCode ?? '',
  ].join('|');

/**
 * 발행 한 번과 그 뒤의 인쇄를 끌고 간다.
 *
 * ⛔ **발행과 인쇄를 한 호출로 묶지 않는다**(스펙 §6). 묶으면 인쇄가 실패했을 때 기록까지
 * 없던 일로 만들고 싶어지는데, 계약에 **발행 취소 경로가 없다** — 기록 전용이다.
 */
export const useLabelIssue = ({ workerNo, drawLabel }: LabelIssueOptions): LabelIssueHandle => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<IssuePhase>('idle');
  const [step, setStep] = useState<IssueStep | null>(null);
  const [labels, setLabels] = useState<IssuedLabel[]>([]);
  const [result, setResult] = useState<IssueRunResult>(IDLE_RESULT);
  /*
   * ⛔ **한 번에 하나만 나간다.** 단추의 비활성만으로는 막지 못한다 — 그 값은 다음 렌더에서야
   * 반영되므로, 장갑 낀 손이 빠르게 두 번 누르면 **같은 렌더에서 두 번** 들어온다. 그러면
   * 발행이 두 번 나가 회차가 하나 더 오르고, 그것을 되돌릴 화면이 없다.
   */
  const isRunning = useRef(false);
  /*
   * ⛔ **재시도에 새 멱등 키를 붙이지 않는다.** 키가 매번 달라지면 서버는 같은 명령인 줄 모르고
   * **두 번째 기록을 만든다** — 타임아웃 뒤 다시 누르는 것이 곧 2회차가 된다. `isRunning` 은
   * 같은 세션의 연타만 막고 실패 후 재시도는 막지 못하므로, 서버 쪽 방어가 유일한 그물이다.
   * 명령이 바뀌면(대상·프린터·사유) 그때 새 키를 낸다 — 전례 `patterns/master/use-master-write`.
   */
  const issueKey = useRef<{ signature: string; key: string } | null>(null);
  const issued = useRef<IssueView[]>([]);
  const issuedKind = useRef<LabelKind | null>(null);
  /* 다시 그릴 때도 같은 값을 실어야 한다 — 발행에 쓴 대상 줄을 들고 있는다. */
  const issuedRows = useRef<readonly TargetRow[]>([]);
  /* 미리보기 주소는 화면이 놓아도 브라우저가 놓지 않는다 — 이 훅이 끝까지 들고 있다가 푼다. */
  const urls = useRef<string[]>([]);

  const releaseUrls = useCallback(() => {
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current = [];
  }, []);

  useEffect(() => releaseUrls, [releaseUrls]);

  const reset = useCallback(() => {
    releaseUrls();
    setPhase('idle');
    setStep(null);
    setLabels([]);
    issued.current = [];
    issuedKind.current = null;
    issuedRows.current = [];
    setResult(IDLE_RESULT);
  }, [releaseUrls]);

  /**
   * 라벨 한 장의 바이트와 미리보기를 만든다 — **POP 이 그린다.**
   *
   * ⛔ **줄을 못 찾으면 멈춘다.** 발행 응답의 `targetId` 로 대상 줄을 되찾는데, 못 찾으면 그릴
   *    값이 없다 — 예전에는 그때 서버 경로로 흘렀지만 그 길이 사라졌고, 애초에 그 길도 이
   *    종류들을 그려 주지 않았다. 빈 라벨을 내보내느니 여기서 멈추는 편이 낫다.
   */
  const renderOne = useCallback(
    (one: IssueView, kind: LabelKind, rows: readonly TargetRow[]): IssuedLabel => {
      const row = rows.find((each) => each.issueTargetId === one.targetId);

      if (row === undefined) {
        throw new Error(`발행 기록의 대상(${String(one.targetId)})을 목록에서 찾지 못했습니다.`);
      }

      const drawn = drawLabel(kind, row, one);

      if (drawn === null) {
        throw new Error(`${kind} 라벨을 그릴 수 없습니다.`);
      }

      /*
       * ⭐ **미리보기도 같은 바이트를 쓴다.** 그림이라 `<img>` 가 그대로 그리고, 두 번 그리면
       *    「본 것과 나온 것」이 갈릴 수 있다.
       */
      const previewUrl = URL.createObjectURL(new Blob([drawn as BlobPart], { type: 'image/png' }));
      urls.current.push(previewUrl);

      return { issue: one, bytes: drawn, format: 'png', previewUrl };
    },
    [drawLabel],
  );

  const issue = useCallback(
    (command: IssueCommand) => {
      /*
       * ⛔ **사번을 모르면 아무것도 부르지 않는다**(공유계약 D-5 · F-6). 단추도 함께 막혀
       * 있지만 판정을 나가는 자리에 두어, 다른 경로가 생겨도 빈 사번이 새지 않게 한다.
       */
      if (workerNo === null || command.rows.length === 0) return;
      if (isRunning.current) return;

      isRunning.current = true;

      const execute = async (): Promise<void> => {
        let at: IssueStep = 'issue';

        try {
          setPhase('issuing');
          setStep('issue');
          const signature = signatureOf(command);

          if (issueKey.current?.signature !== signature) {
            issueKey.current = { signature, key: createIdempotencyKey() };
          }

          const issues = await createIssues(client, command, workerNo, issueKey.current.key);
          issued.current = issues;
          issuedKind.current = command.kind;
          issuedRows.current = command.rows;

          at = 'render';
          setStep('render');

          const rendered: IssuedLabel[] = [];

          for (const one of issues) {
            rendered.push(renderOne(one, command.kind, command.rows));
          }

          setLabels(rendered);
          setResult(IDLE_RESULT);
          setPhase('issued');
          // 기록이 남았다 — 다음 발행은 같은 값이라도 «다른» 명령이다.
          issueKey.current = null;
        } catch (cause) {
          /*
           * ⚠ **기록이 남았는데 그리기에서 멈춘 상태가 있다.** 그것을 「발행 실패」로 말하면
           * 사용자가 다시 눌러 회차가 하나 더 오른다 — 어디서 멈췄는지를 그대로 남긴다.
           */
          setResult({
            printed: 0,
            failedAt: at,
            ...stepFailureOf(cause),
          });
          setPhase(at === 'issue' ? 'idle' : 'issued');
        } finally {
          isRunning.current = false;
          setStep(null);
          /*
           * ⚠ **여기서 멈췄어도 기록은 남았다.** 회차를 다시 읽지 않으면 같은 대상을 다시
           * 고를 때 화면이 낡은 「발행 0회」를 보고 재발행 사유를 요구하지 않는다 — 사유 없는
           * 2회차 요청이 나가 `ck_document_reissue_reason` 에 막힌다.
           */
          await queryClient.invalidateQueries({ queryKey: ['shipping-packing-label', 'summary'] });
          // 이력도 함께 낡는다 — 발행 뒤 인쇄 전에 회차 단추를 누르면 지난 목록이 뜬다.
          await queryClient.invalidateQueries({ queryKey: ['shipping-packing-label', 'history'] });
        }
      };

      void execute();
    },
    [client, queryClient, renderOne, workerNo],
  );

  const retryRendition = useCallback(() => {
    if (issued.current.length === 0 || isRunning.current) return;

    isRunning.current = true;

    const execute = async (): Promise<void> => {
      try {
        setPhase('issuing');
        setStep('render');
        releaseUrls();
        const rendered: IssuedLabel[] = [];

        for (const one of issued.current) {
          if (issuedKind.current === null) throw new Error('다시 그릴 라벨 종류를 모릅니다.');

          rendered.push(renderOne(one, issuedKind.current, issuedRows.current));
        }

        setLabels(rendered);
        setResult(IDLE_RESULT);
        setPhase('issued');
      } catch (cause) {
        setLabels([]);
        setResult({
          printed: 0,
          failedAt: 'render',
          ...stepFailureOf(cause),
        });
        setPhase('issued');
      } finally {
        isRunning.current = false;
        setStep(null);
      }
    };

    void execute();
  }, [releaseUrls, renderOne]);

  const print = useCallback(() => {
    if (workerNo === null || labels.length === 0) return;
    if (isRunning.current) return;

    isRunning.current = true;

    const execute = async (): Promise<void> => {
      let printed = 0;

      setPhase('printing');

      try {
        const shell = renditionShell();

        for (const label of labels) {
          setStep('print');

          /*
           * ⛔ **통로가 없는 것을 인쇄 성공으로 보고하지 않는다.** 기록은 이미 남았으므로
           * 실패로 보고해야 「나오지 않은 라벨」이 나온 것으로 남지 않는다(공유계약 F-6).
           */
          const failureReason =
            shell === null
              ? NO_SHELL_REASON
              : await shell
                  .save(
                    label.bytes,
                    `label-${String(label.issue.documentIssueLogId)}`,
                    new Date().toISOString(),
                    label.format,
                  )
                  .then(() => null)
                  .catch((cause: unknown) => toFailureReason(cause));

          /*
           * ⭐ **종이가 나온 시점에 센다.** 보고 뒤에 세면 보고만 실패했을 때 이미 나온 장이
           * 카운트에서 빠져, 「종이는 나왔다」는 안내와 화면의 숫자가 서로를 부정한다.
           */
          if (failureReason === null) printed += 1;

          setStep('report');
          await reportPrint(client, label.issue.documentIssueLogId, failureReason, workerNo);

          /*
           * ⭐ **첫 실패에서 멈춘다.** 프린터가 죽은 상태로 남은 장을 계속 밀면 실패 보고만
           * 쌓이고 사용자는 그 사이 아무것도 할 수 없다. 발행 기록은 이미 모든 대상에
           * 남았으므로, 멈춘 뒤 남은 장도 「인쇄 실패」 사유의 재발행으로 이어받는다.
           */
          if (failureReason !== null) {
            setResult({ printed, failedAt: 'print', failureReason, error: null });
            setPhase('printed');

            return;
          }
        }

        setResult({ printed, failedAt: null, failureReason: null, error: null });
        setPhase('printed');
      } catch (cause) {
        /*
         * ⚠ **보고 실패가 인쇄 성공을 뒤집지 않는다.** 종이는 이미 나왔다 — 그 사실을 실패
         * 사유로 올리되 「인쇄되지 않았다」고 말하지 않는다.
         */
        setResult({ printed, failedAt: 'report', failureReason: null, error: toApiError(cause) });
        setPhase('printed');
      } finally {
        isRunning.current = false;
        setStep(null);
        // 회차가 올랐다 — 목록의 「최근 발행 · 회차」 칸을 다시 읽어야 다음 조작이 옳다.
        await queryClient.invalidateQueries({ queryKey: ['shipping-packing-label', 'summary'] });
        await queryClient.invalidateQueries({ queryKey: ['shipping-packing-label', 'history'] });
      }
    };

    void execute();
  }, [client, labels, queryClient, workerNo]);

  return { phase, step, labels, result, issue, retryRendition, print, reset };
};
