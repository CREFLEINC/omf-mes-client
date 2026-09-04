import { messages } from '@omf-mes/i18n';

import {
  DOCUMENT_TYPE_CODES,
  TARGET_TYPE_CODES,
  type DocumentIssueSummary,
  type PackingContentRow,
  type ReprintTarget,
} from './types';

const t = messages.packingLabelReprint.targets;

/**
 * 포장 내용물에서 재출력 대상 줄을 만든다 — **줄 하나가 라벨 한 장**이다(스펙 §3 와이어).
 *
 * ⭐ **두 유형이 한 목록에 함께 선다.** 「LOT 단위 포장이면 LOT 라벨, 제품 단위 포장이면
 * 인식표」라는 분기를 **화면이 판정하지 않는다** — 포장 유형은 계약이 「값으로 분기하지 않는다」로
 * 닫아 두었고 내용물은 어느 쪽이든 LOT+수량으로만 담긴다(`P-02-08` §5-2). 둘 다 세우고 고르는
 * 것은 작업자다.
 *
 * ⛔ **인식표 줄은 고를 수 없다.** 포장 내용물에 개체 참조가 없어 「이 박스에 든 개체가 어느
 * 것인가」를 데이터로 좁힐 수 없다(스펙 §5-2·§8-3 · `omf-mes#64`). 줄은 세우되 비활성으로 두고
 * LOT + 수량으로 범위만 보인다 — 감추면 재출력할 수 없다는 사실 자체가 안 보인다.
 */
export const buildTargets = (rows: readonly PackingContentRow[]): ReprintTarget[] =>
  rows.flatMap((row) => {
    const label = row.lotNo ?? t.unknownLot;

    return [
      {
        rowId: `lot-${String(row.handlingUnitContentId)}`,
        targetTypeCode: TARGET_TYPE_CODES.lot,
        targetId: row.lotId,
        lotId: row.lotId,
        documentTypeCode: DOCUMENT_TYPE_CODES.packingLabel,
        displayName: label,
        qty: row.qty,
        issueCount: null,
        lastIssuedAt: null,
        disabledReason: null,
      },
      {
        rowId: `tag-${String(row.handlingUnitContentId)}`,
        targetTypeCode: TARGET_TYPE_CODES.serialNumber,
        /* 개체를 특정할 수 없다 — 이 줄은 보내지 않으므로 대상 id 를 지어내지 않는다 */
        targetId: row.lotId,
        lotId: row.lotId,
        documentTypeCode: DOCUMENT_TYPE_CODES.identificationTag,
        displayName: label,
        qty: row.qty,
        issueCount: null,
        lastIssuedAt: null,
        disabledReason: t.serialUnavailable,
      },
    ];
  });

/**
 * 발행 요약을 대상 줄에 얹는다.
 *
 * ⚠ **요약이 아직 없으면 `null` 로 둔다** — 「모른다」와 「0회」는 다르다. 0회는 최초 발행이라
 * 사유를 받지 않고, 모르는 것을 0으로 읽으면 재발행에 사유 없이 보내 서버가 422 로 되돌린다.
 */
export const applySummary = (
  targets: readonly ReprintTarget[],
  summaries: readonly DocumentIssueSummary[] | undefined,
): ReprintTarget[] => {
  if (summaries === undefined) return [...targets];

  const found = new Map(
    summaries.map((summary) => [`${summary.targetTypeCode}:${String(summary.targetId)}`, summary]),
  );

  return targets.map((target) => {
    const summary = found.get(`${target.targetTypeCode}:${String(target.targetId)}`);

    if (summary === undefined) return target;

    return {
      ...target,
      issueCount: summary.issueCount,
      lastIssuedAt: summary.lastIssuedAt ?? null,
    };
  });
};

/**
 * 고른 대상 중 **하나라도 이미 발행된 것이 있으면 사유가 필수**다(계약 · 스펙 §6).
 *
 * ⚠ **회차를 모르는 대상이 섞여 있으면 「필요 없다」로 판정하지 않는다.** 모르는 채 사유 없이
 * 보내면 서버가 422 로 되돌린다 — 필요할 수 있다고 보고 사유를 받는 편이 안전하다.
 */
export const needsReason = (selected: readonly ReprintTarget[]): boolean =>
  selected.some((target) => target.issueCount === null || target.issueCount > 0);
