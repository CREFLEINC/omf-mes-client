import { AlertBanner, Button, Dialog, useToast } from '@crefle/web-ui';
import type { ApiError, components } from '@omf-mes/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import type { SelectedLotSnapshot } from './candidate-model';

type Body = components['schemas']['LotHoldCreate'];
type LotHold = components['schemas']['LotHold'];
const ROOT_KEYS = [
  ['suspicious-material-hold'],
  ['lot-status-history'],
  ['lot-status-transition'],
] as const;
const conflict = (error: ApiError | null): boolean =>
  error?.kind === 'conflict' || (error?.kind === 'http' && error.status === 409);
const conflictMessage = (error: ApiError | null): string => {
  if (
    (error?.kind === 'conflict' || error?.kind === 'http') &&
    error.message !== undefined &&
    error.message.trim() !== ''
  )
    return error.message;
  return '선택한 LOT 중 하나의 상태가 변경되었습니다. 최신 정보를 다시 불러오세요.';
};

export interface SuspiciousMaterialHoldExecutionProps {
  body: Body | null;
  selected: SelectedLotSnapshot[];
  onConfirmationChange: (pinned: boolean) => void;
  onApplied: () => void;
  onReload: () => void;
}

export const SuspiciousMaterialHoldExecution = ({
  body,
  selected,
  onConfirmationChange,
  onApplied,
  onReload,
}: SuspiciousMaterialHoldExecutionProps) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirmation, setConfirmation] = useState<Body | null>(null);
  const [applied, setApplied] = useState(false);
  const write = useMasterWrite<Body, LotHold[]>({
    request: (requestBody, headers) =>
      client.POST('/quality/lot-holds', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: requestBody,
      }),
    etagPath: null,
    invalidateKeys: ROOT_KEYS,
    knownFields: [
      'lots',
      'holdQty',
      'uomId',
      'reasonCode',
      'releaseCondition',
      'targetLotStatusCode',
      'remarks',
    ],
    keyLifetime: 'until-applied',
    onSuccess: () => {
      setConfirmation(null);
      setApplied(true);
      onConfirmationChange(false);
      toast.show({ variant: 'success', description: '의심자재 보류를 등록했습니다.' });
      onApplied();
    },
  });
  const close = (): void => {
    if (write.isSaving) return;
    setConfirmation(null);
    onConfirmationChange(false);
    write.reset();
  };
  const reload = (): void => {
    close();
    onReload();
    for (const queryKey of ROOT_KEYS) void queryClient.invalidateQueries({ queryKey });
  };
  const stale = conflict(write.error);

  return (
    <section aria-label="의심자재 보류 실행">
      <Button
        disabled={body === null || confirmation !== null}
        onClick={() => {
          if (body !== null) {
            setApplied(false);
            setConfirmation(body);
            onConfirmationChange(true);
          }
        }}
      >
        등록 확인
      </Button>
      {applied && (
        <AlertBanner variant="success" title="의심자재 보류를 등록했습니다.">
          Lot Status 판정·전이 처리에서 후속 처리하세요.
        </AlertBanner>
      )}
      {confirmation !== null && (
        <Dialog
          open
          closeOnBackdropClick={false}
          showCloseButton={false}
          title="의심자재 보류 등록 확인"
          onClose={close}
          footer={
            <>
              <Button variant="outlined" disabled={write.isSaving} onClick={close}>
                취소
              </Button>
              <Button
                loading={write.isSaving}
                disabled={stale}
                onClick={() => {
                  if (!write.isSaving && !stale) write.write(confirmation);
                }}
              >
                보류 등록
              </Button>
            </>
          }
        >
          {stale ? (
            <AlertBanner variant="error" action={<Button onClick={reload}>최신 불러오기</Button>}>
              {conflictMessage(write.error)}
            </AlertBanner>
          ) : (
            <SaveErrorBanner error={write.error} />
          )}
          <AlertBanner variant="warning" title="보류 등록 영향">
            {selected.length}개 LOT의 출고·출하·피킹을 막습니다. 해제는 W-03-02에서 별도로 처리하며
            이미 출고된 수량은 회수되지 않습니다.
          </AlertBanner>
        </Dialog>
      )}
    </section>
  );
};
