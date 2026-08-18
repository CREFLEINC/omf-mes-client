import {
  AlertBanner,
  Breadcrumb,
  Button,
  EmptyState,
  PageHeader,
  SkeletonText,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { AdjustLineTable, type AdjustLineRow } from './adjust-line-table';
import { toBookQty, type BookQtyState } from './balances';
import {
  isReasonCodeListPending,
  PLACEHOLDER_STOCK_ADJUST_CODES,
  toCodeOptionSets,
} from './code-options';
import { readInventoryCountId, withInventoryCountId, withoutInventoryCountId } from './entry';
import {
  addLineDraft,
  createInheritedLineDrafts,
  patchLineDraft,
  removeLineDraft,
} from './line-draft';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  toSelectOptions,
  useItemLookup,
  useLocationLookup,
  useLotLookup,
  useUomLookup,
  useWarehouseLookup,
} from './lookups';
import {
  UNASKED_BALANCE,
  useCountVarianceLines,
  useInventoryCounts,
  useLocationBalances,
} from './queries';
import { SourcePane } from './source-pane';
import { applySourceChange, initialSourceKind, type AdjustSourceKind } from './source';
import type { AdjustLineDraft, SelectOption } from './types';
import { excludedLineCount, validateLines } from './validation';

const t = messages.stockAdjust;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_IDS: number[] = [];

/** 값 목록이 확정되지 않은 코드. **한 번만 옮긴다** — 배열이 상수라 렌더마다 다시 만들 이유가 없다. */
const CODE_OPTIONS = toCodeOptionSets(PLACEHOLDER_STOCK_ADJUST_CODES);

/**
 * W-01-12 컨테이너 — **장부와 실물이 어긋난 것을 조정 전표로 만드는 화면**이다.
 *
 * 이 회차가 세우는 것은 **조정 대상**까지다. 등록·상신·전기와 처리 이력은 뒤따르는 회차가
 * 붙이고, 그동안 라우트는 닫혀 있다.
 *
 * ⭐ **잔량을 직접 고치지 않는다**(조심 ③ · D-5). 표는 「장부 · 실물 · 차이」 세 열로 서고
 * **입력칸은 차이 하나**다 — 실물은 `장부 + 차이`로 파생한다. 화면 맨 위의 범위 안내가 그
 * 사실을 상시 밝힌다.
 *
 * ⛔ **승인 대기 탭이 없다**(조심 ① · D-3). 승인·반려는 결재함(W-CO-09)이 소유하고, 이 화면은
 * 조정을 세워 올리는 쪽이다 — 상단 안내가 그 자리를 가리킨다.
 *
 * **무엇이 바뀔 때 무엇을 비우는가 — 수명 표.**
 *
 * | # | 조작 | `count` | 원천 갈래 | 대상 창고 | 조정 대상(줄) | 초안 세션 |
 * | :-: | --- | :-: | :-: | :-: | :-: | :-: |
 * | 1 | 맥락 있는 첫 진입 | 주소 | **실사** | 실사가 정한다 | 비어 있다 | 0 |
 * | 2 | 맥락 없는 첫 진입 | 없음 | **직접** | 비어 있다 | 비어 있다 | 0 |
 * | 3 | 원천 바꾸기 | 직접으로 가면 지운다 | 바뀐다 | 갈래가 정한다 | **버린다** | **올린다** |
 * | 4 | 대상 실사 바꾸기 | 바뀐다(`replace`) | 유지 | 실사가 정한다 | **버린다** | **올린다** |
 * | 5 | 실사 차이 불러오기 | 유지 | 유지 | 유지 | **다시 세운다** | **올린다** |
 * | 6 | 같은 값을 다시 받음(재조회) | 유지 | 유지 | 유지 | **건드리지 않는다** | 유지 |
 * | 7 | 대상 창고 바꾸기 | — | 유지 | 바뀐다 | **버린다** | **올린다** |
 * | 8 | 줄 더하기·고치기·지우기 | 유지 | 유지 | 유지 | 바뀐다 | 유지 |
 * | 9 | 참조·잔액 응답 도착 | 유지 | 유지 | 유지 | **건드리지 않는다** | 유지 |
 * | 10 | 주소가 없는 실사를 가리킴 | **지운다**(`replace`) | 유지 | — | 유지 | 유지 |
 *
 * 6행이 이 화면의 되돌림 축 자리다. **조정 대상의 축은 「불러온 응답」이다** — 조회 캐시가
 * 구조를 공유해 같은 값이 다시 오면 참조도 같으므로, 재조회 한 번에 친 차이 수량이 말없이
 * 되돌아가지 않는다. 반대로 응답이 실제로 달라지면 대상도 다시 서야 한다 — 낡은 장부로
 * 실물을 파생하면 사용자가 확인하지 않은 수가 화면에 선다.
 *
 * **초안 세션**(D-15)은 대상을 버리고 다시 세울 때마다 올라간다. 지금은 초안 줄의 키가 그 값을
 * 쓰고, 뒤따르는 회차의 등록이 **나가는 중인 쓰기를 가르는 축**으로 같은 값을 쓴다 — 등록에는
 * 아직 자원 번호가 없어 초안 세션 말고는 두 초안을 가를 것이 없다.
 *
 * **대상을 버리는 길이 하나다**(`resetDraftForNewTarget`). 자리마다 따로 비우면 한 자리가
 * 빠지고, 그 자리가 곧 「앞 대상의 줄이 새 대상 위에 서는」 경로가 된다.
 */
