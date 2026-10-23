import { Button, Dialog, SkeletonText, Stepper, TextField, type StepperItem } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { plantNowLocal } from '../../patterns/plant-time';
import { codeLabel, SUBSTITUTE_LOT_REASON_GROUP, toCodeOptions } from './code-options';
import { CreatedReceiptsPane } from './created-receipts-pane';
import { DiscardConfirmDialog } from './discard-confirm-dialog';
import { guideHint, guideStatuses, guideStep, GUIDE_STEPS } from './guide';
import {
  createDrafts,
  hasAnyLineInput,
  readDraft,
  setDraftLot,
  setDraftQty,
  type LineDrafts,
  type LotDraft,
} from './line-draft';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  toReference,
  useItemNames,
  usePlantOptions,
  useSupplierOptions,
  useUomOptions,
} from './lookups';
import { applyLotScan } from './lot-scan';
import { useCodeValues, usePurchaseOrderDetail, useSplitRegister } from './queries';
import { ReceiptHeaderForm } from './receipt-header-form';
import { RegisterActions } from './register-actions';
import { RegisterConfirmDialog } from './register-confirm-dialog';
import { hasLineError, toSplitLines, type ItemCodeResolver } from './split-calc';
import { SplitLineTable } from './split-line-table';
import { toReceiptLines, toSplitRequest } from './split-request';
import {
  EMPTY_HEADER_DRAFT,
  toCreatedReceiptView,
  type CreatedResult,
  type HeaderDraft,
  type PoLineView,
  type PoView,
} from './types';
import { lineErrorReason, registerBlockReason, validateHeader } from './validation';

const t = messages.overReceiptSplit;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_LINES: PoLineView[] = [];
const EMPTY_ITEM_IDS: number[] = [];
const EMPTY_DRAFTS: LineDrafts = {};
const NO_FIELD_ERRORS: Record<string, string> = {};

const isSameHeader = (left: HeaderDraft, right: HeaderDraft): boolean =>
  left.receiptDatetime === right.receiptDatetime &&
  left.deliveryNoteNo === right.deliveryNoteNo &&
  left.remarks === right.remarks;

/** 입하 일시는 **공장 현지 지금**으로 채운다 — 대개 받자마자 등록하고, 아니면 고친다. */
const freshHeader = (): HeaderDraft => ({
  ...EMPTY_HEADER_DRAFT,
  receiptDatetime: plantNowLocal(),
});

export interface ReceiptRegisterPanelProps {
  /** 받을 발주. 창은 이 번호 하나로 선다 — 발주 머리와 라인을 상세 하나로 받는다. */
  purchaseOrderId: number;
  /** 등록 뒤 함께 다시 읽을 것 — 창을 연 화면의 표. */
  refreshKeys?: readonly (readonly unknown[])[];
  /** 등록 결과의 「초과분 발주 연결」 — 방금 만든 전표를 앞에 세운 연결 창으로 간다. */
  onOpenExcess: (inboundReceiptNo: string) => void;
  onClose: () => void;
}

/**
 * W-01-03 「입하 등록」 창 — **입하 예정 조회에서 오른쪽으로 열린다**(사용자 지시 2026-10-21 · 입하·입고 일을
 * 그 화면으로 모은다). 고른 발주의 라인마다 도착 수량과 공급사 LOT 을 받아 입하 전표 한 건으로 등록한다.
 *
 * **전표는 늘 한 건이다**(서버 장부 P-100). 발주보다 많이 와도 줄을 가르지 않고, 줄 하나 · LOT 하나로 받아
 * P/O 에 넣지 않는 몫을 그 줄의 `excessQty` 로 싣는다. 그 몫은 추가 발주가 오면 초과분 연결에서 연결한다.
 *
 * **되돌릴 수 없는 쓰기다.** 입하 취소는 승인을 타므로 잘못 만들어진 전표를 이 창이 되돌릴 수 없다.
 * 그래서 보내기 전에 네 겹으로 막는다 — ① 실릴 줄이 있는가 ② 머리 입력 검증 ③ 고치지 않은 줄(수량·LOT)
 * ④ 무엇이 나가는지 보이는 확인 창. **보내는 중에는 창을 닫지 못한다.**
 *
 * **초안은 주소에 싣지 않는다** — 글자마다 뒤로가기 기록이 쌓인다. 다른 발주를 열면 창을 새로 세운다
 * (부르는 쪽이 `key` 로 발주 번호를 준다).
 */
