import { Button, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
import { ItemHistoryDialog, LevelChip } from '../inspection-level/history-dialog';
import { LevelDialog } from '../inspection-level/level-dialog';
import { useLevelWrite } from '../inspection-level/level-write';
import { useItemInspectionLevel } from '../inspection-level/queries';

const t = messages.inspectionStandard.itemLevel;

/** 검사 수준 지정 · 변경 권한(W-03-12) — 서버가 이 화면 권한으로 지정 · 변경을 받는다. 화면 자체는 없앴다(omf-all-around#357). */
const INSPECTION_LEVEL_PATH = '/quality/inspection-levels';

export interface ItemLevelFactProps {
  item: { itemId: number; itemCode: string; itemName: string };
}

/**
 * IQC 기준 상세의 「검사 수준」 칸(omf-all-around#357) — 품목의 현재 IQC 검사 수준과 「지정」/「변경」 · 「이력」.
 * 검사 수준 설정 화면을 검사 기준 화면으로 합쳤다. 지정 · 변경 · 이력은 그 화면의 창을 그대로 쓴다.
 */
export const ItemLevelFact = ({ item }: ItemLevelFactProps) => {
  const toast = useToast();
  const { session } = useSession();
  const canEdit = toWebAccess(session?.permissions).allows(INSPECTION_LEVEL_PATH);
  const level = useItemInspectionLevel(item.itemId);
  const row = level.data ?? null;
  const [isEditing, setIsEditing] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const write = useLevelWrite(() => {
    setIsEditing(false);
    toast.show({ variant: 'success', description: messages.common.saved });
  });

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
      {/* 목록을 다시 받는 동안에는 `versionNo` 가 곧 낡는다 — 창을 열지 않는다. */}
      {canEdit && level.isSuccess && (
        <Button
          size="sm"
          variant="outlined"
          disabled={level.isFetching}
          onClick={() => {
            write.reset();
            setIsEditing(true);
          }}
        >
          {row === null ? t.set : t.change}
        </Button>
      )}
      {row !== null && (
        <Button size="sm" variant="outlined" onClick={() => setIsHistoryOpen(true)}>
          {t.history}
        </Button>
      )}

      {isEditing && (
        <LevelDialog
          row={row}
          presetItem={item}
          fieldErrors={write.fieldErrors}
          banner={
            <SaveErrorBanner
              error={write.error}
              onReload={() => {
                write.reset();
                setIsEditing(false);
                void level.refetch();
              }}
            />
          }
          isSaving={write.isSaving}
          onClose={() => setIsEditing(false)}
          onSave={(values) => write.write({ row, values })}
        />
      )}
      {isHistoryOpen && <ItemHistoryDialog item={item} onClose={() => setIsHistoryOpen(false)} />}
    </dd>
  );
};
