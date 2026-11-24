import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite } from '../../patterns/master';
import type { LevelDialogValues } from './level-dialog';
import { inspectionLevelKeys } from './queries';

type ItemInspectionLevel = components['schemas']['ItemInspectionLevel'];

const t = messages.inspectionLevel;

/**
 * 검사 수준 지정(POST) — IQC 판정 확정 때, 검사 중 골라 둔 수준을 저장한다(omf-all-around#133 · #247).
 * 변경은 검사 기준 관리의 「기본 정보 수정」이 맡는다(#357). 자동 전환은 없다 — `autoSwitchEnabled` 를 싣지 않는다(서버 기본 false).
 */
export const useLevelWrite = (onSuccess: () => void) => {
  const { client } = useApiClient();

  return useMasterWrite<LevelDialogValues, ItemInspectionLevel>({
    request: (values, headers) =>
      client.POST('/quality/item-inspection-levels', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: {
          itemId: values.itemId,
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
