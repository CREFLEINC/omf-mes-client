import type {
  ItemResourceMap,
  ItemResourceMapCreate,
  ItemResourceMapUpdate,
} from '@omf-mes/api-client';

/**
 * 설비·금형 매핑 편집 창의 값과 요청 본문 사이의 유일한 통로.
 *
 * **다른 부속 자원과 달리 전체 치환이 아니다** — 줄마다 `POST`·`PUT`으로 바로 저장한다.
 * 그래서 초안 목록이 없고 창 하나의 값만 있다.
 *
 * 공장은 창의 값이 아니다. 표 위에서 고른 공장으로 등록하고, 계약이 수정 본문에서 공장을 받지
 * 않는다(바꾸려면 새로 등록한다).
 */

/** 선택값은 디자인 시스템 입력이 다루는 문자열로 들고, 계약의 숫자·널은 아래 변환에서 넘는다. */
export interface ItemResourceMapFormValues {
  /** 비우면 품목 공통이다 — 계약이 널을 허용한다 */
  processId: string;
  equipmentId: string;
  moldId: string;
  isDefault: boolean;
  /** 입력 도중의 빈 값을 표현하려고 문자열로 든다 */
  priorityNo: string;
  remarks: string;
}

/** 서버 기본값과 같게 둔다 — 다르면 창에서 비워 둔 것과 서버가 채운 값이 어긋난다. */
export const DEFAULT_PRIORITY_NO = '100';

/** 서버 오류 중 창의 입력칸 옆에 낼 수 있는 것. 나머지는 배너로 올린다. */
export const ITEM_RESOURCE_MAP_FORM_FIELDS = [
  'processId',
  'equipmentId',
  'moldId',
  'priorityNo',
  'remarks',
] as const;

const idText = (value: number | null): string => (value === null ? '' : String(value));

export const createItemResourceMapFormValues = (): ItemResourceMapFormValues => ({
  processId: '',
  equipmentId: '',
  moldId: '',
  isDefault: false,
  priorityNo: DEFAULT_PRIORITY_NO,
  remarks: '',
});

export const toItemResourceMapFormValues = (row: ItemResourceMap): ItemResourceMapFormValues => ({
  processId: idText(row.processId),
  equipmentId: idText(row.equipmentId),
  moldId: idText(row.moldId),
  isDefault: row.isDefault,
  priorityNo: String(row.priorityNo),
  remarks: row.remarks ?? '',
});

const textToId = (value: string): number | null => (value === '' ? null : Number(value));

const textToOptionalText = (value: string): string | null =>
  value.trim() === '' ? null : value.trim();

/**
 * 등록 본문. **키를 하나씩 열거해 만든다** — 조회 응답을 스프레드하면 이름 칸과 식별자가
 * 함께 실린다.
 */
export const toItemResourceMapCreate = (
  values: ItemResourceMapFormValues,
  plantId: number,
  itemId: number,
): ItemResourceMapCreate => ({
  plantId,
  itemId,
  processId: textToId(values.processId),
  equipmentId: textToId(values.equipmentId),
  moldId: textToId(values.moldId),
  isDefault: values.isDefault,
  priorityNo: Number(values.priorityNo),
  remarks: textToOptionalText(values.remarks),
});

/**
 * 수정 본문. 계약이 「생략 = 유지, 널 = 비움」이라 **창이 다루는 칸은 모두 싣는다** —
 * 비운 칸을 생략하면 서버가 옛 값을 유지해 사용자가 지운 공정·설비·금형이 되살아난다.
 *
 * 사용 여부는 싣지 않는다. 창에 그 칸이 없고, 표의 「사용 중지」·「다시 사용」이 따로 바꾼다.
 */
export const toItemResourceMapUpdate = (
  values: ItemResourceMapFormValues,
): ItemResourceMapUpdate => ({
  processId: textToId(values.processId),
  equipmentId: textToId(values.equipmentId),
  moldId: textToId(values.moldId),
  isDefault: values.isDefault,
  priorityNo: Number(values.priorityNo),
  remarks: textToOptionalText(values.remarks),
});

/**
 * 유일 제약의 판정 키. 계약 `uq_item_resource_map`이 공장·품목·공정·설비·금형을 **빈 값끼리도
 * 같은 값으로** 센다(`NULLS NOT DISTINCT`). 공장·품목은 목록 조회 조건으로 고정돼 있다.
 */
export const resourceMapKeyOf = (values: {
  processId: string;
  equipmentId: string;
  moldId: string;
}): string => `${values.processId}#${values.equipmentId}#${values.moldId}`;

export const rowResourceMapKey = (row: ItemResourceMap): string =>
  resourceMapKeyOf({
    processId: idText(row.processId),
    equipmentId: idText(row.equipmentId),
    moldId: idText(row.moldId),
  });

export const isSameItemResourceMapValues = (
  a: ItemResourceMapFormValues,
  b: ItemResourceMapFormValues,
): boolean =>
  a.processId === b.processId &&
  a.equipmentId === b.equipmentId &&
  a.moldId === b.moldId &&
  a.isDefault === b.isDefault &&
  a.priorityNo === b.priorityNo &&
  a.remarks === b.remarks;
