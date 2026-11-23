import type { ErrorItem } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { toDecimalText } from './decimal-text';
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

/** 지수 표기 없는 양의 십진수 — 정수부와 소수부로 나눈다. */
const PLAIN_DECIMAL = /^(\d+)(?:\.(\d*))?$/;

/**
 * `size ÷ count`(봉지당 양)가 소수 1자리까지 떨어지는가(피처 014 FR-018 · 사용자 결정 2026-11-24).
 * 부동소수 나눗셈을 쓰지 않는다 — 기본크기 문자열을 10^k 배 정수로 옮겨 `size × 10` 이 `count × 10^k` 의
 * 배수인지 BigInt 로 본다(예: 2.5 ÷ 5 → 250 mod 50 = 0 통과, 2.5 ÷ 2 → 250 mod 20 ≠ 0 막힘).
 * 지수 표기(`1e3`)는 십진 문자열로 편 뒤 본다. 그래도 읽지 못하면 막지 않는다(서버가 본다).
 */
const dividesToOneDecimal = (sizeText: string, count: number): boolean => {
  const match = PLAIN_DECIMAL.exec(sizeText) ?? PLAIN_DECIMAL.exec(toDecimalText(Number(sizeText)));

  if (match === null) return true;

  const [, intPart = '0', fracPart = ''] = match;
  const scaled = BigInt(`${intPart}${fracPart}`);
  const unit = BigInt(count) * 10n ** BigInt(fracPart.length);

  return (scaled * 10n) % unit === 0n;
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
   * 기본크기 ÷ 수량(봉지당 양)이 소수 1자리까지 떨어져야 한다(사용자 결정 2026-11-24). 기본크기가 비면 나눔은 보지 않는다.
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
      !dividesToOneDecimal(defaultProductionLotSize, count)
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
