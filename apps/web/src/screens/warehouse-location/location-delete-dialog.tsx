import { AlertBanner, Button, Dialog, Icon, useToast } from '@crefle/web-ui';
import { createIdempotencyKey } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';
import { ConfirmTarget } from './location-identity';
import { locationKeys } from './queries';
import type { Location } from './types';

const t = messages.warehouseLocation.deleteLocation;

export interface LocationDeleteDialogProps {
  /** 지울 위치. null 이면 닫힌다. */
  target: Location | null;
  /** 함께 지워질 위치 수 — 그 위치와 밑의 위치 전부. */
  count: number;
  onClose: () => void;
  /** 지운 뒤 — 화면이 열린 수정 창을 닫는다. */
  onDeleted: () => void;
}

/** 실패 사유 한 줄 — 서버 문구가 있으면 그것을 쓴다(쓰인 위치는 400 STATE_LOCKED). */
const failureReason = (error: unknown): string => {
  const apiError = toApiError(error);
  switch (apiError.kind) {
    case 'validation':
    case 'stateLocked':
      return apiError.errors[0]?.message ?? messages.httpError.title;
    case 'conflict':
      return apiError.message;
    case 'http':
      return apiError.message ?? messages.httpError.title;
    case 'network':
      return messages.httpError.offline;
  }
};

/**
 * 위치 삭제 확인(서버 위치 ③b) — 그 위치와 밑의 위치를 함께 지운다. 하나라도 어디서 쓰였으면 서버가 거절하고
 * 아무것도 지우지 않는다 — 그때는 사용 중지를 쓴다. 스크림 클릭으로 닫히지 않는다.
 */
export const LocationDeleteDialog = ({
  target,
  count,
  onClose,
  onDeleted,
}: LocationDeleteDialogProps) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const close = () => {
    if (saving) return;
    setFailure(null);
    onClose();
  };

  const confirm = async () => {
    if (target === null) return;
    setSaving(true);
    setFailure(null);
    try {
      await runRequest(() =>
        client.DELETE('/mdm/locations/{locationId}', {
          params: {
            path: { locationId: target.locationId },
            header: { 'Idempotency-Key': createIdempotencyKey() },
          },
        }),
      );
      await queryClient.invalidateQueries({ queryKey: locationKeys.all });
      toast.show({ variant: 'success', description: t.deleted });
      onDeleted();
      onClose();
    } catch (error) {
      setFailure(failureReason(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={target !== null}
      onClose={close}
      size="sm"
      title={t.title}
      closeOnBackdropClick={false}
      footer={
        <>
          <Button variant="outlined" disabled={saving} onClick={close}>
            {messages.common.cancel}
          </Button>
          <Button
            className="location-danger-filled"
            leadingIcon={<Icon name="delete" size={18} />}
            loading={saving}
            disabled={saving}
            onClick={() => void confirm()}
          >
            {t.confirm}
          </Button>
        </>
      }
    >
      {failure !== null && <AlertBanner variant="error" title={failure} />}
      {target !== null && (
        <ConfirmTarget tone="danger" icon="warning" target={target} line={t.count(count)} />
      )}
    </Dialog>
  );
};
