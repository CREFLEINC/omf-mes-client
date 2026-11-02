import { AlertBanner, Button, Chip, Dialog, SkeletonText, Tabs } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { lookupDisplayLabelWithInactive } from '../../patterns/lookup-display';
import {
  useInspectionRequestDetail,
  useInspectionResultDetail,
  useMeasurementSummary,
} from './queries';
import { useInspectionPlanVersion, usePlanItemCount } from './history-queries';
import { useSamplingMethodLookup } from './lookups';
import {
  DefectReasonSection,
  LotHistorySection,
  RejectionSection,
} from './result-history-sections';
import type { ResultLabels } from './result-overview';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { useItemNames } from './item-names';
import { MeasurementSection } from './measurement-section';
import { useUomCodeOf } from './uoms';

const t = messages.inspectionResultInsights.detail;
const tm = messages.inspectionResultInsights.measurement;
const EMPTY = t.unknown;
/* 기준 미등록은 「없는 값」이다 — 「모르는 값」(EMPTY)과 같은 모양으로 그리지 않는다(공유계약 G-9 · client#589). */
const NO_PLAN_VERSION = t.noPlanVersion;
const dateTime = (value: string): string => {
  return formatPlantDateTime(value) ?? value;
};
const percent = (value: number): string =>
  new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value);

interface ResultDetailDialogProps {
  inspectionResultId: number;
  labels: ResultLabels;
  onClose: () => void;
}

