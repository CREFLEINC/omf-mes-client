import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * 이 화면이 푸는 참조는 **계측기 하나**다.
 *
 * ⭐ **계측기 전용 경로가 없다** — 계측기는 설비의 한 종류라 설비 목록을 쓴다. 「검교정이
 * 필요한가」(`calibrationRequired`)로 거른다: 형제 화면(W-05-11)이 세부유형 코드로 걸렀지만
 * 그쪽은 마스터를 관리하는 자리라 유형이 곧 대상이고, 여기는 **검교정 이력을 적는 자리**라
 * 「검교정을 받는 설비인가」가 곧 대상이다. 유형 코드값 시드에 매이지 않는 이점도 있다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.gaugeCalibration;

export interface LookupResult {
  entries: LookupEntry[];
  /** 목록이 잘렸으면 참. 고를 수 없는 계측기가 생겼다는 뜻이다. */
  truncated: boolean;
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
}

const EMPTY_ENTRIES: LookupEntry[] = [];

const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/**
 * 선택칸 아래에 붙일 안내.
 *
 * **실패가 잘림보다 앞선다** — 첫 조회가 잘린 목록을 주고 다시 부르기가 실패하면 낡은 자료와
 * 실패가 함께 참이 된다. 그때 「일부만 보인다」고만 말하면 목록이 낡았다는 사실이 가려진다.
 */
export const equipmentNote = (lookup: LookupResult): string | undefined => {
  if (lookup.isError) return t.filters.equipmentLookupFailed;
  if (lookup.truncated) return t.filters.equipmentLookupTruncated;

  return undefined;
};

export const lookupKeys = {
  equipments: ['gauge-calibration-lookups', 'equipments'] as const,
};

export const useEquipmentOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.equipments,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/equipments', { params: { query: { calibrationRequired: true } } }),
      ),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.equipmentId),
        label: `${item.equipmentCode} · ${item.equipmentName}`,
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