export const StockAdjustScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlCountId = readInventoryCountId(searchParams);

  const counts = useInventoryCounts();
  const countList = counts.data;

  const [sourceKind, setSourceKind] = useState<AdjustSourceKind>(() =>
    initialSourceKind(urlCountId),
  );
  const [lines, setLines] = useState<AdjustLineDraft[]>([]);
  const [warehouseDraft, setWarehouseDraft] = useState('');
  /** 실사 차이를 실제로 불러온 실사. `null`이면 아직 부르지 않았다 */
  const [loadedCountId, setLoadedCountId] = useState<number | null>(null);
  /** 주소가 가리킨 실사를 찾지 못해 지웠는가. **지운 뒤에는 판정이 사라지므로 사실을 든다** */
  const [hasCleanedMissingCount, setCleanedMissingCount] = useState(false);

  /**
   * **초안 세션**(D-15) — 대상을 버리고 다시 세울 때마다 올라간다.
   *
   * 상태가 아니라 ref로 든다: 지금 이 값을 읽는 곳은 초안 줄의 키 하나뿐이고, 그 키는 세울
   * 때 한 번만 읽힌다 — 상태로 들면 아무도 다시 그리지 않는 값 때문에 렌더가 는다.
   * 뒤따르는 회차가 이 값을 매임의 축으로 읽을 때 상태가 함께 선다.
   */
  const draftSessionRef = useRef(0);

  const startDraftSession = (): number => {
    draftSessionRef.current += 1;

    return draftSessionRef.current;
  };

  const warehouses = useWarehouseLookup();

  const chosenCount =
    countList?.counts.find((count) => count.inventoryCountId === urlCountId) ?? null;

  /**
   * 대상 창고 — **갈래마다 정하는 주체가 다르다.**
   *
   * 실사 갈래에서는 고른 실사가 정하고(그 실사가 센 창고다), 직접 등록 갈래에서는 사용자가
   * 고른다. 계약이 위치 조회에 창고를 필수로 요구하고 잔액 조회도 창고를 받으므로,
   * 이 값이 없으면 위치도 장부도 확인할 수 없다.
   */
  const warehouseId =
    sourceKind === 'count'
      ? (chosenCount?.warehouseId ?? null)
      : warehouseDraft === ''
        ? null
        : Number(warehouseDraft);

  const hasTarget = warehouseId !== null;

  const locations = useLocationLookup(warehouseId);
  const items = useItemLookup(hasTarget);
  const uoms = useUomLookup(hasTarget);

  const lineItemIds =
    lines.length === 0
      ? EMPTY_IDS
      : lines.flatMap((line) => (line.itemId === '' ? [] : [Number(line.itemId)]));

  const lots = useLotLookup(lineItemIds, hasTarget);

  /**
   * 장부 조회는 **직접 등록 갈래에만 있다**(D-6).
   *
   * 실사 갈래의 장부는 실사 라인이 이미 들고 왔다 — 여기서 또 부르면 같은 사실을 두 시점의
   * 값으로 말하게 되고, 둘이 갈리면 어느 쪽이 참인지 화면이 모른다.
   */
  const balanceLocationIds =
    sourceKind === 'direct' && lines.length > 0
      ? lines.flatMap((line) => (line.locationId === '' ? [] : [Number(line.locationId)]))
      : EMPTY_IDS;

  const balances = useLocationBalances(
    sourceKind === 'direct' ? warehouseId : null,
    balanceLocationIds,
  );

  const variance = useCountVarianceLines(loadedCountId);
  const varianceData = variance.data;

  /**
   * 주소가 **없는 실사**를 가리키면 지운다(사본 체크리스트 1번).
   *
   * **잘린 목록에서는 판정하지 않는다** — 못 본 것과 없는 것은 다르다. 목록이 앞쪽 일부만
   * 왔는데 「없다」로 판정하면 정상 실사를 가리킨 주소가 지워지고, 재고실사에서 넘어온 사용자가
   * 무엇을 조정하려 했는지 잃는다.
   *
   * **`replace`로 지운다.** 히스토리에 칸을 쌓으면 뒤로가기가 없는 실사 주소로 되돌아가
   * 같은 정리가 되풀이되고 사용자가 갇힌다.
   */
  const isUrlCountMissing =
    urlCountId !== null &&
    countList !== undefined &&
    !countList.truncated &&
    !countList.counts.some((count) => count.inventoryCountId === urlCountId);

  /* 정리 effect가 읽는 값은 **그 시점의 최신**이어야 한다 — 의존성에 넣으면 매 렌더 다시 돈다. */
  const cleanMissingCountRef = useRef((): void => {
    /* 자리를 미리 만든다 — 아래에서 매 렌더 최신 함수로 갈아 끼운다. */
  });

  cleanMissingCountRef.current = (): void => {
    setSearchParams(withoutInventoryCountId(searchParams), { replace: true });
    setCleanedMissingCount(true);
  };

  useEffect(() => {
    if (!isUrlCountMissing) return;

    cleanMissingCountRef.current();
  }, [isUrlCountMissing]);

  /** 주소가 실사를 가리키면 실사 갈래다 — 재고실사에서 넘어오는 길과 뒤로가기가 같은 자리다. */
  useEffect(() => {
    if (urlCountId === null) return;

    setSourceKind('count');
  }, [urlCountId]);

  /**
   * 불러온 실사 차이를 조정 대상으로 세운다(C2·C3).
   *
   * **축이 「불러온 응답」이다.** 조회 캐시가 구조를 공유해 같은 값이 다시 오면 참조도 같으므로
   * 재조회가 친 차이 수량을 되돌리지 않는다 — 응답이 실제로 달라졌을 때만 다시 선다.
   */
  const seedFromVarianceRef = useRef((): void => {
    /* 자리를 미리 만든다. */
  });

  seedFromVarianceRef.current = (): void => {
    if (varianceData === undefined) return;

    setLines(createInheritedLineDrafts(varianceData, startDraftSession()));
  };

  useEffect(() => {
    seedFromVarianceRef.current();
  }, [varianceData]);

  /**
   * 대상이 바뀌면 **세운 것을 거둔다** — 원천·대상 실사·대상 창고가 바뀌는 세 자리가
   * 이 한 문을 지난다.
   *
   * 자리마다 따로 비우면 한 자리가 빠지고, 그 자리가 곧 「앞 대상의 줄이 새 대상 위에 서는」
   * 경로가 된다. 뒤따르는 회차의 쓰기 거둠(`resetIfIdle`)도 여기에 붙는다.
   */
  const resetDraftForNewTarget = (): void => {
    setLines(applySourceChange(lines).keptLines);
    setLoadedCountId(null);
    startDraftSession();
  };

  const changeSourceKind = (next: AdjustSourceKind): void => {
    if (next === sourceKind) return;

    resetDraftForNewTarget();
    setSourceKind(next);

    /* 직접 등록 갈래에는 대상 실사가 없다 — 주소에 남겨 두면 화면과 주소가 다른 말을 한다. */
    if (next === 'direct' && urlCountId !== null) {
      setSearchParams(withoutInventoryCountId(searchParams), { replace: true });
    }
  };

  const chooseCount = (value: string): void => {
    if (value === '') return;

    resetDraftForNewTarget();
    setSearchParams(withInventoryCountId(searchParams, Number(value)), { replace: true });
  };

  const chooseWarehouse = (value: string): void => {
    if (value === warehouseDraft) return;

    resetDraftForNewTarget();
    setWarehouseDraft(value);
  };

  /**
   * 실사 차이를 불러온다 — **대상을 다시 세우는 조작**이다.
   *
   * 이미 부른 실사를 다시 누르면 조회만 다시 한다. 응답이 같으면 대상은 그대로다
   * (수명 표 6행) — 같은 값으로 다시 세우면 친 차이 수량이 말없이 되돌아간다.
   */
  const loadVariance = (): void => {
    if (urlCountId === null) return;

    if (loadedCountId === urlCountId) {
      void variance.refetch();

      return;
    }

    setLoadedCountId(urlCountId);
  };

  const addLine = (): void => {
    setLines((prev) => addLineDraft(prev, draftSessionRef.current));
  };

  const patchLine = (key: string, patch: Partial<Omit<AdjustLineDraft, 'key'>>): void => {
    setLines((prev) => patchLineDraft(prev, key, patch));
  };

  const removeLine = (key: string): void => {
    setLines((prev) => removeLineDraft(prev, key));
  };

  const retryReferences = (): void => {
    warehouses.refetch();
    locations.refetch();
    items.refetch();
    uoms.refetch();
    lots.refetch();
  };

  /**
   * 그 줄의 장부 — **갈래마다 출처가 다르다**(D-6).
   *
   * 실사에서 온 줄은 실사가 준 값을 그대로 쓰고, 더한 줄은 그 위치의 잔액에서 (품목·LOT)로
   * 찾는다. **못 찾은 것을 0으로 메우지 않는다.**
   */
  const bookQtyOf = (line: AdjustLineDraft): BookQtyState => {
    if (line.countSystemQty !== null) return { kind: 'known', qty: line.countSystemQty };

    const source =
      line.locationId === ''
        ? UNASKED_BALANCE
        : (balances[Number(line.locationId)] ?? UNASKED_BALANCE);

    return toBookQty(
      source,
      line.itemId === '' ? null : Number(line.itemId),
      line.lotId === '' ? null : Number(line.lotId),
    );
  };

  const rows: AdjustLineRow[] = lines.map((draft) => ({ draft, bookQty: bookQtyOf(draft) }));

  const { errors } = validateLines(lines);
  const excludedCount = excludedLineCount(lines);

  const countOptions: SelectOption[] =
    countList?.counts.map((count) => ({
      value: String(count.inventoryCountId),
      label: `${count.inventoryCountNo} · ${count.plannedDate}`,
    })) ?? [];

  /** 「불러오기」가 막힌 사유. `null`이면 열려 있다. */
  const loadBlockReason = (): string | null => {
    if (urlCountId === null) return t.actionReasons.loadVarianceNeedsCount;
    if (variance.isFetching) return t.actionReasons.loadVarianceLoading;

    return null;
  };

  /**
   * 「라인 추가」가 막힌 사유.
   *
   * **실사 갈래에서는 줄을 더하지 않는다.** 그 갈래의 장부는 실사가 준 값이라, 더한 줄은
   * 장부를 확인할 길이 없는 채로 표에 선다 — 세 열 중 둘이 영영 빈 줄이 된다.
   */
  const addLineBlockReason = (): string | null => {
    if (sourceKind === 'count') return t.actionReasons.addLineCountSource;
    if (!hasTarget) return t.actionReasons.addLineNeedsWarehouse;

    return null;
  };

  const addLineReason = addLineBlockReason();
  const addLineReasonId = useId();

  const hasReferenceError =
    locations.isError || items.isError || uoms.isError || lots.isError || warehouses.isError;

  const hasBalanceError = Object.values(balances).some((source) => source.isError);
  const hasUnknownBookQty = rows.some((row) => row.bookQty.kind === 'notFound');
  const hasInheritedReason = lines.some((line) => line.countReasonCode !== null);

  const linesPaneContent = () => {
    if (variance.isPending && loadedCountId !== null) {
      return (
        <div role="status" aria-label={t.loading.varianceLines}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    if (rows.length === 0) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noLinesTitle}
          description={
            sourceKind === 'count'
              ? t.empty.noLinesCountDescription
              : t.empty.noLinesDirectDescription
          }
        />
      );
    }

    return (
      <>
        <AdjustLineTable
          rows={rows}
          errors={errors}
          locationLookup={locations}
          itemLookup={items}
          uomLookup={uoms}
          lotLookup={lots}
          locationOptions={toSelectOptions(locations)}
          itemOptions={toSelectOptions(items)}
          uomOptions={toSelectOptions(uoms)}
          onPatch={patchLine}
          onRemove={removeLine}
        />

        {/* 차이 0인 줄은 **막지 않고** 무엇이 일어나는지만 밝힌다(D-4). */}
        {excludedCount > 0 && <p className="field-note">{t.notes.excludedZero(excludedCount)}</p>}

        {/* 장부를 못 찾아도 조정할 수 있다(C8) — 그 사실을 그 줄이 보이는 자리에서 말한다. */}
        {hasUnknownBookQty && <p className="field-note">{t.notes.bookQtyOptional}</p>}

        {/* 실사에서 온 사유는 보이기만 한다(D-7) — 고칠 수 있는 값으로 읽히지 않게 밝힌다. */}
        {hasInheritedReason && <p className="field-note">{t.notes.lineReasonReadOnly}</p>}

        <p className="field-note">{t.notes.lineNoAssignedByServer}</p>

        {hasBalanceError && (
          <p className="field-error" role="status">
            {t.reasons.balancesFailed}
          </p>
        )}

        {hasReferenceError && (
          <div className="field-cell">
            <span className="field-note">{t.reasons.lineReferencesFailed}</span>
            <Button variant="outlined" size="sm" onClick={retryReferences}>
              {messages.common.retry}
            </Button>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {/*
       * ⭐ **범위 안내는 늘 선다**(조심 ③ · C13). 이 화면을 「잔량을 고치는 화면」으로 읽는 것이
       * 여기서 가장 비싼 오해라, 맥락 유무로 접으면 정작 그렇게 읽는 사람이 읽지 못한다.
       */}
      <div className="banner-slot">
        <AlertBanner variant="info" title={t.scope.title}>
          {t.scope.description}
        </AlertBanner>
      </div>

      {/*
       * ⛔ **승인 대기 탭을 두지 않는다**(조심 ① · D-3). 결재는 결재함이 소유한다 —
       * 이 안내가 그 자리를 가리키므로 사용자가 여기서 승인 버튼을 찾지 않는다.
       */}
      <div className="banner-slot">
        <AlertBanner variant="info" title={t.approvalNotice.title}>
          {t.approvalNotice.description}
        </AlertBanner>
      </div>

      {counts.isError && (
        <LoadErrorBanner
          error={counts.error}
          onRetry={() => {
            void counts.refetch();
          }}
        />
      )}

      <section className="pane" aria-label={t.panes.source}>
        {/* 지운 사실을 남긴다 — 주소를 지우고 나면 「없는 실사였다」를 말할 근거가 사라진다. */}
        {hasCleanedMissingCount && <p className="field-note">{t.source.countNotFoundNote}</p>}

        <SourcePane
          kind={sourceKind}
          onChangeKind={changeSourceKind}
          discardCount={applySourceChange(lines).discardedCount}
          countOptions={countOptions}
          countNote={countList?.truncated === true ? t.lookups.truncated : undefined}
          countId={urlCountId === null ? '' : String(urlCountId)}
          onChangeCount={chooseCount}
          countWarehouseName={describeReference(
            toReference(warehouses, chosenCount?.warehouseId ?? null),
          )}
          warehouseOptions={toSelectOptions(warehouses)}
          warehouseNote={lookupNote(warehouses)}
          warehouseId={warehouseDraft}
          onChangeWarehouse={chooseWarehouse}
          loadBlockReason={loadBlockReason()}
          onLoadVariance={loadVariance}
        />

        {/*
         * **불러온 결과를 밝힌다.** 0행인 갈래를 따로 말하는 것이 요점이다 — 「불러오지 못했다」와
         * 「불러왔더니 차이가 없다」는 다른 말이고, 뭉개면 사용자가 조회를 되풀이한다.
         */}
        {loadedCountId !== null && varianceData !== undefined && (
          <p className="field-note">
            {varianceData.length === 0
              ? t.source.loadedEmptyNote
              : t.source.loadedNote(varianceData.length)}
          </p>
        )}
      </section>

      <section className="pane" aria-label={t.panes.lines}>
        {/*
         * ⭐ **실물은 파생이고 차이는 음수를 받는다**(조심 ②·③). 표를 읽기 전에 이 둘을 알아야
         * 사용자가 「실물을 고쳐야 하나」·「음수를 넣어도 되나」를 묻지 않는다.
         */}
        <p className="field-note">{t.notes.actualDerived}</p>
        <p className="field-note">{t.notes.negativeAllowed}</p>

        {variance.isError && (
          <LoadErrorBanner
            error={variance.error}
            onRetry={() => {
              void variance.refetch();
            }}
          />
        )}

        {linesPaneContent()}

        <div className="form-actions">
          <div className="field-cell">
            <Button
              variant="outlined"
              disabled={addLineReason !== null}
              aria-describedby={addLineReason === null ? undefined : addLineReasonId}
              onClick={addLine}
            >
              {t.actions.addLine}
            </Button>
            {addLineReason !== null && (
              <span id={addLineReasonId} className="field-note">
                {addLineReason}
              </span>
            )}
          </div>
        </div>

        {/*
         * **값 목록이 비어 있는 동안 무엇이 막히는지 밝힌다**(D-9 · C10). 대상을 세우는 일은
         * 이 값과 무관하게 열려 있고, 막히는 것은 등록 하나다 — 그 사실을 여기서 미리 말한다.
         */}
        {isReasonCodeListPending(CODE_OPTIONS) && (
          <p className="field-note">{t.notes.reasonCodePending}</p>
        )}
      </section>
    </>
  );
};
