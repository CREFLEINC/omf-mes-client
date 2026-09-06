import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { LookupEntry, LookupSource } from '../../patterns/lookup-display';
import { runRequest } from '../../patterns/request';

/**
 * 출하 상태의 표시명 — 계약은 `Shipment.statusCode`의 코드만 내리고 이름은 공통코드 그룹
 * `SHIPMENT_STATUS`(미확정·확정·취소 · 시스템 값)가 준다(G-32). 코드 문자열을 사용자에게
 * 그대로 보이지 않기 위한 조회다.
 *
 * 표시명은 다국어 컬럼(`nameKo`)이 먼저, 기본 이름(`codeName`)이 fallback(G-33). 로케일 스위치가
 * 아직 없어 한국어만 본다. 모르는 코드는 코드를 그대로 보인다 — 뜻을 지어내지 않는다(G-9).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */
export const SHIPMENT_STATUS_CODE_GROUP = 'SHIPMENT_STATUS';

const EMPTY_ENTRIES: LookupEntry[] = [];

const nameOf = (value: { code: string; codeName: string; nameKo?: string | null }): string => {
  const localized = (value.nameKo ?? '').trim();
  if (localized !== '') return localized;
  const base = value.codeName.trim();
  return base === '' ? value.code : base;
};

export const useShipmentStatusLookup = (): LookupSource => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: ['shipment-confirm-lookups', 'code-values', SHIPMENT_STATUS_CODE_GROUP],
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: SHIPMENT_STATUS_CODE_GROUP, includeInactive: true } },
        }),
      );

      return data.items.map((item): LookupEntry => ({
        value: item.code,
        label: nameOf(item),
        isActive: item.isActive,
      }));
    },
  });

  return {
    entries: query.data ?? EMPTY_ENTRIES,
    isError: query.isError,
    isLoading: query.isPending,
  };
};

/** 표시명이 없으면(조회 전·실패·모르는 코드) 코드를 그대로 — 상태 코드는 그 자체가 읽히는 말이다. */
export const shipmentStatusText = (lookup: LookupSource, code: string): string => {
  const label = lookup.entries.find((entry) => entry.value === code)?.label;
  return label === undefined || label === '' || label === messages.common.reference.unknown
    ? code
    : label;
};
