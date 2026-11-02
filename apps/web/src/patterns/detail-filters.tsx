import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.common.inspectionHub.detailFilters;

/**
 * 「상세 조건 펼치기」 단추 — 검사 조회·판정(IQC · PQC · OQC) 탭의 조회 조건을 접고 편다(사용자 지시 2026-11-02 · omf-all-around#225).
 * 접혀 있는데 그 안의 조건이 걸려 있으면 단추 옆에 한 줄로 알린다 — 모르는 사이 목록이 좁혀져 있지 않게.
 */
export const DetailFiltersToggle = ({
  open,
  onToggle,
  controlsId,
  hasCondition,
}: {
  open: boolean;
  onToggle: () => void;
  /** 접고 펴는 상자의 id. */
  controlsId: string;
  /** 접힌 칸에 조건이 걸려 있는가. */
  hasCondition: boolean;
}) => (
  <div className="inspection-detail-toggle">
    {!open && hasCondition && <span className="field-note">{t.hiddenApplied}</span>}
    <Button
      variant="text"
      size="sm"
      aria-expanded={open}
      aria-controls={controlsId}
      onClick={onToggle}
    >
      {open ? t.close : t.open}
    </Button>
  </div>
);
