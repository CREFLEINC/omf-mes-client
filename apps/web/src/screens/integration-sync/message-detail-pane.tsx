import { Chip, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { directionName, documentNoOf, interfaceName } from './message-labels';
import { formatDateTime, toStatusView } from './message-status';
import type { MessageDetailView } from './types';
import './layout.css';

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
 * 오른쪽 상세 상자(#358) — 정보 상자 하나(검사 조회·판정과 같은 모양) → 오류 내용(있을 때만).
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

  const items: DetailItem[] = [
    { label: t.table.interfaceCode, value: interfaceName(view.interfaceCode) },
    { label: t.table.direction, value: directionName(view.directionCode) },
    { label: t.detail.retryCount, value: t.table.retryTimes(view.retryCount) },
    ...toTimeItems(view, now),
  ];

  return (
    <div className="integration-sync-detail">
      {/* 상자 제목 — 목록 상자의 「연동 이력 목록」과 짝(사용자 지시 2026-11-24). */}
      <h2 className="pane-title">{t.detail.title}</h2>
      {/*
       * 정보 상자 하나 — 검사 조회·판정과 같은 모양(첫 칸에 번호 + 상태 배지, 칸 사이 세로선 · #358).
       * 칸 순서: 문서 번호 → 연동 항목 · 송수신 구분 · 재시도 횟수 → 발생 · 전송 · 완료 일시.
       */}
      <dl className="parts-iqc-facts iqc-inbound-facts integration-sync-facts">
        <div className="parts-iqc-fact">
          <dt className="field-label">{t.table.messageKey}</dt>
          <dd className="iqc-inbound-lot-key">
            <h3 className="parts-iqc-fact-key">{documentNoOf(view)}</h3>
            <Chip variant="status" size="sm" status={status.tone}>
              {status.label}
            </Chip>
            {/* 「언제부터 처리 중」 — 처리를 시작한 시각만 낸다(「잠금이 오래됐다」 같은 판정은 하지 않는다). */}
            {(view.lockedBy ?? '') !== '' && status.note !== null && (
              <span className="parts-iqc-fact-sub">{status.note}</span>
            )}
          </dd>
        </div>
        {items.map((item) => (
          <div className="parts-iqc-fact" key={item.label}>
            <dt className="field-label">{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>

      {/* 오류 내용은 값이 있을 때만, 정보 상자 바로 아래 전체 폭으로(#358). */}
      {errorMessage !== '' && (
        <div className="integration-sync-detail-error">
          <span className="field-label">{t.table.lastErrorMessage}</span>
          <p>{errorMessage}</p>
        </div>
      )}
    </div>
  );
};
