import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta, SelectOption, StepView } from './types';

/**
 * 내부 번호(FK)로 이어진 값을 이름으로 푸는 참조.
 *
 * **이 화면의 참조는 하나뿐이다.**
 *
 * | 참조 | 경로 | 보이는 자리 | 언제 부르나 | 네 갈래를 가르나 |
 * | --- | --- | --- | --- | :-: |
 * | 사업부 | `/mdm/business-units` | 조건 줄 · 목록 표 · 상세 | **첫 진입** | **그렇다** |
 * | 단계의 승인자 | **없다(응답이 준다)** | 단계 표 | — | 아니다 |
 *
 * 계약이 단계 응답에 `approverName`·`approverDepartmentName`을 실어 보낸다 —
 * 「화면이 사용자 목록을 다시 부르지 않게 한다」가 계약의 명시적 의도이고,
 * 그 덕에 단계를 읽는 데 조회가 하나도 붙지 않는다.
 *
 * **그러나 그 이름은 필수 필드가 아니다.** 없으면 번호를 대신 내지 않는다 —
 * 내부 번호가 화면에 서면 그것이 식별자로 읽힌다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.approvalRoute;

/**
 * 참조를 이름으로 풀 때 필요한 것 전부. **넷을 함께 들고 있어야 갈래를 가를 수 있다** —
 * 아직 오지 않음 · 목록에 없음 · 불러오기 실패 · 정상.
 */
export interface ReferenceSource {
  entries: readonly LookupEntry[];
  isError: boolean;
  isLoading: boolean;
  /**
   * 목록이 잘렸으면 참.
   *
   * **읽는 쪽이 이 값을 볼 수 있어야 한다.** 잘린 목록으로 이름을 풀면 그 뒤의 정상 값이
   * 「알 수 없음」으로 찍히는데, 그 문구는 *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다.
   */
  truncated: boolean;
}

export interface LookupResult extends ReferenceSource {
  entries: LookupEntry[];
  /** 조회 실패에는 복구 경로를 함께 낸다 — 사용자가 할 수 있는 조치가 재시도뿐이다. */
  refetch: () => void;
}

/**
 * 참조 값 하나의 표기 상태.
 *
 * **네 갈래를 타입으로 가른다.** 하나로 뭉개면 본 자료가 참조 목록보다 먼저 오는 순간
 * 정상 값이 「알 수 없음」으로 보이고, 그 문구는 *값이 잘못됐다*는 뜻이라 반대로 읽힌다.
 *
 * **어느 갈래에도 번호를 담지 않는다.** 담을 자리가 없으면 화면으로 샐 경로도 없다.
 */
export type ReferenceState =
  { kind: 'named'; label: string } | { kind: 'unknown' } | { kind: 'loading' } | { kind: 'failed' };

/**
 * 참조 하나를 표기 상태로 옮긴다.
 *
 * 순서가 뜻을 정한다 — **실패 · 미도착이 「목록에 없음」보다 앞선다.** 목록이 없거나 못 받은 것을
 * 「그 값이 목록에 없다」로 판정하면 정상 값에 잘못된 값이라는 표를 붙이는 셈이다.
 *
 * `String(id)`는 **맞춰 보기 위한 것이지 표시를 위한 것이 아니다** — 결과 어디에도 담기지 않는다.
 */
export const toReference = (
  source: ReferenceSource,
  id: number | null | undefined,
): ReferenceState => {
  if (source.isError) return { kind: 'failed' };
  if (source.isLoading) return { kind: 'loading' };
  if (id === null || id === undefined) return { kind: 'unknown' };

  const label = source.entries.find((entry) => entry.value === String(id))?.label;

  return label === undefined ? { kind: 'unknown' } : { kind: 'named', label };
};

/** 표기 상태를 화면 문구로 옮긴다. 네 갈래의 문구가 서로 달라야 뜻이 구분된다. */
export const describeReference = (state: ReferenceState): string => {
  switch (state.kind) {
    case 'named':
      return state.label;
    case 'unknown':
      return t.values.unknown;
    case 'loading':
      return t.values.referenceLoading;
    case 'failed':
      return t.values.referenceFailed;
  }
};

