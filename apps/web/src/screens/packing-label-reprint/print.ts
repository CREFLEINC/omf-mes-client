/**
 * 인쇄 — **발행과 분리된 세 걸음**(스펙 §5-3 · K-4).
 *
 * ```
 * ② 발행 기록을 만든다        (mutations.ts)
 * ③-1 그린 것을 받는다         GET  /app/document-issues/{id}/rendition
 * ③-2 셸이 프린터로 보낸다     window.pop.rendition.save
 * ③-3 결과를 보고한다          POST /app/document-issues/{id}:report-print
 * ```
 *
 * ⛔ **발행과 인쇄를 한 호출로 묶지 않는다.** 인쇄가 실패해도 발행 기록은 남아야 하고, 그
 * 사실이 곧 재인쇄로 복구할 수 있다는 뜻이다.
 *
 * ⛔ **셸이 출력물을 다시 그리지 않는다.** 서버가 그린 바이트를 그대로 넘긴다 — 단말마다
 * 출력물이 달라지지 않게 하기 위함이다(POP 셸 설계 결정 18).
 */

/** 라벨·인식표 모두 이미지다. 성적서·보고서(`pdf`)는 이 화면의 출력물이 아니다. */
export const LABEL_RENDITION_FORMAT = 'png';

/**
 * POP 셸이 렌더러에 여는 통로 중 이 화면이 쓰는 부분.
 *
 * ⚠ **관리웹(브라우저)에는 이 통로가 없다.** 없는 것이 오류는 아니고 「여기서는 프린터로 보낼
 * 수 없다」는 사실이라, 화면은 그 사유를 말하고 발행까지만 진행한다.
 */
export interface RenditionShell {
  save: (bytes: Uint8Array, label: string, now: string, format: 'png' | 'pdf') => Promise<string>;
}

interface ShellCarrier {
  pop?: { rendition?: RenditionShell };
}

/** 셸 통로를 집는다. 없으면 `null` — 지어내지 않는다. */
export const renditionShell = (): RenditionShell | null => {
  if (typeof window === 'undefined') return null;

  const carrier = window as unknown as ShellCarrier;
  const shell = carrier.pop?.rendition;

  return typeof shell?.save === 'function' ? shell : null;
};

/** 한 장을 인쇄하는 데 필요한 것. 시험이 각 걸음을 따로 대체할 수 있도록 주입으로 받는다. */
export interface PrintDeps {
  fetchRendition: (documentIssueLogId: number) => Promise<Uint8Array>;
  send: (bytes: Uint8Array, label: string) => Promise<void>;
  report: (documentIssueLogId: number, failureReason: string | null) => Promise<void>;
}

export interface PrintTarget {
  documentIssueLogId: number;
  /** 인쇄 작업 이름. 현장에서 어느 출력물인지 가리는 값이라 LOT 번호를 쓴다. */
  label: string;
}

export type PrintOutcome =
  | { ok: true; printed: number }
  /** 몇 장까지 나갔고 어디서 멈췄는지. **멈춘 자리를 감추지 않는다.** */
  | { ok: false; printed: number; failedAt: PrintTarget; reason: string };

const reasonOf = (error: unknown): string =>
  error instanceof Error && error.message.trim() !== '' ? error.message : '인쇄 실패';

/**
 * 발행 기록마다 한 장씩 인쇄하고 결과를 보고한다.
 *
 * ⭐ **첫 실패에서 멈춘다.** 프린터가 죽은 상태로 남은 장을 계속 밀면 실패 보고만 쌓이고
 * 사용자는 그 사이 아무것도 할 수 없다. 멈춘 뒤 남은 것은 회차가 오르지 않은 채 그대로
 * 있고, 다시 누르면 그것부터 이어받는다.
 *
 * ⚠ **보고 실패가 인쇄 성공을 뒤집지 않는다.** 종이는 이미 나왔다 — 보고가 실패하면 그 사실을
 * 실패 사유로 올리되 「인쇄되지 않았다」고 말하지 않는다.
 */
export const printAll = async (
  targets: readonly PrintTarget[],
  deps: PrintDeps,
): Promise<PrintOutcome> => {
  let printed = 0;

  for (const target of targets) {
    try {
      const bytes = await deps.fetchRendition(target.documentIssueLogId);
      await deps.send(bytes, target.label);
    } catch (error) {
      const reason = reasonOf(error);

      /* 실패 보고 자체가 실패해도 여기서 더 할 수 있는 것이 없다 — 원인은 위 실패다. */
      try {
        await deps.report(target.documentIssueLogId, reason);
      } catch {
        /* 삼키지 않고 아래 결과에 실패로 남는다. */
      }

      return { ok: false, printed, failedAt: target, reason };
    }

    printed += 1;

    /*
     * 종이는 이미 나왔다 — 보고가 실패해도 「인쇄되지 않았다」로 말하지 않는다. 다만 조용히
     * 넘기지도 않는다: 보고가 없으면 서버에는 `PENDING` 으로 남아, 나온 라벨이 안 나온 것으로
     * 읽힌다.
     */
    try {
      await deps.report(target.documentIssueLogId, null);
    } catch (error) {
      return { ok: false, printed, failedAt: target, reason: reasonOf(error) };
    }
  }

  return { ok: true, printed };
};
