import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 보류 등록·해제 사유의 선택지 — **고객의 공통코드 마스터에서 받는다**(스펙 §5-4 · G-31 마스터).
 *
 * | 자리 | 그룹 | 계약 칸 |
 * | --- | --- | --- |
 * | 보류 등록 사유 | `LOT_HOLD_REASON` | `LotHoldCreate.reasonCode` |
 * | 보류 해제 사유 | `LOT_HOLD_RELEASE_REASON` | `LotHoldRelease.releaseReasonCode` |
 *
 * ⛔ 값 목록을 화면에 박지 않는다 — 고객이 늘리는 값이다. 목록이 아직 없거나(빈 seed) 못 받았거나
 * 잘렸으면 선택칸을 잠그고 그 사유를 적는다(G-2 · 규범 4) — 자유 입력으로 물러나지 않는다.
 * 표시명은 다국어 컬럼이 먼저, 기본 이름이 fallback(G-33). 로케일 스위치 전이라 한국어만 본다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */
export const LOT_HOLD_REASON_GROUP = 'LOT_HOLD_REASON';
export const LOT_HOLD_RELEASE_REASON_GROUP = 'LOT_HOLD_RELEASE_REASON';
export type LotHoldReasonGroup =
  typeof LOT_HOLD_REASON_GROUP | typeof LOT_HOLD_RELEASE_REASON_GROUP;

/** 한 번에 받아 둘 최대 건수. 사유 값이 이보다 많을 일은 없다 — 넘으면 「잘렸다」로 잠근다. */
export const REASON_OPTION_SIZE = 100;

export interface ReasonOption {
  value: string;
  label: string;
}

export interface ReasonOptions {
  options: ReasonOption[];
  isPending: boolean;
  isError: boolean;
  /** 선택칸을 잠글 사유. 없으면 고를 수 있다. 차례: 못 받음 → 아직 안 옴 → 잘림 → 비어 있음 */
  unavailableReason: string | undefined;
}

const labelOf = (value: { code: string; codeName: string; nameKo?: string | null }): string => {
  const localized = (value.nameKo ?? '').trim();
  if (localized !== '') return localized;
  const base = value.codeName.trim();
  return base === '' ? value.code : base;
};

export const useLotHoldReasonOptions = (group: LotHoldReasonGroup): ReasonOptions => {
  const { client } = useApiClient();
  const t = messages.lotStatusTransition.reason;
  const query = useQuery({
    /* 화면 데이터 키(`['lot-status-transition', …]`)와 접두를 나눈다 — 확인 pin 동안의 무효화가 참조 목록까지 다시 부르지 않게. */
    queryKey: ['lot-status-transition-lookups', 'code-values', group] as const,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: group, size: REASON_OPTION_SIZE } },
        }),
      );

      return {
        options: [...data.items]
          .filter((value) => value.isActive && value.code.trim() !== '')
          .sort((left, right) => left.displayOrder - right.displayOrder)
          .map((value) => ({ value: value.code.trim(), label: labelOf(value) })),
        truncated: data.page.total > data.items.length,
      };
    },
  });

  const options = query.data?.options ?? [];
  const unavailableReason = query.isError
    ? t.failed
    : query.isPending
      ? t.pending
      : query.data?.truncated === true
        ? t.truncated
        : options.length === 0
          ? t.empty
          : undefined;

  return { options, isPending: query.isPending, isError: query.isError, unavailableReason };
};

/** 고른 값이 선택지 안에 있는가 — 낡은 값이 남아 있거나 목록이 바뀐 뒤에는 통과하지 않는다. */
export const isKnownReason = (options: readonly ReasonOption[], code: string): boolean =>
  options.some((option) => option.value === code);
