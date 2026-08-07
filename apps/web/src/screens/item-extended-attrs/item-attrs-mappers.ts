import type { components } from '@omf-mes/api-client';

import type { Item, ItemAttrsFormValues } from './types';

type ItemUpdate = components['schemas']['ItemUpdate'];

/**
 * 계약 표현과 폼 표현 사이의 변환. **이 화면에서 가장 조심할 파일이다.**
 *
 * 계약의 `Item`은 원본 4열과 확장 속성을 한 객체에 담고 있고, `ItemUpdate`는 확장 속성만 받는다.
 * 그런데 **서버가 그 경계를 막지 않는다** — 원본 열을 섞어 보내도 200이 돌아온다(계약 실측).
 * 그래서 경계를 지키는 곳이 여기뿐이다.
 */

/** 계약 표현을 폼 표현으로. 널·없음을 빈 문자열로 모은다 — 「지정하지 않음」이 하나의 값이어야 한다. */
export const itemToAttrsFormValues = (item: Item): ItemAttrsFormValues => ({
  lotControlTypeCode: item.lotControlTypeCode,
  serialControlTypeCode: item.serialControlTypeCode,
  /*
   * 계약에 「유효기한 관리」 컬럼이 없다 — `shelfLifeDays`의 널 여부가 그 토글이다(§8-2).
   * **0은 「비었다」가 아니다**(계약 `minimum: 0`) — 0이 들어오면 토글은 켜진 상태다.
   */
  shelfLifeManaged: item.shelfLifeDays !== null && item.shelfLifeDays !== undefined,
  shelfLifeDays:
    item.shelfLifeDays === null || item.shelfLifeDays === undefined
      ? ''
      : String(item.shelfLifeDays),
  inspectionRequired: item.inspectionRequired,
  fifoPolicyCode: item.fifoPolicyCode,
  negativeStockAllowed: item.negativeStockAllowed,
  storageConditionCode: item.storageConditionCode ?? '',
  openedShelfLifeHours:
    item.openedShelfLifeHours === null || item.openedShelfLifeHours === undefined
      ? ''
      : String(item.openedShelfLifeHours),
});

/**
 * 확장 속성 수정 요청 본문.
 *
 * **키를 하나씩 열거해 만든다. 폼 값을 스프레드하지 않는다** — 스프레드를 쓰면 폼에 무엇이
 * 더해지든 그대로 서버로 나가고, 원본 열이 섞여도 서버가 막지 않는다.
 *
 * **`isActive`는 조회한 품목의 값을 그대로 되돌려 싣는다**(결정 3). 계약이 이 값을 요청에
 * 필수로 요구하는데 「사용 중지 액션이 화면에 없다」고 같은 계약이 못 박았다 —
 * 빼면 400이고, `true`로 굳히면 **미사용 품목을 저장하는 순간 조용히 되살아난다.**
 * 그래서 폼이 아니라 **조회 결과**를 출처로 받는다.
 *
 * **비운 선택 항목은 키를 빼지 않고 널을 명시한다.** 키를 빼면 서버가 이전 값을 남길 수 있어
 * 한 번 넣은 값을 지울 방법이 사라진다.
 */
export const toItemUpdate = (values: ItemAttrsFormValues, source: Item): ItemUpdate => {
  const storageConditionCode = values.storageConditionCode.trim();
  const openedShelfLifeHours = values.openedShelfLifeHours.trim();

  return {
    // 앞뒤 공백이 붙은 코드는 눈으로 구분되지 않는 다른 값이 된다.
    lotControlTypeCode: values.lotControlTypeCode.trim(),
    serialControlTypeCode: values.serialControlTypeCode.trim(),
    // 토글 OFF는 「값을 비운다」가 아니라 「유효기한을 관리하지 않는다」다 — 널을 명시해 보낸다.
    shelfLifeDays: values.shelfLifeManaged ? Number(values.shelfLifeDays.trim()) : null,
    inspectionRequired: values.inspectionRequired,
    fifoPolicyCode: values.fifoPolicyCode.trim(),
    negativeStockAllowed: values.negativeStockAllowed,
    storageConditionCode: storageConditionCode === '' ? null : storageConditionCode,
    openedShelfLifeHours: openedShelfLifeHours === '' ? null : Number(openedShelfLifeHours),
    isActive: source.isActive,
  };
};

/** 기준값과 현재 값의 비교. 「고친 것이 있는가」의 판정 근거다. */
export const isSameItemAttrsValues = (a: ItemAttrsFormValues, b: ItemAttrsFormValues): boolean =>
  a.lotControlTypeCode === b.lotControlTypeCode &&
  a.serialControlTypeCode === b.serialControlTypeCode &&
  a.shelfLifeManaged === b.shelfLifeManaged &&
  a.shelfLifeDays === b.shelfLifeDays &&
  a.inspectionRequired === b.inspectionRequired &&
  a.fifoPolicyCode === b.fifoPolicyCode &&
  a.negativeStockAllowed === b.negativeStockAllowed &&
  a.storageConditionCode === b.storageConditionCode &&
  a.openedShelfLifeHours === b.openedShelfLifeHours;
