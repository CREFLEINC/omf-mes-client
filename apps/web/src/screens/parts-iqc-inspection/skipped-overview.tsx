import { messages } from '@omf-mes/i18n';
import { Icon, Tabs } from '@crefle/web-ui';
import type { ReactNode } from 'react';

import { useInspectionPlan, usePlanVersion } from './queries';

const t = messages.partsIqcInspection;

export interface SkippedOverviewFact {
  key: string;
  label: string;
  value: ReactNode;
}

export interface SkippedOverviewProps {
  /** PQC · OQC 는 제목 줄(제목 + 안내)을 이 부품이 그린다. IQC 는 상세 머리줄에 이미 있어 비운다. */
  title?: string;
  itemLabel: string;
  itemParts: { code: string; name: string } | null;
  planCode: string;
  planAction: ReactNode;
  requestNo: string;
  lotNo: string;
  /** LOT 번호 뒤에 오는 검사별 칸(IQC 공급업체 · PQC 작업지시 · OQC 출하 지시서 등). */
  lotFacts: SkippedOverviewFact[];
  /** 「검사 진행」 뒤에 붙는 탭(검사 이력 등). 주면 IQC 처럼 탭으로 묶는다(사용자 지시 2026-11-23 · #353). */
  tabs?: SkippedOverviewTab[];
}

export interface SkippedOverviewTab {
  value: string;
  label: string;
  content: ReactNode;
}

/** 생략 안내 줄 — IQC · PQC · OQC 상세 공통(사용자 지시 2026-11-23 · omf-all-around#353). */
export const SkippedNotice = () => (
  <p className="iqc-inspection-action-note inspection-skip-note" data-tone="warning">
    <Icon name="warning" size={16} aria-hidden />
    {t.skipped.notice}
  </p>
);

/** 검사 기준서 관리번호 — 기준 버전 → 기준. 못 읽으면 「-」. */
export const usePlanCode = (versionId: number | null): string => {
  const version = usePlanVersion(versionId);
  const plan = useInspectionPlan(version.data?.inspectionPlanId ?? null);
  return plan.data?.inspectionPlanCode ?? '-';
};

/**
 * 생략으로 닫힌 의뢰의 읽기 전용 요약 — IQC · PQC · OQC 가 같은 틀을 쓴다(사용자 지시 2026-11-23 · #353).
 * ① 품목 · 검사 기준서(+기준 조회) · 의뢰번호 ② LOT 정보(LOT 번호 + 검사별 칸).
 */
export const SkippedOverview = (props: SkippedOverviewProps) => {
  const cards = <SkippedCards {...props} />;
  return (
    <>
      {props.title !== undefined && (
        <div className="parts-iqc-detail-head">
          <h2 className="pane-title">{props.title}</h2>
          <SkippedNotice />
        </div>
      )}
      {props.tabs === undefined ? (
        cards
      ) : (
        <Tabs
          className="parts-iqc-detail-tabs"
          size="md"
          aria-label={props.title ?? t.dialog.title}
          items={[
            { value: 'input', label: t.skipped.detailTab, content: cards },
            /* 이력 탭은 아래 참고 상자와 같은 모양(이력 줄 · 숨긴 부품 제목)으로 — 그 상자의 틀을 그대로 쓴다. */
            ...props.tabs.map((tab) => ({
              ...tab,
              content: (
                <div className="oqc-inspection-fold oqc-inspection-history-card">{tab.content}</div>
              ),
            })),
          ]}
        />
      )}
    </>
  );
};

const SkippedCards = (props: SkippedOverviewProps) => (
  <section className="parts-iqc-block parts-iqc-skipped" aria-label={t.target.heading}>
    <dl className="parts-iqc-facts">
      <div className="parts-iqc-fact">
        <dt className="field-label">{props.itemLabel}</dt>
        {/* 이름 · 코드를 한 줄에. */}
        <dd className="parts-iqc-fact-key parts-iqc-fact-inline">
          {props.itemParts?.name ?? '-'}
          {props.itemParts !== null && (
            <span className="parts-iqc-fact-sub">{props.itemParts.code}</span>
          )}
        </dd>
      </div>
      <div className="parts-iqc-fact">
        <dt className="field-label">{t.target.plan}</dt>
        <dd className="parts-iqc-plan-cell">
          {props.planCode}
          {props.planAction}
        </dd>
      </div>
      <div className="parts-iqc-fact">
        <dt className="field-label">{t.skipped.requestNo}</dt>
        <dd>{props.requestNo}</dd>
      </div>
    </dl>
    <div className="parts-iqc-lot-box" role="group" aria-label={t.lot.heading}>
      <h4>{t.lot.heading}</h4>
      <dl className="parts-iqc-facts">
        <div className="parts-iqc-fact">
          <dt className="field-label">{t.lot.lotNo}</dt>
          <dd className="parts-iqc-lot-no">{props.lotNo}</dd>
        </div>
        {props.lotFacts.map((fact) => (
          <div className="parts-iqc-fact" key={fact.key}>
            <dt className="field-label">{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  </section>
);
