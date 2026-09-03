import { useCallback, useEffect, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { printFailureReason, renditionShell } from './print';
import { LABEL_RENDITION_FORMAT } from './types';

/**
 * 발행 뒤의 절차를 화면에 붙인다 — **받기 → 미리보기 → 보내기 → 보고.**
 *
 * ⚠ **`useMasterWrite` 를 쓰지 않는다.** 그 부품의 `write` 는 값을 돌려주지 않아 「받고, 보이고,
 * 보내고, 보고한다」를 이어 붙일 수 없다. 사람이 누르는 저장이 아니라 절차라서 형태가 다르다 —
 * 대신 멱등 키·오류 정규화 같은 규약은 여기서도 그대로 지킨다.
 */

export type IssuePrintPhase =
  /** 아직 발행하지 않았다 */
  | 'idle'
  /** 발행됐고 그린 것을 받는 중 */
  | 'fetching'
  /** 받았다 — 사용자가 보고 인쇄를 누를 차례 */
  | 'preview'
  /** 프린터로 보내는 중 */
  | 'printing'
  | 'succeeded'
  /** 인쇄나 보고가 실패했다. **발행 기록은 남아 있다** */
  | 'failed'
  /** 그린 것을 받지 못했다. 발행 기록은 남아 있다 */
  | 'renditionFailed'
  /** 셸 밖(브라우저)이라 프린터로 보낼 수 없다 */
  | 'shellUnavailable';

export interface IssuePrintTarget {
  documentIssueLogId: number;
  /** 인쇄 작업 이름. 현장에서 어느 출력물인지 가리는 값이라 포장 번호를 쓴다. */
  label: string;
}

export interface IssuePrintState {
  phase: IssuePrintPhase;
  /** 미리보기에 걸 이미지 주소. 받기 전·닫은 뒤에는 `null` */
  imageUrl: string | null;
  /** 실패 사유. 서버·셸이 준 말이다 */
  reason: string | null;
  /**
   * 방금 발행한 것. **다시 인쇄가 여기서 나온다** — 복구는 「다시 «인쇄»」이지 「다시 «발행»」이
   * 아니다(다시 발행하면 회차가 또 오른다).
   */
  target: IssuePrintTarget | null;
}

const IDLE: IssuePrintState = { phase: 'idle', imageUrl: null, reason: null, target: null };

export interface IssuePrintRunner {
  state: IssuePrintState;
  /** 발행이 끝난 직후 부른다 — 그린 것을 받아 미리보기까지 연다 */
  begin: (target: IssuePrintTarget) => Promise<void>;
  /** 미리보기에서 인쇄를 눌렀다 */
  print: () => Promise<void>;
  /** 미리보기를 닫는다. **발행 기록은 남는다** — 인쇄는 나중에 다시 할 수 있다 */
  dismiss: () => void;
  reset: () => void;
}

export const useIssuePrintRunner = (workerNo: string | null): IssuePrintRunner => {
  const { client } = useApiClient();
  const [state, setState] = useState<IssuePrintState>(IDLE);

  /** 받은 바이트. 미리보기와 인쇄가 **같은 것**을 써야 한다 — 두 번 받으면 서버가 두 번 그린다. */
  const bytes = useRef<Uint8Array | null>(null);
  /** 만든 이미지 주소. 화면에서 사라질 때 반드시 거둔다 — 안 거두면 단말 메모리에 쌓인다. */
  const objectUrl = useRef<string | null>(null);

  const releaseImage = useCallback(() => {
    if (objectUrl.current !== null) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
  }, []);

  /* 화면을 떠날 때도 거둔다. */
  useEffect(() => releaseImage, [releaseImage]);

  /**
   * 결과 보고의 멱등 키를 **보고 한 건마다 하나로 고정**한다.
   *
   * ⛔ 재시도마다 새 키를 만들면 같은 보고가 다른 쓰기로 나가, 서버가 「이미 보고된 건」으로
   * 되돌린 422 를 화면이 「보고 실패」로 읽는다.
   */
  const reportKeys = useRef(new Map<string, string>());

  const reportKeyFor = useCallback((documentIssueLogId: number, failed: boolean): string => {
    const slot = `${String(documentIssueLogId)}:${failed ? 'FAILED' : 'SUCCEEDED'}`;
    const existing = reportKeys.current.get(slot);

    if (existing !== undefined) return existing;

    const created = crypto.randomUUID();
    reportKeys.current.set(slot, created);

    return created;
  }, []);

  const report = useCallback(
    async (documentIssueLogId: number, failureReason: string | null): Promise<void> => {
      if (workerNo === null) {
        throw new Error('사번이 없어 인쇄 결과를 보고할 수 없습니다.');
      }

      await runRequest(() =>
        client.POST('/app/document-issues/{documentIssueLogId}:report-print', {
          params: {
            header: {
              'Idempotency-Key': reportKeyFor(documentIssueLogId, failureReason !== null),
              'X-Worker-No': workerNo,
            },
            path: { documentIssueLogId },
          },
          body:
            failureReason === null
              ? { outcome: 'SUCCEEDED' }
              : { outcome: 'FAILED', failureReason },
        }),
      );
    },
    [client, reportKeyFor, workerNo],
  );

  const begin = useCallback(
    async (target: IssuePrintTarget): Promise<void> => {
      releaseImage();
      bytes.current = null;
      setState({ phase: 'fetching', imageUrl: null, reason: null, target });

      try {
        const data = await runRequest<ArrayBuffer>(() =>
          client.GET('/app/document-issues/{documentIssueLogId}/rendition', {
            params: {
              path: { documentIssueLogId: target.documentIssueLogId },
              query: { format: LABEL_RENDITION_FORMAT },
            },
            parseAs: 'arrayBuffer',
          }),
        );

        const received = new Uint8Array(data);
        bytes.current = received;

        const url = URL.createObjectURL(
          new Blob([received], { type: `image/${LABEL_RENDITION_FORMAT}` }),
        );
        objectUrl.current = url;

        setState({ phase: 'preview', imageUrl: url, reason: null, target });
      } catch (error) {
        /*
         * ⛔ **발행이 실패한 것이 아니다.** 기록은 남았고 그림만 못 받았다 — 화면이 이 둘을
         * 뭉뚱그리면 사용자가 다시 «발행»을 눌러 회차를 하나 더 올린다.
         */
        setState({
          phase: 'renditionFailed',
          imageUrl: null,
          reason: printFailureReason(error),
          target,
        });
      }
    },
    [client, releaseImage],
  );

  const print = useCallback(async (): Promise<void> => {
    const target = state.target;
    const payload = bytes.current;

    if (target === null || payload === null) return;

    const shell = renditionShell();

    if (shell === null || workerNo === null) {
      /* 셸 밖이거나 사번이 없다. 발행은 이미 끝났고 인쇄만 여기서 할 수 없다. */
      setState((current) => ({ ...current, phase: 'shellUnavailable' }));
      return;
    }

    setState((current) => ({ ...current, phase: 'printing', reason: null }));

    try {
      await shell.save(payload, target.label, new Date().toISOString(), LABEL_RENDITION_FORMAT);
    } catch (error) {
      const reason = printFailureReason(error);

      /*
       * 실패도 보고한다 — 보고하지 않으면 발행 기록이 곧 인쇄 성공으로 읽혀, 실제로는 안 나온
       * 라벨이 나온 것으로 남는다(계약).
       */
      try {
        await report(target.documentIssueLogId, reason);
      } catch {
        /* 보고까지 실패했다. 사용자에게 말할 것은 여전히 「인쇄 실패」다 — 사유를 덮지 않는다. */
      }

      setState((current) => ({ ...current, phase: 'failed', reason }));
      return;
    }

    try {
      await report(target.documentIssueLogId, null);
    } catch (error) {
      /*
       * ⚠ **보고 실패가 인쇄 성공을 뒤집지 않는다.** 종이는 이미 나왔다 — 그 사실을 사유로
       * 올리되 「인쇄되지 않았다」고 말하지 않는다.
       */
      setState((current) => ({ ...current, phase: 'failed', reason: printFailureReason(error) }));
      return;
    }

    releaseImage();
    setState((current) => ({ ...current, phase: 'succeeded', imageUrl: null }));
  }, [releaseImage, report, state.target, workerNo]);

  const dismiss = useCallback(() => {
    releaseImage();
    setState((current) => ({ ...current, phase: 'idle', imageUrl: null }));
  }, [releaseImage]);

  const reset = useCallback(() => {
    releaseImage();
    bytes.current = null;
    setState(IDLE);
  }, [releaseImage]);

  return { state, begin, print, dismiss, reset };
};
