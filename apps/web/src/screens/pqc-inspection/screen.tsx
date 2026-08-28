import { Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { toApiError } from '../../patterns/request';

import { ActionBar } from './action-bar';
import { CODE_GROUPS, toCodeOptions } from './code-options';
import { toConfirmBlockedReason } from './confirm-gate';
import {
  EMPTY_COVERAGE_DRAFT,
  fillCoverage,
  toCoverageDraft,
  type CoverageDraft,
} from './coverage';
import { settleDisposition, type DispositionState } from './disposition';
import { ItemPanel } from './item-panel';
import { QueueLoadErrorBanner } from './load-error-banner';
import {
  hasValueError,
  isAllJudged,
  toMeasurementDrafts,
  toMeasurementInputs,
  type MeasurementDraft,
  type MeasurementDrafts,
} from './measurement-draft';
import { toMeasurementRows, type MeasurementRow } from './measurement-rows';
import {
  useCodeValues,
  useConfirmResult,
  useInspectionItemSpecs,
  useInspectionRequestDetail,
  useInspectionRoundLock,
  useInspectionRounds,
  useMeasurements,
  useSaveDraft,
} from './queries';
import { ResultPanel } from './result-panel';
import { TargetHeader } from './target-header';
import { readTargetId } from './target';
import {
  EMPTY_QUANTITY_DRAFT,
  hasQuantityError,
  toMicro,
  toSendableNumber,
  toTotals,
  validateQuantities,
  type QuantityDraft,
} from './quantity-draft';
import { latestRound } from './types';

/**
 * P-02-13 PQC 제품 검사·검사 결과 입력 — **화면 스펙 §3 의 배치를 그대로 따른다.**
 *
 * ```
 * 헤더    대상(의뢰·W/O·품목·LOT·검사수량·기준 버전)
 * 본문    좌 《검사 항목》 464  │  우 《결과 입력》 544
 * 액션바  [ 임시 저장 ]            [ 검사 확정 ]      ← 아래 고정
 * ```
 *
 * ⭐ **목록을 두지 않는다.** §5-9 의 액션 표에 조회·필터가 없고 화면 전이가 「작업 화면에서
 * 진입」이다 — 대상이 이미 정해진 채로 열린다. 진입 경로가 아직 없어 진입 인자로 받고,
 * 없으면 안내만 그린다(검토 요청 omf-mes#257 — A안).
 *
 * ⛔ **「검사 시작」 단추를 두지 않는다.** 스펙 §3 에 없고, 첫 임시 저장이 곧 검사 시작이며
 * 서버가 그때 의뢰 상태를 옮긴다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.pqcInspection;

/** 계약이 못박은 두 값 중 확정 쪽. 이 값이면 회차를 더 고치지 않는다. */
const CONFIRMED_STATUS = '확정';

export const PqcInspectionScreen = () => {
  const [searchParams] = useSearchParams();
  const targetId = readTargetId(searchParams);

  const detail = useInspectionRequestDetail(targetId);
  const rounds = useInspectionRounds(targetId);

  const round = latestRound(rounds.data ?? []);

  /**
   * 확정된 회차에서 **재검사 회차를 쓰는 중**인가.
   *
   * ⭐ **회차를 먼저 만들지 않는다.** 누르면 칸이 열릴 뿐이고 회차는 첫 임시 저장이 만든다 —
   * 먼저 만들면 열어 보고 그만둔 사람마다 빈 회차가 쌓인다.
   */
  const [isReinspecting, setIsReinspecting] = useState(false);

  /**
   * 재검사가 가리키는 **앞 회차**. 재검사 중이 아니면 `null`.
   *
   * ⭐ **지금 화면에 있는 회차로 매번 다시 판정한다** — 눌렀을 때의 식별자를 따로 들고 있으면
   * 그 값이 화면의 회차와 어긋나는 상태가 생기고, 어느 쪽이 옳은지 정할 근거가 없다.
   */
  const reinspectingFrom = isReinspecting ? (round?.inspectionResultId ?? null) : null;
  const isReinspectingNow = reinspectingFrom !== null;

  /** 확정된 회차는 고치지 않는다 — 정정이 아니라 재검사로 새 회차를 쌓는다. */
  const isConfirmed = round?.statusCode === CONFIRMED_STATUS;
  const isLocked = isConfirmed && !isReinspectingNow;

  /** 고칠 회차. 확정본이면 `null` 이 되어 저장이 「새로 만들기」로 간다. */
  const editingResultId = !isConfirmed && round !== null ? round.inspectionResultId : null;

  /* ⭐ 잠금 토큰을 얻으려고 회차 한 건을 따로 부른다 — 목록 200 에는 `ETag` 가 없다. */
  useInspectionRoundLock(editingResultId);

  const itemSpecs = useInspectionItemSpecs(detail.data?.inspectionPlanVersionId ?? null);
  /*
   * ⚠ **재검사 중에는 앞 회차의 측정치를 그리지 않는다.** 그리면 아직 아무것도 재지 않은 새
   * 회차에 앞 회차의 값이 들어 있는 것처럼 보이고, 검사자가 그것을 자기가 잰 값으로 읽는다.
   */
  const measurements = useMeasurements(
    isReinspectingNow ? null : (round?.inspectionResultId ?? null),
  );

  const rows = toMeasurementRows(itemSpecs.data ?? [], measurements.data ?? []);

  /**
   * 종합 판정과 **항목 판정은 그룹이 다르다** — 항목에는 「보류」가 없다. 합쳐 쓰면 항목
   * 선택칸에 보류가 떠서 설계와 어긋난 값이 저장된다.
   */
  const overallValues = useCodeValues(CODE_GROUPS.overallJudgment);
  const overallOptions = toCodeOptions(overallValues.data ?? []);
  const itemJudgmentValues = useCodeValues(CODE_GROUPS.measurementJudgment);
  const itemJudgmentOptions = toCodeOptions(itemJudgmentValues.data ?? []);

  const [draft, setDraft] = useState<QuantityDraft>(EMPTY_QUANTITY_DRAFT);

  /**
   * 검사 수량 초안 — **사람이 넣는 값이다**(§3 도면 · §4-B). 회차가 있으면 그 값에서,
   * 없으면 의뢰의 대상 수량에서 시작한다: 표본 검사라 둘이 다를 수 있고, 다를 때 고치는
   * 것은 사람이다.
   */
  const [inspectedDraft, setInspectedDraft] = useState('');
  const [drafts, setDrafts] = useState<MeasurementDrafts>({});
  const [coverage, setCoverage] = useState<CoverageDraft>(EMPTY_COVERAGE_DRAFT);
  const [disposition, setDisposition] = useState<DispositionState>(null);
  const [judgment, setJudgment] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isJustConfirmed, setIsJustConfirmed] = useState(false);

  const save = useSaveDraft(targetId, editingResultId, () => {
    setIsSaved(true);
  });

  const confirm = useConfirmResult(targetId, editingResultId, () => {
    setIsSaved(false);
    setIsJustConfirmed(true);
  });

  /*
   * 되돌림은 **값**으로 판정한다 — 조회 응답이 다시 그려질 때마다 참조가 달라지므로,
   * 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다.
   */
  const roundId = round?.inspectionResultId ?? null;
  const { acceptedQty, rejectedQty, heldQty } = round ?? {
    acceptedQty: 0,
    rejectedQty: 0,
    heldQty: 0,
  };
  const storedJudgment = round?.overallJudgmentCode ?? '';
  /* 회차가 있으면 그 검사 수량, 없으면 의뢰의 대상 수량에서 시작한다. */
  const storedInspectedQty = round?.inspectedQty ?? detail.data?.targetQty ?? 0;
  const coverageFromAt = detail.data?.coverageFromAt ?? null;
  const coverageToAt = detail.data?.coverageToAt ?? null;

  /**
   * 회차가 화면에 보일 값. 회차가 없으면 빈 초안이다.
   *
   * ⛔ 0을 미리 채우지 않는다 — 채우면 「검사자가 0으로 판정했다」와 「아직 아무것도 넣지
   * 않았다」가 화면에서 같아 보인다.
   */
  const draftOf = (
    source: { acceptedQty: number; rejectedQty: number; heldQty: number } | null,
  ): QuantityDraft =>
    source === null
      ? EMPTY_QUANTITY_DRAFT
      : {
          accepted: String(source.acceptedQty),
          rejected: String(source.rejectedQty),
          held: String(source.heldQty),
        };

  /**
   * 고른 대상이나 회차가 바뀌면 그 회차의 값으로 되돌아간다.
   *
   * ⭐ **대상(`targetId`)이 의존성에 든다.** 회차 값만 보면 **회차가 없는 대상끼리 옮길 때**
   * 네 값이 모두 그대로여서 effect 가 깨어나지 않고, 앞 대상에 친 수량이 다음 화면에 남는다 —
   * 저장이 붙는 순간 **다른 LOT 에 앞 대상의 수량을 저장**하는 길이 된다.
   */
  useEffect(() => {
    setIsSaved(false);
    setIsJustConfirmed(false);
    setShowErrors(false);
    /*
     * ⭐ 재검사 모드도 함께 푼다 — 저장이 새 회차를 만들면 `roundId` 가 바뀌어 여기로 오고,
     * 그 회차는 이제 «실재하는 작성중 회차»라 재검사 모드로 남아 있으면 다음 저장이 또 새
     * 회차를 만든다.
     */
    setIsReinspecting(false);
    setJudgment(storedJudgment);
    setDraft(draftOf(roundId === null ? null : { acceptedQty, rejectedQty, heldQty }));
    /*
     * ⚠ **처분은 저장되지 않으므로 되돌릴 원본이 없다.** 다른 대상으로 옮겼는데 앞 대상에서
     * 고른 처분이 남아 있으면, 검사자는 그것을 «이 대상의 판단»으로 읽는다.
     */
    setDisposition(null);
    setCoverage(toCoverageDraft(coverageFromAt, coverageToAt));
    setInspectedDraft(String(storedInspectedQty));
  }, [
    targetId,
    roundId,
    acceptedQty,
    rejectedQty,
    heldQty,
    storedJudgment,
    storedInspectedQty,
    coverageFromAt,
    coverageToAt,
  ]);

  /**
   * 항목 초안은 **줄이 서거나 저장값이 바뀌면** 그 줄의 저장값으로 되돌아간다.
   *
   * ⛔ **열쇠만 보면 안 된다.** 항목 규격과 측정치는 서로 다른 조회라 **규격이 먼저 오고
   * 측정치가 나중에 온다** — 그 사이 줄의 열쇠는 그대로이므로, 열쇠만 의존성에 넣으면
   * 되돌림이 깨어나지 않아 **저장된 측정치가 화면 칸에 영영 안 붙는다.** 실제로 그 상태로
   * 화면에 나갔고, 값이 비었는데 「규격 밖」 표만 붙어 있는 모습으로 드러났다.
   *
   * 그래서 **저장값까지 포함한 지문**을 의존성으로 삼는다. 배열 참조로 넣으면 조회가 다시
   * 그려질 때마다 검사자가 치던 값이 사라지므로 참조가 아니라 **값**이어야 한다.
   */
  const rowsFingerprint = rows
    .map((row) => `${row.key}:${row.measured?.judgmentCode ?? ''}:${storedValueKey(row)}`)
    .join('|');

  useEffect(() => {
    setDrafts(toMeasurementDrafts(rows));
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- 줄 목록은 지문 문자열로 판정한다 */
  }, [rowsFingerprint, roundId, isReinspectingNow]);

  const changeInspected = (raw: string): void => {
    setIsSaved(false);
    setInspectedDraft(raw);
  };

  const changeDraft = (next: QuantityDraft): void => {
    setIsSaved(false);
    setDraft(next);
    /*
     * ⭐ **불합격이 0이 되면 고른 처분을 함께 거둔다.** 남겨 두면 화면에는 안 보이는데 값은
     * 살아 있어, 불합격을 다시 올렸을 때 사용자가 고르지 않은 처분이 되살아난다.
     */
    setDisposition((current) => settleDisposition(current, toMicro(next.rejected)));
  };

  const changeMeasurement = (key: string, next: MeasurementDraft): void => {
    setIsSaved(false);
    setDrafts((current) => ({ ...current, [key]: next }));
  };

  /**
   * 합계 판정의 오른쪽 변. **초안이 수량이면 그 값을 쓴다** — 사람이 고친 검사 수량으로
   * 견줘야 합계 제약이 실제로 검사한 수와 맞는다.
   */
  const inspectedMicro = toMicro(inspectedDraft);
  const inspectedQty = inspectedMicro === null ? 0 : Number(inspectedDraft);
  const totals = toTotals(draft, inspectedQty);

  /**
   * 이 단말이 이 공정의 검사를 입력할 수 있는가(`can_input_inspection` · F-1).
   *
   * ⚠ **단말 컨텍스트가 이 저장소에 아직 없다** — 세션이 단말 식별자를 싣지 않아 화면이
   * 플래그를 읽을 길이 없다. ⛔ **모를 때 막지 않는다**: 막으면 권한 있는 사람이 이유 없이
   * 갇힌다. 계약이 「단말 게이팅을 서버가 강제한다」고 적었으므로 정본은 서버이고, 화면의
   * 막음은 헛수고를 줄이는 편의다.
   *
   * ⭐ **이 한 자리만 실제 플래그로 바꾸면 된다** — 아래 차단 판정과 그 감지기는 이미 서 있다.
   */
  const canInputInspection = true;

  /**
   * 확정이 막혔다면 **무엇이** 막혔는지. 풀렸으면 `null`.
   *
   * ⛔ 갈래를 뭉개지 않는다 — 푸는 방법이 다르다. 권한은 단말 설정을, 합계는 수량을, 판정은
   * 선택을, 항목은 남은 줄을 고쳐야 한다.
   */
  /**
   * ⭐ **판정을 순수 함수에 맡긴다.** 조립부 안에 두면 막는 조건 하나를 지워도 아무 감지기도
   * 울지 않는다 — 실제로 그런 상태였고 뮤테이션으로 드러났다(`confirm-gate.ts` 머리 참조).
   */
  const confirmBlockedReason = toConfirmBlockedReason({
    canInputInspection,
    isLocked,
    hasRound: editingResultId !== null,
    totals,
    judgment,
    isAllJudged: isAllJudged(rows, drafts),
  });

  /**
   * 저장. **합계가 맞지 않아도 보낸다** — 임시 저장은 판정을 확정하는 것이 아니라 하던 일을
   * 남기는 것이고, 계약도 「작성중」에는 합계 제약을 걸지 않는다. **막는 것은 보낼 수 없는
   * 값이 남아 있을 때뿐이다.**
   */
  const saveBlockedReason =
    showErrors && (hasQuantityError(validateQuantities(draft)) || hasValueError(rows, drafts))
      ? t.result.saveBlockedByInvalid
      : null;

  const saveDraft = (inspectionRequestId: number, uomId: number): void => {
    setShowErrors(true);

    if (hasQuantityError(validateQuantities(draft)) || hasValueError(rows, drafts)) return;

    setIsSaved(false);

    /* 검사한 시각은 지금이다. **한 번만 읽어 두 자리가 갈리지 않게 한다.** */
    const inspectedAt = new Date().toISOString();

    save.write({
      inspectionRequestId,
      inspectedQty: toSendableNumber(inspectedDraft),
      acceptedQty: toSendableNumber(draft.accepted),
      rejectedQty: toSendableNumber(draft.rejected),
      heldQty: toSendableNumber(draft.held),
      uomId,
      /*
       * ⛔ **고른 판정을 함께 싣는다.** 싣지 않으면 저장 뒤 재조회가 저장 전 판정을 돌려주고
       * 되돌림이 사용자가 고른 값을 덮는다 — 그러고 확정하면 «고른 것과 다른 판정»이 나가는데
       * 그 쓰기는 되돌릴 수 없다.
       */
      overallJudgmentCode: judgment,
      inspectedAt,
      /*
       * ⭐ **구간이 비어 있으면 검사 시각으로 채워 보낸다.** 표본 검사는 대표 구간이 있어야
       * 불합격 시 회수 범위가 정해진다 — 비운 채 저장하면 그 근거가 영영 없다.
       */
      coverage: fillCoverage(coverage, inspectedAt),
      /*
       * 재검사면 앞 회차를 가리킨다 — 이 값이 있어야 서버가 회차를 +1 하고 사슬을 잇는다.
       * ⛔ 빠뜨리면 같은 의뢰에 회차 1이 두 번 만들어지려 해 `UNIQUE(의뢰, 회차)` 에 걸린다.
       */
      previousResultId: reinspectingFrom,
      /* ⛔ 측정치는 자체 쓰기 경로가 없다 — 결과 저장에 함께 실린다. */
      measurements: toMeasurementInputs(rows, drafts, inspectedAt),
    });
  };

  /**
   * 대상이 없거나 못 불러왔다. **네 갈래를 가른다** — 인자 없음 · 실패 · 부르는 중 · 상세.
   *
   * ⛔ 실패를 「인자 없음」으로 접지 않는다. 접으면 진입이 잘못된 것처럼 보여 검사자가
   * 작업 화면으로 돌아가는데, 돌아가서 다시 와도 같은 실패가 온다.
   */
  if (targetId === null) {
    return (
      <PqcFrame>
        <p className="field-note">{t.detail.nothingSelected}</p>
      </PqcFrame>
    );
  }

  if (detail.isError) {
    return (
      <PqcFrame>
        <QueueLoadErrorBanner
          error={toApiError(detail.error)}
          onRetry={() => void detail.refetch()}
        />
      </PqcFrame>
    );
  }

  if (detail.data === undefined) {
    return (
      <PqcFrame>
        <p className="field-note">{t.detail.loading}</p>
      </PqcFrame>
    );
  }

  return (
    <PqcFrame>
      <TargetHeader detail={detail.data} />

      <div className="pop-inspect">
        <ItemPanel
          inspectionPlanVersionId={detail.data.inspectionPlanVersionId}
          rows={rows}
          drafts={drafts}
          onChange={changeMeasurement}
          judgmentOptions={itemJudgmentOptions}
          isLoading={itemSpecs.isLoading || measurements.isLoading}
          isLocked={isLocked}
        />

        <ResultPanel
          inspectedDraft={inspectedDraft}
          onInspectedChange={changeInspected}
          inspectedQty={inspectedQty}
          round={isReinspectingNow ? null : (round?.inspectionRound ?? null)}
          isLocked={isLocked}
          isReinspecting={isReinspectingNow}
          draft={draft}
          onChange={changeDraft}
          fieldErrors={save.fieldErrors}
          showErrors={showErrors}
          coverage={coverage}
          onCoverageChange={setCoverage}
          judgmentOptions={overallOptions}
          judgment={judgment}
          onJudgmentChange={setJudgment}
          disposition={disposition}
          onDispositionChange={setDisposition}
        />
      </div>

      <ActionBar
        blockedReason={confirmBlockedReason}
        saveBlockedReason={saveBlockedReason}
        isSaved={isSaved}
        isJustConfirmed={isJustConfirmed}
        isSaving={save.isSaving || rounds.isFetching}
        isConfirming={confirm.isSaving}
        isLocked={isLocked}
        isReinspecting={isReinspectingNow}
        onSave={() => {
          saveDraft(targetId, detail.data.uomId);
        }}
        onConfirm={() => {
          confirm.write({ overallJudgmentCode: judgment });
        }}
        onStartReinspection={() => {
          /* 새 회차는 빈 칸에서 시작한다 — 앞 회차의 값이 남으면 그대로 저장된다. */
          setIsSaved(false);
          setDraft(EMPTY_QUANTITY_DRAFT);
          setDrafts({});
          setJudgment('');
          setIsReinspecting(true);
        }}
        onCancelReinspection={() => {
          setIsReinspecting(false);
          /*
           * ⛔ **확정본의 값을 되돌려 놓는다.** 비우면 그만둔 자리에 확정된 회차가 «수량
           * 없이» 놓인다 — 판정이 끝난 기록인데 화면이 비어 있으니 검사자는 자기가 방금
           * 그것을 지웠다고 읽는다.
           */
          setDraft(draftOf(round));
          setDrafts(toMeasurementDrafts(rows));
          setJudgment(storedJudgment);
        }}
      />
    </PqcFrame>
  );
};

/**
 * 저장값의 지문 한 조각. **세 칸 중 채워진 것 하나**를 문자열로 낸다 — 어느 칸인지는 항목
 * 유형이 정하고, 셋 다 비어 있는 줄(육안 항목)도 정상이다.
 */
const storedValueKey = (row: MeasurementRow): string => {
  const measured = row.measured;

  if (measured === null) return '';

  return String(measured.numericValue ?? measured.textValue ?? measured.booleanValue ?? '');
};

/** 머리와 이름은 어느 갈래에서나 같다 — 갈래마다 다시 쓰면 한쪽만 고쳐지는 자리가 된다. */
const PqcFrame = ({ children }: { children: React.ReactNode }) => (
  <>
    <PageHeader
      title={t.title}
      breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
    />
    {children}
  </>
);
