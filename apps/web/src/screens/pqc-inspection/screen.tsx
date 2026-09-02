import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState } from 'react';
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
import { FreeInputPanel } from './free-input-panel';
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
import { judgeAutomatically } from './auto-judgment';
import { toMeasurementRows, type MeasurementRow } from './measurement-rows';
import {
  RESULT_STATUS,
  useCodeValues,
  useInspectionItemSpecs,
  useInspectionRequestDetail,
  toResultBody,
} from './queries';
import { ResultPanel } from './result-panel';
import { TargetHeader } from './target-header';
import { useOnline } from './use-online';
import { useOutbox } from './outbox';
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
  const itemSpecs = useInspectionItemSpecs(detail.data?.inspectionPlanVersionId ?? null);
  /*
   * ⛔ **저장된 측정치를 부르지 않는다.** 이 화면이 부르는 경로는 셋뿐이고(요구서 §3-7)
   * 측정치 조회는 그중에 없다 — 검사자는 지금 재서 넣는다.
   */
  const rows = toMeasurementRows(itemSpecs.data ?? [], []);

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
   * 검사 수량 초안 — **사람이 넣는 값이다**(§3 도면 · §4-B). 의뢰의 대상 수량에서 시작한다:
   * 표본 검사라 둘이 다를 수 있고, 다를 때 고치는 것은 사람이다.
   */
  const [inspectedDraft, setInspectedDraft] = useState('');
  const [drafts, setDrafts] = useState<MeasurementDrafts>({});
  const [coverage, setCoverage] = useState<CoverageDraft>(EMPTY_COVERAGE_DRAFT);
  const [disposition, setDisposition] = useState<DispositionState>(null);
  const [judgment, setJudgment] = useState('');
  /** 자유 입력 — **기준 없는 갈래가 쓰는 자리**다(§5-2). */
  const [remarks, setRemarks] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isJustConfirmed, setIsJustConfirmed] = useState(false);

  /**
   * 저장 — **임시 저장과 검사 확정이 한 훅이다**(요구서 §3-7). 무엇으로 저장했는지에 따라
   * 알리는 문장이 갈린다.
   */
  const outbox = useOutbox();

  /*
   * 되돌림은 **값**으로 판정한다 — 조회 응답이 다시 그려질 때마다 참조가 달라지므로,
   * 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다.
   */
  const storedInspectedQty = detail.data?.targetQty ?? 0;
  const coverageFromAt = detail.data?.coverageFromAt ?? null;
  const coverageToAt = detail.data?.coverageToAt ?? null;

  /**
   * 대상이 바뀌면 화면을 그 대상의 시작 상태로 되돌린다.
   *
   * ⭐ **대상(`targetId`)이 의존성에 든다.** 대상이 달라졌는데 되돌리지 않으면 앞 대상에 친
   * 수량이 다음 화면에 남고, 저장이 붙는 순간 **다른 LOT 에 앞 대상의 수량을 저장**하는
   * 길이 된다.
   */
  useEffect(() => {
    setIsSaved(false);
    setIsJustConfirmed(false);
    setShowErrors(false);
    setJudgment('');
    setDraft(EMPTY_QUANTITY_DRAFT);
    /*
     * ⚠ **처분은 저장되지 않으므로 되돌릴 원본이 없다.** 다른 대상으로 옮겼는데 앞 대상에서
     * 고른 처분이 남아 있으면, 검사자는 그것을 «이 대상의 판단»으로 읽는다.
     */
    setDisposition(null);
    setRemarks('');
    setCoverage(toCoverageDraft(coverageFromAt, coverageToAt));
    setInspectedDraft(String(storedInspectedQty));
  }, [targetId, storedInspectedQty, coverageFromAt, coverageToAt]);

  /**
   * 항목 초안은 **줄이 서면** 빈 초안으로 시작한다. 저장된 측정치를 부르지 않으므로
   * (요구서 §3-7) 되돌릴 값이 없고, 검사자가 지금 재서 넣는다.
   *
   * 줄의 열쇠를 이어 붙인 문자열을 의존성으로 삼는다 — 배열 참조로 넣으면 조회가 다시
   * 그려질 때마다 검사자가 치던 값이 사라진다.
   */
  const rowKeys = rows.map((row) => row.key).join('|');

  useEffect(() => {
    setDrafts(toMeasurementDrafts(rows));
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- 줄 목록은 열쇠 문자열로 판정한다 */
  }, [rowKeys]);

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

  /**
   * 항목 한 줄을 고친다.
   *
   * ⭐ **값을 넣으면 자동 판정이 채운다**(§5-11) — 저장된 측정치를 부르지 않으므로 검사자가
   * 지금 넣는 값이 유일한 대조 대상이다. ⛔ **사람이 이미 고른 판정은 덮지 않는다.** 채운
   * 값은 시작점이지 확정이 아니고, 덮으면 사람 판단이 지워진다.
   */
  const changeMeasurement = (key: string, next: MeasurementDraft): void => {
    setIsSaved(false);
    setDrafts((current) => {
      const row = rows.find((candidate) => candidate.key === key);
      const filled =
        row !== undefined && next.judgment === ''
          ? (judgeAutomatically({ ...row, measured: toProbe(row, next.value) }) ?? '')
          : next.judgment;

      return { ...current, [key]: { ...next, judgment: filled } };
    });
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

  /**
   * 결과를 저장한다 — **임시 저장과 검사 확정이 같은 경로**이고 상태값으로 갈린다(§3-7).
   */
  const saveResult = (
    inspectionRequestId: number,
    uomId: number,
    statusCode: (typeof RESULT_STATUS)['draft'],
  ): void => {
    setShowErrors(true);

    if (hasQuantityError(validateQuantities(draft)) || hasValueError(rows, drafts)) return;

    setIsSaved(false);
    setIsJustConfirmed(false);

    /* 검사한 시각은 지금이다. **한 번만 읽어 두 자리가 갈리지 않게 한다.** */
    const inspectedAt = new Date().toISOString();

    /*
     * ⭐ **담는 순간이 곧 성공이다**(공유계약 C-1 #2). 통신을 기다리지 않는다 — 끊긴 망에서
     * 검사자가 저장 버튼 앞에 붙들려 있으면 현장이 멈춘다. 서버에 닿았는지는 머리의 미동기
     * 건수가 말한다(#4).
     */
    outbox.enqueue(
      statusCode,
      toResultBody({
        inspectionRequestId,
        inspectedQty: toSendableNumber(inspectedDraft),
        acceptedQty: toSendableNumber(draft.accepted),
        rejectedQty: toSendableNumber(draft.rejected),
        heldQty: toSendableNumber(draft.held),
        uomId,
        /*
         * ⛔ **고른 판정을 함께 싣는다** — 확정에도 임시 저장에도 이 값이 결론이다. */
        overallJudgmentCode: judgment,
        inspectedAt,
        remarks,
        statusCode,
        /*
         * ⭐ **구간이 비어 있으면 검사 시각으로 채워 보낸다.** 표본 검사는 대표 구간이 있어야
         * 불합격 시 회수 범위가 정해진다 — 비운 채 저장하면 그 근거가 영영 없다.
         */
        coverage: fillCoverage(coverage, inspectedAt),
        /* ⛔ 측정치는 자체 쓰기 경로가 없다 — 결과 저장에 함께 실린다(§4-C). */
        measurements: toMeasurementInputs(rows, drafts, inspectedAt),
      }),
    );

    setIsSaved(statusCode === RESULT_STATUS.draft);
    setIsJustConfirmed(statusCode === RESULT_STATUS.confirmed);
  };

  /**
   * 대상이 없거나 못 불러왔다. **네 갈래를 가른다** — 인자 없음 · 실패 · 부르는 중 · 상세.
   *
   * ⛔ 실패를 「인자 없음」으로 접지 않는다. 접으면 진입이 잘못된 것처럼 보여 검사자가
   * 작업 화면으로 돌아가는데, 돌아가서 다시 와도 같은 실패가 온다.
   */
  if (targetId === null) {
    return (
      <PqcFrame pendingCount={outbox.pendingCount} isOnline={outbox.isOnline}>
        <p className="field-note">{t.detail.nothingSelected}</p>
      </PqcFrame>
    );
  }

  if (detail.isError) {
    return (
      <PqcFrame pendingCount={outbox.pendingCount} isOnline={outbox.isOnline}>
        <QueueLoadErrorBanner
          error={toApiError(detail.error)}
          onRetry={() => void detail.refetch()}
        />
      </PqcFrame>
    );
  }

  if (detail.data === undefined) {
    return (
      <PqcFrame pendingCount={outbox.pendingCount} isOnline={outbox.isOnline}>
        <p className="field-note">{t.detail.loading}</p>
      </PqcFrame>
    );
  }

  const planVersionId = detail.data.inspectionPlanVersionId;

  return (
    <PqcFrame
      target={<TargetHeader detail={detail.data} />}
      pendingCount={outbox.pendingCount}
      isOnline={outbox.isOnline}
    >
      <div className="pop-inspect">
        {/*
         * ⭐ **갈래가 둘이다**(§5-2 · 통지 #589). 검사 기준이 없으면 항목표 대신 판정 선택과
         * 자유 입력만 보인다 — 기준 미등록은 현장에서 실제로 일어나고, 그때 검사를 막으면
         * 제품이 멈춘다. 어느 갈래인지는 **의뢰에 기준이 실려 있는가**로 갈린다.
         */}
        {planVersionId === null ? (
          <FreeInputPanel remarks={remarks} onRemarksChange={setRemarks} />
        ) : (
          <ItemPanel
            inspectionPlanVersionId={planVersionId}
            rows={rows}
            drafts={drafts}
            onChange={changeMeasurement}
            judgmentOptions={itemJudgmentOptions}
            isLoading={itemSpecs.isLoading}
          />
        )}

        <ResultPanel
          inspectedDraft={inspectedDraft}
          onInspectedChange={changeInspected}
          inspectedQty={inspectedQty}
          draft={draft}
          onChange={changeDraft}
          fieldErrors={outbox.rejection?.fieldErrors ?? EMPTY_FIELD_ERRORS}
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
        onSave={() => {
          saveResult(targetId, detail.data.uomId, RESULT_STATUS.draft);
        }}
        onConfirm={() => {
          saveResult(targetId, detail.data.uomId, RESULT_STATUS.confirmed);
        }}
      />
    </PqcFrame>
  );
};

