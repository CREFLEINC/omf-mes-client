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

/** 재시도가 앞으로 잡혀 있는가 — 지난 시각이면 「예정」이 아니다. */
const isScheduled = (value: string | null | undefined, now: Date): boolean => {
  if (value === null || value === undefined) return false;
  const at = new Date(value).getTime();
  return !Number.isNaN(at) && at > now.getTime();
};

/** 정보 상자 한 줄(세 칸)을 그린다 — 검사 조회·판정과 같은 테두리 상자 · 칸 사이 세로선(#358). */
const FactRow = ({ label, items }: { label: string; items: DetailItem[] }) => (
  <dl className="parts-iqc-facts iqc-inbound-facts integration-sync-facts" aria-label={label}>
    {items.map((item) => (
      <div className="parts-iqc-fact" key={item.label}>
        <dt className="field-label">{item.label}</dt>
        <dd>{item.value}</dd>
      </div>
    ))}
  </dl>
);

/** 처리 일시 — 발생 → 전송 → 완료 순. 「다음 재시도 일시」는 재시도가 예정돼 있을 때만 덧붙인다. */
const toTimeItems = (view: MessageDetailView, now: Date): DetailItem[] => {
  const availableAt = formatDateTime(view.availableAt);
  const items: DetailItem[] = [
    { label: t.table.createdAt, value: orEmptyMark(formatDateTime(view.createdAt)) },
    { label: t.detail.sentAt, value: orEmptyMark(formatDateTime(view.sentAt)) },
    { label: t.detail.completedAt, value: orEmptyMark(formatDateTime(view.completedAt)) },
  ];
  if (availableAt !== null && isScheduled(view.availableAt, now)) {
    items.push({ label: t.detail.availableAt, value: availableAt });
  }
  return items;
};

/**
 * 오른쪽 상세 상자(#358) — 머리 줄(문서 번호 · 상태) → 오류 내용(있을 때만) → 연동 정보 → 처리 일시.
 * 재처리는 목록 줄의 [재처리]가 맡는다.
 *
 * **전송 내용(전문)은 그리지 않는다.** 거래처·수량 등이 들어 있어 누구에게까지 보일지가 정해지지 않았다.
 */
export const MessageDetailPane = ({ view, isLoading, loadError, now }: MessageDetailPaneProps) => {
  if (loadError !== null && loadError !== undefined) return <>{loadError}</>;

  if (isLoading || view === undefined) {
    return (
      <div role="status" aria-label={t.loading.messageDetail}>
        <SkeletonText lines={4} />
      </div>
    );
  }

  const status = toStatusView(view, now);
  const errorMessage = view.lastErrorMessage ?? '';

  return (
    <div className="integration-sync-detail">
      <div className="integration-sync-detail-head">
        <h2 className="pane-title">{documentNoOf(view)}</h2>
        <Chip variant="status" size="sm" status={status.tone}>
          {status.label}
        </Chip>
        {/*
         * 「언제부터 처리 중」 — 처리를 시작한 시각만 낸다(「잠금이 오래됐다」 같은 판정은 하지 않는다).
         * 자동 재시도 예정은 아래 「다음 재시도 일시」 칸이 말한다.
         */}
        {(view.lockedBy ?? '') !== '' && status.note !== null && (
          <span className="field-note">{status.note}</span>
        )}
      </div>

      {/* 오류 내용은 값이 있을 때만, 머리 줄 바로 아래 전체 폭으로(#358). */}
      {errorMessage !== '' && (
        <div className="integration-sync-detail-error">
          <span className="field-label">{t.table.lastErrorMessage}</span>
          <p>{errorMessage}</p>
        </div>
      )}

      <FactRow
        label={t.detail.linkInfo}
        items={[
          { label: t.table.interfaceCode, value: interfaceName(view.interfaceCode) },
          { label: t.table.direction, value: directionName(view.directionCode) },
          { label: t.detail.retryCount, value: t.table.retryTimes(view.retryCount) },
        ]}
      />
      <FactRow label={t.detail.processTimes} items={toTimeItems(view, now)} />
    </div>
  );
};
