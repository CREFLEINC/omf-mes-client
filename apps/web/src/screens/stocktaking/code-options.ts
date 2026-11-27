import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { masterName } from '../../patterns/master-name';
import { runRequest } from '../../patterns/request';
import type { SelectOption, StocktakingCodeKey } from './types';

/**
 * 값 목록이 확정되지 않은 코드 셋을 한 파일에 격리한다.
 *
 * **값을 지어내지 않는 것이 이 파일의 목적이다.** 착수 이슈가 미결로 남긴 것을 화면이
 * 그럴듯한 예시로 메우면, 사용자는 고를 수 있다고 믿고 고르는데 서버는 그 값을 모른다 —
 * 개시와 마감이 **되돌릴 수 없는** 이 화면에서 그 어긋남은 막다른 길이 된다. 계약의 `@example`
 * (`CYCLE`·`MISPLACED`·`IN_PROGRESS`)도 심지 않는다. 그것은 예시이지 확정이 아니며,
 * 계약 자신이 「서버가 내려주는 선택지를 그대로 쓴다」고 적었다(공유계약 G-2).
 *
 * **필수도로 갈라 적용한다**(계획 결정 10 · 승인 G1). 이것이 W-01-10과 다른 점이다 —
 * 비어 있는 동안 잠기는 범위가 코드마다 다르고, 잠기지 않은 경로는 온전히 쓰인다.
 *
 * | 코드 | 자리 | 필수도 | 비어 있으면 무엇이 막히나 |
 * | --- | --- | :-: | --- |
 * | `countType` | 개시 — 실사 유형 | **요청 필수** | **개시가 통째로 막힌다**(PR ②) |
 * | `varianceReason` | 결과 등록 — 차이 사유 | **조건부 필수** | **차이가 있는 위치만** 저장이 막힌다(PR ③) |
 *
 * 조회 조건의 실사 유형·상태는 선택지가 늘 비어 쓰이지 않아 걷었고, 선택지가 왜 비었는지 밝히던
 * `pendingCode.note`도 이 화면에서는 내지 않는다(사용자 지시 2026-11-18). 잠기는 까닭은 버튼 옆
 * 비활성 사유가 말한다.
 *
 * **잠금 판정은 이 파일이 소유하고 사유 문구는 그 조작이 소유한다.** 「고를 값이 있는가」는
 * 값 목록의 사정이라 여기서 재고(`isCountTypeListPending`), 「그래서 무엇이 막히는가」는
 * 그 조작의 사정이라 `validation.ts`가 문구로 낸다 — 화면이 배열 길이를 직접 세면 같은 판정이
 * 자리마다 다시 생긴다.
 *
 * **값 목록은 서버 코드값에서 받는다**(계약 확정 — 공유계약 G-32 · omf-mes#198 · 사용자 지시 2026-11-27
 * 「재고실사에서 실사 유형 데이터도 넣어주어야 해」). 화면·검증·요청 조립은 배열을 읽을 뿐이라
 * 받은 배열이 차는 순간 개시와 저장이 살아난다. 받기 전 · 실패면 빈 목록이라 종전처럼 잠긴다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 코드마다의 값 목록 — 서버에서 받는다(`useStocktakingCodeLists`). */
export type CodeValueLists = Record<StocktakingCodeKey, readonly string[]>;

/** 코드마다의 선택지. */
export type CodeOptionSets = Record<StocktakingCodeKey, SelectOption[]>;

/**
 * 받기 전 · 실패 때의 값 목록 — **둘 다 비어 있다.**
 *
 * 자리표시 값을 하나 넣어 두지 않는다. 넣으면 사용자가 그것을 고를 수 있고, 고르면
 * 서버가 모르는 코드가 되돌릴 수 없는 전표에 실린다.
 */
export const PLACEHOLDER_STOCKTAKING_CODES: CodeValueLists = {
  countType: [],
  varianceReason: [],
};

/** 코드마다 서버가 준 이름(코드 → 이름). 받기 전이거나 없는 코드는 코드 그대로 보인다. */
export type CodeNames = Record<StocktakingCodeKey, ReadonlyMap<string, string>>;

const NO_NAMES: CodeNames = { countType: new Map(), varianceReason: new Map() };

const toOptions = (values: readonly string[], names: ReadonlyMap<string, string>): SelectOption[] =>
  values.map((code) => ({ value: code, label: names.get(code) ?? code }));

/**
 * 값 목록을 선택지로 옮긴다.
 *
 * **라벨을 지어내지 않는다** — 서버가 준 이름(`names`)이 있으면 그것을, 없으면 코드값을 그대로
 * 라벨로 쓴다. 화면이 「순환 실사」 같은 이름을 붙이면 그 뜻도 화면이 지어낸 것이 된다.
 *
 * **차례를 바꾸지 않는다.** 값 목록이 어떤 차례로 오는지가 뜻일 수 있다(자주 쓰는 것부터 등).
 */
export const toCodeOptionSets = (
  values: CodeValueLists,
  names: CodeNames = NO_NAMES,
): CodeOptionSets => ({
  countType: toOptions(values.countType, names.countType),
  varianceReason: toOptions(values.varianceReason, names.varianceReason),
});