/**
 * 결재선의 사업부 칸은 **다섯째 갈래**를 갖는다.
 *
 * 사업부를 비운 결재선은 「전 사업부 공통」이며 그것은 **확정된 뜻이지 빈 값이 아니다.**
 * 「알 수 없음」이나 대시로 두면 자료가 빠진 것으로 읽혀 정반대가 된다.
 */
export type BusinessUnitState = ReferenceState | { kind: 'allUnits' };

/**
 * **「전 사업부 공통」이 네 갈래보다 앞선다.** 그 뜻은 이름 목록을 필요로 하지 않으므로,
 * 참조 조회가 실패했거나 아직 오지 않았어도 흔들리지 않는다 — 뒤에 두면 조회가 실패한 동안
 * 전 사업부 공통 결재선이 「이름을 불러오지 못했습니다」로 보인다.
 */
export const toBusinessUnit = (
  source: ReferenceSource,
  businessUnitId: number | null,
): BusinessUnitState =>
  businessUnitId === null ? { kind: 'allUnits' } : toReference(source, businessUnitId);

export const describeBusinessUnit = (state: BusinessUnitState): string =>
  state.kind === 'allUnits' ? t.values.allBusinessUnits : describeReference(state);

/**
 * 선택칸 아래에 붙일 안내. 밝히지 않으면 사용자가 **불완전한 목록을 완전한 것으로 읽고**
 * 찾는 값이 없으면 「그런 사업부가 없다」로 결론짓는다.
 *
 * **실패가 잘림보다 앞선다.** 둘이 겹치는 자리가 실제로 있다 — 첫 조회가 잘린 목록을 주고
 * 다시 부르기가 실패하면 낡은 자료(`truncated`)와 실패(`isError`)가 함께 참이 된다.
 */
export const lookupNote = (lookup: LookupResult): string | undefined => {
  if (lookup.isError) return t.filters.lookupFailed;
  if (lookup.truncated) return t.filters.lookupTruncated;

  return undefined;
};

/**
 * 조건 줄의 사업부 선택지.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다.** 빼면 그 사업부가 걸린 결재선을 조건으로 찾을
 * 방법이 사라진다 — 결재선은 사업부보다 오래 산다.
 */
export const toBusinessUnitOptions = (entries: readonly LookupEntry[]): SelectOption[] =>
  entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/**
 * 단계의 승인자 표기.
 *
 * **이름이 없으면 부서만으로 이름을 만들지도, 번호를 내지도 않는다.** 「합성부서」만 적으면
 * 사용자는 부서가 결재한다고 읽는데 1차의 승인자는 언제나 사람이다.
 */
export const describeApprover = (step: StepView): string => {
  if (step.approverName === null) return t.values.approverUnknown;

  return step.approverDepartmentName === null
    ? step.approverName
    : `${step.approverName} · ${step.approverDepartmentName}`;
};

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ENTRIES: LookupEntry[] = [];

/** 서버가 보낸 전체 건수가 받은 건수보다 많으면 잘린 것이다. */
const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

export const lookupKeys = {
  businessUnits: ['approval-route-lookups', 'business-units'] as const,
};

/**
 * 사업부 — **조건 줄의 선택지·목록 표의 칸·고른 결재선의 상세가 같은 목록을 쓴다.**
 *
 * **`includeInactive=true`로 한 번 받아 둔다.** 기본 조회는 사용 중인 것만 내려주므로,
 * 지금은 쓰지 않는 사업부를 가리키는 결재선이 오면 이름이 비어 보인다.
 *
 * **첫 진입에 부른다.** 목록 표의 사업부 칸이 목록 응답과 함께 곧바로 그려지므로 고른 뒤에
 * 부르기 시작하면 첫 화면의 이름이 한 박자 늦게 채워진다.
 */
export const useBusinessUnitLookup = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.businessUnits,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/business-units', { params: { query: { includeInactive: true } } }),
      ),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.businessUnitId),
        label: `${item.businessUnitCode} · ${item.businessUnitName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};
