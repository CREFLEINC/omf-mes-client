import { Button, Chip, Dialog, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { formatDateTime, toStatusView } from './message-status';
import type { MessageDetailView } from './types';

const t = messages.integrationSync;

export interface MessageDetailDialogProps {
  open: boolean;
  onClose: () => void;
  /** 아직 받지 못했으면 undefined. 받지 못한 상태에서 빈 값을 자료로 보이면 안 된다. */
  view: MessageDetailView | undefined;
  isLoading: boolean;
  /** 조회 실패 표시. null이 아니면 항목 대신 이것을 낸다. */
  loadError: ReactNode;
  /** 상태 보조 문구의 기준 시각. 화면이 한 번 만들어 넘긴다. */
  now: Date;
}

interface DetailItem {
  label: string;
  value: ReactNode;
}

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null): string => value ?? t.values.empty;

const toItems = (view: MessageDetailView, now: Date): DetailItem[] => {
  const status = toStatusView(view, now);

  return [
    { label: t.table.messageKey, value: view.messageKey },
    { label: t.table.interfaceCode, value: view.interfaceCode },
    { label: t.detail.direction, value: view.directionCode },
    { label: t.detail.target, value: t.detail.targetValue(view.targetTypeCode, view.targetId) },
    {
      label: t.table.status,
      value: (
        <Chip variant="status" size="sm" status={status.tone}>
          {status.label}
        </Chip>
      ),
    },
    { label: t.table.retryCount, value: String(view.retryCount) },
    { label: t.detail.createdAt, value: orEmptyMark(formatDateTime(view.createdAt)) },
    { label: t.detail.availableAt, value: orEmptyMark(formatDateTime(view.availableAt)) },
    { label: t.detail.sentAt, value: orEmptyMark(formatDateTime(view.sentAt)) },
    { label: t.detail.completedAt, value: orEmptyMark(formatDateTime(view.completedAt)) },
    {
      label: t.detail.lockedBy,
      /*
       * 잡고 있는 워커와 그 시각을 함께 낸다. 계약이 준 사실을 그대로 옮길 뿐이며
       * 「잠금이 오래됐다」 같은 판정은 하지 않는다.
       */
      value:
        (view.lockedBy ?? '') === ''
          ? t.values.empty
          : t.detail.lockedValue(view.lockedBy ?? '', orEmptyMark(formatDateTime(view.lockedAt))),
    },
    { label: t.detail.lastErrorMessage, value: orEmptyMark(view.lastErrorMessage ?? null) },
  ];
};

/**
 * 상세 — 목록에 없는 항목을 보이는 자리.
 *
 * **전송 내용(전문)은 구획만 두고 값을 그리지 않는다.** 서버는 전문을 언제나 실어 보내지만
 * 거래처·수량 등이 들어 있어 누구에게까지 보일지가 정해지지 않았다. 화면은 응답에서
 * 그 값을 꺼내지도 않는다 — 꺼내 두면 언젠가 그려진다.
 *
 * 바깥 어둠 클릭으로 닫힌다. 읽기만 하는 창이라 잘못 닫혀도 잃을 것이 없다.
 */
export const MessageDetailDialog = ({
  open,
  onClose,
  view,
  isLoading,
  loadError,
  now,
}: MessageDetailDialogProps) => {
  const payloadReasonId = useId();

  const body = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading || view === undefined) {
      return (
        <div role="status" aria-label={t.loading.messageDetail}>
          <SkeletonText lines={4} />
        </div>
      );
    }

    return (
      <>
        <div className="form-grid">
          {toItems(view, now).map((item) => (
            <div className="field-cell" key={item.label}>
              <span className="field-label">{item.label}</span>
              <span>{item.value}</span>
            </div>
          ))}
        </div>

        {/*
         * 배치 규범 4 — 잠긴 것은 감추지 않고 사유를 항상 보이는 DOM 텍스트로 낸다.
         * 비활성 컨트롤은 포커스를 받지 못해 툴팁만으로는 보조기술 사용자가 닿을 수 없다.
         */}
        <div className="field-cell">
          <span className="field-label">{t.detail.payload}</span>
          <Button variant="outlined" disabled aria-describedby={payloadReasonId}>
            {t.detail.payloadAction}
          </Button>
          <span id={payloadReasonId} className="field-note">
            {t.detail.payloadLocked}
          </span>
        </div>
      </>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title={t.detail.title} size="lg">
      {body()}
    </Dialog>
  );
};