/**
 * 코드 그룹 — 계약 `countTypeCode` · `varianceReasonCode` 설명의 확정 문구(공유계약 G-32 ·
 * omf-mes#198): 값 목록은 `GET /mdm/code-values?codeGroupCode=…` 로 받는다. 채번 식별자
 * (`codeGroupId`)는 환경마다 달라 코드로 부른다.
 */
export const STOCKTAKING_CODE_GROUPS: Record<StocktakingCodeKey, string> = {
  countType: 'INVENTORY_COUNT_TYPE',
  varianceReason: 'VARIANCE_REASON',
};

interface CodeGroupList {
  /** 고를 수 있는 값 — 사용 중인 것만, 서버 차례 그대로. */
  values: string[];
  /** 지난 전표가 쓴 미사용 값도 이름으로 보이게 전부 담는다. */
  names: Map<string, string>;
}

const useCodeGroup = (key: StocktakingCodeKey) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['stocktaking-lookups', 'code-values', STOCKTAKING_CODE_GROUPS[key]],
    queryFn: async (): Promise<CodeGroupList> => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: {
            query: {
              codeGroupCode: STOCKTAKING_CODE_GROUPS[key],
              includeInactive: true,
              size: 100,
            },
          },
        }),
      );

      return {
        values: data.items.filter((item) => item.isActive).map((item) => item.code),
        names: new Map(data.items.map((item) => [item.code, masterName(item, item.codeName)])),
      };
    },
  });
};

export interface StocktakingCodeLists {
  /** 받기 전 · 실패면 빈 목록이다(`PLACEHOLDER_STOCKTAKING_CODES`) — 값을 지어내지 않는다. */
  values: CodeValueLists;
  names: CodeNames;
}

/** 실사 유형 · 차이 사유의 값 목록과 이름을 서버에서 받는다. */
export const useStocktakingCodeLists = (): StocktakingCodeLists => {
  const countType = useCodeGroup('countType');
  const varianceReason = useCodeGroup('varianceReason');

  return {
    values: {
      countType: countType.data?.values ?? PLACEHOLDER_STOCKTAKING_CODES.countType,
      varianceReason: varianceReason.data?.values ?? PLACEHOLDER_STOCKTAKING_CODES.varianceReason,
    },
    names: {
      countType: countType.data?.names ?? NO_NAMES.countType,
      varianceReason: varianceReason.data?.names ?? NO_NAMES.varianceReason,
    },
  };
};

/** 코드 → 서버 이름. 이름이 없으면 코드를 그대로 낸다. */
export const codeNameOf = (names: ReadonlyMap<string, string>, code: string): string =>
  names.get(code) ?? code;

/**
 * 개시가 **통째로** 막히는가 — 실사 유형은 요청 필수인데 고를 값 자체가 없다(승인 G1).
 *
 * 「아직 안 골랐다」와 다르다. 고를 것이 없는데 「고르세요」라고 말하면 사용자가 자기가 놓친
 * 것을 찾다가 화면을 고장으로 읽는다 — 그래서 사유 문구가 갈린다(`validation.ts`).
 *
 * **차이 사유(`varianceReason`)를 함께 보지 않는다.** 그쪽은 조건부 필수라 잠기는 범위가
 * 다르고(차이가 있는 위치만 · PR ③), 여기 묶으면 차이가 없는 위치의 저장까지 막힌다 —
 * 필수도로 갈라 적용한다는 승인 G1의 요점이 그 갈림이다.
 */
export const isCountTypeListPending = (sets: CodeOptionSets): boolean =>
  sets.countType.length === 0;

/**
 * 차이 사유를 **고를 수 있는가** — 조건부 필수라 잠기는 범위가 개시와 다르다(승인 G1).
 *
 * 이 값이 참이어도 **막히는 것은 차이가 있는 줄이 있는 위치뿐이다.** 차이가 없는 위치는
 * 사유가 필요 없어 그대로 저장된다 — 그 갈림을 판정하는 자리는 `line-replace-request.ts`이고,
 * 여기는 「고를 값이 있는가」만 답한다.
 *
 * **`countType`과 한 함수로 묶지 않는다.** 묶으면 실사 유형이 확정되지 않은 동안 차이 없는
 * 위치의 저장까지 막히고, 반대로 차이 사유만 확정되면 개시가 열리는 것처럼 보인다 —
 * 두 코드의 필수도가 다르다는 사실이 판정 함수의 개수로 드러나야 한다.
 */
export const isVarianceReasonListPending = (sets: CodeOptionSets): boolean =>
  sets.varianceReason.length === 0;

/**
 * 선택칸 트리거에 보이는 자리표시 문구 — 고를 값이 있으면 「~을/를 선택하세요」, 없으면 「등록된 값 없음」.
 */
export const codePlaceholder = (label: string, options: readonly SelectOption[]): string =>
  options.length === 0
    ? messages.pendingCode.placeholder
    : messages.screenPatterns.referencePicker.select(label);
