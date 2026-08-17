import { Breadcrumb, Button, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { readSourceLineId, readSourceReceiptId, withSourceLineId } from './entry';
import { HeaderForm } from './header-form';
import {
  addLineDraft,
  createInheritedLineDraft,
  patchLineDraft,
  removeLineDraft,
} from './line-draft';
import { LineTable } from './line-table';
import { LoadErrorBanner } from './load-error-banner';
import {
  lookupNote,
  useBusinessUnitOptions,
  useItemOptions,
  usePlantOptions,
  useSupplierOptions,
  useUomOptions,
  type LookupResult,
} from './lookups';
import { useSourceReceipt } from './queries';
import { ScopeBanner } from './scope-banner';
import { SourceReceiptPane } from './source-receipt-pane';
import {
  EMPTY_HEADER_DRAFT,
  seedHeaderDraft,
  type HeaderDraft,
  type LineDraft,
  type SelectOption,
  type SourceLineView,
} from './types';
import { supplierChangeWarning, validateHeader, validateLines } from './validation';

const t = messages.poRegister;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_LINES: SourceLineView[] = [];
const EMPTY_DRAFTS: LineDraft[] = [];
const NO_FIELD_ERRORS: Record<string, string> = {};

/**
 * 참조 목록을 선택지로 옮긴다.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다** — 참조를 `includeInactive=true`로 받는 이유는
 * 미사용 값을 참조하는 과거 자료의 이름을 풀기 위해서인데, 빼면 그 값을 고를 수도 없다.
 */
const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/**
 * W-01-11 컨테이너 — **초과 입하분을 사후에 정산하는 발주 등록 화면**이다.
 *
 * 배치는 위에서 아래로 쌓는다 — 범위 안내 · 넘어온 초과분(읽기 전용) · 발주 정보 · 발주 라인 ·
 * 등록. 진입 맥락(`receipt`·`line`)은 **주소가 소유한다**(계획 결정 2) — 새로고침·뒤로가기·
 * 공유가 같은 초과분을 연다. **친 값은 주소에 싣지 않는다.**
 *
 * **이 회차는 보내지 않는다.** 등록 버튼은 서면서 늘 잠겨 있고, 왜 잠겼는지를 사유가 말한다 —
 * 사유를 감추고 버튼만 두면 눌러도 아무 일이 없는 버튼이 된다. 실제 등록은 뒤따르는 회차가 붙인다.
 *
 * **무엇이 바뀔 때 무엇을 비우는가 — 수명 표.**
 *
 * | # | 조작 | `receipt` | `line` | 발주 정보 | 라인 초안 |
 * | :-: | --- | :-: | :-: | :-: | :-: |
 * | 1 | 첫 진입(맥락 있음) | 주소 | 주소 또는 자동 확정 | **승계로 채운다** | **승계 줄 1행** |
 * | 2 | 대상 줄 바꾸기 | 유지 | 바뀐다(`replace`) | **다시 승계한다** | **다시 세운다** |
 * | 3 | 발주 정보·라인 치기 | 유지 | 유지 | 바뀐다 | 바뀐다 |
 * | 4 | 참조 응답 도착 | 유지 | 유지 | **건드리지 않는다** | **건드리지 않는다** |
 * | 5 | 맥락 없이 진입 | 없음 | 없음 | 비어 있다 | 비어 있다 |
 *
 * 4행이 이 화면의 `omf-mes#43` 자리다 — 되돌림 effect의 의존성은 **고른 줄과 입하 응답 둘뿐**이다.
 * 참조 도착·부모 리렌더에 반응하면 사용자가 값을 치는 도중에 입력이 사라진다.
 */
export const PoRegisterScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const sourceReceiptId = readSourceReceiptId(searchParams);
  const urlLineId = readSourceLineId(searchParams);

  const source = useSourceReceipt(sourceReceiptId);
  const sourceData = source.data;
  const sourceLines = sourceData?.lines ?? EMPTY_LINES;

  const suppliers = useSupplierOptions();
  const businessUnits = useBusinessUnitOptions();
  const plants = usePlantOptions();
  const items = useItemOptions();
  const uoms = useUomOptions();

  /**
   * 대상으로 확정된 줄.
   *
   * **한 줄이면 자동으로 확정되고, 여럿이면 고른 줄만 대상이다**(계획 결정 4).
   * 주소가 목록에 없는 줄을 가리키면 고르지 않은 것으로 본다 — 주소는 손으로 고쳐지는 자리라
   * 없는 줄을 승계하면 화면이 지어낸 값이 전표에 실린다.
   */
  const chosenLine = useMemo<SourceLineView | null>(() => {
    if (sourceLines.length === 1) return sourceLines[0] ?? null;

    return sourceLines.find((line) => line.inboundReceiptLineId === urlLineId) ?? null;
  }, [sourceLines, urlLineId]);

  const [header, setHeader] = useState<HeaderDraft>(EMPTY_HEADER_DRAFT);
  const [lines, setLines] = useState<LineDraft[]>(EMPTY_DRAFTS);

  /**
   * 대상이 정해지면 발주 정보와 라인 1행을 **승계로 세운다**(수명 표 1·2행).
   *
   * 의존성은 **고른 줄과 입하 응답 둘뿐이다.** 참조 도착·부모 리렌더는 이 effect를 깨우지
   * 않는다 — 깨우면 사용자가 치는 도중에 값이 되돌아간다.
   */
  const chosenLineId = chosenLine?.inboundReceiptLineId ?? null;

  useEffect(() => {
    if (sourceData === undefined || chosenLine === null) {
      setHeader(EMPTY_HEADER_DRAFT);
      setLines(EMPTY_DRAFTS);

      return;
    }

    setHeader(seedHeaderDraft(sourceData.receipt));
    setLines([createInheritedLineDraft(chosenLine)]);
    /* `chosenLine`은 응답 배열에서 찾은 값이라 응답이 같으면 참조도 같다 — 번호로 좁히지 않는다. */
  }, [sourceData, chosenLine]);

  /**
   * 대상을 고른다. **주소를 `replace`로 갱신한다**(사본 체크리스트 1번) —
   * 고를 때마다 히스토리가 쌓이면 뒤로가기가 앞선 선택으로 되돌아가 초안이 말없이 다시 세워진다.
   */
  const chooseLine = (inboundReceiptLineId: number): void => {
    setSearchParams(withSourceLineId(searchParams, inboundReceiptLineId), { replace: true });
  };

  const changeHeader = (patch: Partial<HeaderDraft>): void => {
    setHeader((prev) => ({ ...prev, ...patch }));
  };

  const patchLine = (key: string, patch: Partial<Omit<LineDraft, 'key'>>): void => {
    setLines((prev) => patchLineDraft(prev, key, patch));
  };

  const removeLine = (key: string): void => {
    setLines((prev) => removeLineDraft(prev, key));
  };

  const addLine = (): void => {
    setLines((prev) => addLineDraft(prev));
  };

  const lineValidation = validateLines(lines);
  const headerErrors = validateHeader(header);

  /**
   * 등록이 막힌 사유. **순서가 뜻을 정한다** — 먼저 풀어야 하는 것부터 말한다.
   * 앞의 사정이 남아 있는데 뒤의 사정을 말하면 사용자가 풀 수 없는 조치를 시도한다.
   */
  const registerBlockReason = (): string => {
    if (sourceReceiptId === null) return t.actionReasons.noContext;
    if (sourceData === undefined) return t.actionReasons.sourceNotLoaded;
    if (chosenLine === null) return t.actionReasons.sourceLineNotChosen;
    /* **잘못 친 값이 아직 안 친 칸보다 먼저다** — 지금 고칠 수 있는 것을 먼저 말한다. */
    if (Object.keys(lineValidation.errors).length > 0) return t.actionReasons.lineInvalid;
    if (Object.keys(headerErrors).length > 0) return t.actionReasons.headerIncomplete;

    /* 보낼 자리가 아직 없다. 값이 다 갖춰졌다는 사실과 보낼 수 없다는 사실을 함께 말한다. */
    return t.actionReasons.unavailable;
  };

  const registerReasonId = useId();

  /** 이름이 보이는 자리가 하나뿐이라 복구 수단도 한 곳에 둔다 — 다섯을 함께 다시 부른다. */
  const retryReferences = (): void => {
    suppliers.refetch();
    businessUnits.refetch();
    plants.refetch();
    items.refetch();
    uoms.refetch();
  };

  const sourcePaneContent = () => {
    if (sourceReceiptId === null) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noContextTitle}
          description={t.empty.noContextDescription}
        />
      );
    }

    /* 실패는 위 배너가 말한다 — 여기서 빈 상태로 내면 자료가 없는 것으로 읽힌다. */
    if (source.isError) return null;

    if (sourceData === undefined) {
      return (
        <div role="status" aria-label={t.loading.sourceReceipt}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <SourceReceiptPane
        receipt={sourceData.receipt}
        lines={sourceData.lines}
        chosenLineId={chosenLineId}
        supplierLookup={suppliers}
        plantLookup={plants}
        itemLookup={items}
        uomLookup={uoms}
        onChoose={chooseLine}
        onRetryReferences={retryReferences}
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {/* 범위 안내는 **늘 선다** — 맥락 유무로 접히면 정작 잘못 들어온 사람이 읽지 못한다. */}
      <ScopeBanner />

      {source.isError && (
        <LoadErrorBanner
          error={source.error}
          onRetry={() => {
            void source.refetch();
          }}
        />
      )}

      <section className="pane" aria-label={t.panes.source}>
        {sourcePaneContent()}
      </section>

      {sourceData !== undefined && (
        <section className="pane" aria-label={t.panes.header}>
          <HeaderForm
            values={header}
            supplierOptions={toSelectOptions(suppliers)}
            businessUnitOptions={toSelectOptions(businessUnits)}
            plantOptions={toSelectOptions(plants)}
            supplierNote={lookupNote(suppliers)}
            businessUnitNote={lookupNote(businessUnits)}
            plantNote={lookupNote(plants)}
            /* 오류는 **등록을 누른 뒤에** 보인다 — 그 배선은 보내는 회차가 붙인다. */
            fieldErrors={NO_FIELD_ERRORS}
            supplierWarning={
              supplierChangeWarning(header, sourceData.receipt.supplierId) ?? undefined
            }
            onChange={changeHeader}
          />
        </section>
      )}

      {sourceData !== undefined && (
        <section className="pane" aria-label={t.panes.lines}>
          {chosenLine === null ? (
            <EmptyState
              size="sm"
              title={t.empty.noTargetTitle}
              description={t.empty.noTargetDescription}
            />
          ) : (
            <>
              <LineTable
                rows={lines}
                errors={lineValidation.errors}
                warnings={lineValidation.warnings}
                itemLookup={items}
                uomLookup={uoms}
                itemOptions={toSelectOptions(items)}
                uomOptions={toSelectOptions(uoms)}
                onPatch={patchLine}
                onRemove={removeLine}
              />

              <p className="field-note">{t.notes.lineNoAssignedByServer}</p>

              <div className="filter-bar">
                <div className="field-cell">
                  <Button variant="outlined" onClick={addLine}>
                    {t.actions.addLine}
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/*
       * 등록은 **늘 서고 늘 잠겨 있다**(이 회차 한정). 사유는 감추지 않고 항상 보이는 DOM
       * 텍스트로 렌더해 `aria-describedby`로 잇는다 — 잠긴 컨트롤은 포커스를 받지 못해
       * 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다(배치 규범 4).
       */}
      <div className="form-actions">
        <div className="field-cell">
          <Button variant="outlined" disabled aria-describedby={registerReasonId}>
            {t.actions.register}
          </Button>
          <span id={registerReasonId} className="field-note">
            {registerBlockReason()}
          </span>
        </div>
      </div>
    </>
  );
};
