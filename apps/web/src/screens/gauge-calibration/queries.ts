import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import type { CalibrationListQuery } from './filters';
import { toCalibrationView, type CalibrationListResult } from './types';

/**
 * 이 화면의 오퍼레이션 — **읽기 하나와 쓰기 하나**다.
 *
 * ⛔ **수정·삭제 경로가 없다.** 계약에 없고, 잘못 적었으면 새 이력을 덧붙인다. 그래서 이
 * 파일에는 `PUT`도 `DELETE`도 없다 — 없는 것이 이 화면의 규율이다.
 *
 * ⛔ **상세 조회를 부르지 않는다.** 계약에 있지만 목록이 같은 칸을 전부 내려주므로 부를 이유가
 * 없다 — 부르면 목록을 눌렀을 때 요청이 하나 더 나가고 화면에 새로 보이는 것은 없다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 */

type Client = ApiClient['client'];
type Calibration = components['schemas']['Calibration'];
type CalibrationCreate = components['schemas']['CalibrationCreate'];

export const calibrationKeys = {
  all: ['gauge-calibration'] as const,
  list: (query: CalibrationListQuery) => ['gauge-calibration', 'list', query] as const,
};

const fetchList = async (
  client: Client,
  query: CalibrationListQuery,
): Promise<CalibrationListResult> => {
  const data = await runRequest(() =>
    client.GET('/maintenance/calibrations', { params: { query } }),
  );

  return {
    items: data.items.map(toCalibrationView),
    /*
     * 계약이 쪽 정보를 선택으로 두었다. 오지 않으면 **받은 것이 전부**로 본다 — 지어낸 전체
     * 건수로 쪽 이동을 열면 있지도 않은 쪽으로 보내게 된다.
     */
    page: data.page ?? { page: query.page ?? 1, size: data.items.length, total: data.items.length },
  };
};

/** 이력 목록. **조건이 비어 있어도 부른다** — 계약이 필수로 둔 조건이 없다. */
export const useCalibrationList = (
  query: CalibrationListQuery,
): UseQueryResult<CalibrationListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: calibrationKeys.list(query),
    queryFn: () => fetchList(client, query),
  });
};

/** 화면이 소유한 입력칸 이름 — 서버 오류를 인라인으로 낼지 배너로 올릴지 가르는 기준이다. */
const KNOWN_FIELDS = [
  'equipmentId',
  'historyTypeCode',
  'performedOn',
  'resultCode',
  'certificateNo',
  'agencyTypeCode',
  'agencyName',
  'nextDueOn',
  'toleranceNote',
  'remarks',
] as const;

/**
 * 이력 등록.
 *
 * ⭐ **멱등 키 수명이 `until-applied`다.** 이력은 되돌릴 수 없는 쓰기다 — 통신이 끊긴 뒤 다시
 * 눌렀을 때 서버가 다른 쓰기로 보면 **같은 이력이 두 줄** 남고, 지울 길이 없다. 값이 바뀌면
 * 새 키가 나가므로 「고쳐서 다시 저장」은 막히지 않는다.
 *
 * ⚠ **낙관적 잠금을 걸지 않는다**(`etagPath: null`). 이 저장이 계측기 마스터의 두 칸을
 * **치환**하므로 스펙은 잠금을 요구했으나, **계약의 이 오퍼레이션은 `If-Match`를 받지 않는다**
 * (헤더에 멱등 키뿐 — 실측). 화면이 보낼 수 없는 헤더를 지어 보낼 수는 없다.
 */
export const useCalibrationCreate = (
  onSuccess: () => void,
): MasterWriteResult<CalibrationCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<CalibrationCreate, Calibration>({
    request: (body, headers) =>
      client.POST('/maintenance/calibrations', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [calibrationKeys.all],
    knownFields: KNOWN_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess,
  });
};
