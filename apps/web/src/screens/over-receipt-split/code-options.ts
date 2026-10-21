import type { components } from '@omf-mes/api-client';

import { masterName } from '../../patterns/master-name';
import type { SelectOption } from './types';

/**
 * 공통 코드 선택지 — 서버 `GET /mdm/code-values?codeGroupCode=` 로 받는다(공유계약 G-32).
 * 채번 식별자(`codeGroupId`)는 환경마다 달라 **코드 그룹 코드**로만 부른다.
 *
 * 초기 시드가 있고 ⭐ 고객이 늘린다 — 화면에 값을 적지 않는다.
 */

type CodeValue = components['schemas']['CodeValue'];

/** 대체 LOT 사유 — 라벨 없는 줄에 필수. 시드: NO_LABEL · LABEL_DAMAGED · FORMAT_UNRECOGNIZED · BULK_UNLABELED · OTHER */
export const SUBSTITUTE_LOT_REASON_GROUP = 'SUBSTITUTE_LOT_REASON';

/** 쓰는 값만, 표시 순서대로, 현재 언어의 이름으로. */
export const toCodeOptions = (values: readonly CodeValue[] | undefined): SelectOption[] =>
  (values ?? [])
    .filter((value) => value.isActive)
    .slice()
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((value) => ({ value: value.code, label: masterName(value, value.codeName) }));

/** 코드 → 표시 이름. 목록에 없으면 코드 그대로(뜻을 지어내지 않는다). */
export const codeLabel = (options: readonly SelectOption[], code: string): string =>
  options.find((option) => option.value === code)?.label ?? code;
