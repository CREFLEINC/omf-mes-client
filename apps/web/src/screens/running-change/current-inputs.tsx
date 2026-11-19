import { messages } from '@omf-mes/i18n';
import { useRef, useState, type ReactNode } from 'react';

import {
  PuChip,
  PuCount,
  PuEmpty,
  PuNote,
  PuPager,
  PuSection,
  useClientPage,
  useFitCount,
  type PuFold,
} from '../../patterns/pop-uniform';
import {
  ListOrderFoot,
  listDateTimeText,
  sortByTime,
  type ListOrder,
} from '../../patterns/pop-list-order';
import { isShotCountExceeded, type CurrentMold } from './mold';
import type { ReferenceLabels } from './reference-labels';
import type { CurrentInputView } from './types';

const t = messages.runningChange;

export interface CurrentInputsProps {
  rows: readonly CurrentInputView[];
  isPending: boolean;
  hasWorkOrder: boolean;
  /** 조회 실패 — 「없다」가 아니라 「모른다」다. 있으면 목록 대신 이것이 선다. */
  error: ReactNode;
  labels: ReferenceLabels;
  fold: PuFold;
}

/**
 * 《현재 투입》 — 스펙 §3 좌단 · POP 통일 시안(#295). **읽기 전용 구획**이고, 교체 대상 목록의 모집단이다.
 *
 * ⭐ 한 줄씩, 구획 높이에 들어가는 만큼 보이고 나머지는 아래 쪽 넘김(‹ ›) — 구획 안 스크롤 없음.
 * ⛔ **비어 있음과 불러오지 못함을 같은 모양으로 두지 않는다.** 「투입이 없다」로 보이면 작업자는 교체할
 *    것이 없다고 읽고 화면을 떠난다.
 */
export const CurrentInputs = ({
  rows,
  isPending,
  hasWorkOrder,
  error,
  labels,
  fold,
}: CurrentInputsProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const per = useFitCount(listRef, { fallback: 4 });
  /* 투입일시로 [최신순 | 오래된순](사용자 지시 2026-11-19) — 처음은 최신순. */
  const [order, setOrder] = useState<ListOrder>('newest');
  const page = useClientPage(
    sortByTime(rows, order, (row) => row.occurredAt),
    per,
  );
  const hasError = error !== null && error !== undefined && error !== false;
  const showList = hasWorkOrder && !hasError && !isPending && rows.length > 0;

  return (
    <PuSection
      title={t.panes.current}
      fold={fold}
      meta={showList ? <PuCount>{rows.length}</PuCount> : undefined}
      split={showList}
    >
      <div className="rc-cur">
        {!hasWorkOrder && (
          <PuEmpty title={t.current.noWorkOrderTitle} hint={t.current.noWorkOrder} />
        )}
        {hasWorkOrder && hasError && error}
        {hasWorkOrder && !hasError && isPending && <p className="pu-help">{t.current.loading}</p>}
        {hasWorkOrder && !hasError && !isPending && rows.length === 0 && (
          <PuEmpty title={t.current.empty} />
        )}
        {showList && (
          <div
            ref={listRef}
            className="pu-list pu-fit rc-list"
            role="list"
            aria-label={t.panes.current}
          >
            {page.items.map((row) => (
              <div key={row.materialConsumptionId} className="pu-item rc-row" role="listitem">
                <span className="no">{labels.describeItem(row.itemId)}</span>
                <span className="lot pu-mono">{labels.describeLot(row.lotId)}</span>
                {/* IQC 에서 적은 4M 변경품 — 교체를 막지 않고 알린다(omf-all-around#63 2단계). */}
                {row.isFourMChange && <PuChip tone="warn">{t.current.fourMChangeMark}</PuChip>}
                <span className="qty">
                  {row.inputQty.toLocaleString('ko-KR')} {labels.describeUom(row.uomId)}
                </span>
                <span className="at" title={t.current.occurredAt}>
                  {listDateTimeText(row.occurredAt) ?? ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {showList && (
        <ListOrderFoot
          order={order}
          onOrder={(next) => {
            setOrder(next);
            page.setPage(1);
          }}
        >
          <PuPager
            label={t.panes.current}
            total={rows.length}
            page={page.page}
            pages={page.pages}
            onPage={page.setPage}
          />
        </ListOrderFoot>
      )}
    </PuSection>
  );
};

/**
 * 《금형 정보》 — 지금 물린 금형(스펙 §4-B). **읽기 전용이다** — 교체 등록 본문에 담지 않는다.
 *
 * ⚠ 세션에 금형이 없는 것과 못 읽은 것을 다르게 말한다. 앞은 정상이고 뒤는 조치가 있다.
 * ⚠ **적정 타수를 넘어도 막지 않는다**(스펙 §6 — 경고). 주의 줄로만 알린다.
 */
export const MoldInfo = ({
  mold,
  moldFailed,
  hasSession,
}: {
  mold: CurrentMold | null;
  moldFailed: boolean;
  hasSession: boolean;
}) => (
  <PuSection title={t.current.moldSectionLabel} grow={false}>
    {moldFailed && <p className="pu-help">{t.current.moldUnknown}</p>}
    {/* 「없다」와 「알 수 없다」를 가른다 — 세션이 없으면 물린 금형을 물어볼 자리가 없다. */}
    {!moldFailed && mold === null && (
      <p className="pu-help">{hasSession ? t.current.moldNone : t.current.moldNoSession}</p>
    )}
    {!moldFailed && mold !== null && (
      <dl className="rc-fig">
        <div>
          <dt>{t.current.moldNoLabel}</dt>
          <dd className="pu-mono">{mold.moldCode}</dd>
        </div>
        <div>
          <dt>{t.current.moldNameLabel}</dt>
          <dd>{mold.moldName}</dd>
        </div>
        <div>
          <dt>{t.current.shotCountLabel}</dt>
          <dd>{t.current.moldShotCount(mold.currentShotCount)}</dd>
        </div>
        <div>
          <dt>{t.current.shotRemainingLabel}</dt>
          <dd>
            {mold.availableShotCount === null
              ? t.current.moldShotRemainingUnknown
              : t.current.moldShotRemaining(mold.availableShotCount)}
          </dd>
        </div>
      </dl>
    )}
    {!moldFailed && mold !== null && isShotCountExceeded(mold) && (
      <PuNote tone="warn">{t.current.moldShotExceeded}</PuNote>
    )}
  </PuSection>
);
