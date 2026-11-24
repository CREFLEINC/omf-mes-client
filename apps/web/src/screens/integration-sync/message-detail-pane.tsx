import { Button, Chip, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { directionName, documentNoOf, interfaceName, messageTitleOf } from './message-labels';
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
  /** 이 건을 다시 보낸다(확인 창은 화면이 연다). */
  onRetry: (view: MessageDetailView) => void;
  /** 이 건의 재처리를 보내는 중. */
  isRetrying: boolean;
}

interface DetailItem {
  label: string;
  value: ReactNode;
}

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null): string => value ?? t.values.empty;

/** 재시도가 앞으로 잡혀 있는가 — 지난 시각이면 「예정」이 아니다. */
const isScheduled = (value: string | null | undefined, now: Date): boolean => {
  if (value === null || value === undefined) return false;
  const at = new Date(value).getTime();
  return !Number.isNaN(at) && at > now.getTime();
};

/**
 * 아래 두 열 칸(#358) — 발생일시 · 전송 일시 · 완료 일시 · 재시도 횟수.
 * 「다음 재시도 일시」는 재시도가 예정돼 있을 때만 덧붙인다. 처리 중이면 머리 줄 배지 옆에 「언제부터 처리 중」이 선다.
 */
const toItems = (view: MessageDetailView, now: Date): DetailItem[] => {
  const availableAt = formatDateTime(view.availableAt);
  const items: DetailItem[] = [
    { label: t.table.createdAt, value: orEmptyMark(formatDateTime(view.createdAt)) },
    { label: t.detail.sentAt, value: orEmptyMark(formatDateTime(view.sentAt)) },
    { label: t.detail.completedAt, value: orEmptyMark(formatDateTime(view.completedAt)) },
    { label: t.detail.retryCount, value: String(view.retryCount) },
  ];
  if (availableAt !== null && isScheduled(view.availableAt, now)) {
    items.push({ label: t.detail.availableAt, value: availableAt });
  }
  return items;
};

/**
 * 상세 — 목록 오른쪽 구획(사용자 지시 2026-10-27). 짜임(#358):
 * 머리 줄 「문서 번호 · 상태 배지 … [재처리]」 → 「송수신 · 연동 항목」 → 오류 내용(구획 전체 폭) → 일시 · 횟수 두 열.
 *
 * **재처리는 상태 코드로도 `lockedBy`로도 막지 않는다.** 실서버의 상태 어휘를 화면이 모르므로 「실패일 때만」으로 막으면
 * 어휘가 다른 서버에서 버튼이 전부 죽는다. 판정은 서버 몫이다(400 NOT_RETRYABLE · 409 workerLease).
 *
 * **전송 내용(전문)은 그리지 않는다.** 거래처·수량 등이 들어 있어 누구에게까지 보일지가 정해지지 않았다.
 */
export const MessageDetailPane = ({
  view,
  isLoading,
  loadError,
  now,
  onRetry,
  isRetrying,
}: MessageDetailPaneProps) => {
  if (loadError !== null && loadError !== undefined) return <>{loadError}</>;

  if (isLoading || view === undefined) {
    return (
      <div role="status" aria-label={t.loading.messageDetail}>
        <SkeletonText lines={4} />
      </div>
    );
  }

  const status = toStatusView(view, now);

  return (
    <div className="integration-sync-detail">
      <div className="integration-sync-detail-head">
        <h2 className="pane-title">{documentNoOf(view)}</h2>
        <Chip variant="status" size="sm" status={status.tone}>
          {status.label}
        </Chip>
        <Button
          variant="outlined"
          size="sm"
          className="integration-sync-detail-retry"
          loading={isRetrying}
          aria-label={t.actions.retryRow(messageTitleOf(view))}
          onClick={() => {
            onRetry(view);
          }}
        >
          {t.actions.retry}
        </Button>
      </div>
      <p className="integration-sync-detail-sub">
        {directionName(view.directionCode)} · {interfaceName(view.interfaceCode)}
        {/*
         * 「언제부터 처리 중」 — 목록은 배지만 두고 이 줄은 여기서 본다(#358). 처리를 시작한 시각만 낸다(「잠금이 오래됐다」
         * 같은 판정은 하지 않는다). 자동 재시도 예정은 아래 「다음 재시도 일시」 칸이 말한다.
         */}
        {(view.lockedBy ?? '') !== '' && status.note !== null && (
          <span className="field-note integration-sync-detail-note">{status.note}</span>
        )}
      </p>

      <div className="field-cell integration-sync-detail-error">
        <span className="field-label">{t.table.lastErrorMessage}</span>
        <span>{orEmptyMark(view.lastErrorMessage ?? null)}</span>
      </div>

      <div className="integration-sync-detail-grid">
        {toItems(view, now).map((item) => (
          <div className="field-cell" key={item.label}>
            <span className="field-label">{item.label}</span>
            <span>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
