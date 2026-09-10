import type { components } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { productionFlowKeys } from './flow-queries';
import type { DocumentIssueCreate, LotComplete } from './flow-state';

type SerialNumberBatchCreate = components['schemas']['SerialNumberBatchCreate'];
type SerialNumberBatchResult = components['schemas']['SerialNumberBatchResult'];
type DocumentIssueBatchResult = components['schemas']['DocumentIssueBatchResponse'];
type Lot = components['schemas']['Lot'];

interface WriteOptions<T> {
  workerNo: string;
  onSuccess: (data: T) => void;
}

export const useSerialIssue = ({
  workerNo,
  onSuccess,
}: WriteOptions<SerialNumberBatchResult>): MasterWriteResult<SerialNumberBatchCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<SerialNumberBatchCreate, SerialNumberBatchResult>({
    request: (body, headers) =>
      client.POST('/trace/serial-numbers', {
        params: {
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'X-Worker-No': workerNo,
          },
        },
        body,
      }),
    etagPath: null,
    invalidateKeys: [productionFlowKeys.all],
    knownFields: ['quantity'],
    keyLifetime: 'until-applied',
    onSuccess,
  });
};

export const useDocumentIssue = ({
  workerNo,
  onSuccess,
}: WriteOptions<DocumentIssueBatchResult>): MasterWriteResult<DocumentIssueCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<DocumentIssueCreate, DocumentIssueBatchResult>({
    request: (body, headers) =>
      client.POST('/app/document-issues', {
        params: {
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'X-Worker-No': workerNo,
          },
        },
        body,
      }),
    etagPath: null,
    invalidateKeys: [productionFlowKeys.all],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess,
  });
};

export const useLotComplete = ({
  lotId,
  workerNo,
  onSuccess,
}: WriteOptions<Lot> & { lotId: number | null }): MasterWriteResult<LotComplete> => {
  const { client, etags } = useApiClient();

  return useMasterWrite<LotComplete, Lot>({
    request: (body, headers) => {
      if (lotId === null) throw new Error('현재 LOT이 없으면 마감을 보내지 않습니다.');

      const ifMatch = etags.ifMatch(`/trace/lots/${String(lotId)}`);

      /*
       * ⛔ **잠금 값이 없으면 마감을 보내지 않는다**(#1005 · 공유계약 B-1).
       *
       *    전에는 「있으면 싣는다」였다. 그런데 이 화면은 목록 경로만 불렀고 ETag 보관소는
       *    «요청 경로별»로 담기므로 이 자리는 **언제나 비어 있었다** — 계약이 `If-Match` 를
       *    Optional 로 두어 오류도 나지 않았고, 요청은 잠금 없이 그대로 나가 성공했다.
       *    코드가 잠그는 «모양»이라 육안 리뷰로는 잡히지 않는다.
       *
       *    값을 채우는 것은 `useLotDetail` 이다. 그 조회가 빠지거나 실패하면 여기서 멈춘다 —
       *    두 단말이 같은 LOT 을 함께 마감하는 것보다 한 번 실패하고 다시 부르는 편이 낫다.
       */
      if (ifMatch === undefined) {
        throw new Error('LOT 상태를 확인하지 못해 마감을 보내지 않습니다.');
      }

      return client.POST('/trace/lots/{lotId}:complete', {
        params: {
          path: { lotId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'X-Worker-No': workerNo,
            'If-Match': ifMatch,
          },
        },
        body,
      });
    },
    etagPath: null,
    invalidateKeys: [productionFlowKeys.all],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess,
  });
};
