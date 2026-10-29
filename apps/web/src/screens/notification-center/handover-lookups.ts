import { handoverTypeName, useHandoverAlertTypes } from '../../patterns/handover-alert-types';
import type { EventEntry } from './lookups';

const NO_ENTRIES: EventEntry[] = [];

/**
 * 인계 작업 10종(피처 002) — 유형 이름 풀이와 선택지에 기존 6종 **뒤에** 더한다(FR-022).
 *
 * ⭐ **못 받으면 빈 목록이다.** 기존 6종 조회(`useNotificationEventOptions`)와 따로 둔다 — 이 조회가
 * 실패해도 기존 유형 선택지·실패 안내·이름 풀이는 지금과 같아야 하고, 인계 알림 제목은 원문
 * 코드로 낙하한다(`describeEvent` 와 같은 규율).
 */
export const useHandoverEventEntries = (): EventEntry[] => {
  const types = useHandoverAlertTypes();
  return (
    types.data?.map((type) => ({
      value: type.alertTypeCode,
      label: handoverTypeName(type, type.alertTypeCode),
    })) ?? NO_ENTRIES
  );
};
