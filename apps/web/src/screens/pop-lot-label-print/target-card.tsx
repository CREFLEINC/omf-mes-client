import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { popTouchClass } from '../../patterns/pop-touch';
import type { IssueBlock, ReissueVerdict } from './issue-request';
import type { Item, Lot } from './types';

const t = messages.popLotLabelPrint.detail;
const ta = messages.popLotLabelPrint.action;

export interface TargetCardProps {
  lot: Lot | null;
  item: Item | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  issueCount: number | null;
  verdict: ReissueVerdict;
  /** 막는 사유 하나. `null` 이면 누를 수 있다 */
  block: IssueBlock | null;
  isSubmitting: boolean;
  onPrint: () => void;
  onReprint: () => void;
  /** 단말 권한을 확인하지 못했을 때만 다시 시도 경로를 준다 */
  onGateRetry: () => void;
}

/**
 * 우단 《대상》 — 고른 LOT 의 상세와 조작 둘.
 *
 * ⭐ **양품·상태는 상세 조회에서만 온다**(`queries.ts` 의 `useLotDetail`). 목록이 채우지 못하는
 * 두 값이 여기서는 채워진다 — 그래서 왼쪽에서 고른 뒤 오른쪽에서 확인하는 흐름이다.
 *
 * ⛔ **화면이 「완료 / 미달」을 계산하지 않는다.** 서버가 내린 `completionJudgmentCode` 를
 * 옮기기만 한다(공유계약 L-2) — 화면이 달성률로 판정하면 완료 화면(`P-02-06`)과 값이 갈린다.
 *
 * ⛔ **비활성 사유를 감추지 않는다**(F-1). 무엇이 막혔는지와 어떻게 푸는지를 함께 말한다.
 */
export const TargetCard = ({
  lot,
  item,
  isLoading,
  isError,
  onRetry,
  issueCount,
  verdict,
  block,
  isSubmitting,
  onPrint,
  onReprint,
  onGateRetry,
}: TargetCardProps) => {
  if (isError) {
    return (
      <div className="pop-lot-detail">
        <p className="field-error">{t.loadFailed}</p>
        <Button className={popTouchClass('normal')} variant="outlined" size="xl" onClick={onRetry}>
          {t.retry}
        </Button>
      </div>
    );
  }

  if (lot === null) {
    return <p className="field-note">{isLoading ? t.loading : t.placeholder}</p>;
  }

  /* 조회 중에는 값을 단정하지 않는다 — 「모른다」로 잠깐 보이면 그 사이 오해가 생긴다. */
  const progress = isLoading ? null : (lot.progress ?? null);
  const judgment = progress === null ? null : t.judgment[progress.completionJudgmentCode];

  return (
    <div className="pop-lot-detail">
      <h2 className="pop-lot-pane-title">{lot.lotNo}</h2>

      <dl className="pop-lot-facts">
        <dt>{t.itemLabel}</dt>
        {/* 품목 코드는 별도 조회다 — 못 받았으면 지어내지 않고 모른다고 말한다. */}
        <dd>{item?.itemCode ?? t.unknown}</dd>

        <dt>{t.goodQtyLabel}</dt>
        <dd>{progress === null ? t.unknown : String(progress.goodQty)}</dd>

        <dt>{t.statusLabel}</dt>
        <dd>{judgment ?? t.unknown}</dd>

        <dt>{t.issueHistoryLabel}</dt>
        {/* 「모른다」와 「없다」를 가른다 — 앞의 것은 출력을 막는 사유다. */}
        <dd>
          {issueCount === null
            ? t.unknown
            : issueCount === 0
              ? t.neverIssued
              : messages.popLotLabelPrint.lotList.issuedCount(issueCount)}
        </dd>
      </dl>

      <div className="pop-lot-actions">
        {/*
         * 조작이 둘이지만 **한 번에 하나만 뜬다** — 신규면 「라벨 출력」, 이미 찍혔으면
         * 「재출력」이다. 둘을 함께 두면 사용자가 어느 것이 맞는지 판단해야 하고, 그 판단의
         * 근거(회차)는 이미 화면이 갖고 있다.
         *
         * 되돌릴 수 없는 쓰기라 **위험 등급**이다(`popTouchClass`) — 발행 취소가 없다.
         */}
        {verdict === 'reissue' ? (
          <Button
            className={popTouchClass('destructive')}
            size="xl"
            disabled={block !== null || isSubmitting}
            onClick={onReprint}
          >
            {ta.reprint}
          </Button>
        ) : (
          <Button
            className={popTouchClass('critical')}
            size="xl"
            disabled={block !== null || isSubmitting}
            onClick={onPrint}
          >
            {ta.print}
          </Button>
        )}

        {block === null ? null : <p className="field-note">{ta.blocked[block]}</p>}

        {/* 확인하지 못한 것에만 다시 시도 경로를 준다 — 「권한이 없다」와 다른 상황이다(G-3). */}
        {block === 'gateUnknown' ? (
          <Button
            className={popTouchClass('normal')}
            variant="outlined"
            size="xl"
            onClick={onGateRetry}
          >
            {ta.gateRetry}
          </Button>
        ) : null}
      </div>
    </div>
  );
};