/**
 * 지금 친 값을 **자동 판정이 볼 수 있는 모양**으로 감싼다. 저장된 측정치가 없으므로 대조할
 * 값은 화면의 초안뿐이다 — 수치가 아니면 잴 것이 없어 비운다.
 */
const toProbe = (row: MeasurementRow, raw: string): MeasurementRow['measured'] => {
  const numeric = Number(raw.trim());

  if (raw.trim() === '' || Number.isNaN(numeric)) return null;

  return {
    numericValue: numeric,
    textValue: null,
    booleanValue: null,
    judgmentCode: '',
    measuredAt: '',
    inspectionEquipmentId: null,
    calibrationExpired: false,
  };
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

/**
 * 머리와 이름은 어느 갈래에서나 같다 — 갈래마다 다시 쓰면 한쪽만 고쳐지는 자리가 된다.
 *
 * 도면 §3 의 **위쪽 64 한 줄**이다 — 제목이 왼쪽, 대상이 오른쪽에 선다. 관리웹의
 * `PageHeader` + `Breadcrumb` 를 쓰지 않는다: 이 화면은 POP 라우트라 관리웹 셸
 * (`AppLayout`) 밖에 서고, 사이드바로 오가지 않아 **돌아갈 경로가 없다.**
 *
 * ⚠ 도면의 단말명·연결 표시(`POP-L1 ●`)는 아직 그리지 않는다 — 단말 컨텍스트가 이 저장소에
 * 서지 않았다(`patterns/pop-identity`). 모르는 것을 지어내지 않는다.
 */
/** 거부가 없을 때 넘길 빈 목록. 렌더마다 새로 만들면 아래 구획이 매번 다시 그려진다. */
const EMPTY_FIELD_ERRORS: Record<string, string> = {};

const PqcFrame = ({
  children,
  target,
  pendingCount,
  isOnline,
}: {
  children: React.ReactNode;
  target?: React.ReactNode;
  pendingCount: number;
  isOnline: boolean;
}) => {
  const titleId = useId();

  return (
    <main className="pop-shell" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        {target}
        {/*
         * 도면 §3 머리 오른쪽 끝의 상태 표식이다. **어느 갈래에서나 선다** — 대상을 못
         * 불러온 화면이야말로 「연결이 끊겨서인가」를 물을 자리다.
         *
         * ⭐ **미동기 건수가 필수 요건이다**(공유계약 C-1 #4). 「담는 순간 성공」을 택한
         * 결정의 전제가 이것이라, 없으면 서버에 닿지 않은 사실을 알 방법이 사라진다.
         * **연결 상태도 함께 낸다 — 끊긴 것과 밀리는 것은 다르다**(`P-02-03` 전례).
         */}
        <Chip variant="status" size="sm" status={pendingCount > 0 ? 'warning' : 'success'}>
          {pendingCount > 0 ? messages.common.connection.unsent(pendingCount) : t.header.synced}
        </Chip>
        {!isOnline && (
          <Chip variant="status" size="sm" status="error">
            {messages.common.connection.offline}
          </Chip>
        )}
      </header>
      {children}
    </main>
  );
};
