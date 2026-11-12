import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { supplierItemDefaultKeys } from './queries';
import type {
  SupplierItemDefault,
  SupplierItemDefaultCreate,
  SupplierItemDefaultUpdate,
} from './types';

export type DefaultSave =
  | { mode: 'create'; body: SupplierItemDefaultCreate }
  | { mode: 'update'; id: number; body: SupplierItemDefaultUpdate };

/** 기본 정보 추가 · 수정(계약 §9). 수정은 `versionNo` 로 잠근다(409 VERSION_CONFLICT). */
export const useSaveDefault = (
  onSuccess: (saved: SupplierItemDefault) => void,
): MasterWriteResult<DefaultSave> => {
  const { client } = useApiClient();
  return useMasterWrite<DefaultSave, SupplierItemDefault>({
    request: (save, headers) =>
      save.mode === 'create'
        ? client.POST('/mdm/supplier-item-defaults', {
            params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
            body: save.body,
          })
        : client.PUT('/mdm/supplier-item-defaults/{supplierItemDefaultId}', {
            params: {
              path: { supplierItemDefaultId: save.id },
              header: { 'Idempotency-Key': headers['Idempotency-Key'] },
            },
            body: save.body,
          }),
    etagPath: null,
    invalidateKeys: [supplierItemDefaultKeys.all],
    knownFields: [],
    onSuccess,
  });
};

/** 기본 정보 삭제(계약 §9). 이미 만든 자재 관리 LOT 에는 영향이 없다. */
export const useDeleteDefault = (onSuccess: () => void): MasterWriteResult<number> => {
  const { client } = useApiClient();
  return useMasterWrite<number, unknown>({
    request: (id, headers) =>
      client.DELETE('/mdm/supplier-item-defaults/{supplierItemDefaultId}', {
        params: {
          path: { supplierItemDefaultId: id },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    etagPath: null,
    invalidateKeys: [supplierItemDefaultKeys.all],
    knownFields: [],
    onSuccess,
  });
};
