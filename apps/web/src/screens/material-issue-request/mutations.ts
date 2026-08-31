import type { components } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { materialIssueRequestKeys } from './queries';
import { toCreatedRequestView, type CreatedRequestView } from './types';
import type { MaterialIssueRequestCreate } from './types';
import { HEADER_FORM_FIELDS } from './validation';

type MaterialIssueRequestDetailResponse =
  components['schemas']['MaterialIssueRequestDetailResponse'];

/**
 * 요청 발행 — **이 화면에서 되돌릴 수 없는 유일한 쓰기**다. 취소 경로가 이 화면에 없다.
 *
 * **잠금 토큰을 보내지 않는다**(`etagPath: null`). 새 전표라 견줄 판이 없고, 계약도 `If-Match`
 * 를 선택으로 둔다 — 보내지 않으면 낙관적 잠금 검사를 건너뛴다.
 *
 * ⭐ **멱등 키의 수명이 `until-applied` 다.** 본문이 있는 되돌릴 수 없는 쓰기라는 일반 기준에
 * 더해, 이 화면에는 이유가 하나 더 있다 — **서버가 중복 요청을 막지 않는다**(스펙 §6). 통신이
 * 끊긴 뒤 다시 누를 때 **같은 키가 나가는 것이 유일한 방어선**이고, `per-attempt` 로 두면 같은
 * 자재 요청 전표가 둘 생긴다.
 *
 * **기존 요청 목록을 무효화한다** — 방금 발행한 요청이 그 경고 목록에 즉시 나타나야 다음
 * 사용자가 중복을 알아본다.
 */
export const useMaterialIssueRequestMutation = (options: {
  onSuccess: (data: CreatedRequestView) => void;
}): MasterWriteResult<MaterialIssueRequestCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<MaterialIssueRequestCreate, MaterialIssueRequestDetailResponse>({
    request: (body, headers) =>
      client.POST('/logistics/material-issue-requests', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [materialIssueRequestKeys.existingAll],
    knownFields: HEADER_FORM_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess: (data) => {
      options.onSuccess(toCreatedRequestView(data));
    },
  });
};
