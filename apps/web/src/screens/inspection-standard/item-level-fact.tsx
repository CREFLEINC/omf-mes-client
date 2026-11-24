import { messages } from '@omf-mes/i18n';

import { LevelChip } from '../inspection-level/history-table';
import { useItemInspectionLevel } from '../inspection-level/queries';

const t = messages.inspectionStandard.itemLevel;

export interface ItemLevelFactProps {
  itemId: number;
}

/**
 * IQC 기준 상세의 「검사 수준」 칸(omf-all-around#357) — 품목의 현재 IQC 검사 수준을 보이기만 한다.
 * 지정 · 변경은 「기본 정보 수정」 창, 변경 이력은 아래 카드의 「검사 수준 상세」 탭에서 본다(사용자 지시).
 */
export const ItemLevelFact = ({ itemId }: ItemLevelFactProps) => {
  const level = useItemInspectionLevel(itemId);
  const row = level.data ?? null;

  return (
    <dd className="inspection-standard-item-level">
      {level.isPending ? (
        <span>…</span>
      ) : level.isError ? (
        <span>{t.loadFailed}</span>
      ) : row === null ? (
        <span>{t.unset}</span>
      ) : (
        <LevelChip code={row.inspectionLevelCode} />
      )}
    </dd>
  );
};
