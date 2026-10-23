import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { toPoLineView, toPoView, type PoLineView, type PoView } from './types';
import { RECEIPT_FORM_FIELDS } from './validation';

/**
 * 「입하 등록」 창의 읽기 — 발주 상세 하나(`GET /logistics/purchase-orders/{id}`)가 머리와 라인을 함께 준다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 쓰기는 하나다 — `POST /logistics/inbound-receipts:split`. 한 트랜잭션으로 두 전표를
 * 만들므로 건별 요청을 나누지 않는다(이슈 §6 — 부분 실패가 없다).
 */

type Client = ApiClient['client'];

/**
 * 캐시 키. 앞머리(`purchase-orders`)는 발주를 다시 읽을 때 함께 걷히는 묶음이다.
 */
export const poKeys = {
  detail: (purchaseOrderId: number) => ['purchase-orders', 'detail', purchaseOrderId] as const,
  codeValues: (codeGroupCode: string) =>
    ['over-receipt-split', 'code-values', codeGroupCode] as const,
};

/** 발주 한 건과 그 라인 — 「입하 등록」 창이 발주 번호 하나로 선다. */
export interface PoDetail {
  purchaseOrder: PoView;
  lines: PoLineView[];
}

/**
 * 발주 상세. 창은 입하 예정 조회가 연다 — 그 화면의 목록은 이 계약의 발주 모양이 아니어서 머리와 라인을
 * 상세 하나로 함께 받는다.
 *
 * 이 응답의 참조(`data`)가 바뀌는 것이 **초안을 새로 만드는 유일한 신호**다(계획 결정 4).
 */
export const usePurchaseOrderDetail = (purchaseOrderId: number): UseQueryResult<PoDetail> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: poKeys.detail(purchaseOrderId),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/logistics/purchase-orders/{purchaseOrderId}', {
          params: { path: { purchaseOrderId } },
        }),
      );

      return { purchaseOrder: toPoView(data.purchaseOrder), lines: data.lines.map(toPoLineView) };
    },
  });
};

type CodeValue = components['schemas']['CodeValue'];

/** 공통 코드 값 목록. 그룹 코드로 부른다 — 채번 식별자는 환경마다 다르다(공유계약 G-32). */
export const useCodeValues = (
  codeGroupCode: string,
  enabled: boolean,
): UseQueryResult<CodeValue[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: poKeys.codeValues(codeGroupCode),
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode, page: 1, size: 200 } },
        }),
      ).then((response) => response.items),
  });
};

type SplitRequest = components['schemas']['InboundReceiptSplitRequest'];
type SplitResponse = components['schemas']['InboundReceiptSplitResponse'];

export interface SplitRegisterOptions {
  /** 등록 뒤 다시 부를 발주. 누적 입하가 늘었으므로 그 결과를 바로 확인할 수 있어야 한다 */
  purchaseOrderId: number;
  /** 함께 다시 읽을 것 — 창을 연 화면의 표(입하 예정의 발주·라인, 초과분 목록). */
  refreshKeys?: readonly (readonly unknown[])[];
  onSuccess: (data: SplitResponse) => void;
}

/**
 * 입하 등록.
 *
 * **공통 쓰기 훅을 그대로 쓰고 고치지 않는다**(계획 결정 12). 이름에 「마스터」가 들어 있으나
 * 그 훅은 리소스 이름을 알지 않는다 — 요청 함수·잠금 토큰 경로·무효화 키·화면이 아는 필드만 받는다.
 * 입력 형 화면이 둘째로 생기면 `patterns/`의 패턴 이름을 그때 재검토한다. 지금 옮기면
 * 사용처 하나짜리 일반화가 된다.
 *
 * **잠금 토큰이 없다**(`etagPath: null`). 이 오퍼레이션에는 `If-Match`가 없고(실측)
 * 응답 갈래도 201·400·403뿐이라 충돌(409)이 나오지 않는다 — 저장 실패 배너에
 * 「최신 불러오기」가 뜨지 않는 이유가 그것이다.
 *
 * 창을 연 화면의 표는 부르는 쪽이 `refreshKeys` 로 준다. 창은 발주 번호 하나로 서므로 그 표가 다시 읽혀
 * 방금 등록한 발주가 목록에서 빠져도 창은 닫히지 않는다.
 *
 * **남은 위험**: 응답을 받지 못한 뒤 다시 누르면 훅이 **새 멱등 키**를 만들어 서버가
 * 재전송으로 보지 못한다. 제출 단위로 키를 고정하면 풀리는 문제이나 그것은 `patterns/`
 * 변경이라 이번 범위 밖이다 — 화면 차원 완화 셋(전송 중 전 버튼 잠금 · 성공 후 초안 비움 ·
 * 응답 없음 안내)으로 다루고 후속 이슈로 남긴다.
 */
export const useSplitRegister = (
  options: SplitRegisterOptions,
): MasterWriteResult<SplitRequest> => {
  const { client } = useApiClient();

  return useMasterWrite<SplitRequest, SplitResponse>({
    request: (body, headers) =>
      client.POST('/logistics/inbound-receipts:split', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [poKeys.detail(options.purchaseOrderId), ...(options.refreshKeys ?? [])],
    /* 라인 오류는 계약이 어느 행인지 알려 주지 않아 인라인으로 낼 자리가 없다 — 전부 배너로 간다. */
    knownFields: RECEIPT_FORM_FIELDS,
    onSuccess: options.onSuccess,
  });
};
