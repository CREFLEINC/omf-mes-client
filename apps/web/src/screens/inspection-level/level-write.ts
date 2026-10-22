import type { ItemInspectionLevel } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite } from '../../patterns/master';
import type { LevelDialogValues } from './level-dialog';
import { inspectionLevelKeys } from './queries';

const t = messages.inspectionLevel;

export interface LevelWriteVariables {
  row: ItemInspectionLevel | null;
  values: LevelDialogValues;
}

/**
 * 검사 수준 지정(POST)·수동 변경(PUT) — 검사 수준 관리 화면과 IQC 상세(omf-all-around#133)가 같은 창으로 쓴다.
 * 자동 전환은 없다 — `autoSwitchEnabled` 를 싣지 않는다(서버 기본 false).
 */
export const useLevelWrite = (onSuccess: () => void) => {
  const { client } = useApiClient();

  return useMasterWrite<LevelWriteVariables, ItemInspectionLevel>({
    request: ({ row, values }, headers) =>
      row === null
        ? client.POST('/quality/item-inspection-levels', {
            params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
            body: {
              itemId: values.itemId,
              inspectionLevelCode: values.level,
              reason: values.reason === '' ? undefined : values.reason,
            },
          })
        : client.PUT('/quality/item-inspection-levels/{itemInspectionLevelId}', {
            params: {
              path: { itemInspectionLevelId: row.itemInspectionLevelId },
              /* 목록이 줄마다 `versionNo`를 준다 — 창을 연 시점의 판으로 잠근다. */
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                'If-Match': String(row.versionNo),
              },
            },
            body: {
              inspectionLevelCode: values.level,
              reason: values.reason === '' ? undefined : values.reason,
            },
          }),
    etagPath: null,
    invalidateKeys: [inspectionLevelKeys.all],
    knownFields: ['itemId', 'inspectionLevelCode', 'reason'],
    restateFieldError: (item) =>
      item.code === 'UNIQUE_VIOLATION' ? t.dialog.duplicate : undefined,
    onSuccess,
  });
};
