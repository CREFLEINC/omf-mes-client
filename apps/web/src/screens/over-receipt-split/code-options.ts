import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { masterName } from '../../patterns/master-name';
import type { SelectOption } from './types';

/**
 * 공통 코드 선택지 — 서버 `GET /mdm/code-values?codeGroupCode=` 로 받는다(공유계약 G-32).
 * 채번 식별자(`codeGroupId`)는 환경마다 달라 **코드 그룹 코드**로만 부른다.
 *
 * 두 그룹 모두 초기 시드가 있고 ⭐ 고객이 늘린다 — 화면에 값을 적지 않는다.
 */

const t = messages.overReceiptSplit;

type CodeValue = components['schemas']['CodeValue'];

/** 예외 유형 — 초과분 전표에 실린다. 시드: CUSTOMER_SUPPLY · FREE_SAMPLE · URGENT_RECEIPT · OVER_DELIVERY */
export const EXCEPTION_TYPE_GROUP = 'INBOUND_RECEIPT_EXCEPTION_TYPE';
/** 대체 LOT 사유 — 라벨 없는 줄에 필수. 시드: NO_LABEL · LABEL_DAMAGED · FORMAT_UNRECOGNIZED · BULK_UNLABELED · OTHER */
export const SUBSTITUTE_LOT_REASON_GROUP = 'SUBSTITUTE_LOT_REASON';

/**
 * 이 화면이 만드는 초과분은 정의상 「초과입하」다 — 기본값으로 둔다(서버는 강제하지 않는다 · 실측).
 * 목록에 없으면(고객이 뺐으면) 기본값을 두지 않는다 — 없는 코드를 보내면 400 이다.
 */
export const DEFAULT_EXCEPTION_TYPE = 'OVER_DELIVERY';

/** 쓰는 값만, 표시 순서대로, 현재 언어의 이름으로. */
export const toCodeOptions = (values: readonly CodeValue[] | undefined): SelectOption[] =>
  (values ?? [])
    .filter((value) => value.isActive)
    .slice()
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((value) => ({ value: value.code, label: masterName(value, value.codeName) }));

export const defaultExceptionType = (options: readonly SelectOption[]): string =>
  options.some((option) => option.value === DEFAULT_EXCEPTION_TYPE) ? DEFAULT_EXCEPTION_TYPE : '';

export type CodeListState = 'ready' | 'loading' | 'failed';

/** 선택지 칸 아래의 안내 — 비어 있는 까닭(불러오는 중 · 실패 · 값 없음)을 밝힌다. */
export const codeListNote = (
  options: readonly SelectOption[],
  state: CodeListState,
): string | undefined => {
  if (state === 'loading') return t.loading.codes;
  if (state === 'failed') return t.filters.lookupFailed;

  return options.length === 0 ? messages.pendingCode.note : undefined;
};

/** 코드 → 표시 이름. 목록에 없으면 코드 그대로(뜻을 지어내지 않는다). */
export const codeLabel = (options: readonly SelectOption[], code: string): string =>
  options.find((option) => option.value === code)?.label ?? code;
