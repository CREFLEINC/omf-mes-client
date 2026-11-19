import { Chip } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { formatQty } from '../../patterns/package-qty';
import { formatPlantDateTime } from '../../patterns/plant-time';
import {
  lotJudgmentStatus,
  overviewStatus,
  type LotOverview,
  type PickedLotJudgment,
} from './shipment-oqc';

type ShipmentRequestLot = components['schemas']['ShipmentRequestLot'];

/**
 * 출하 OQC 새 흐름(피처 010)의 작은 표시 부품 — W-04-03 · P-04-06 이 같은 말 · 같은 색으로 그린다.
 */

const s = messages.oqcInspection.shipment;

export const overviewText = (overview: LotOverview): string => {
  switch (overview.kind) {
    case 'skipped':
      return s.overview.skipped;
    case 'none':
      return s.overview.none;
    case 'rejected':
      return s.overview.rejected(overview.count);
    case 'held':
      return s.overview.held(overview.count);
    case 'notInspected':
      return s.overview.notInspected(overview.count);
    case 'allAccepted':
      return s.overview.allAccepted;
  }
};

export const OverviewChip = ({
  overview,
  size = 'sm',
}: {
  overview: LotOverview;
  size?: 'sm' | 'md';
}) => (
  <Chip variant="status" size={size} status={overviewStatus(overview)}>
    {overviewText(overview)}
  </Chip>
);

export const LotJudgmentChip = ({
  code,
  size = 'sm',
}: {
  code: PickedLotJudgment;
  size?: 'sm' | 'md';
}) => (
  <Chip variant="status" size={size} status={lotJudgmentStatus(code)}>
    {s.judgments[code]}
  </Chip>
);

/** 창고 · 위치별 몫 — 「창고A A-01-01 40 · 창고B B-02-01 20」. 지시서를 못 읽었으면 빈 글. */
export const portionsText = (
  lot: ShipmentRequestLot | null,
  /** 적치 대기 자리를 시스템 코드 대신 이 이름으로 적는다(P-04-06). 없으면 위치 코드 그대로. */
  stagingLabel?: string,
): string =>
  (lot?.portions ?? [])
    .map((portion) =>
      s.lots.portion(
        portion.warehouseName,
        stagingLabel !== undefined && portion.locationSystemRoleCode === 'PUTAWAY_STAGING'
          ? stagingLabel
          : portion.locationCode,
        formatQty(portion.qty),
      ),
    )
    .join(' · '); // ui-check-ignore: C-13 시안 W0403 · P0406 「창고 · 위치」 칸 표기

/** 교체된 LOT 의 근거 한 줄 — 「불합격 · PDA 교체 11-18 11:02 작업자 · 부적합 NC-…」. */
export const replacedText = (lot: ShipmentRequestLot | null): string => {
  const replacement = lot?.replacement ?? null;
  if (replacement === null) return s.lots.replacedFallback;
  const names: Readonly<Record<string, string>> = s.judgments;
  const judgment =
    replacement.judgment === null
      ? s.judgments.REJECTED
      : (names[replacement.judgment] ?? replacement.judgment);

  return s.lots.replacedLine(
    judgment,
    formatPlantDateTime(replacement.replacedAt) ?? replacement.replacedAt,
    replacement.worker?.workerName ?? '',
    replacement.nonconformanceNo,
  );
};
