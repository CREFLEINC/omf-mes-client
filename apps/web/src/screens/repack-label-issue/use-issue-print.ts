import { createIdempotencyKey } from '@omf-mes/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { fetchLabelRendition } from '../../patterns/pop-label-rendition';
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
  /** 프린터로 보내지 못했다. **발행 기록은 남아 있다** — 복구는 새 회차 재발행이다 */
  | 'failed'
  /**
   * **종이는 나왔고 결과 보고만 실패했다.**
   *
   * ⛔ `failed` 와 섞지 않는다 — 섞으면 화면이 「인쇄하지 못했다」고 말하고 복구로 다시
   * 인쇄를 권해 **같은 라벨이 한 장 더 나온다.** 여기서 할 일은 보고 재시도다.
   */
  | 'reportFailed'
  /** 그린 것을 받지 못했다. 발행 기록은 남아 있다 */
  | 'renditionFailed'
  /** 셸 밖(브라우저)이라 프린터로 보낼 수 없다 */
  | 'shellUnavailable';

export interface IssuePrintTarget {
  documentIssueLogId: number;
  /** 물리 인쇄 실패 때 `PRINT_FAILURE` 사유의 새 회차를 발행할 계약 대상. */
  targetId: number;
  /** 인쇄 작업 이름. 현장에서 어느 출력물인지 가리는 값이라 포장 번호를 쓴다. */
  label: string;
}

export interface IssuePrintState {
  phase: IssuePrintPhase;
  /** 미리보기에 걸 이미지 주소. 받기 전·닫은 뒤에는 `null` */
  imageUrl: string | null;
  /** 실패 사유. 서버·셸이 준 말이다 */
  reason: string | null;
  /** 방금 발행한 것. 렌디션 재조회와 물리 인쇄 실패 후 재발행 대상이 여기서 나온다. */
  target: IssuePrintTarget | null;
}

const IDLE: IssuePrintState = { phase: 'idle', imageUrl: null, reason: null, target: null };

export interface IssuePrintRunner {
  state: IssuePrintState;
  /** 발행이 끝난 직후 부른다 — 그린 것을 받아 미리보기까지 연다 */
  begin: (target: IssuePrintTarget) => Promise<void>;
  /** 미리보기에서 인쇄를 눌렀다 */
  print: () => Promise<void>;
  /** 종이는 나왔는데 보고만 실패했다 — **보고만** 다시 보낸다. 인쇄를 되풀이하지 않는다 */
  retryReport: () => Promise<void>;
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

    const created = createIdempotencyKey();
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
        /*
         * ⛔ **서버에 이 경로가 없다**(`patterns/pop-label-rendition` 머리말 · 대응표 P1
         * 「미구현 5건」). `client.GET` 을 부르지 않고 항상 거부하는 대역을 부른다 — 아래
         * `catch` 가 «renditionFailed» 로 받아, «발행 실패»와 뒤섞이지 않게 한다.
         */
        const data = await fetchLabelRendition();

        const received = new Uint8Array(data);
        bytes.current = received;

        /*
         * ⛔ **미리보기는 «그림»으로 따로 받는다.** 인쇄로 나가는 것은 명령형(`tspl`)인데,
         *    그 바이트를 `<img>` 에 넣으면 언제나 「그릴 수 없습니다」가 뜬다 — 그리고
         *    명령형을 쓰는 자리는 실기 단말뿐이라, **확인해야 할 그 단말에서만** 미리보기가
         *    통째로 죽는다(리뷰 지적 2026-09-08).
         *
         * ⚠ 그림을 못 받아도 인쇄는 막지 않는다 — 종이로 나갈 바이트는 이미 손에 있다.
         */
        const previewBytes =
          LABEL_RENDITION_FORMAT === 'png'
            ? received
            : /*
               * ⛔ 여기도 서버에 없는 경로다 — 위와 같은 대역을 부른다. 실제로는 위 줄에서
               * 이미 던져 이 자리까지 오지 않지만(첫 호출도 같은 경로다), 서버가 구현해
               * 첫 호출이 성공하게 되는 날에도 «명령형 인쇄용 프린터 형식은 png 로 다시
               * 받는다»는 이 갈래의 뜻은 그대로 남아야 한다.
               */
              await fetchLabelRendition()
                .then((drawn) => new Uint8Array(drawn))
                .catch(() => null);

        const url =
          previewBytes === null
            ? null
            : URL.createObjectURL(new Blob([previewBytes], { type: 'image/png' }));
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
      setState((current) => ({
        ...current,
        phase: 'reportFailed',
        reason: printFailureReason(error),
      }));
      return;
    }

    releaseImage();
    setState((current) => ({ ...current, phase: 'succeeded', imageUrl: null }));
  }, [releaseImage, report, state.target, workerNo]);

  /**
   * 보고만 다시 보낸다.
   *
   * ⭐ **멱등 키가 이미 고정이라 안전하다** — 같은 결과의 보고는 같은 키로 나가므로 서버가
   * 두 번 기록하지 않는다.
   */
  const retryReport = useCallback(async (): Promise<void> => {
    const target = state.target;

    if (target === null) return;

    try {
      await report(target.documentIssueLogId, null);
    } catch (error) {
      setState((current) => ({
        ...current,
        phase: 'reportFailed',
        reason: printFailureReason(error),
      }));
      return;
    }

    releaseImage();
    setState((current) => ({ ...current, phase: 'succeeded', imageUrl: null }));
  }, [releaseImage, report, state.target]);

  const dismiss = useCallback(() => {
    releaseImage();
    setState((current) => ({ ...current, phase: 'idle', imageUrl: null }));
  }, [releaseImage]);

  const reset = useCallback(() => {
    releaseImage();
    bytes.current = null;
    setState(IDLE);
  }, [releaseImage]);

  return { state, begin, print, retryReport, dismiss, reset };
};
