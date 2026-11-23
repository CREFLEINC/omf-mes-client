import type { ErrorItem } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { ItemAttrsFormValues } from './types';

const t = messages.itemExtendedAttrs.attrs.validation;

/** 계약이 정한 상한. 상한 자체는 허용값이며 그것을 **넘을 때만** 막는다. */
const CODE_MAX = 50;

/** 부호 없는 정수. 계약이 두 수량 필드를 `integer`로 두었다. */
const NON_NEGATIVE_INTEGER = /^\d+$/;

/**
 * 확장 속성 폼이 소유한 입력칸 이름. 서버가 준 필드 오류를 인라인으로 낼지
 * 배너로 올릴지 가르는 기준이며, 목록에 없는 필드명은 삼키지 않고 배너로 간다.
 *
 * **`isActive`가 없다.** 대응하는 입력칸이 화면에 없으므로 그 필드의 오류는 배너로 올린다 —
 * 보이지 않는 칸에 붙인 오류는 어디에도 표시되지 않는다. 화면에서 뺀 칸(다국어 명칭 · 시리얼 관리 유형 · 개발품 ·
 * 개봉 후 유효시간 · 보관 조건 · LOT 관리 — 사용자 지시 2026-10-28)도 같다. 그 값은 조회한 값 그대로 되돌려 실리고 화면이 검사하지 않는다.
 */
export const ITEM_ATTRS_FORM_FIELDS: readonly string[] = [
  'defaultLotStorageUomId',
  'defaultProductionLotSize',
  /* 피처 014 FR-018 — 서버 400 PAIR · INVALID 를 두 칸 아래에 낸다. */
  'defaultPackageUomId',
  'defaultPackageCount',
  'shelfLifeDays',
  'inspectionRequired',
  'fifoPolicyCode',
  'negativeStockAllowed',
];

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 *
 * **코드값이 어떤 목록에 속하는지 검사하지 않는다** — 값 목록이 확정되지 않았고,
 * 화면이 없는 목록을 흉내 내면 서버가 허용하는 값을 막는다(공유계약 G-8).
 *
 * **`shelfLifeDays`와 `openedShelfLifeHours`의 하한 규칙이 서로 다르다.**
 * 계약이 앞은 `minimum: 0`(0 허용), 뒤는 `exclusiveMinimum: 0`(0 불가)으로 두었다 —
 * 하나로 뭉치면 둘 중 하나가 반드시 어긋난다.
 *
 * **유효기한 관리와 선출 정책을 연동하지 않는다**(이슈 #14 §4). 어긋난 조합에 경고도 내지 않는다 —
 * 경고는 자동 연동의 절반이며, 이슈가 「두 항목을 따로 받는다」로 정했다.
 */
/**
 * 서버 400 의 패키징 기본값 오류를 화면 문구로(피처 014 FR-018) — `PAIR` 는 「함께 넣거나 함께 비워」,
 * LOT 당 패키징 수량의 `INVALID` 는 「패키징 수량이 부적합 합니다…」. 그 밖은 서버 문구 그대로.
 */
export const restatePackageError = (item: ErrorItem): string | undefined => {
  if (item.field !== 'defaultPackageUomId' && item.field !== 'defaultPackageCount')
    return undefined;
  if (item.code === 'PAIR') return t.packagePair;
  if (item.field === 'defaultPackageCount' && item.code === 'INVALID') return t.packageNotDivisible;
  return undefined;
};

/** `size` 가 `count` 로 나머지 없이 나눠지는가 — 소수 기본크기의 부동소수 찌꺼기를 걷고 본다. */
const isMultipleOf = (size: number, count: number): boolean => {
  const quotient = size / count;

  return Math.abs(quotient - Math.round(quotient)) < 1e-9;
};

export const validateItemAttrsForm = (values: ItemAttrsFormValues): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (values.fifoPolicyCode.trim() === '') {
    errors.fifoPolicyCode = t.required;
  } else if (values.fifoPolicyCode.trim().length > CODE_MAX) {
    errors.fifoPolicyCode = t.codeTooLong;
  }

  const defaultLotStorageUomId = values.defaultLotStorageUomId.trim();

  if (
    defaultLotStorageUomId !== '' &&
    (!NON_NEGATIVE_INTEGER.test(defaultLotStorageUomId) || Number(defaultLotStorageUomId) <= 0)
  ) {
    errors.defaultLotStorageUomId = t.defaultLotStorageUomInvalid;
  }

  const defaultProductionLotSize = values.defaultProductionLotSize.trim();

  if (defaultProductionLotSize !== '' && !Number.isFinite(Number(defaultProductionLotSize))) {
    errors.defaultProductionLotSize = t.defaultProductionLotSizeInvalid;
  }

  /*
   * 패키징 기본값(피처 014 FR-018) — 함께 넣거나 함께 비우고, LOT 당 패키징 수량은 1 이상 정수이며 자재 LOT
   * 기본크기를 나머지 없이 나눠야 한다(서버와 같은 규칙: 기본크기 mod 수량 = 0). 기본크기가 비면 나눔은 보지 않는다.
   */
  const packageUomId = values.defaultPackageUomId.trim();
  const packageCount = values.defaultPackageCount.trim();

  if ((packageUomId === '') !== (packageCount === '')) {
    if (packageUomId === '') errors.defaultPackageUomId = t.packagePair;
    else errors.defaultPackageCount = t.packagePair;
  } else if (packageCount !== '') {
    const count = Number(packageCount);
    const size = Number(defaultProductionLotSize);

    if (!NON_NEGATIVE_INTEGER.test(packageCount) || count < 1) {
      errors.defaultPackageCount = t.packageCountInvalid;
    } else if (
      defaultProductionLotSize !== '' &&
      Number.isFinite(size) &&
      !isMultipleOf(size, count)
    ) {
      errors.defaultPackageCount = t.packageNotDivisible;
    }
  }

  /*
   * 조건부 필수(A-2). 토글이 꺼져 있으면 값 칸이 무엇이든 상관없다 —
   * 저장할 때 널이 실린다.
   */
  if (values.shelfLifeManaged) {
    const shelfLifeDays = values.shelfLifeDays.trim();

    if (shelfLifeDays === '') {
      errors.shelfLifeDays = t.shelfLifeDaysRequired;
    } else if (!NON_NEGATIVE_INTEGER.test(shelfLifeDays)) {
      // 0은 허용값이다 — 계약 `minimum: 0`. 「비었다」로 다루지 않는다.
      errors.shelfLifeDays = t.shelfLifeDaysInvalid;
    }
  }

  return errors;
};
