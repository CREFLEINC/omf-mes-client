import { useMutation } from '@tanstack/react-query';
import type { ApiError } from '@omf-mes/api-client';
import { useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';

const RESYNC_PATH = '/planning/production-orders/{productionOrderId}:resync';

export interface ProductionOrderResync {
  requestResync: () => void;
  isPending: boolean;
  isAccepted: boolean;
  error: ApiError | null;
  resetIfIdle: () => void;
}

export const useProductionOrderResync = (productionOrderId: number): ProductionOrderResync => {
  const { client } = useApiClient();
  const [isAccepted, setIsAccepted] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const isPendingRef = useRef(false);
  const mutation = useMutation({
    mutationFn: (idempotencyKey: string): Promise<void> =>
      runRequest<void>(() =>
        client.POST(RESYNC_PATH, {
          params: {
            path: { productionOrderId },
            header: { 'Idempotency-Key': idempotencyKey },
          },
        }),
      ),
  });

  const requestResync = (): void => {
    if (isPendingRef.current) return;

    isPendingRef.current = true;
    setIsAccepted(false);
    setError(null);
    mutation.mutate(crypto.randomUUID(), {
      onSuccess: () => {
        isPendingRef.current = false;
        setIsAccepted(true);
      },
      onError: (cause) => {
        isPendingRef.current = false;
        setError(toApiError(cause));
      },
    });
  };

  const resetIfIdle = (): void => {
    if (isPendingRef.current) return;

    setIsAccepted(false);
    setError(null);
    mutation.reset();
  };

  return {
    requestResync,
    isPending: isPendingRef.current || mutation.isPending,
    isAccepted,
    error,
    resetIfIdle,
  };
};
