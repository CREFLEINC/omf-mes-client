import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { LevelChip } from '../inspection-level/history-table';
import { useItemInspectionLevel } from '../inspection-level/queries';

const t = messages.inspectionStandard.itemLevel;

export interface ItemLevelFactProps {
  itemId: number;
  /** 「검사 수준 변경 이력」 창을 연다 */
  onOpenHistory: () => void;
}

/**
 * IQC 기준 상세의 「검사 수준」 칸(omf-all-around#357) — 품목의 현재 IQC 검사 수준과 「변경 이력」 단추를 한 줄로 둔다.
 * 검사 수준은 버전이 아니라 품목(곧 기준 전체)에 걸린 값이라 이력 단추를 버전 구획이 아닌 이 칸 옆에 둔다(사용자 지시).
 * 단추는 테두리 없는 글자 단추 — 현재 값이 먼저 눈에 들어오게 한다. 지정 · 변경은 「기본 정보 수정」 창에서 한다.
 */
export const ItemLevelFact = ({ itemId, onOpenHistory }: ItemLevelFactProps) => {
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
      <Button variant="text" size="sm" onClick={onOpenHistory}>
        {t.historyButton}
      </Button>
    </dd>
  );
};