export const ReceiptRegisterPanel = ({
  purchaseOrderId,
  refreshKeys,
  onOpenExcess,
  onClose,
}: ReceiptRegisterPanelProps) => {
  const detail = usePurchaseOrderDetail(purchaseOrderId);
  const purchaseOrder: PoView | null = detail.data?.purchaseOrder ?? null;
  const lineData = detail.data?.lines;

  const suppliers = useSupplierOptions();
  const plants = usePlantOptions();
  const uoms = useUomOptions(true);
  const lotReasons = useCodeValues(SUBSTITUTE_LOT_REASON_GROUP, true);
  const lotReasonOptions = useMemo(() => toCodeOptions(lotReasons.data), [lotReasons.data]);

  /* 품목 이름·코드는 **라인이 온 뒤에** 그 줄에 실린 번호만 묻는다(`lookups.ts`의 ⛔ 둘). */
  const items = useItemNames(lineData?.map((line) => line.itemId) ?? EMPTY_ITEM_IDS);
  const itemCodeOf: ItemCodeResolver = (itemId) => items.detail(itemId)?.itemCode ?? null;

  /** 라인별 도착 수량·LOT 초안. */
  const [drafts, setDrafts] = useState<LineDrafts>(EMPTY_DRAFTS);

  /*
   * **#43을 재생산하지 않는 자리다.** 의존성은 **상세 응답의 라인 하나뿐이다** — 참조가 같으면(캐시가 같은
   * 내용을 유지하면) 깨어나지 않아 치던 수량이 사라지지 않는다.
   */
  useEffect(() => {
    setDrafts(createDrafts(lineData ?? EMPTY_LINES));
  }, [lineData]);

  /**
   * 라인 바깥의 초안. `baseline` 은 창이 채운 기본값이다 — 「버릴 것이 있는가」는 기본값과 **다른지**로 잰다.
   */
  const [baseline] = useState<HeaderDraft>(freshHeader);
  const [header, setHeader] = useState<HeaderDraft>(baseline);

  /** 만들어진 전표와 실린 초과 몫. `null`이면 아직 등록하지 않았거나 마지막 시도가 실패했다. */
  const [created, setCreated] = useState<CreatedResult | null>(null);

  /**
   * 방금 보낸 초과 몫. 되먹임(`onSuccess`)에서 읽는다 — 되먹임은 제출한 렌더의 닫힘을 들고 있어
   * 그 렌더의 옛 값을 보므로 상태가 아니라 ref 에 적는다. 성공하면 초안이 비워져 다시 셀 수 없다.
   */
  const submittedExcessRef = useRef<CreatedResult['excessLines']>([]);

  /** 보내기 전에 창이 잡은 오류. **등록을 누른 뒤에만 세운다.** */
  const [localFieldErrors, setLocalFieldErrors] = useState<Record<string, string>>(NO_FIELD_ERRORS);

  /** 고치지 않은 줄 때문에 막았다는 사실. 사용자가 고치면 조건이 풀려 저절로 사라진다 */
  const [isLineBlockShown, setLineBlockShown] = useState(false);

  /** 닫기 전에 버릴지 묻는 중인가. */
  const [isDiscardOpen, setDiscardOpen] = useState(false);

  /** 확인 창이 열려 있는가(④). 검증을 통과한 뒤에만 선다. */
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  /** 라벨 스캔 칸. 결과 한 줄은 칸 아래 산다. */
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanText, setScanText] = useState('');
  const [scanNote, setScanNote] = useState<string | null>(null);

  /** 등록 결과 — 성공하면 그 자리로 끌어 올린다(창 아래쪽 입력을 보던 중이다). */
  const resultRef = useRef<HTMLDivElement>(null);

  const register = useSplitRegister({
    purchaseOrderId,
    refreshKeys,
    onSuccess: (data) => {
      setCreated({
        receipts: data.created.map(toCreatedReceiptView),
        excessLines: submittedExcessRef.current,
      });
      /* **초안을 비운다**(이중 제출 완화의 한 층). 머리는 기본값으로 돌아간다. */
      setDrafts(EMPTY_DRAFTS);
      setHeader(baseline);
      setLocalFieldErrors(NO_FIELD_ERRORS);
      setLineBlockShown(false);
    },
  });

  useEffect(() => {
    if (created !== null) resultRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [created]);

  /** 버릴 것이 있는가. 라인 입력(수량·LOT)과 머리 입력을 **함께** 본다. */
  const hasDraft = hasAnyLineInput(drafts) || !isSameHeader(header, baseline);

  /** 닫기(머리 ×·Esc·「취소」) — 보내는 중에는 닫지 않고, 버릴 것이 있으면 묻는다. 서버를 부르지 않는다. */
  const requestClose = (): void => {
    if (register.isSaving) return;
    if (hasDraft) {
      setDiscardOpen(true);

      return;
    }
    onClose();
  };

  /**
   * **읽는 자리에서 파생한다.** 잔량·P/O 반영·초과분·LOT 사유는 `split-calc.ts`가 한 번만 만들고
   * 표는 그 결과를 그리기만 한다 — **요청 조립도 같은 결과를 받는다.**
   */
  const splitLines = toSplitLines(lineData ?? EMPTY_LINES, drafts, itemCodeOf);

  const changeQty = (purchaseOrderLineId: number, text: string): void => {
    setDrafts((prev) => setDraftQty(prev, purchaseOrderLineId, text));
  };

  /**
   * LOT 칸. 「라벨 없음」을 켜면 대체 사유를 **첫 선택지로 미리 채운다** — 사유 없이는 보낼 수 없어 어차피
   * 하나를 골라야 하고, 가장 흔한 사유(라벨 없음)가 첫째다. 다른 사유면 바꾼다.
   */
  const changeLot = (purchaseOrderLineId: number, patch: Partial<LotDraft>): void => {
    const defaultReason = lotReasonOptions[0]?.value ?? '';
    setDrafts((prev) => {
      const current = readDraft(prev, purchaseOrderLineId).lot;
      const filled =
        patch.labelMissing === true && (patch.reasonCode ?? current.reasonCode) === ''
          ? { ...patch, reasonCode: defaultReason }
          : patch;

      return setDraftLot(prev, purchaseOrderLineId, filled);
    });
  };

  /** 잔량이 남은 줄 중 아직 비운 줄에 잔량을 넣는다 — 「전부 왔다」가 흔한 출발점이다. */
  const fillRemaining = (): void => {
    setDrafts((prev) =>
      splitLines.reduce(
        (next, row) =>
          row.remainingQty > 0 &&
          readDraft(prev, row.line.purchaseOrderLineId).qtyText.trim() === ''
            ? setDraftQty(next, row.line.purchaseOrderLineId, String(row.remainingQty))
            : next,
        prev,
      ),
    );
  };

  /** 라벨 스캔 — 품목코드로 줄을 찾아 수량과 LOT 을 담는다(규칙은 `lot-scan.ts`). 칸은 비워 다음 스캔을 받는다. */
  const scan = (): void => {
    const result = applyLotScan(scanText, lineData ?? EMPTY_LINES, drafts, itemCodeOf);
    setScanNote(result.note);
    if (result.applied) {
      setDrafts(result.drafts);
      setScanText('');
    }
  };

  /** 실제로 요청에 실릴 줄 수. **세는 자리와 보내는 자리가 같다** — 갈리면 빈 전표가 나간다. */
  const receiptLines = toReceiptLines(splitLines);
  const counts = {
    lines: receiptLines.length,
    excessLines: receiptLines.filter((line) => (line.excessQty ?? 0) > 0).length,
  };

  /* 사용자가 고치면 조건이 풀려 안내가 저절로 사라진다 — 지워 주는 절차를 따로 두지 않는다. */
  const lineBlockReason = isLineBlockShown ? lineErrorReason(splitLines) : null;

  /**
   * 등록 단추 — **보내기 전에 두 겹을 본다**(머리 입력 · 고치지 않은 줄). 통과하면 확인 창을 연다(④).
   * 막히면 **요청을 만들지 않는다** — 되돌릴 수 없는 쓰기라 「보내 보고 서버가 막아 주기」를 기대할 수 없다.
   */
  const requestSubmit = (): void => {
    const headerErrors = validateHeader(header);
    const lineBlocked = lineErrorReason(splitLines) !== null;

    setLocalFieldErrors(headerErrors);
    setLineBlockShown(lineBlocked);

    if (Object.keys(headerErrors).length > 0 || lineBlocked) return;

    setConfirmOpen(true);
  };

  /** 확인 창의 「등록」. 요청을 만들어 보낸다. */
  const submit = (target: PoView): void => {
    /* 실패하면 결과 구획이 비어 있어야 한다 — 앞 성공의 번호가 남으면 오해한다. */
    setCreated(null);
    /* 요청을 만들기 전에 적는다 — 되먹임이 이 값을 읽는다(위 ref 주석). 매 제출마다 새로 적는다. */
    submittedExcessRef.current = splitLines.flatMap((row) =>
      row.split !== null && row.split.excessQty > 0
        ? [{ lineNo: row.line.lineNo, excessQty: row.split.excessQty }]
        : [],
    );

    register.write(
      toSplitRequest({
        purchaseOrder: target,
        rows: splitLines,
        header,
        /* 발생 시각은 **제출 순간**이다. 순수 함수에 넘겨 그 사실이 인자로 드러나게 한다. */
        now: new Date(),
      }),
    );
  };

  /** 머리 입력을 고치면 그 칸의 옛 오류(서버·화면 둘 다)를 지운다 — 남아 있으면 무엇을 고쳐야 하는지 알 수 없다. */
  const changeHeader = (patch: Partial<HeaderDraft>): void => {
    setHeader((prev) => ({ ...prev, ...patch }));

    for (const field of Object.keys(patch)) {
      register.clearFieldError(field);
      setLocalFieldErrors((prev) => {
        if (!(field in prev)) return prev;

        const next = { ...prev };
        delete next[field];

        return next;
      });
    }
  };

  const fieldErrors = { ...register.fieldErrors, ...localFieldErrors };

  /** 참조 실패의 복구 경로 — 라인 표 머리의 공급사 이름도 이 한 자리가 다시 부른다(옛 화면은 목록이 맡았다). */
  const retryLineReferences = (): void => {
    suppliers.refetch();
    items.refetch();
    uoms.refetch();
    plants.refetch();
  };

  /** 등록할 대상. **라인 표가 그려지는 조건과 같다** — 갈리면 표는 없는데 폼만 있는 상태가 생긴다. */
  const registerTarget = detail.isSuccess ? purchaseOrder : null;

  /* 라인이 서면 스캔 칸이 입력을 받는다 — 스캐너는 키보드처럼 글자와 Enter 를 보낸다. */
  useEffect(() => {
    if (registerTarget !== null) scanRef.current?.focus();
  }, [registerTarget]);

  const toolbar = (
    <div className="ors-toolbar">
      <div className="field-cell ors-scan">
        <TextField
          ref={scanRef}
          fullWidth
          label={t.scan.label}
          placeholder={t.scan.placeholder}
          value={scanText}
          autoComplete="off"
          disabled={register.isSaving}
          onChange={(event) => {
            setScanText(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              scan();
            }
          }}
        />
        {scanNote !== null && (
          <span className="field-note" role="status">
            {scanNote}
          </span>
        )}
      </div>
      <div className="field-cell field-cell-unlabeled">
        <Button variant="outlined" size="sm" disabled={register.isSaving} onClick={fillRemaining}>
          {t.actions.fillRemaining}
        </Button>
      </div>
    </div>
  );

  const linePane = (): ReactNode => {
    if (detail.isError) {
      return (
        <LoadErrorBanner
          error={detail.error}
          onRetry={() => {
            void detail.refetch();
          }}
        />
      );
    }
    if (purchaseOrder === null) {
      return (
        <div role="status" aria-label={t.loading.lines}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <SplitLineTable
        purchaseOrder={purchaseOrder}
        supplierName={describeReference(toReference(suppliers, purchaseOrder.supplierId))}
        supplierFailed={suppliers.isError}
        rows={splitLines}
        isLoading={false}
        /* 공장은 **참조 자체**를 넘긴다 — 이 구획이 실패 안내와 다시 시도를 소유한다. */
        plantLookup={plants}
        itemNames={items}
        uomLookup={uoms}
        lotReasonOptions={lotReasonOptions}
        isLocked={register.isSaving}
        showLotErrors={isLineBlockShown}
        toolbar={toolbar}
        onChangeQty={changeQty}
        onChangeLot={changeLot}
        onRetryReferences={retryLineReferences}
      />
    );
  };

  /**
   * 단계 안내(`guide.ts`) — 창 상태에서 지금 할 일을 정한다. 머리 입력은 **지금** 검증해 보되 붉은 글씨는
   * 내지 않는다(그것은 등록을 누른 뒤의 일). 단계는 안내일 뿐 아무 단추도 잠그지 않는다.
   */
  const step = guideStep({
    hasOrder: registerTarget !== null,
    counts,
    hasLineError: hasLineError(splitLines),
    headerErrorCount: Object.keys(validateHeader(header)).length,
  });
  const statuses = guideStatuses(step);
  const guideItems: StepperItem[] = GUIDE_STEPS.map((key) => ({
    label: t.guide.steps[key],
    status: statuses[key],
  }));

  /** 아래 띠 — 오류 · 누르기 전 요약 · 단추. 창 몸이 길어도 늘 보인다. */
  const footer = (
    <div className="register-footer">
      {/* 저장 실패는 **세 갈래**다(계획 결정 9) — 검증 실패(400)·권한 없음(403)·응답 없음(네트워크). */}
      <SaveErrorBanner error={register.error} />

      {/* **응답을 받지 못한 실패에만 한 줄을 더한다** — 확인 없이 다시 보내면 같은 입하가 전표 두 벌로 남는다. */}
      {register.error?.kind === 'network' && (
        <p className="field-error">{t.notes.registerRecheck}</p>
      )}

      {lineBlockReason !== null && <p className="field-error">{lineBlockReason}</p>}

      <div className="register-footer-row">
        <p className="ors-totals" aria-live="polite">
          {counts.lines === 0 ? (
            t.totals.none
          ) : (
            <>
              <span>{t.totals.label}:</span>
              <strong>{t.totals.receipt(counts.lines)}</strong>
              {counts.excessLines > 0 && <strong>{t.totals.excess(counts.excessLines)}</strong>}
            </>
          )}
        </p>

        <RegisterActions
          blockReason={registerBlockReason(counts)}
          isSaving={register.isSaving}
          onSubmit={requestSubmit}
          onCancel={requestClose}
        />
      </div>
    </div>
  );

  return (
    <>
      <Dialog
        open
        onClose={requestClose}
        placement="right"
        size="lg"
        className="register-dialog"
        title={t.title}
        footer={footer}
      >
        <div className="register-panel">
          <nav className="ors-guide" aria-label={t.guide.label}>
            <Stepper size="sm" steps={guideItems} />
            <p className="ors-guide-hint" aria-live="polite">
              {guideHint(step)}
            </p>
          </nav>

          {/* 결과는 **따로 선 자리**다 — 다음 등록을 준비하는 입력과 방금 만들어진 번호가 섞이지 않게. */}
          {created !== null && (
            <div ref={resultRef} className="po-board-register">
              <CreatedReceiptsPane result={created} onOpenExcess={onOpenExcess} />
            </div>
          )}

          <section className="register-section" aria-label={t.panes.lines}>
            {linePane()}
          </section>

          {registerTarget !== null && (
            <section className="register-section" aria-label={t.panes.register}>
              <h3 className="ors-section-title">{t.form.headerTitle}</h3>
              <ReceiptHeaderForm
                values={header}
                fieldErrors={fieldErrors}
                isSaving={register.isSaving}
                onChange={changeHeader}
              />
            </section>
          )}
        </div>
      </Dialog>

      {isConfirmOpen && registerTarget !== null && (
        <RegisterConfirmDialog
          counts={counts}
          purchaseOrderNo={registerTarget.purchaseOrderNo}
          supplierName={describeReference(toReference(suppliers, registerTarget.supplierId))}
          header={header}
          lotReasonLabel={(code) => codeLabel(lotReasonOptions, code)}
          rows={splitLines.filter((row) => row.split !== null)}
          itemLabelOf={(itemId) => describeReference(items.of(itemId))}
          uomLabelOf={(uomId) => describeReference(toReference(uoms, uomId))}
          onConfirm={() => {
            setConfirmOpen(false);
            submit(registerTarget);
          }}
          onClose={() => {
            setConfirmOpen(false);
          }}
        />
      )}

      {isDiscardOpen && (
        <DiscardConfirmDialog
          onConfirm={() => {
            setDiscardOpen(false);
            onClose();
          }}
          onClose={() => {
            setDiscardOpen(false);
          }}
        />
      )}
    </>
  );
};
