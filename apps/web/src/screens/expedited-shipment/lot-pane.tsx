import { AlertBanner, Chip, Select, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import type { ExpeditedLookup } from './lookups';
import type { LotReleaseState } from './lot-release';
import { formatQty } from './quantity';
import type { ProductionLotCandidate } from './types';

const t = messages.expeditedShipment;

export interface LotPaneProps {
  lots: readonly ProductionLotCandidate[];
  truncated: boolean;
  isLoading: boolean;
  isError: boolean;
  selected: ProductionLotCandidate | null;
  release: LotReleaseState | null;
  items: ExpeditedLookup;
  uoms: ExpeditedLookup;
  onSelect: (lotId: number | null) => void;
}

/**
 * ⛔ **차단 사유를 «상태 배지»로만 보이지 않는다.** 「검사 대기」라는 낱말만으로는 무엇을 해야
 * 하는지 알 수 없어 사용자가 확정 버튼을 계속 누른다 — 배지 옆에 **어떻게 풀 것인가**를 함께
 * 둔다(공유계약 G-1·G-3).
 */
const ReleaseNotice = ({ release }: { release: LotReleaseState }) => {
  if (release.kind === 'held') {
    return (
      <AlertBanner variant="error" title={t.release.heldTitle}>
        {t.release.held}
      </AlertBanner>
    );
  }
  if (release.kind === 'inspection-pending') {
    return (
      <AlertBanner variant="error" title={t.release.inspectionPendingTitle}>
        {t.release.inspectionPending}
      </AlertBanner>
    );
  }

  /*
   * ⭐ 막지 않는 두 갈래에도 **최종 판정이 서버에 있다는 사실**을 남긴다. 화면이 아는 코드가
   * 두 개뿐이라 「통과」를 선언할 수 없다(§5-3 · 공유계약 G-2).
   */
  return <AlertBanner variant="info">{t.release.serverDecides}</AlertBanner>;
};

/** ① 대상 제품 LOT — 생산 완료분 중 **아직 창고에 들어오지 않은** 것만 온다. */
export const LotPane = ({
  lots,
  truncated,
  isLoading,
  isError,
  selected,
  release,
  items,
  uoms,
  onSelect,
}: LotPaneProps) => {
  const selectId = useId();
  const noteId = `${selectId}-note`;

  const options = lots.map((lot) => ({
    value: String(lot.lotId),
    label: `${lot.lotNo} · ${lookupDisplayLabel(items, lot.itemId)} · ${formatQty(lot.initialQty)}`,
  }));

  return (
    <section className="pane" aria-label={t.panes.lot}>
      <h2>{t.panes.lot}</h2>

      {isError ? (
        <AlertBanner variant="error">{t.lot.loadFailed}</AlertBanner>
      ) : isLoading ? (
        <div role="status" aria-label={t.lot.loading}>
          <SkeletonText lines={2} />
        </div>
      ) : (
        <>
          <div className="field-cell wide-select">
            <label className="field-label" htmlFor={selectId}>
              {t.lot.label}
            </label>
            <Select
              id={selectId}
              options={options}
              value={selected === null ? null : String(selected.lotId)}
              placeholder={options.length === 0 ? t.lot.empty : t.lot.placeholder}
              aria-describedby={noteId}
              onChange={(value) => onSelect(value === '' ? null : Number(value))}
            />
            {/* §5-4 — 이 LOT이 왜 여기 있는지. 정상 출하 흐름과 갈리는 지점이다. */}
            <span id={noteId} className="field-note">
              {t.lot.unreceivedNotice}
            </span>
          </div>

          {/* ⚠ 목록이 잘렸다는 사실을 감춘다면 「없다」와 「이 쪽에 없다」가 뭉개진다(L-11). */}
          {truncated && <AlertBanner variant="warning">{t.lot.truncated}</AlertBanner>}
        </>
      )}

      {selected !== null && (
        <>
          {/* 읽기 전용 요약은 필터 바와 같은 셀 구조를 쓴다(`W-03-10` 상세와 같은 형태). */}
          <dl className="filter-bar">
            <div className="field-cell">
              <dt className="field-label">{t.lot.fields.lotNo}</dt>
              <dd>{selected.lotNo}</dd>
            </div>
            <div className="field-cell">
              <dt className="field-label">{t.lot.fields.item}</dt>
              <dd>{lookupDisplayLabel(items, selected.itemId)}</dd>
            </div>
            <div className="field-cell">
              <dt className="field-label">{t.lot.fields.qty}</dt>
              <dd>
                {formatQty(selected.initialQty)} {lookupDisplayLabel(uoms, selected.uomId)}
              </dd>
            </div>
            <div className="field-cell">
              <dt className="field-label">{t.lot.fields.status}</dt>
              <dd>
                <Chip>{selected.held === undefined ? t.release.unknown : selected.statusCode}</Chip>
              </dd>
            </div>
          </dl>
          {release !== null && (
            <div className="banner-slot">
              <ReleaseNotice release={release} />
            </div>
          )}
        </>
      )}
    </section>
  );
};
