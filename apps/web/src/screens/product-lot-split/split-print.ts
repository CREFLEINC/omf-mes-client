import { messages } from '@omf-mes/i18n';

import type { PuTone } from '../../patterns/pop-uniform';
import type { PrintState, PrintTarget } from '../production-result/flow-print';
import { buildProductionLotLabel } from '../production-result/label-tspl';

/**
 * 분리 라벨 두 장 — 생산 LOT 라벨을 찍는 P-02-04 와 같은 흐름이다(`production-result/flow-print`
 * `useLabelPrintRunner` · `label-tspl`): 발행 기록 → 화면이 짠 80 × 30 mm 라벨 → 셸 인쇄 → 결과 보고.
 *
 * ⭐ **공용으로 꺼내지 않았다.** 쓰는 화면이 둘(P-02-04 · P-04-08)이고 둘 다 같은 함수를 그대로 부른다 — 꺼내면
 *    P-02-04 를 함께 고쳐야 하는데 이 피처가 손댈 까닭이 없다. 세 번째 화면이 생기면 `patterns/` 로 올린다.
 * ⭐ 원래 LOT 을 먼저, 새 LOT 을 다음에 찍는다. 앞 장이 실패하면 러너가 뒤 장을 보내지 않는다(프린터가 선 것).
 * ⛔ 라벨 값은 서버가 준 그대로다 — 수량은 LOT 수량(분리 응답 · 목록의 `qty`), W/O 는 원래 LOT 의 것.
 */
const t = messages.productLotSplit;

export interface SplitLabel {
  role: 'parent' | 'child';
  documentIssueLogId: number;
  issueSeq: number;
  lotNo: string;
  qty: number;
}

export interface SplitLabelSource {
  itemCode: string;
  uomCode: string | null;
  /** 원래 LOT 의 W/O. 모르면 `-`(생산 LOT 라벨 화면과 같은 자리 표시). */
  workOrderNo: string | null;
}

/** 두 장을 원래 → 새 차례로 인쇄 대상으로 짠다. */
export const splitPrintTargets = (
  labels: readonly SplitLabel[],
  source: SplitLabelSource,
): PrintTarget[] =>
  [...labels]
    .sort((left, right) => (left.role === right.role ? 0 : left.role === 'parent' ? -1 : 1))
    .map((label) => ({
      documentIssueLogId: label.documentIssueLogId,
      label: label.lotNo,
      command: buildProductionLotLabel({
        itemCode: source.itemCode,
        lotNo: label.lotNo,
        qty: label.qty,
        uomCode: source.uomCode,
        issueSeq: label.issueSeq,
        workOrderNo: source.workOrderNo ?? '-',
        /* 반제품 LOT 은 서버가 분리를 막는다(SEMI_FINISHED_LOT · 피처 016) — 늘 제품 LOT 라벨이다. */
        wip: null,
      }),
    }));

export interface PrintOutcomeView {
  tone: PuTone;
  title: string;
  body: string | null;
  /** 결과만 보내지 못했다 — [다시 보내기]를 둔다. */
  canRetryReport: boolean;
}

/**
 * 러너가 끝난 상태 → 결과 띠. 실패면 몇 장이 어느 라벨인지 말한다 — 앞 장(원래)이 실패하면 뒤 장(새)은 보내지
 * 않았으므로 「두 라벨」이다.
 */
export const printOutcomeViewOf = (
  state: PrintState,
  total: number,
  isReprint: boolean,
): PrintOutcomeView | null => {
  switch (state.phase) {
    case 'succeeded':
      return isReprint
        ? { tone: 'ok', title: t.result.reprinted, body: null, canRetryReport: false }
        : {
            tone: 'ok',
            title: t.result.printedTitle,
            body: t.result.printedBody,
            canRetryReport: false,
          };
    case 'printFailed':
    case 'renditionFailed': {
      const failed = Math.max(1, total - state.printed);
      const which =
        failed >= 2
          ? t.result.whichBoth
          : state.printed === 0
            ? t.result.whichParent
            : t.result.whichChild;

      return {
        tone: 'bad',
        title: t.result.failedTitle(failed, which),
        body: t.result.failedBody,
        canRetryReport: false,
      };
    }
    case 'shellUnavailable':
      return { tone: 'bad', title: t.result.shellUnavailable, body: null, canRetryReport: false };
    case 'reportFailed':
      return { tone: 'warn', title: t.result.reportFailed, body: null, canRetryReport: true };
    case 'idle':
    case 'sending':
      return null;
  }
};
