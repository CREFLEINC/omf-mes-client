import { Chip, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { directionName, documentNoOf, interfaceName } from './message-labels';
import { formatDateTime, toStatusView } from './message-status';
import type { MessageDetailView } from './types';

const t = messages.integrationSync;

export interface MessageDetailPaneProps {
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

  const lockedAt = formatDateTime(view.lockedAt);

  /*
   * 코드 대신 업무 이름(사용자 지시 2026-10-27). 메시지 키 · 대상(ERP 수신 표 이름 · 순번) · 처리하는 워커 이름 같은
   * 시스템 값은 보이지 않는다 — 번호와 항목이 그 건을 부른다.
   */
  return [
    { label: t.table.direction, value: directionName(view.directionCode) },
    { label: t.table.interfaceCode, value: interfaceName(view.interfaceCode) },
    { label: t.table.messageKey, value: documentNoOf(view) },
    {
      label: t.table.status,
      value: (
        <Chip variant="status" size="sm" status={status.tone}>
          {status.label}
        </Chip>
      ),
    },
    { label: t.detail.retryCount, value: String(view.retryCount) },
    { label: t.table.createdAt, value: orEmptyMark(formatDateTime(view.createdAt)) },
    { label: t.detail.availableAt, value: orEmptyMark(formatDateTime(view.availableAt)) },
    { label: t.detail.sentAt, value: orEmptyMark(formatDateTime(view.sentAt)) },
    { label: t.detail.completedAt, value: orEmptyMark(formatDateTime(view.completedAt)) },
    {
      label: t.detail.lockedBy,
      /* 처리를 시작한 시각만 낸다 — 「잠금이 오래됐다」 같은 판정은 하지 않는다. */
      value:
        (view.lockedBy ?? '') === ''
          ? t.values.empty
          : lockedAt === null
            ? t.status.processingNoTime
            : t.status.processing(lockedAt),
    },
    { label: t.table.lastErrorMessage, value: orEmptyMark(view.lastErrorMessage ?? null) },
  ];
};

/**
 * 상세 — 목록에 없는 항목을 보이는 자리. 목록 오른쪽 구획이다(입고 관리와 같은 짜임 · 사용자 지시 2026-10-27).
 * 옛 판은 창(Dialog)으로 떠 목록을 가렸다.
 *
 * **전송 내용(전문)은 그리지 않는다.** 서버는 전문을 언제나 실어 보내지만 거래처·수량 등이 들어 있어 누구에게까지
 * 보일지가 정해지지 않았다. 화면은 응답에서 그 값을 꺼내지도 않는다 — 꺼내 두면 언젠가 그려진다. 늘 잠긴 「전송 내용
 * 보기」 단추와 그 사유 안내는 걷어 냈다(사용자 지시 2026-10-27 「불필요한 안내문 제거」).
 */
export const MessageDetailPane = ({ view, isLoading, loadError, now }: MessageDetailPaneProps) => {
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
      <div className="form-grid">
        {toItems(view, now).map((item) => (
          <div className="field-cell" key={item.label}>
            <span className="field-label">{item.label}</span>
            <span>{item.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <h2 className="pane-title">{t.detail.title}</h2>
      {body()}
    </>
  );
};
