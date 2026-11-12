import {
  AlertBanner,
  Button,
  Chip,
  DatePicker,
  Dialog,
  IconButton,
  Icon,
  Radio,
  RadioGroup,
  Tabs,
  TextArea,
  TextField,
} from '@crefle/web-ui';
import {
  isInboundLotInspection,
  type components,
  type FourMChangeForward,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router';

import { InspectionDrawingImages } from '../../patterns/inspection-drawings';
import { InspectionGuideNotice } from '../../patterns/inspection-guide';
import { SaveErrorBanner } from '../../patterns/master';
import { Select } from '../../patterns/select';
import { FieldLabel } from '../iqc-inspection/field-label';
import { AttachmentPanel, useAttachments } from '../inspection-documents/attachment-panel';
import {
  formatPlantDateTime,
  plantNowLocal,
  PLANT_UTC_OFFSET,
  toPlantDateTimeParts,
} from '../../patterns/plant-time';
import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
import { TimeField, type TimeFieldLabels } from '../../patterns/time-field';
import {
  useDefectCodes,
  useInspectionItemSpecs,
  useInspectionRequestDetail,
  useInspectionRounds,
  useRejectedLotFollowUp,
  useMeasurements,
} from '../iqc-inspection/queries';
import { DiscardDialog } from '../routing/leave-guard';
import type { LevelDialogValues } from '../inspection-level/level-dialog';
import { useLevelWrite } from '../inspection-level/level-write';
import {
  FourMChange,
  fourMBodyOf,
  fourMDraftOf,
  isFourMIncomplete,
  isSameFourM,
  type FourMChangeDraft,
} from '../iqc-inspection/four-m-change';
import {
  ItemLevel,
  ItemLevelStep,
  readPendingLevel,
  storePendingLevel,
} from '../iqc-inspection/item-level';
import { RejectedLotGuide } from '../iqc-inspection/rejected-lot-guide';
import { useItemNames, useLotNumbers } from '../iqc-inspection/reference-lookup';
import { sampleQtyOf } from '../iqc-inspection/sample-qty';
import { latestRound } from '../iqc-inspection/types';
import { WorkerConnectDialog } from '../iqc-inspection/worker-connect-dialog';
import { InspectionHistory } from './history';
import { InboundDetail, type InboundDetailProps } from './inbound-detail';
import { splitRuleErrors } from './lot-judgment';
import { useInboundInspection } from './inbound-queries';
import { PlanDialog } from './plan-dialog';
import { useUomLookup, withUom } from '../iqc-inspection/uom-lookup';
import {
  countOf,
  emptyForm,
  historyReducer,
  numberOf,
  sameForm,
  startHistory,
  withValue,
  type PartsIqcForm,
} from './form-state';
import {
  acceptanceOf,
  judgeDimension,
  kindOf,
  rejectedQtyOf,
  serverExpectedOf,
  suggestedJudgmentOf,
  type ItemJudgment,
} from './judgment';
import { isManualDimension, ItemNameCell, MeasurementTable, rowStateOf } from './measurement-table';
import {
  partsIqcKeys,
  useDrawings,
  useInboundInfo,
  useInspectionPlan,
  usePlanVersion,
  useSubmitInspection,
  type SubmitVariables,
} from './queries';

type ItemSpec = components['schemas']['InspectionItemSpec'];
type DefectCode = {
  defectCodeId: number;
  defectCode: string;
  defectName: string;
  parentDefectCodeId?: number | null;
  isActive?: boolean;
};

const t = messages.partsIqcInspection;
const tResult = messages.iqcInspection.result;
/** 검사 기준 화면 — 기준이 없을 때 「검사기준 설정」이 이 주소로 그 화면의 「기준 추가」 창을 유형 · 품목을 채워 연다(`new` · `newItem`). */
const STANDARD_PATH = '/master-data/inspection-standard';

const TIME_LABELS: TimeFieldLabels = {
  field: t.lot.inspectedTime,
  hourList: t.lot.inspectedHour,
  minuteList: t.lot.inspectedMinute,
  hourHead: t.lot.hourHead,
  minuteHead: t.lot.minuteHead,
  placeholder: t.lot.timePlaceholder,
};

const toOffset = (local: string): string => `${local}:00${PLANT_UTC_OFFSET}`;
/** 비고 글자 수 — 사용자 시안(0/200). 서버 칸에는 길이 제한이 없다. */
const REMARKS_MAX = 200;

/** 고칠 결과를 양식에 다시 채우는 값 — 임시 저장 회차 · 새 흐름 결과 드로어가 같은 모양을 쓴다. */
export type InspectionFormDraft = NonNullable<FormProps['draft']>;

export interface InspectionDetailProps {
  /**
   * 005 새 흐름 상세의 머리 단추 · 아래 줄 — [자재 관리 LOT 분리](C3) · [판정 확정] · [확정 취소](C4). 두 변형이 같은 것을 준다.
   */
  inboundHead?: Pick<InboundDetailProps, 'headActions' | 'headNote'>;
  inspectionRequestId: number;
  onSubmitted: () => void;
  /** 입력이 있는가 — 목록에서 다른 의뢰를 고르거나 닫을 때 화면이 한 번 묻는다. */
  onDirtyChange: (dirty: boolean) => void;
  /**
   * OA 공장 화면(#247 · 사용자 지시 2026-11-10 — 부품 화면과 같은 상세) — 기본 정보에 「검사 수준」, 비고 아래 「4M 변경 정보」를 더한다.
   */
  oa?: boolean;
}

/**
 * 부품 공장 IQC 수입검사 상세(omf-all-around#211 · 레퍼런스 화면) — 로트 → 치수 측정 → 외관·XRF → 기타 검사 항목 → 판정 → 기준서 도면 → 비고.
 * [제출]은 측정값과 함께 임시 저장하고, XRF 성적서를 올린 뒤 확정한다(`useSubmitInspection`).
 */
export const InspectionDetail = ({
  inspectionRequestId,
  onSubmitted,
  onDirtyChange,
  oa = false,
  inboundHead,
}: InspectionDetailProps) => {
  const { session } = useSession();
  const navigate = useNavigate();
  const detail = useInspectionRequestDetail(inspectionRequestId);
  const rounds = useInspectionRounds(inspectionRequestId);
  const versionId = detail.data?.inspectionPlanVersionId ?? null;
  const version = usePlanVersion(versionId);
  const specs = useInspectionItemSpecs(versionId);
  const plan = useInspectionPlan(version.data?.inspectionPlanId ?? null);
  const drawings = useDrawings(versionId);
  const inbound = useInboundInfo(inspectionRequestId);
  const defectCodes = useDefectCodes(true);
  const items = useItemNames([detail.data?.itemId]);
  const lots = useLotNumbers([detail.data?.lotId]);
  const uoms = useUomLookup();
  /* 005 새 흐름(대상 = 입하 LOT) — 결과 목록 · 드로어 상세로 연다. 이전 데이터(대상 LOT)는 아래 지금 경로 그대로(R18-1). */
  const inboundFlow = detail.data !== undefined && isInboundLotInspection(detail.data);
  const inboundInspection = useInboundInspection(inboundFlow ? inspectionRequestId : null);

  const round = latestRound(rounds.data ?? []);
  const draftRound = round !== null && round.statusCode === 'DRAFT' ? round : null;
  /* 검사 진행 탭에 고친 것이 있는가 — 다른 탭으로 옮기면 입력이 사라지므로 먼저 묻는다(#247 · 사용자 지시 2026-11-10). */
  const [formDirty, setFormDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const changeDirty = useCallback(
    (next: boolean) => {
      setFormDirty(next);
      onDirtyChange(next);
    },
    [onDirtyChange],
  );
  const measurements = useMeasurements(draftRound?.inspectionResultId ?? null);
  /*
   * OA — 4M 변경 정보에서 골라 둔 검사 수준. 판정을 확정해야 저장한다(#247 · 사용자 지시 2026-11-09). 의뢰별로 이 브라우저에 둔다.
   */
  const [pendingLevel, setPendingLevel] = useState<LevelDialogValues | null>(null);
  useEffect(() => {
    setPendingLevel(oa ? readPendingLevel(inspectionRequestId) : null);
  }, [oa, inspectionRequestId]);
  const levelWrite = useLevelWrite(() => undefined);
  const submitted = () => {
    if (pendingLevel !== null) {
      levelWrite.write({ row: null, values: pendingLevel });
      storePendingLevel(inspectionRequestId, null);
      setPendingLevel(null);
    }
    onSubmitted();
  };

  /*
   * 재검사(OA 화면과 같다 · 사용자 지시 2026-11-09) — 확정된 회차를 두고 새 회차를 쌓는다. 회차가 바뀌면(제출됨) 저절로 풀린다.
   * 불량 LOT 은 처분으로, 검사 대기가 아닌 LOT 은 사유로 잇는다 — 서버가 받지 않는 길을 열지 않는다.
   */
  const latestRoundId = round?.inspectionResultId ?? null;
  const [reinspectingFrom, setReinspectingFrom] = useState<number | null>(null);
  const isReinspecting = reinspectingFrom !== null && reinspectingFrom === latestRoundId;
  const confirmed = round !== null && round.statusCode === 'CONFIRMED' && !isReinspecting;
  const followUp = useRejectedLotFollowUp(detail.data?.lotId ?? null, confirmed);
  /* 첨부 파일 탭 건수 — OA 화면과 같은 LOT 첨부(#247). LOT 이 없는 의뢰는 부르지 않는다. */
  const lotId = detail.data?.lotId ?? null;
  const attachments = useAttachments('LOT', lotId ?? 0, lotId !== null);

  const loading =
    detail.isPending ||
    rounds.isPending ||
    (versionId !== null && (version.isPending || specs.isPending));
  const failed = detail.isError || rounds.isError || version.isError || specs.isError;

  const body = () => {
    if (loading) return <p className="field-note">{t.dialog.loading}</p>;
    if (failed || detail.data === undefined)
      return <AlertBanner variant="error">{t.dialog.loadFailed}</AlertBanner>;
    /* 생략으로 닫힌 의뢰는 입력할 것이 없다 — 받은 정보만 읽기 전용으로 보인다(사용자 지시 2026-11-02 · #225). */
    if (detail.data.statusCode === 'SKIPPED') {
      return (
        <SkippedSummary
          skipBasisCode={detail.data.skipBasisCode ?? null}
          itemParts={items.partsOf(detail.data.itemId)}
          planLabel={plan.data?.inspectionPlanCode ?? '-'}
          planName={plan.data?.inspectionPlanName ?? '-'}
          lotNo={lots.labelOf(detail.data.lotId)}
          qtyLabel={withUom(String(detail.data.targetQty), uoms.codeOf(detail.data.uomId))}
          inbound={inbound.data}
        />
      );
    }
    if (confirmed) {
      return (
        <AlertBanner variant="info">
          {t.dialog.confirmed(
            t.judgment[round?.overallJudgmentCode ?? ''] ?? round?.overallJudgmentCode,
          )}
        </AlertBanner>
      );
    }
    if (versionId === null || version.data === undefined || specs.data === undefined) {
      /* 검사 기준 화면에서 이 품목의 IQC 기준 등록 창을 바로 연다(#225) — 그 화면 권한이 없으면 단추를 두지 않는다. */
      const setPlan = toWebAccess(session?.permissions).allows(STANDARD_PATH) ? (
        <Button
          variant="outlined"
          size="sm"
          onClick={() => navigate(`${STANDARD_PATH}?new=IQC&newItem=${String(detail.data.itemId)}`)}
        >
          {t.dialog.setPlan}
        </Button>
      ) : undefined;
      /* 단추는 문구와 같은 줄에 둔다 — 띠의 action 자리는 문구 아래 줄로 내려간다(#225). */
      return (
        <AlertBanner variant="warning">
          <span className="parts-iqc-no-plan">
            <span>{t.dialog.noPlan}</span>
            {setPlan}
          </span>
        </AlertBanner>
      );
    }
    return (
      <InspectionForm
        key={`${String(inspectionRequestId)}-${String(isReinspecting)}-${String(draftRound?.inspectionResultId ?? 0)}-${measurements.isSuccess ? 'm' : '-'}`}
        request={detail.data}
        version={version.data}
        specs={[...specs.data].sort((a, b) => a.sequenceNo - b.sequenceNo)}
        planLabel={plan.data === undefined ? '-' : plan.data.inspectionPlanCode}
        planName={plan.data?.inspectionPlanName ?? '-'}
        itemParts={items.partsOf(detail.data.itemId)}
        lotNo={lots.labelOf(detail.data.lotId)}
        qtyLabel={withUom(String(detail.data.targetQty), uoms.codeOf(detail.data.uomId))}
        inbound={inbound.data}
        drawings={drawings.data ?? []}
        inspector={session?.worker ?? null}
        appUserId={session?.userId ?? null}
        previousResultId={isReinspecting ? (round?.inspectionResultId ?? null) : null}
        draft={
          draftRound === null
            ? null
            : {
                inspectionResultId: draftRound.inspectionResultId,
                versionNo: draftRound.versionNo,
                inspectedQty: draftRound.inspectedQty,
                inspectedAt: draftRound.inspectedAt,
                overallJudgmentCode: draftRound.overallJudgmentCode,
                remarks: draftRound.remarks,
                measured: measurements.data ?? [],
              }
        }
        onSubmitted={submitted}
        onDirtyChange={changeDirty}
        oa={
          oa
            ? {
                hasLot: detail.data.lotId !== null,
                fourMStored: detail.data.fourMChange,
                itemId: detail.data.itemId,
                levelItem: (() => {
                  const parts = items.partsOf(detail.data.itemId);
                  return parts === null ? null : { itemCode: parts.code, itemName: parts.name };
                })(),
                pendingLevel,
                onPickLevel: (values: LevelDialogValues) => {
                  setPendingLevel(values);
                  storePendingLevel(inspectionRequestId, values);
                },
              }
            : null
        }
      />
    );
  };

  const oaOf = (request: NonNullable<typeof detail.data>): FormProps['oa'] =>
    oa
      ? {
          hasLot: request.lotId !== null,
          fourMStored: request.fourMChange,
          itemId: request.itemId,
          levelItem: (() => {
            const parts = items.partsOf(request.itemId);
            return parts === null ? null : { itemCode: parts.code, itemName: parts.name };
          })(),
          pendingLevel,
          onPickLevel: (values: LevelDialogValues) => {
            setPendingLevel(values);
            storePendingLevel(inspectionRequestId, values);
          },
        }
      : null;

  /* 결과 드로어의 양식 — 지금 IQC 양식 그대로(회차 · 이전 결과 · 재검사 사유 없음), 저장은 확정 없이 결과만. */
  const renderInboundForm: InboundDetailProps['renderForm'] = ({
    drawer,
    draft,
    formKey,
    onDirtyChange: formDirtyChange,
  }) => {
    if (detail.data === undefined) return null;
    if (versionId === null || version.data === undefined || specs.data === undefined) {
      return <AlertBanner variant="warning">{t.dialog.noPlan}</AlertBanner>;
    }
    return (
      <InspectionForm
        key={formKey}
        request={detail.data}
        version={version.data}
        specs={[...specs.data].sort((a, b) => a.sequenceNo - b.sequenceNo)}
        planLabel={plan.data === undefined ? '-' : plan.data.inspectionPlanCode}
        planName={plan.data?.inspectionPlanName ?? '-'}
        itemParts={items.partsOf(detail.data.itemId)}
        lotNo={inboundInspection.data?.inboundLotNo ?? detail.data.inspectionRequestNo}
        qtyLabel={withUom(String(detail.data.targetQty), uoms.codeOf(detail.data.uomId))}
        inbound={
          inboundInspection.data === undefined
            ? inbound.data
            : {
                supplierLabel: inboundInspection.data.supplierName ?? null,
                receivedAt: inboundInspection.data.receivedAt ?? null,
              }
        }
        drawings={drawings.data ?? []}
        inspector={session?.worker ?? null}
        appUserId={session?.userId ?? null}
        previousResultId={null}
        draft={draft}
        onSubmitted={() => undefined}
        onDirtyChange={formDirtyChange}
        drawer={drawer}
        oa={oaOf(detail.data)}
      />
    );
  };

  if (inboundFlow && detail.data !== undefined) {
    const aql = version.data?.aqlValue;
    const planText = [
      aql == null ? null : t.target.conditionAql(aql),
      plan.data?.inspectionPlanName ?? null,
    ]
      .filter((part): part is string => part !== null && part !== '')
      .join(' · '); // ui-check-ignore: C-13 설계 확정 표기 「AQL 1.0 · 육안 검사」(screens/W-01-01.md)

    return (
      <InboundDetail
        inspectionRequestId={inspectionRequestId}
        itemParts={items.partsOf(detail.data.itemId)}
        planText={planText === '' ? '-' : planText}
        uomCode={uoms.codeOf(detail.data.uomId) ?? ''}
        renderForm={renderInboundForm}
        headActions={inboundHead?.headActions}
        headNote={inboundHead?.headNote}
      />
    );
  }

  /* 고른 탭은 의뢰마다 처음부터. 확정이 끝난 의뢰는 「검사 진행」 탭을 두지 않고 이력만 보인다(사용자 지시 2026-11-04). */
  const [picked, setPicked] = useState<{ requestId: number; tab: string } | null>(null);
  /* 확정된 의뢰는 이력에서 시작하고, 첨부 파일 탭은 고를 수 있다(#247). */
  const pickedTab = picked?.requestId === inspectionRequestId ? picked.tab : null;
  const tab = confirmed
    ? pickedTab === 'documents'
      ? 'documents'
      : 'history'
    : (pickedTab ?? 'input');

  /* 목록 아래(또는 옆) 상세 구획에 선다 — 기존 검사 조회·판정과 같은 배치(팝업이 아니다 · 사용자 지시 2026-10-29). */
  return (
    <div className="parts-iqc-detail-body">
      <div className="parts-iqc-detail-head">
        <h2 className="pane-title">{t.dialog.title}</h2>
        {detail.data !== undefined && t.requestStatus[detail.data.statusCode] !== undefined && (
          <Chip size="sm" status={detail.data.statusCode === 'IN_PROGRESS' ? 'info' : 'idle'}>
            {t.requestStatus[detail.data.statusCode]}
          </Chip>
        )}
        {isReinspecting ? (
          <Button
            variant="outlined"
            size="sm"
            className="parts-iqc-reinspect"
            onClick={() => {
              setReinspectingFrom(null);
              changeDirty(false);
            }}
          >
            {tResult.reinspectCancel}
          </Button>
        ) : (
          confirmed &&
          followUp.data?.isInspectionPending === true && (
            <Button
              variant="outlined"
              size="sm"
              className="parts-iqc-reinspect"
              onClick={() => {
                setReinspectingFrom(latestRoundId);
                setPicked({ requestId: inspectionRequestId, tab: 'input' });
              }}
            >
              {tResult.reinspect}
            </Button>
          )
        )}
      </div>
      {confirmed && followUp.data?.isDefective === true && (
        <RejectedLotGuide nonconformanceId={followUp.data.nonconformanceId} />
      )}
      {confirmed && followUp.data?.isDefective === false && !followUp.data.isInspectionPending && (
        <p className="iqc-inspection-action-note" data-tone="info">
          <Icon name="info" size={14} aria-hidden />
          {tResult.reinspectLotNotPending}
        </p>
      )}
      {isReinspecting && <p className="field-note">{t.dialog.reinspectNote}</p>}
      {/* IQC 생략은 OA 화면처럼 목록 「생략」 칸으로 옮겼다(omf-all-around#225). */}
      {/* 검사 진행 · 첨부 파일 · 검사 이력 순(#247 · 사용자 지시 2026-11-10) — 이력은 이 의뢰의 회차를 읽기 전용으로 */}
      <Tabs
        className="parts-iqc-detail-tabs"
        size="md"
        aria-label={t.dialog.title}
        value={tab}
        onChange={(next) => {
          if (tab === 'input' && next !== 'input' && formDirty) setPendingTab(next);
          else setPicked({ requestId: inspectionRequestId, tab: next });
        }}
        items={[
          ...(confirmed
            ? []
            : [{ value: 'input', label: t.tabs.input, content: tab === 'input' ? body() : null }]),
          /* 첨부 파일 — OA 화면 「첨부 파일」 탭과 같은 LOT 첨부(시험성적서 등 · #247 · 사용자 지시 2026-11-10). */
          ...(lotId === null
            ? []
            : [
                {
                  value: 'documents',
                  label: messages.inspectionDocuments.heading,
                  badge:
                    attachments.data === undefined || attachments.data.length === 0 ? undefined : (
                      <span className="parts-iqc-muted">{attachments.data.length}</span>
                    ),
                  content:
                    tab === 'documents' ? (
                      /* OA 첨부 탭과 같은 상자 — 안내 · 단추 줄과 표 사이를 띄운다(겹침 · #247). */
                      <div className="iqc-inspection-tab-body iqc-inspection-fold">
                        <AttachmentPanel
                          key={lotId}
                          targetTypeCode="LOT"
                          targetId={lotId}
                          scrollX
                          paged
                          bulkDownload
                          toolbarStart={
                            <span className="iqc-inspection-head-badge iqc-inspection-docs-help">
                              <Icon name="attach_file" size={16} aria-hidden />
                              <span>
                                {messages.inspectionDocuments.help
                                  .split(/(\d+\s*MB)/)
                                  .map((part, index) =>
                                    /^\d+\s*MB$/.test(part) ? (
                                      <strong key={index} className="iqc-inspection-docs-limit">
                                        {part}
                                      </strong>
                                    ) : (
                                      part
                                    ),
                                  )}
                              </span>
                            </span>
                          }
                        />
                      </div>
                    ) : null,
                },
              ]),
          {
            value: 'history',
            label: t.tabs.history,
            badge:
              rounds.data === undefined || rounds.data.length === 0 ? undefined : (
                <span className="parts-iqc-muted">{rounds.data.length}</span>
              ),
            content:
              tab === 'history' ? (
                <InspectionHistory
                  inspectionRequestId={inspectionRequestId}
                  specs={[...(specs.data ?? [])].sort((a, b) => a.sequenceNo - b.sequenceNo)}
                  defectCodes={(defectCodes.data ?? []) as DefectCode[]}
                />
              ) : null,
          },
        ]}
      />
      {pendingTab !== null && (
        <DiscardDialog
          title={t.dialog.title}
          body={t.dialog.discardConfirm}
          showCloseButton={false}
          onStay={() => setPendingTab(null)}
          onLeave={() => {
            changeDirty(false);
            setPicked({ requestId: inspectionRequestId, tab: pendingTab });
            setPendingTab(null);
          }}
        />
      )}
    </div>
  );
};

/** 생략된 의뢰의 읽기 전용 요약 — 검사 대상 · LOT 정보를 입력 화면과 같은 짜임으로 보인다(#225). */
const SkippedSummary = (props: {
  skipBasisCode: string | null;
  itemParts: { code: string; name: string } | null;
  planLabel: string;
  planName: string;
  lotNo: string;
  qtyLabel: string;
  inbound: { supplierLabel: string | null; receivedAt: string | null } | undefined;
}) => (
  <>
    <AlertBanner variant="info">
      {t.skipped.notice(
        props.skipBasisCode === null ? null : (t.skipped.basis[props.skipBasisCode] ?? null),
      )}
    </AlertBanner>
    <section className="parts-iqc-block" aria-label={t.target.heading}>
      <dl className="parts-iqc-facts">
        <div className="parts-iqc-fact">
          <dt className="field-label">{t.target.itemName}</dt>
          <dd className="parts-iqc-fact-key">
            {props.itemParts?.name ?? '-'}
            {props.itemParts !== null && (
              <span className="parts-iqc-fact-sub">{props.itemParts.code}</span>
            )}
          </dd>
        </div>
        <div className="parts-iqc-fact">
          <dt className="field-label">{t.target.plan}</dt>
          <dd>{props.planLabel}</dd>
        </div>
        <div className="parts-iqc-fact">
          <dt className="field-label">{t.target.planName}</dt>
          <dd>{props.planName}</dd>
        </div>
      </dl>
      <div className="parts-iqc-lot-box" role="group" aria-label={t.lot.heading}>
        <h4>{t.lot.heading}</h4>
        <dl className="parts-iqc-kv">
          <div>
            <dt>{t.lot.lotNo}</dt>
            <dd className="parts-iqc-lot-no">{props.lotNo}</dd>
          </div>
          <div>
            <dt>{t.lot.supplier}</dt>
            <dd>{props.inbound?.supplierLabel ?? '-'}</dd>
          </div>
          <div>
            <dt>{t.lot.qty}</dt>
            <dd>{props.qtyLabel}</dd>
          </div>
          <div>
            <dt>{t.lot.receivedAt}</dt>
            <dd>{formatPlantDateTime(props.inbound?.receivedAt ?? null) ?? '-'}</dd>
          </div>
        </dl>
      </div>
    </section>
  </>
);

/** 결과 드로어 모드(005 새 흐름). */
export interface InspectionFormDrawer {
  /** 고른 자재 관리 LOT — 저장 때 `matchedLotIds` 로 싣는다. */
  matchedLotIds: number[];
  /** 매칭 칸 · 재검 사유 칸(드로어가 그린다). */
  matchField: ReactNode;
  /** 판정이 바뀔 때마다 알린다 — 드로어가 재검 사유가 필요한지 계산한다(FR-023a · 2026-11-12). 같은 함수를 계속 준다. */
  onJudgmentChange: (judgmentCode: string | null) => void;
  /** [저장] 직전 드로어 칸 검사 — 매칭 0개 · 재검 사유 빠짐이면 칸에 오류를 띄우고 `false`(FR-021 · FR-023a). */
  validate: () => boolean;
  /** 재검 사유 — 필요할 때만 싣는다(`null` 이면 싣지 않는다). */
  reinspectionReasonCode: string | null;
  onCancel: () => void;
  onSaved: () => void;
}

interface FormProps {
  request: {
    inspectionRequestId: number;
    itemId: number;
    lotId: number | null;
    targetQty: number;
    uomId: number;
  };
  version: components['schemas']['InspectionPlanVersion'];
  specs: ItemSpec[];
  planLabel: string;
  planName: string;
  itemParts: { code: string; name: string } | null;
  lotNo: string;
  qtyLabel: string;
  inbound: { supplierLabel: string | null; receivedAt: string | null } | undefined;
  drawings: { attachmentId: number; blob: Blob }[];
  inspector: { workerName: string } | null;
  /** 재검사면 앞 회차, 아니면 `null` */
  previousResultId: number | null;
  /** 작업자 연결 창이 이을 계정 — 세션이 없으면 버튼을 두지 않는다. */
  appUserId: number | null;
  draft: {
    inspectionResultId: number;
    /** 불러올 때의 판 번호 — 그사이 다른 사람이 저장했으면 서버가 이 저장을 막는다(#247 클릭 점검). */
    versionNo: number;
    inspectedQty: number;
    inspectedAt: string;
    overallJudgmentCode: string;
    remarks: string;
    measured: {
      inspectionItemSpecId: number;
      sampleNo: number;
      numericValue?: number | null;
      booleanValue?: boolean | null;
      textValue?: string | null;
      judgmentCode?: string | null;
    }[];
  } | null;
  onSubmitted: () => void;
  onDirtyChange: (dirty: boolean) => void;
  /**
   * 005 새 흐름(입하 LOT 단위) 결과 드로어(screens/W-01-01.md 「결과 추가·수정 — 오른쪽 드로어」) — 지금 양식 그대로 쓰되
   * 아래 줄이 [취소] [저장]이고, 저장은 확정 없이 결과만 남긴다(검사 단위 판정 확정). 매칭 칸을 기본 정보 아래에 둔다.
   */
  drawer?: InspectionFormDrawer | null;
  /** OA 화면에서만 — 검사 수준 · 4M 변경 정보(#247). 부품 화면은 `null`. */
  oa: {
    /** 자재 LOT 이 있는 의뢰만 4M 변경품을 적는다. */
    hasLot: boolean;
    fourMStored: FourMChangeForward | null;
    itemId: number;
    levelItem: { itemCode: string; itemName: string } | null;
    pendingLevel: LevelDialogValues | null;
    onPickLevel: (values: LevelDialogValues) => void;
  } | null;
}

/** 기준서 도면 — 품질 기준 정보 「도면」 탭과 같은 보기(한 장씩 좌우로 넘김 · 사용자 지시 2026-10-30). */
const DrawingImages = ({ drawings }: { drawings: { attachmentId: number; blob: Blob }[] }) => (
  <section className="parts-iqc-card" aria-label={t.drawing.heading}>
    <div className="parts-iqc-block-head">
      <h3>{t.drawing.heading}</h3>
      {drawings.length === 0 && <span className="parts-iqc-muted">{t.drawing.none}</span>}
    </div>
    {drawings.length === 0 ? null : (
      <InspectionDrawingImages
        drawings={drawings}
        altOf={t.drawing.alt}
        labels={{ prev: t.drawing.prev, next: t.drawing.next }}
      />
    )}
  </section>
);

const InspectionForm = (props: FormProps) => {
  const { request, version, specs, draft } = props;
  const versionAcceptance = version.acceptanceNumber ?? null;
  const dimensions = specs.filter((s) => kindOf(s) === 'dimension');
  const checkItems = specs.filter((s) => kindOf(s) === 'check');
  const defaultQty = String(
    sampleQtyOf(request.targetQty, {
      samplingMethodCode: version.samplingMethodCode,
      samplingRatio: version.samplingRatio ?? null,
      samplingQty: version.samplingQty ?? null,
    }),
  );

  const initial = useMemo((): PartsIqcForm => {
    /* 임시 저장한 회차는 저장한 검사일시 · 비고로 다시 연다(#247). */
    const saved = draft === null ? null : toPlantDateTimeParts(draft.inspectedAt);
    const form = emptyForm(saved === null ? plantNowLocal() : `${saved.date}T${saved.time}`);
    form.visualInspectedQty = draft === null ? defaultQty : String(draft.inspectedQty);
    form.remarks = draft?.remarks ?? '';
    for (const m of draft?.measured ?? []) {
      const spec = specs.find((s) => s.inspectionItemSpecId === m.inspectionItemSpecId);
      if (spec === undefined) continue;
      const kind = kindOf(spec);
      if (kind === 'dimension' && m.numericValue != null) {
        const row = [...(form.values[spec.inspectionItemSpecId] ?? [])];
        row[m.sampleNo - 1] = String(m.numericValue);
        form.values[spec.inspectionItemSpecId] = row;
        if (
          isManualDimension(spec) &&
          (m.judgmentCode === 'ACCEPTED' || m.judgmentCode === 'REJECTED')
        )
          form.checks[spec.inspectionItemSpecId] = m.judgmentCode;
      } else if (kind === 'check') {
        /* 텍스트 항목은 적은 글과 판정으로 남는다(#247). */
        if (m.textValue != null) form.texts[spec.inspectionItemSpecId] = m.textValue;
        if (m.booleanValue != null)
          form.checks[spec.inspectionItemSpecId] = m.booleanValue ? 'ACCEPTED' : 'REJECTED';
        else if (m.judgmentCode === 'ACCEPTED' || m.judgmentCode === 'REJECTED')
          form.checks[spec.inspectionItemSpecId] = m.judgmentCode;
      }
    }
    return form;
  }, [draft, specs, defaultQty]);

  const [history, dispatch] = useReducer(historyReducer, initial, startHistory);
  const form = history.present;
  const change = (next: PartsIqcForm) => dispatch({ type: 'change', next });
  /*
   * 고친 것이 있는가 — 마지막으로 불러오거나 저장한 내용과 견준다. 눌렀다 풀거나 적었다 지우면 고친 것이 아니다
   * (#247 · 사용자 지시 2026-11-10 — 되돌리기 기록 수로 재면 OK 를 눌렀다 풀어도 [임시 저장]이 켜져 있었다).
   */
  const [baseline, setBaseline] = useState(initial);
  /* OA 4M 변경품 — 서버 기록과 같으면 싣지 않는다(종전 OA 화면과 같다). 고친 것이 있는가에 함께 든다. */
  const storedFourM = fourMDraftOf(props.oa?.fourMStored ?? null);
  const [fourM, setFourM] = useState<FourMChangeDraft>(storedFourM);
  const fourMChanged = props.oa?.hasLot === true && !isSameFourM(fourM, storedFourM);
  const fourMBlocked = fourMChanged && isFourMIncomplete(fourM);
  const dirty = !sameForm(form, baseline) || fourMChanged;
  /* 텍스트 항목은 글만 남긴다 — 판정은 검사자가 OK/NG 를 직접 고른다(#247 · 사용자 지시 2026-11-10). */
  const changeText = (item: ItemSpec, text: string) =>
    change({ ...form, texts: { ...form.texts, [item.inspectionItemSpecId]: text } });
  const inspectedAtId = useId();
  const [inspectedDate = '', inspectedTimeRaw = ''] = form.inspectedAt.split('T');
  const inspectedTime = inspectedTimeRaw.slice(0, 5);
  const changeInspectedAt = (date: string, time: string) =>
    change({ ...form, inspectedAt: date === '' ? '' : `${date}T${time === '' ? '00:00' : time}` });
  const judgmentInputOf = (f: PartsIqcForm) => {
    /* 자동 판정이 꺼진 항목은 고른 OK/NG 가 그 항목의 판정이다 — NG 면 불량 1(기타 검사 항목과 같다 · #247 클릭 점검). */
    const dims = dimensions.map((item) => {
      if (isManualDimension(item)) {
        const picked = f.checks[item.inspectionItemSpecId] ?? null;
        return { judgment: picked, outCount: picked === 'REJECTED' ? 1 : 0 };
      }
      return judgeDimension(
        Array.from({ length: item.measurementCount }, (_, i) =>
          numberOf(f.values[item.inspectionItemSpecId]?.[i]),
        ),
        item,
        versionAcceptance,
      );
    });
    return {
      inspectedQty: countOf(f.visualInspectedQty),
      dimensions: dims,
      checks: checkItems.map((item): ItemJudgment => f.checks[item.inspectionItemSpecId] ?? null),
      /* 필수 항목만 다 적으면 자동 판정 · 종합 판정이 채워진다(#247 · 사용자 지시 2026-11-10). */
      requiredDimensions: dimensions.map((item) => item.requiredFlag),
      requiredChecks: checkItems.map((item) => item.requiredFlag),
    };
  };
  /* 임시 저장 때 자동 판정과 다르게 고른 판정이면 그대로 되살린다(#247). */
  const [chosen, setChosen] = useState<string | null>(() => {
    const stored = draft?.overallJudgmentCode ?? '';
    return stored !== '' && stored !== suggestedJudgmentOf(judgmentInputOf(initial))
      ? stored
      : null;
  });
  const [reason, setReason] = useState('');
  const [ask, setAsk] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  /*
   * 같은 회차를 다시 저장하면 폼이 다시 열리지 않는다 — 저장한 지금 값을 새 출발점으로 삼아 「고친 것」을 비운다.
   * [임시 저장] · [제출]은 한 통로로 쓴다 — 방금 임시 저장한 판 번호를 제출이 이어 써야 자기 저장에 막히지 않는다(#247 클릭 점검).
   */
  const latestForm = useRef(form);
  latestForm.current = form;
  const [savingDraft, setSavingDraft] = useState(false);
  const submit = useSubmitInspection((result) => {
    if (props.drawer != null) {
      props.drawer.onSaved();
      return;
    }
    if (result.statusCode !== 'DRAFT') {
      props.onSubmitted();
      return;
    }
    setBaseline(latestForm.current);
    dispatch({ type: 'reset', form: latestForm.current });
  });

  const input = judgmentInputOf(form);
  const { inspectedQty, dimensions: dimensionResults, checks } = input;
  const suggested = suggestedJudgmentOf(input);
  const rejectedQty = rejectedQtyOf(input);
  const dimensionStates = dimensions.map((item, index) => {
    const put = (form.values[item.inspectionItemSpecId] ?? []).filter(
      (text) => numberOf(text) !== null,
    ).length;
    if (isManualDimension(item)) {
      const picked = form.checks[item.inspectionItemSpecId] ?? null;
      return picked === 'REJECTED'
        ? 'err'
        : picked === 'ACCEPTED'
          ? 'done'
          : put === 0
            ? 'empty'
            : 'wait';
    }
    return rowStateOf(
      put,
      item.measurementCount,
      dimensionResults[index]?.outCount ?? 0,
      acceptanceOf(item, versionAcceptance),
    );
  });
  /* 자동 판정이 꺼진 항목에 값만 적고 판정을 고르지 않았으면 저장을 막는다 — 판정 없는 측정값은 서버가 받지 않는다. */
  const manualUnjudged = dimensions.filter(
    (item) =>
      isManualDimension(item) &&
      (form.checks[item.inspectionItemSpecId] ?? null) === null &&
      (form.values[item.inspectionItemSpecId] ?? []).some((text) => numberOf(text) !== null),
  );
  const overall = chosen ?? suggested;
  const heldQtyOf = (judgment: string | null): number =>
    judgment === 'HELD' && inspectedQty !== null ? Math.max(0, inspectedQty - rejectedQty) : 0;
  const expected = serverExpectedOf(rejectedQty, versionAcceptance, heldQtyOf(overall));
  const needsReason = overall !== null && expected !== null && overall !== expected;
  const maxN = Math.max(0, ...dimensions.map((d) => d.measurementCount));

  const measurementsOf = (): SubmitVariables['measurements'] => {
    const measuredAt = toOffset(form.inspectedAt);
    const out: SubmitVariables['measurements'] = [];
    dimensions.forEach((item) => {
      const picked = isManualDimension(item)
        ? (form.checks[item.inspectionItemSpecId] ?? null)
        : null;
      for (let i = 0; i < item.measurementCount; i += 1) {
        const value = numberOf(form.values[item.inspectionItemSpecId]?.[i]);
        if (value === null) continue;
        const lower = item.lowerLimit ?? -Infinity;
        const upper = item.upperLimit ?? Infinity;
        out.push({
          inspectionItemSpecId: item.inspectionItemSpecId,
          sampleNo: i + 1,
          numericValue: value,
          /* 자동 판정이 꺼진 항목은 고른 판정을 시료마다 싣는다. */
          judgmentCode: picked ?? (value < lower || value > upper ? 'REJECTED' : 'ACCEPTED'),
          measuredAt,
        });
      }
    });
    const bool = (item: ItemSpec, ok: boolean) =>
      out.push({
        inspectionItemSpecId: item.inspectionItemSpecId,
        sampleNo: 1,
        booleanValue: ok,
        judgmentCode: ok ? 'ACCEPTED' : 'REJECTED',
        measuredAt,
      });
    checkItems.forEach((item) => {
      const j = form.checks[item.inspectionItemSpecId];
      if (j == null) return;
      if (item.dataTypeCode !== 'TEXT') {
        bool(item, j === 'ACCEPTED');
        return;
      }
      /* 텍스트 항목은 적은 글을 싣는다 — 글이 없으면 판정만(#247 · 사용자 지시 2026-11-10). */
      const text = (form.texts[item.inspectionItemSpecId] ?? '').trim();
      out.push({
        inspectionItemSpecId: item.inspectionItemSpecId,
        sampleNo: 1,
        ...(text === '' ? {} : { textValue: text }),
        judgmentCode: j,
        measuredAt,
      });
    });
    return out;
  };

  const blocked =
    props.inspector === null ||
    overall === null ||
    inspectedQty === null ||
    inspectedQty <= 0 ||
    fourMBlocked ||
    manualUnjudged.length > 0 ||
    (needsReason && reason.trim() === '');

  const variablesOf = (judgment: string, qty: number): SubmitVariables => ({
    inspectionRequestId: request.inspectionRequestId,
    draftResultId: draft?.inspectionResultId ?? null,
    draftVersionNo: draft?.versionNo ?? null,
    previousResultId: props.previousResultId,
    uomId: request.uomId,
    inspectedAt: toOffset(form.inspectedAt),
    inspectedQty: qty,
    rejectedQty: judgment === 'ACCEPTED' ? Math.min(rejectedQty, qty) : rejectedQty,
    overallJudgmentCode: judgment,
    measurements: measurementsOf(),
    /*
     * 불량 유형 · 수량은 받지 않는다(#247 · 설계 변경 2026-11-10 — 화면은 치수 측정 · 기타 검사 항목만). 빈 배열은 앞서 임시 저장한
     * 불량 기록을 지운다. 서버도 불합격 IQC 확정에 불량 기록을 요구하지 않는다(서버 #1014 — 선택 입력).
     */
    defects: [],
    ...(needsReason ? { judgmentChangeReason: reason.trim() } : {}),
    remarks: form.remarks,
    ...(fourMChanged ? { fourMChange: fourMBodyOf(fourM) } : {}),
  });
  const onSubmit = () => {
    setAsk(false);
    if (blocked || overall === null || inspectedQty === null) return;
    setSavingDraft(false);
    submit.write(variablesOf(overall, inspectedQty));
  };
  /*
   * 임시 저장(#247 · 사용자 지시 2026-11-10) — 판정을 확정하지 않고 지금 입력을 회차에 남긴다. 고친 것이 있고 검사자 · 검사 수량 ·
   * 검사일시가 있으면 된다(판정은 아직 없어도 된다). 저장했다는 안내는 두지 않는다.
   */
  /* 고친 것이 있을 때만 켠다(#247 · 사용자 지시 2026-11-10). */
  const draftBlocked =
    !dirty ||
    props.inspector === null ||
    inspectedQty === null ||
    inspectedQty <= 0 ||
    form.inspectedAt === '' ||
    fourMBlocked ||
    manualUnjudged.length > 0 ||
    submit.isSaving;
  const onSaveDraft = () => {
    if (draftBlocked || inspectedQty === null) return;
    setSavingDraft(true);
    submit.write({ ...variablesOf(overall ?? '', inspectedQty), draftOnly: true });
  };

  /*
   * 결과 드로어의 [저장] — 확정하지 않고 결과만 남긴다(005 새 흐름). 판정이 없으면 막고 「판정을 고르세요.」 —
   * 검사 단위 판정 확정이 판정 빈 결과를 받지 않는다(FR-025).
   */
  const [judgmentMissing, setJudgmentMissing] = useState(false);
  const drawerBlocked =
    submit.isSaving ||
    props.inspector === null ||
    inspectedQty === null ||
    inspectedQty <= 0 ||
    form.inspectedAt === '' ||
    fourMBlocked ||
    manualUnjudged.length > 0 ||
    (needsReason && reason.trim() === '');
  const onSaveResult = () => {
    if (drawerBlocked || inspectedQty === null || props.drawer == null) return;
    if (overall === null) {
      setJudgmentMissing(true);
      return;
    }
    setJudgmentMissing(false);
    if (!props.drawer.validate()) return;
    const reasonCode = props.drawer.reinspectionReasonCode;
    submit.write({
      ...variablesOf(overall, inspectedQty),
      draftOnly: true,
      matchedLotIds: props.drawer.matchedLotIds,
      ...(reasonCode === null ? {} : { reinspectionReasonCode: reasonCode }),
    });
  };
  /* 판정 규칙의 서버 400(2026-11-12)은 드로어 문구로 — 나머지만 저장 오류 띠로 간다. */
  const ruleErrors = props.drawer == null ? null : splitRuleErrors(submit.error);
  const onDrawerJudgment = props.drawer?.onJudgmentChange;
  useEffect(() => onDrawerJudgment?.(overall), [overall, onDrawerJudgment]);

  const { onDirtyChange } = props;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  return (
    <div className="parts-iqc-form">
      {props.inspector === null && (
        <AlertBanner variant="warning">
          {/* 버튼은 문구와 같은 줄 오른쪽 끝(사용자 지시 2026-10-30) — DS `action` 자리는 문구 아래 줄이라 쓰지 않는다. 테두리는 둔다(버튼으로 보이게). */}
          <div className="parts-iqc-worker-alert">
            <span>{t.dialog.workerMissing}</span>
            {props.appUserId !== null && (
              <Button variant="outlined" size="sm" onClick={() => setConnectOpen(true)}>
                {messages.usersRoles.workerLink.connect}
              </Button>
            )}
          </div>
        </AlertBanner>
      )}
      {/* 경고 안에서 바로 사번을 잇는다(사용자 지시 2026-10-30) — OA 화면의 연결 창과 같다. 성공하면 세션을 다시 읽어 경고가 걷힌다. */}
      {planOpen && (
        <PlanDialog
          planCode={props.planLabel}
          planName={props.planName}
          itemParts={props.itemParts}
          version={version}
          specs={specs}
          drawings={<DrawingImages drawings={props.drawings} />}
          onClose={() => setPlanOpen(false)}
        />
      )}
      {connectOpen && props.appUserId !== null && (
        <WorkerConnectDialog appUserId={props.appUserId} onClose={() => setConnectOpen(false)} />
      )}

      <section className="parts-iqc-block" aria-label={t.target.heading}>
        {/* 기본 정보 — OQC 상세의 기본 정보와 같은 짜임: 테두리 상자 안에 칸을 나란히, 칸 사이 세로선(사용자 시안 2026-10-29) */}
        <dl className="parts-iqc-facts">
          <div className="parts-iqc-fact">
            <dt className="field-label">{t.target.itemName}</dt>
            <dd className="parts-iqc-fact-key">
              {props.itemParts?.name ?? '-'}
              {props.itemParts !== null && (
                <span className="parts-iqc-fact-sub">{props.itemParts.code}</span>
              )}
            </dd>
          </div>
          <div className="parts-iqc-fact">
            <dt className="field-label">{t.target.plan}</dt>
            <dd className="parts-iqc-plan-cell">
              {props.planLabel}
              {/* 검사 기준 조회 팝업(사용자 지시 2026-10-30) */}
              <Button variant="outlined" size="sm" onClick={() => setPlanOpen(true)}>
                {t.plan.open}
              </Button>
            </dd>
          </div>
          <div className="parts-iqc-fact">
            <dt className="field-label">{t.target.planName}</dt>
            <dd>{props.planName}</dd>
          </div>
          {dimensions.length > 0 && (
            <>
              <div className="parts-iqc-fact">
                <dt className="field-label">{t.target.condition}</dt>
                <dd>
                  {version.aqlValue == null
                    ? t.target.conditionNone
                    : t.target.conditionAql(version.aqlValue)}
                </dd>
              </div>
              <div className="parts-iqc-fact">
                <dt className="field-label">{t.target.sample}</dt>
                <dd>{t.target.sampleValue(maxN, versionAcceptance ?? 0)}</dd>
              </div>
            </>
          )}
          {props.oa !== null && (
            <div className="parts-iqc-fact">
              <dt className="field-label">
                {messages.iqcInspection.detail.fields.inspectionLevel}
              </dt>
              <dd>
                <ItemLevel
                  key={props.oa.itemId}
                  itemId={props.oa.itemId}
                  item={props.oa.levelItem}
                />
              </dd>
            </div>
          )}
          <div className="parts-iqc-fact">
            <dt className="field-label">{t.target.inspector}</dt>
            <dd>{props.inspector?.workerName ?? '-'}</dd>
          </div>
        </dl>
        <div className="parts-iqc-lot-box" role="group" aria-labelledby="parts-iqc-lot">
          <h4 id="parts-iqc-lot">{t.lot.heading}</h4>
          {/* 받은 값(LOT · 공급업체 · 수량 · 입고) 두 줄, 구분선 아래에 적는 값(검사일시) — 사용자 시안 2026-10-29 */}
          <dl className="parts-iqc-kv">
            <div>
              <dt>{t.lot.lotNo}</dt>
              <dd className="parts-iqc-lot-no">{props.lotNo}</dd>
            </div>
            <div>
              <dt>{t.lot.supplier}</dt>
              <dd>{props.inbound?.supplierLabel ?? '-'}</dd>
            </div>
            <div>
              <dt>{t.lot.qty}</dt>
              <dd>{props.qtyLabel}</dd>
            </div>
            <div>
              <dt>{t.lot.receivedAt}</dt>
              <dd>{formatPlantDateTime(props.inbound?.receivedAt ?? null) ?? '-'}</dd>
            </div>
          </dl>
          <div className="parts-iqc-lot-inspected">
            {/* 시각은 입고 화면과 같은 시·분 고르기(공용 패턴) — 글자 입력 대신 DS 모양으로(사용자 지시 2026-10-29). */}
            <div className="field-cell date-time-field">
              <label className="field-label" htmlFor={inspectedAtId}>
                {t.lot.inspectedAt}
                <span className="required-mark" aria-hidden="true">
                  {' *'}
                </span>
              </label>
              <div className="date-time-field-controls">
                <DatePicker
                  id={inspectedAtId}
                  value={inspectedDate === '' ? null : inspectedDate}
                  onChange={(next) => changeInspectedAt(next, inspectedTime)}
                />
                <TimeField
                  labels={TIME_LABELS}
                  hour={inspectedTime.slice(0, 2)}
                  minute={inspectedTime.slice(3, 5)}
                  disabled={false}
                  invalid={false}
                  onChange={(hour, minute) => changeInspectedAt(inspectedDate, `${hour}:${minute}`)}
                />
              </div>
            </div>
            {/* 검사 수량 — 이 회차에 실제로 검사한 수(사용자 지시 2026-10-30). 기본은 검사기준의 시료 수, 고칠 수 있다.
                검사일시와 한 줄, 칸 이름은 위에(검사일시와 같은 모양 · 사용자 지시 2026-10-30). */}
            <div className="field-cell parts-iqc-inspected-qty">
              <FieldLabel htmlFor="parts-iqc-inspected-qty" label={t.lot.inspectedQty} required />
              <TextField
                id="parts-iqc-inspected-qty"
                inputMode="numeric"
                value={form.visualInspectedQty}
                trailingIcon={<span>{t.visual.unit}</span>}
                error={
                  form.visualInspectedQty !== '' && (inspectedQty === null || inspectedQty <= 0)
                    ? t.lot.invalidInspectedQty
                    : undefined
                }
                onChange={(event) => change({ ...form, visualInspectedQty: event.target.value })}
              />
            </div>
          </div>
        </div>
      </section>

      {props.drawer?.matchField}

      <MeasurementTable
        items={dimensions}
        values={form.values}
        versionAcceptance={versionAcceptance}
        judgments={form.checks}
        disabled={submit.isSaving}
        onChange={(itemId, index, text) => change(withValue(form, itemId, index, text))}
        onJudge={(itemId, judgment) =>
          change({ ...form, checks: { ...form.checks, [itemId]: judgment } })
        }
        blockedNote={
          manualUnjudged.length > 0 ? messages.iqcInspection.measurements.blockedIncomplete : null
        }
        checkItems={checkItems}
        texts={form.texts}
        onText={changeText}
      />

      {/* 종합 판정 — 검사 항목 아래(#247 · 사용자 지시 2026-11-10). 왼쪽 자동 판정 결과 상자 · 세로선 · 오른쪽 종합 판정 고르기(사용자 시안 2026-10-29) */}
      <section className="parts-iqc-card" aria-labelledby="parts-iqc-verdict">
        <h3 id="parts-iqc-verdict" className="parts-iqc-sub-title">
          {t.verdict.overall}
        </h3>
        <div className="parts-iqc-verdict-line">
          <div
            className={`parts-iqc-auto-box${suggested === 'REJECTED' ? ' is-ng' : suggested === 'ACCEPTED' ? ' is-ok' : ''}`}
          >
            <span className="parts-iqc-auto-label">{t.verdict.suggested}</span>
            {suggested === null ? (
              <span className="parts-iqc-muted">{t.verdict.pending}</span>
            ) : (
              <span className="parts-iqc-auto-value">
                <strong>{t.judgment[suggested] ?? suggested}</strong>
                {` ${t.verdict.rejectedQty(rejectedQty)}`}
              </span>
            )}
          </div>
          <div className="parts-iqc-inline-field parts-iqc-overall">
            <span className="field-label" id="parts-iqc-overall">
              {t.verdict.overall}
              <span className="required-mark" aria-hidden="true">
                {' *'}
              </span>
            </span>
            <Select
              aria-labelledby="parts-iqc-overall"
              value={overall}
              disabled={suggested === null}
              options={['ACCEPTED', 'REJECTED', 'HELD'].map((value) => ({
                value,
                label: t.judgment[value] ?? value,
              }))}
              onChange={(value) => setChosen(value)}
            />
          </div>
        </div>
        {needsReason && (
          <div className="field-cell parts-iqc-stretch">
            <FieldLabel htmlFor="parts-iqc-reason" label={t.verdict.reason} required />
            <TextArea
              id="parts-iqc-reason"
              fullWidth
              helperText={t.verdict.reasonHint}
              value={reason}
              maxLength={500}
              rows={2}
              error={submit.fieldErrors.judgmentChangeReason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        )}
      </section>

      {/* OA — 4M 변경 정보(번호 없이 검사 진행 안, 비고 위 · #247 사용자 지시 2026-11-10). 품목 검사 수준이 없으면 그 오른쪽 제 상자에서 지정한다(사용자 지시 · #252). */}
      {props.oa !== null && props.oa.hasLot && (
        <div className="parts-iqc-card-pair">
          <section className="parts-iqc-card" aria-labelledby="parts-iqc-four-m">
            <h3 id="parts-iqc-four-m" className="parts-iqc-sub-title">
              {messages.iqcInspection.result.fourMChange.sectionTitle}
            </h3>
            <FourMChange draft={fourM} onChange={setFourM} disabled={submit.isSaving} />
          </section>
          <ItemLevelStep
            itemId={props.oa.itemId}
            item={props.oa.levelItem}
            pending={props.oa.pendingLevel}
            onPick={props.oa.onPickLevel}
          />
        </div>
      )}

      {/* 비고 — 4M 변경 정보(OA) 다음, 그 아래 기준서 도면 · 검사 안내(사용자 지시 · #252). */}
      <div className="field-cell parts-iqc-stretch">
        <h3 className="parts-iqc-sub-title">
          <label htmlFor="parts-iqc-remarks">{t.visual.remarks}</label>
        </h3>
        <TextArea
          id="parts-iqc-remarks"
          fullWidth
          placeholder={t.visual.remarksPlaceholder}
          value={form.remarks}
          rows={3}
          maxLength={REMARKS_MAX}
          showCount
          onChange={(event) => change({ ...form, remarks: event.target.value })}
        />
      </div>

      <DrawingImages drawings={props.drawings} />

      {/* 검사 기준 버전의 안내 문구 — 기준서 도면 아래(사용자 지시 · omf-all-around#252). */}
      <InspectionGuideNotice inspectionRequestId={request.inspectionRequestId} />

      {ask &&
        (() => {
          const judgment = t.judgment[overall ?? ''] ?? '';
          const outOfSpec = dimensionStates.filter((st) => st === 'err').length;
          const missing = dimensionStates.filter((st) => st === 'empty' || st === 'wait').length;
          const ngChecks = checks.filter((j) => j === 'REJECTED').length;
          const unjudgedChecks = checks.filter((j) => j === null).length;
          const verdict = (ok: boolean) => (
            <span className="parts-iqc-confirm-verdict" data-tone={ok ? 'ok' : 'check'}>
              {ok ? t.confirm.ok : t.confirm.check}
            </span>
          );
          return (
            <Dialog
              open
              size="md"
              showCloseButton={false}
              closeOnBackdropClick={false}
              title={t.confirm.title(judgment)}
              onClose={() => setAsk(false)}
              footer={
                <>
                  <Button variant="outlined" onClick={() => setAsk(false)}>
                    {t.confirm.back}
                  </Button>
                  <Button variant="filled" onClick={onSubmit}>
                    {t.confirm.action(judgment)}
                  </Button>
                </>
              }
            >
              {/* 내기 전에 무엇으로 나가는지 한 번 더 본다 — 규격 밖·덜 적은 항목이 여기서 드러난다(사용자 시안 2026-11-04). */}
              <div className="parts-iqc-confirm">
                <p className="parts-iqc-confirm-note">{t.confirm.note}</p>
                <dl className="parts-iqc-confirm-rows">
                  <div>
                    <dt>{t.confirm.target}</dt>
                    <dd>{props.itemParts?.name ?? props.itemParts?.code ?? '-'}</dd>
                  </div>
                  <div>
                    <dt>{t.confirm.lot}</dt>
                    <dd>{props.lotNo}</dd>
                  </div>
                  <div>
                    <dt>{t.confirm.supplier}</dt>
                    <dd>{props.inbound?.supplierLabel ?? '-'}</dd>
                  </div>
                </dl>
                <div className="parts-iqc-confirm-cards">
                  <section className="parts-iqc-confirm-card">
                    <h4>{t.confirm.dimension}</h4>
                    <strong>{t.confirm.dimensionValue(outOfSpec, missing)}</strong>
                    {verdict(outOfSpec === 0 && missing === 0)}
                  </section>
                  {checkItems.length > 0 && (
                    <section className="parts-iqc-confirm-card">
                      <h4>{t.visual.checks}</h4>
                      <strong>{t.confirm.checksValue(ngChecks, unjudgedChecks)}</strong>
                      {verdict(ngChecks === 0 && unjudgedChecks === 0)}
                    </section>
                  )}
                </div>
              </div>
            </Dialog>
          );
        })()}
      <SaveErrorBanner error={ruleErrors === null ? submit.error : ruleErrors.rest} />

      {props.drawer != null ? (
        <div className="parts-iqc-footer parts-iqc-drawer-footer">
          {judgmentMissing && (
            <p className="field-error" role="alert">
              {messages.iqcInboundLot.drawer.judgmentRequired}
            </p>
          )}
          {(ruleErrors?.codes ?? []).map((code) => (
            <p key={code} className="field-error" role="alert">
              {messages.iqcInboundLot.drawer.ruleErrors[code]}
            </p>
          ))}
          <span className="field-note">{messages.iqcInboundLot.drawer.saveNote}</span>
          <span className="parts-iqc-footer-gap" />
          <Button variant="outlined" disabled={submit.isSaving} onClick={props.drawer.onCancel}>
            {messages.iqcInboundLot.drawer.cancel}
          </Button>
          <Button
            variant="filled"
            loading={submit.isSaving}
            disabled={drawerBlocked}
            onClick={onSaveResult}
          >
            {messages.iqcInboundLot.drawer.save}
          </Button>
        </div>
      ) : (
        /* 아래 줄은 레퍼런스 화면 그대로다 — 왼쪽 되돌리기 · 다시 실행, 오른쪽 비우기 · 제출(사용자 확인 2026-10-29) */
        <div className="parts-iqc-footer">
          <Button
            variant="text"
            leadingIcon={<Icon name="undo" />}
            disabled={history.past.length === 0 || submit.isSaving}
            onClick={() => dispatch({ type: 'undo' })}
          >
            {t.footer.undo}
          </Button>
          <IconButton
            className="parts-iqc-redo"
            aria-label={t.footer.redo}
            icon="redo"
            disabled={history.future.length === 0 || submit.isSaving}
            onClick={() => dispatch({ type: 'redo' })}
          />
          <span className="parts-iqc-footer-gap" />
          {/*
           * 부분 입고 — OA 화면과 같이 자리만 두고 누를 수 없다(규칙 미정 · 스펙 §8 #2 · #247 사용자 지시 2026-11-10).
           * 「업데이트 예정」은 단추 설명(마우스를 올리면 보이는 글)으로 둔다.
           */}
          <Button variant="outlined" disabled title={tResult.partialReceiptPending}>
            {tResult.partialReceipt}
          </Button>
          <Button
            variant="outlined"
            loading={submit.isSaving && savingDraft}
            disabled={draftBlocked}
            onClick={onSaveDraft}
          >
            {tResult.save}
          </Button>
          <Button
            variant="text"
            disabled={submit.isSaving}
            onClick={() => {
              const cleared = emptyForm(form.inspectedAt);
              cleared.visualInspectedQty = defaultQty;
              change(cleared);
              setChosen(null);
              setReason('');
              setFourM(storedFourM);
            }}
          >
            {t.footer.clear}
          </Button>
          <Button
            variant="filled"
            className="parts-iqc-submit"
            loading={submit.isSaving && !savingDraft}
            disabled={blocked || submit.isSaving}
            onClick={() => setAsk(true)}
          >
            {submit.isSaving && !savingDraft ? t.footer.submitting : t.footer.submit}
          </Button>
        </div>
      )}
    </div>
  );
};
