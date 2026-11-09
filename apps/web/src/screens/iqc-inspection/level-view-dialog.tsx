import { Button, Dialog } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { formatPlantDateTime } from '../../patterns/plant-time';

type ItemInspectionLevel = components['schemas']['ItemInspectionLevel'];

const t = messages.iqcInspection.detail.level;
const levelNames = messages.inspectionLevel.levels;

export interface LevelViewDialogProps {
  item: { itemCode: string; itemName: string };
  /** 품목의 현재 검사 수준. 없으면 `null` — 「미지정」 */
  row: ItemInspectionLevel | null;
  /** 검사 수준 관리 화면으로 옮긴다. 권한이 없으면 `null` — [수정]을 두지 않는다 */
  onEdit: (() => void) | null;
  onClose: () => void;
}

/**
 * 「수준 조회」 창(omf-all-around#247 · 사용자 지시 2026-11-09) — 품목의 현재 검사 수준을 보인다. 고치려면 [수정]으로
 * 검사 수준 관리 화면에 간다 — [기준 조회] 창과 같은 모양이다.
 */
export const LevelViewDialog = ({ item, row, onEdit, onClose }: LevelViewDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="sm"
    title={t.viewTitle}
    showCloseButton={false}
    footer={
      <>
        <Button
          type="button"
          variant="outlined"
          size="md"
          className="app-button-neutral"
          onClick={onClose}
        >
          {t.close}
        </Button>
        {onEdit !== null && (
          <Button type="button" size="md" onClick={onEdit}>
            {t.edit}
          </Button>
        )}
      </>
    }
  >
    <div className="iqc-inspection-plan-view">
      <div>
        <p className="inspection-level-history-item-name">{item.itemName}</p>
        <p className="field-note">{t.viewItemCode(item.itemCode)}</p>
      </div>
      <dl className="iqc-inspection-plan-view-summary">
        <div>
          <dt>{t.viewLevel}</dt>
          <dd>
            {row === null
              ? t.unset
              : (levelNames[row.inspectionLevelCode] ?? row.inspectionLevelCode)}
          </dd>
        </div>
        {row !== null && (
          <div>
            <dt>{t.viewUpdatedAt}</dt>
            <dd>{formatPlantDateTime(row.updatedAt) ?? ''}</dd>
          </div>
        )}
      </dl>
    </div>
  </Dialog>
);
