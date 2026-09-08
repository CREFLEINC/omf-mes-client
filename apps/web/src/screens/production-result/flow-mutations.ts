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

      return client.POST('/trace/lots/{lotId}:complete', {
        params: {
          path: { lotId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'X-Worker-No': workerNo,
            ...(ifMatch === undefined ? {} : { 'If-Match': ifMatch }),
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
