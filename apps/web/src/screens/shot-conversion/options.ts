import { messages } from '@omf-mes/i18n';

import type { PolicyFilters, RatioFormValues, ScopeValues } from './types';

/** 선택칸 한 줄. 디자인 시스템 `Select` 가 받는 형태 그대로다. */
export interface CodeOption {
  value: string;
  label: string;
}

/** 아무 축도 고르지 않은 상태 — 그것이 「전체」다. */
export const emptyScope: ScopeValues = {
  itemId: '',
  processId: '',
  plantId: '',
  businessUnitId: '',
};

/**
 * 목록 조건의 기본값.
 *
 * ⭐ **기준일을 비운 채로 시작한다** — 계약이 「비우면 끝난 것까지 함께 본다」로 정했고,
 * 이 화면에는 **지우는 길이 없어 끝난 정책이 곧 이력**이다. 감추면 「왜 지금 값이 이것인지」를
 * 되짚을 수 없다.
 */
export const defaultPolicyFilters: PolicyFilters = { effectiveOn: '' };

export const emptyRatioForm = (): RatioFormValues => ({
  scope: { ...emptyScope },
  ratio: '',
  effectiveFrom: '',
  effectiveTo: '',
});

/** 값이 오지 않은 칸을 빈 칸으로 두지 않는다. */
export const orNotRecorded = (value: string | null | undefined): string =>
  value === null || value === undefined || value === ''
    ? messages.shotConversion.fields.notRecorded
    : value;
