import { Button, useToast } from '@crefle/web-ui';
import type { ItemInspectionLevel } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
import { LevelDialog } from '../inspection-level/level-dialog';
import { useLevelWrite } from '../inspection-level/level-write';
import { inspectionLevelKeys, type Paged } from '../inspection-level/queries';

const t = messages.iqcInspection.detail.level;
const levelNames = messages.inspectionLevel.levels;

/** 검사 수준 관리 화면 주소 — 이 권한(`W-03-12`)이 있어야 서버가 지정·변경을 받는다. */
const INSPECTION_LEVEL_PATH = '/quality/inspection-levels';

export interface ItemLevelProps {
  itemId: number;
  /** 풀린 품목 코드·이름. 못 풀었으면 `null` — 변경 창을 열지 않는다 */
  item: { itemCode: string; itemName: string } | null;
}

/**
 * IQC 상세 「검사 수준」 칸(omf-all-around#133) — 품목의 현재 검사 수준을 보이고, 권한이 있으면 그 자리에서
 * 지정·변경한다. 창과 저장은 검사 수준 관리 화면과 같다. 자동 전환은 없다 — 사용자가 정한 수준만 쓴다.
 */
export const ItemLevel = ({ itemId, item }: ItemLevelProps) => {
  const { client } = useApiClient();
  const { session } = useSession();
  const toast = useToast();
  const canEdit = toWebAccess(session?.permissions).allows(INSPECTION_LEVEL_PATH);
  const [editing, setEditing] = useState(false);

  const level = useQuery({
    queryKey: [...inspectionLevelKeys.all, 'item', itemId] as const,
    queryFn: (): Promise<ItemInspectionLevel | null> =>
      runRequest(() =>
        client.GET('/quality/item-inspection-levels', {
          params: { query: { itemId, page: 1, size: 1 } },
        }),
      ).then((page: Paged<ItemInspectionLevel>) => page.items[0] ?? null),
  });
  const write = useLevelWrite(() => {
    setEditing(false);
    toast.show({ variant: 'success', description: messages.common.saved });
  });

  const row = level.data ?? null;
  const label = level.isPending
    ? '…'
    : level.isError
      ? t.loadFailed
      : row === null
        ? t.unset
        : (levelNames[row.inspectionLevelCode] ?? row.inspectionLevelCode);

  return (
    <span className="iqc-inspection-level">
      <span>{label}</span>
      {canEdit && item !== null && level.isSuccess && (
        <Button
          size="md"
          variant="outlined"
          onClick={() => {
            write.reset();
            setEditing(true);
          }}
        >
          {row === null ? t.set : t.change}
        </Button>
      )}
      {editing && item !== null && (
        <LevelDialog
          row={row}
          presetItem={{ itemId, ...item }}
          fieldErrors={write.fieldErrors}
          banner={
            <SaveErrorBanner
              error={write.error}
              onReload={() => {
                write.reset();
                setEditing(false);
                void level.refetch();
              }}
            />
          }
          isSaving={write.isSaving}
          onClose={() => setEditing(false)}
          onSave={(values) => write.write({ row, values })}
        />
      )}
    </span>
  );
};