export const ResultDetailDialog = ({
  inspectionResultId,
  labels,
  onClose,
}: ResultDetailDialogProps) => {
  const detail = useInspectionResultDetail(inspectionResultId);
  const itemNames = useItemNames([detail.data?.itemId]);
  const itemName =
    detail.data?.itemId === undefined ? undefined : itemNames.get(detail.data.itemId);
  /* 수량 뒤 단위 — 검사 결과가 싣는 단위(사용자 2026-11-02). 못 풀면 수량만. */
  const uomCode = useUomCodeOf()(detail.data?.uomId);
  const request = useInspectionRequestDetail(detail.data?.inspectionRequestId ?? null);
  const summary = useMeasurementSummary(inspectionResultId);
  /* 그 회차 검사기준의 샘플링 방식(omf-all-around#85) — 기준이 없는 의뢰는 「기준 없음」이다. */
  const planVersionId = request.data?.inspectionPlanVersionId ?? null;
  const plan = useInspectionPlanVersion(planVersionId);
  const planItemCount = usePlanItemCount(planVersionId);
  /* 측정 요약이 비었을 때 — 기준에 측정 항목이 있으면 누락(안내), 없거나 기준이 없으면 측정 대상이 아니다(영역을 숨긴다). */
  const summaryEmpty = summary.data !== undefined && summary.data.items.length === 0;
  const measurementMissing =
    summaryEmpty && planVersionId !== null && (planItemCount.data ?? 0) > 0;
  /* 측정 탭 — 측정값이 있거나(오류 · 불러오는 중 포함) 기준에 측정 항목이 있는데 비었을 때만 둔다. */
  const showMeasurementTab = !summaryEmpty || measurementMissing;
  const [extraTab, setExtraTab] = useState<'measurement' | 'history'>('measurement');
  const samplingMethods = useSamplingMethodLookup();
  const samplingMethod =
    request.data === undefined
      ? EMPTY
      : planVersionId === null
        ? NO_PLAN_VERSION
        : plan.data === undefined
          ? EMPTY
          : lookupDisplayLabelWithInactive(samplingMethods, plan.data.samplingMethodCode);
  const lotId = detail.data?.lotId ?? null;
  const planVersion =
    request.data === undefined
      ? EMPTY
      : (request.data.inspectionPlanVersionId ?? null) === null
        ? NO_PLAN_VERSION
        : String(request.data.inspectionPlanVersionId);
  const retry = (label: string, refetch: () => Promise<unknown>) => (
    <Button
      aria-label={t.retryOf(label)}
      size="sm"
      variant="outlined"
      onClick={() => void refetch()}
    >
      {t.retry}
    </Button>
  );
  const judgmentCode = detail.data?.overallJudgmentCode;
  const judgmentTone =
    judgmentCode === 'REJECTED' ? 'error' : judgmentCode === 'ACCEPTED' ? 'success' : 'warning';
  /* 추가 정보 — 기준 버전 · LOT · 공정 · 검사자는 접어 둔 묶음 안에 둔다(사용자 시안 2026-11-02). */
  const extraFields =
    detail.data === undefined
      ? []
      : [
          /* LOT 번호 → 검사 기준 버전 · 공정 · 검사자 차례(사용자 2026-11-02). LOT 번호는 첫 줄 전체 폭. */
          [t.fields.lotNo, detail.data.lotNo ?? EMPTY],
          [t.fields.planVersion, planVersion],
          [t.fields.process, detail.data.processName ?? EMPTY],
          [t.fields.inspector, detail.data.inspectorName ?? EMPTY],
        ];
  /* 합격 · 불합격 · 보류의 몫(검사 수량 기준 %) — 검사 수량이 0 이면 막대를 두지 않는다. */
  const ratio =
    detail.data === undefined || detail.data.inspectedQty <= 0
      ? null
      : {
          accepted: (detail.data.acceptedQty / detail.data.inspectedQty) * 100,
          rejected: (detail.data.rejectedQty / detail.data.inspectedQty) * 100,
          held: (detail.data.heldQty / detail.data.inspectedQty) * 100,
        };
  const qtyCells =
    detail.data === undefined
      ? []
      : ([
          [t.qty.inspected, detail.data.inspectedQty, undefined],
          [t.qty.accepted, detail.data.acceptedQty, 'success'],
          [t.qty.rejected, detail.data.rejectedQty, 'error'],
          [t.qty.held, detail.data.heldQty, undefined],
        ] as const);

  return (
    /*
     * 시안 짜임(사용자 2026-11-02) — 오른쪽 위 닫기(X) 없이 꼬리말 [닫기]. 머리에 의뢰번호 · 품목 · 종합 판정,
     * 수량 카드, 불량 내역, 부적합 처리를 펴 두고 나머지(기준 버전 · LOT · 공정 · 검사자 · 측정 결과 · 처리 이력 탭)는 접어 둔다.
     */
    <Dialog
      open
      size="lg"
      title={t.title}
      showCloseButton={false}
      onClose={onClose}
      /* 측정 결과는 「검사 상세 및 이력」 안의 표로 본다 — 따로 여는 단추 · 창은 두지 않는다(사용자 2026-11-02). */
      footer={
        <Button variant="outlined" onClick={onClose}>
          {t.close}
        </Button>
      }
    >
      {detail.isPending && <SkeletonText lines={3} />}
      {detail.isError && (
        <AlertBanner
          variant="error"
          title={t.failed}
          action={retry(t.failedRetryTarget, detail.refetch)}
        />
      )}
      {!detail.isError && detail.data !== undefined && (
        <>
          {/*
           * 머리 — 의뢰번호 · 품목 코드 · 품목 이름을 이름표가 붙은 칸으로(검사 기준 정보의 버전 요약 줄과 같은 모양 · 사용자 2026-11-02).
           * 품목 이름을 못 받으면 조회 조건 목록의 이름으로, 코드는 「미확인」.
           */}
          <dl className="inspection-standard-facts-line result-detail-facts">
            {[
              [t.fields.inspectionRequestNo, detail.data.inspectionRequestNo ?? EMPTY],
              [t.fields.itemCode, itemName?.code ?? EMPTY],
              [
                t.fields.itemName,
                itemName?.name ?? lookupDisplayLabelWithInactive(labels.item, detail.data.itemId),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="field-label">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {/*
           * 검사 결과 카드(사용자 시안 2026-11-02 · 아이콘 없이) — 제목 · 종합 판정 표식, 네 수량, 합격 · 불합격 비율 막대,
           * 검사일시 · 검사 방식.
           */}
          <section className="result-detail-card" aria-label={t.fieldsLabel}>
            <div className="result-detail-section-head">
              <h3>{t.resultTitle}</h3>
              <Chip variant="status" status={judgmentTone} size="sm">
                {lookupDisplayLabelWithInactive(labels.judgment, detail.data.overallJudgmentCode)}
              </Chip>
            </div>
            <dl className="result-detail-qty">
              {qtyCells.map(([label, value, tone]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd data-tone={tone}>
                    {new Intl.NumberFormat('ko-KR').format(value)}
                    {uomCode !== null && <span className="result-detail-unit">{uomCode}</span>}
                  </dd>
                </div>
              ))}
            </dl>
            {ratio !== null && (
              <div className="result-detail-ratio">
                <div className="result-detail-ratio-bar">
                  {ratio.accepted > 0 && (
                    <span data-tone="success" style={{ flexGrow: ratio.accepted }}>
                      {percent(ratio.accepted)}%
                    </span>
                  )}
                  {ratio.rejected > 0 && (
                    <span data-tone="error" style={{ flexGrow: ratio.rejected }}>
                      {percent(ratio.rejected)}%
                    </span>
                  )}
                  {ratio.held > 0 && (
                    <span data-tone="warning" style={{ flexGrow: ratio.held }}>
                      {percent(ratio.held)}%
                    </span>
                  )}
                </div>
              </div>
            )}
            {/* 검사일시 · 검사 방식은 한 줄 — 카드 높이를 줄인다(사용자 2026-11-02). */}
            <dl className="result-detail-meta">
              <div>
                <dt>{t.inspectedAtLabel}</dt>
                <dd>{dateTime(detail.data.inspectedAt)}</dd>
              </div>
              <div>
                <dt>{t.method}</dt>
                <dd>{t.methodValue(samplingMethod, detail.data.inspectionRound)}</dd>
              </div>
            </dl>
          </section>
        </>
      )}
      <DefectReasonSection inspectionResultId={inspectionResultId} uomCode={uomCode} />
      {detail.data !== undefined && <RejectionSection lotId={lotId} uomCode={uomCode} />}
      {detail.data !== undefined && (
        <details className="result-detail-extra result-detail-card">
          <summary>{t.extraTitle}</summary>
          {/* 기준 버전 · LOT · 공정 · 검사자 — 줄 맞춘 칸, 긴 LOT 번호는 칸 안에서 줄을 바꾼다(사용자 2026-11-02). */}
          <dl className="inspection-standard-facts-line result-detail-extra-facts">
            {extraFields.map(([label, value]) => (
              <div key={label} data-wide={label === t.fields.lotNo ? 'true' : undefined}>
                <dt className="field-label">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {/*
           * 항목별 측정 결과 · 처리 이력은 탭으로 나눈다(사용자 시안 2026-11-02). 측정 대상이 아니면(기준에 측정 항목이 없거나
           * 기준이 없으면) 측정 탭을 두지 않는다. 기준에 측정 항목이 있는데 값이 없으면 「측정값 없음」 한 줄.
           */}
          <Tabs
            aria-label={t.extraTabs}
            value={showMeasurementTab ? extraTab : 'history'}
            onChange={(value) => setExtraTab(value as 'measurement' | 'history')}
            items={[
              ...(showMeasurementTab
                ? [
                    {
                      value: 'measurement',
                      label: tm.sectionTitle,
                      content: (
                        <>
                          {summary.isPending && <SkeletonText lines={3} />}
                          {summary.isError && (
                            <AlertBanner
                              variant="error"
                              title={t.summaryFailed}
                              action={retry(t.summaryRetryTarget, summary.refetch)}
                            />
                          )}
                          {!summary.isError &&
                            summary.data !== undefined &&
                            (summary.data.items.length === 0 ? (
                              <p className="field-note">{t.summaryMissing}</p>
                            ) : (
                              <MeasurementSection
                                inspectionResultId={inspectionResultId}
                                itemNames={
                                  new Map(
                                    summary.data.items.map((item) => [
                                      item.inspectionItemSpecId,
                                      item.itemName,
                                    ]),
                                  )
                                }
                                judgmentSource={labels.judgment}
                              />
                            ))}
                        </>
                      ),
                    },
                  ]
                : []),
              {
                value: 'history',
                label: t.lotHistoryTitle,
                content: <LotHistorySection lotId={lotId} />,
              },
            ]}
          />
        </details>
      )}
    </Dialog>
  );
};
