import {
  AlertBanner,
  Button,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  IconButton,
  Select,
  SkeletonText,
  TextField,
  useToast,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { BoardFrame } from '../../patterns/board-frame';
import { BoardTable } from '../../patterns/board-table';
import { pickBom, useBomTree, type BomTreeRow } from '../../patterns/bom-tree';
import { BomTreeCell } from '../../patterns/bom-tree-cell';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { OneLine } from '../../patterns/po-board';
import {
  bomName,
  componentRowName,
  extensionLabels,
  requiredQtyText,
} from './bom-component-format';
import { BomComponentFormDialog } from './bom-component-form-dialog';
import {
  BOM_COMPONENT_FORM_FIELDS,
  componentToFormValues,
  isSameBomComponentValues,
  toBomComponentUpdate,
  type BomComponentFormValues,
} from './bom-component-mappers';
import { bomComponentDetailPath, bomKeys, useBomComponentDetail } from './bom-queries';
import {
  bomTreeKeys,
  ITEM_BOM_TREE,
  PARENT_PAGE_SIZE,
  type ItemSummary,
  useBomTreeList,
  useItemSummaries,
  useParentItems,
} from './bom-tree-queries';
import { CODE_GROUPS, useCodeValueOptions } from './code-values';
import { useItemTypeOptions } from './item-queries';
import { LoadErrorBanner } from './load-error-banner';
import {
  useProcessOptions,
  useRoutingOperationOptions,
  useUomCodes,
  type LookupResult,
} from './lookups';
import { codeValueName, lookupLabel, selectableOptions } from './options';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { SetDefaultDialog } from './set-default-dialog';

type Bom = components['schemas']['Bom'];
type BomComponent = components['schemas']['BomComponent'];
type BomComponentDetailResponse = components['schemas']['BomComponentDetailResponse'];
type Item = components['schemas']['Item'];

const t = messages.itemExtendedAttrs;
const tb = t.bomTab;

/** 모품목 목록의 유형 — BOM 이 있는 제품 · 반제품만(원자재 · 상품 · 부자재는 BOM 이 없다). 처음은 제품. */
const PARENT_TYPES = ['FINISHED', 'SEMI_FINISHED'] as const;
const DEFAULT_PARENT_TYPE = 'FINISHED';

/** 주소의 조건 — 「BOM 조회 (ERP)」와 같은 키다. 새로고침·뒤로가기·공유가 같은 결과를 낸다. */
interface Filters {
  q: string;
  type: string;
  /** BOM 이 있는 품목만 — 처음은 켜짐. 끄면 주소에 `bom=all`. */
  hasBom: boolean;
}

const DEFAULT_FILTERS: Filters = { q: '', type: DEFAULT_PARENT_TYPE, hasBom: true };

const readId = (value: string | null): number | null => {
  const id = Number(value ?? '');
  return Number.isInteger(id) && id > 0 ? id : null;
};

const readFilters = (params: URLSearchParams): Filters => {
  const type = params.get('type') ?? '';
  return {
    q: params.get('q') ?? '',
    type: (PARENT_TYPES as readonly string[]).includes(type) ? type : DEFAULT_PARENT_TYPE,
    hasBom: params.get('bom') !== 'all',
  };
};

/** 고른 BOM(`rev`)은 모품목 아래에 매달린 선택이다 — 모품목을 바꾸면 함께 떨어진다. */
const toSearchParams = (
  filters: Filters,
  page = 1,
  item: number | null = null,
  rev: number | null = null,
) => {
  const next = new URLSearchParams();
  if (filters.q !== '') next.set('q', filters.q);
  if (filters.type !== DEFAULT_PARENT_TYPE) next.set('type', filters.type);
  if (!filters.hasBom) next.set('bom', 'all');
  if (page > 1) next.set('page', String(page));
  if (item !== null) next.set('item', String(item));
  if (item !== null && rev !== null) next.set('rev', String(rev));
  return next;
};

interface FilterBarProps {
  applied: Filters;
  typeName: (code: string) => string;
  onSearch: (filters: Filters) => void;
}

/**
 * 모품목 목록의 조건 줄 — 품목 탭과 같은 차례(품목코드·품목명 → 품목유형 → 확인칸 → 조회 · 초기화 · 사용자 지시 2026-10-28).
 * 유형 · BOM 있는 품목만은 고르는 즉시, 검색어는 「조회」로 건다.
 */
const FilterBar = ({ applied, typeName, onSearch }: FilterBarProps) => {
  const typeId = useId();
  const [q, setQ] = useState(applied.q);

  // 뒤로가기 등으로 주소가 바뀌면 입력칸도 따라간다.
  useEffect(() => {
    setQ(applied.q);
  }, [applied.q]);

  return (
    <form
      className="filter-bar"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch({ ...applied, q: q.trim() });
      }}
    >
      <TextField
        label={tb.fields.q}
        value={q}
        onChange={(event) => {
          setQ(event.target.value);
        }}
      />
      <div className="field-cell">
        <label className="field-label" htmlFor={typeId}>
          {t.filters.itemTypeLabel}
        </label>
        <Select
          id={typeId}
          value={applied.type}
          options={PARENT_TYPES.map((code) => ({ value: code, label: typeName(code) }))}
          onChange={(value) => {
            onSearch({ ...applied, q: q.trim(), type: value });
          }}
        />
      </div>
      <div className="field-cell field-cell-unlabeled">
        <Checkbox
          checked={applied.hasBom}
          onChange={(event) => {
            onSearch({ ...applied, q: q.trim(), hasBom: event.target.checked });
          }}
        >
          {tb.fields.hasBom}
        </Checkbox>
      </div>
      <div className="field-cell field-cell-unlabeled">
        <div className="filter-actions">
          <Button type="submit">{messages.common.search}</Button>
          <Button
            variant="outlined"
            onClick={() => {
              onSearch(DEFAULT_FILTERS);
            }}
          >
            {messages.common.reset}
          </Button>
        </div>
      </div>
    </form>
  );
};

/** 손실률은 0~1 비율로 온다(A-8) — 「BOM 조회 (ERP)」와 같이 퍼센트로 낸다. 부동소수 꼬리는 소수 둘째 자리에서 자른다. */
const formatRate = (rate: number): string => `${String(Math.round(rate * 10000) / 100)}%`;

const orEmpty = (value: string | null | undefined): string =>
  value === null || value === undefined || value === '' ? t.values.empty : value;

/** 문자열 칸만 넓힌다 — 생성 타입에 아직 없는 ERP 원본 칸(erp-item/types.ts 와 같은 사정). */
type ItemWithErp = Item & { erpSpec?: string | null };

interface ParentFactsProps {
  item: ItemSummary;
  bom: Bom;
  typeName: (code: string) => string;
  statusName: (code: string) => string;
  uomName: (uomId: number) => string;
}

/** 모품목 상세 — 품목 칸과 그 BOM 칸을 하이라키 위에 한 줄로(「BOM 조회 (ERP)」와 같은 모양). */
const ParentFacts = ({ item, bom, typeName, statusName, uomName }: ParentFactsProps) => {
  const detail = item.item as ItemWithErp | null;
  const facts = [
    { key: 'code', label: t.origin.fields.itemCode, value: item.code ?? item.name, strong: true },
    { key: 'name', label: t.origin.fields.itemName, value: detail?.itemName ?? t.values.empty },
    {
      key: 'type',
      label: tb.fields.itemType,
      value: detail === null ? t.values.empty : typeName(detail.itemTypeCode),
    },
    { key: 'spec', label: t.origin.fields.spec, value: orEmpty(detail?.erpSpec) },
    {
      key: 'uom',
      label: t.origin.fields.baseUom,
      value: detail === null ? t.values.empty : uomName(detail.baseUomId),
    },
    { key: 'bom', label: t.bom.fields.bomCode, value: bom.bomCode },
    { key: 'rev', label: t.bom.fields.bomVersion, value: String(bom.bomVersion) },
    { key: 'status', label: t.bom.fields.status, value: statusName(bom.statusCode) },
    {
      key: 'effective',
      label: t.bom.fields.validPeriod,
      /* 끝이 없는 BOM 은 「~ —」로 — 끝이 비면 잘린 값처럼 보인다. */
      value: t.bom.values.period(bom.effectiveFrom, bom.effectiveTo ?? t.values.empty),
    },
    {
      key: 'baseQty',
      label: t.bom.fields.baseQty,
      value: requiredQtyText(bom.baseQty, uomName(bom.baseUomId)),
    },
  ];

  return (
    <dl className="po-board-order-facts bom-parent-facts" aria-label={tb.parentFacts}>
      {facts.map((fact) => (
        <div key={fact.key}>
          <dt>{fact.label}</dt>
          <dd className={fact.strong === true ? 'bom-tree-code' : undefined}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
};

/**
 * 공정 칸 — 「등록 공정 · 실사용 공정」. 등록 공정은 **그 줄의 윗 BOM 모품목**의 공정 흐름에서 찾는다 —
 * 하이라키 아래 단계는 모품목이 다르다. 같은 품목의 흐름은 한 번만 받는다(조회 키가 같다).
 */
const ProcessCell = ({
  component,
  parentItemId,
  processes,
}: {
  component: BomComponent;
  parentItemId: number;
  processes: LookupResult;
}) => {
  const operations = useRoutingOperationOptions(parentItemId, true);
  /* 둘 다 비었으면 「— · —」 대신 한 번만 — 확장 열을 아직 달지 않은 줄이 대부분이다. */
  if (
    (component.routingOperationId ?? null) === null &&
    (component.actualUseProcessId ?? null) === null
  ) {
    return t.values.empty;
  }
  return (
    <OneLine
      text={t.component.values.process(
        lookupLabel(
          operations.entries,
          component.routingOperationId,
          operations.isLoading,
          operations.isError,
        ),
        lookupLabel(
          processes.entries,
          component.actualUseProcessId,
          processes.isLoading,
          processes.isError,
        ),
      )}
    />
  );
};

/** 편집 창을 연 줄 — 그 줄의 윗 BOM 과 모품목(공정 선택지의 출처). */
interface EditingRow {
  bomId: number;
  bomComponentId: number;
  parentItemId: number;
  rowName: string;
}

interface ComponentFormState {
  source: BomComponentDetailResponse;
  baseline: BomComponentFormValues;
  values: BomComponentFormValues;
}

interface BomTreeTableProps {
  bom: Bom;
  uoms: LookupResult;
  processes: LookupResult;
  onEdit: (row: EditingRow) => void;
}

/**
 * 고른 BOM 의 **하이라키**(사용자 지시 2026-10-28 — 「BOM 조회 (ERP)」처럼). 모품목 줄 아래로 자품목을 들여 쓰고,
 * 자품목이 또 BOM 을 가지면 그 기본 BOM 구성을 한 단계 더 들여 쓴다. 처음에는 다 펼친 채로 서고 줄마다 접는다.
 *
 * ERP 원본 열(소요량 · 손실률 · 필수) 뒤에 **MES 확장 열**(공정 · 확장 표시)을 두고, 줄마다 확장 열 편집 단추를 둔다 —
 * 원본 열은 값 표기만이다(계약에 구성품 추가 · 삭제 · 원본 열 쓰기가 없다).
 */
const BomTreeTable = ({ bom, uoms, processes, onEdit }: BomTreeTableProps) => {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const rows = useBomTree({ itemId: bom.parentItemId, bomId: bom.bomId }, collapsed, ITEM_BOM_TREE);
  const itemOf = useItemSummaries(rows.map((row) => row.itemId));
  const queryClient = useQueryClient();
  /* 받지 못한 하위 구성(BOM 목록 · 구성품)만 다시 부른다 — 받으면 트리가 그 자리부터 다시 펴진다. */
  const retryFailed = (): void => {
    void queryClient.refetchQueries({
      queryKey: bomKeys.all,
      predicate: (query) => query.state.status === 'error',
    });
  };

  const toggle = (key: string): void => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const rowLabel = (row: BomTreeRow): string => {
    const item = itemOf(row.itemId);
    return componentRowName(
      row.component?.sequenceNo ?? 0,
      item.code === null ? item.name : `${item.code} · ${item.name}`,
    );
  };

  const columns: Column<BomTreeRow>[] = [
    /* 폭을 주지 않는 유일한 열 — 들여 쓴 품목 이름이 남는 폭을 다 쓴다. */
    {
      key: 'item',
      header: tb.columns.item,
      render: (row) => {
        const item = itemOf(row.itemId);
        return (
          <BomTreeCell
            row={row}
            code={item.code}
            name={item.name}
            labels={tb.tree}
            onToggle={toggle}
            onRetry={retryFailed}
          />
        );
      },
    },
    {
      key: 'requiredQty',
      header: tb.columns.requiredQty,
      width: '128px',
      align: 'end',
      render: (row) =>
        row.component === null
          ? t.values.empty
          : requiredQtyText(
              row.component.requiredQty,
              lookupLabel(uoms.entries, row.component.uomId, uoms.isLoading, uoms.isError),
            ),
    },
    {
      key: 'scrapRate',
      header: tb.columns.scrapRate,
      width: '80px',
      align: 'end',
      render: (row) =>
        row.component === null ? t.values.empty : formatRate(row.component.scrapRate),
    },
    {
      key: 'isMandatory',
      header: tb.columns.isMandatory,
      width: '64px',
      render: (row) =>
        row.component === null
          ? t.values.empty
          : row.component.isMandatory
            ? tb.values.yes
            : tb.values.no,
    },
    {
      key: 'process',
      header: t.component.fields.process,
      width: '160px',
      render: (row) =>
        row.component === null || row.parentItemId === null ? (
          t.values.empty
        ) : (
          <ProcessCell
            component={row.component}
            parentItemId={row.parentItemId}
            processes={processes}
          />
        ),
    },
    {
      key: 'extensions',
      header: t.component.fields.extensions,
      width: '112px',
      render: (row) => {
        const labels = row.component === null ? [] : extensionLabels(row.component);
        if (labels.length === 0) return t.values.empty;
        return labels.map((label) => (
          <Chip key={label} variant="status" status="info" size="sm">
            {label}
          </Chip>
        ));
      },
    },
    {
      key: 'edit',
      header: t.component.fields.edit,
      width: '56px',
      render: (row) => {
        const { component, parentItemId } = row;
        if (component === null || parentItemId === null) return null;
        return (
          <IconButton
            icon="edit"
            size="sm"
            aria-label={t.component.actions.editRow(rowLabel(row))}
            onClick={() => {
              onEdit({
                bomId: component.bomId,
                bomComponentId: component.bomComponentId,
                parentItemId,
                rowName: rowLabel(row),
              });
            }}
          />
        );
      },
    },
  ];

  return (
    <BoardTable
      label={t.component.paneTitle}
      className="bom-tree-table"
      widthKey="omf-mes:item-boms:columns:tree"
      minWidth="58rem"
      columns={columns}
      rows={rows}
      getRowId={(row) => row.key}
    />
  );
};

interface BomDetailProps {
  parentItemId: number;
  /** 주소가 고른 BOM — 이 모품목의 것이 아니면 무시하고 기본 BOM 을 연다. */
  requestedBomId: number | null;
  onPickBom: (bomId: number) => void;
}

/**
 * 오른쪽 구획 — 고른 모품목의 BOM. 모품목이 바뀌면 통째로 새로 선다(`key`) — 열린 창 · 쓰기 오류 · 접은 줄이
 * 다음 모품목에 따라가지 않는다.
 */
const BomDetail = ({ parentItemId, requestedBomId, onPickBom }: BomDetailProps) => {
  const toast = useToast();
  const { client } = useApiClient();
  const bomSelectId = useId();

  const list = useBomTreeList(parentItemId);
  const boms = list.data ?? EMPTY_BOMS;
  const bom = boms.find((each) => each.bomId === requestedBomId) ?? pickBom(boms) ?? null;

  const parentOf = useItemSummaries([parentItemId]);
  const itemTypes = useItemTypeOptions();
  const statuses = useCodeValueOptions(CODE_GROUPS.masterVersionStatus, { includeInactive: true });
  const uoms = useUomCodes(true);
  const processes = useProcessOptions(true);
  const uomName = (uomId: number): string =>
    lookupLabel(uoms.entries, uomId, uoms.isLoading, uoms.isError);

  /* ── 기본 지정 ── 확인 창의 확인이 `:set-default` 한 번으로 끝낸다(결정 9). */
  const [pendingDefault, setPendingDefault] = useState<Bom | null>(null);
  const setDefaultWrite = useMasterWrite<number, Bom>({
    request: (bomId, headers) =>
      client.POST('/planning/boms/{bomId}:set-default', {
        params: {
          path: { bomId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    /* **반드시 `null`이다**(§5.3 표 5행) — 계약에 이 쓰기의 `If-Match` 가 없다. 상세 경로를 주면 요청이 멈춘다. */
    etagPath: null,
    /* 서버가 지정한 줄만 돌려주므로 목록을 다시 받아야 어느 줄이 기본인지 안다. */
    invalidateKeys: [bomTreeKeys.list(parentItemId)],
    knownFields: [],
    onSuccess: () => {
      setPendingDefault(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /* ── 구성품 확장 열 ── 창을 여는 것이 곧 행 상세 조회를 켜는 것이다(잠금 토큰이 그 응답에만 온다 · §5.3 6행). */
  const [editing, setEditing] = useState<EditingRow | null>(null);
  const detail = useBomComponentDetail(editing?.bomId ?? null, editing?.bomComponentId ?? null);
  const operations = useRoutingOperationOptions(editing?.parentItemId ?? null, editing !== null);
  const [formState, setFormState] = useState<ComponentFormState | null>(null);

  /* 출처가 그대로면 폼을 다시 세우지 않는다 — 고르는 동안 값이 서버 값으로 되돌아가지 않는다. */
  const formSource = detail.data ?? null;
  if (formSource === null) {
    if (formState !== null) setFormState(null);
  } else if (formState?.source !== formSource) {
    const seeded = componentToFormValues(formSource.bomComponent);
    setFormState({ source: formSource, baseline: seeded, values: seeded });
  }

  const componentWrite = useMasterWrite<BomComponentFormValues, BomComponent>({
    request: (values, headers) =>
      client.PUT('/planning/boms/{bomId}/components/{bomComponentId}', {
        params: {
          path: { bomId: editing?.bomId ?? 0, bomComponentId: editing?.bomComponentId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        /* **키를 열거해 만든다** — 원본 열을 섞어 보내도 서버가 막지 않는다(실측 P). */
        body: toBomComponentUpdate(values),
      }),
    /* **행 단위 상세 경로다**(§5.3 표 6행) — 목록 조회는 `ETag`를 주지 않는다. */
    etagPath:
      editing === null ? null : bomComponentDetailPath(editing.bomId, editing.bomComponentId),
    /* 행 상세(다음 저장의 토큰)와 하이라키의 그 BOM 구성품을 함께 다시 받는다. */
    invalidateKeys:
      editing === null
        ? []
        : [bomKeys.components(editing.bomId), bomTreeKeys.components(editing.bomId)],
    knownFields: BOM_COMPONENT_FORM_FIELDS,
    onSuccess: () => {
      setEditing(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const optionsNotice = (lookups: LookupResult[]): ReactNode => {
    if (lookups.some((lookup) => lookup.isError)) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsLoadFailed}</AlertBanner>
        </div>
      );
    }
    if (lookups.some((lookup) => lookup.truncated)) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsTruncated}</AlertBanner>
        </div>
      );
    }
    return null;
  };

  if (list.isError) {
    return <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />;
  }
  if (list.isPending) {
    return (
      <div role="status" aria-label={tb.loading.boms}>
        <SkeletonText lines={3} />
      </div>
    );
  }
  if (bom === null) return <EmptyState size="sm" live title={tb.empty.noBomTitle} />;

  const typeName = (code: string): string => codeValueName(itemTypes.data, code);
  const statusName = (code: string): string => codeValueName(statuses.data, code);

  return (
    <>
      {optionsNotice([processes])}
      {/* BOM 이 여럿이면 고르고, 고른 BOM 이 기본이 아니면 기본으로 지정한다. 하나뿐인 기본 BOM 이면 줄 자체가 없다. */}
      {(boms.length > 1 || !bom.isDefault) && (
        <div className="filter-bar item-bom-choice">
          <div className="field-cell">
            <label className="field-label" htmlFor={bomSelectId}>
              {tb.fields.bom}
            </label>
            <Select
              id={bomSelectId}
              value={String(bom.bomId)}
              options={boms.map((each) => ({
                value: String(each.bomId),
                label: each.isDefault ? tb.values.defaultBom(bomName(each)) : bomName(each),
              }))}
              onChange={(value) => {
                onPickBom(Number(value));
              }}
            />
          </div>
          {!bom.isDefault && (
            <div className="field-cell field-cell-unlabeled">
              <Button
                variant="outlined"
                onClick={() => {
                  setDefaultWrite.reset();
                  setPendingDefault(bom);
                }}
              >
                {t.bom.dialog.setDefaultConfirm}
              </Button>
            </div>
          )}
        </div>
      )}
      <ParentFacts
        item={parentOf(parentItemId)}
        bom={bom}
        typeName={typeName}
        statusName={statusName}
        uomName={uomName}
      />
      {/* BOM 을 바꾸면 접은 줄을 잊는다 — 다른 BOM 의 경로다. */}
      <BomTreeTable
        key={bom.bomId}
        bom={bom}
        uoms={uoms}
        processes={processes}
        onEdit={(row) => {
          componentWrite.reset();
          setEditing(row);
        }}
      />

      {/* 열 때만 마운트한다 — 닫힌 창을 남기면 지난 값이 살아 있고, 창이 행 상세 조회를 붙잡고 있게 된다. */}
      {editing !== null && (
        <BomComponentFormDialog
          rowName={editing.rowName}
          loadError={
            detail.isError ? (
              <LoadErrorBanner error={detail.error} onRetry={() => void detail.refetch()} />
            ) : null
          }
          values={formState?.values ?? null}
          onChange={(patch) => {
            setFormState((prev) =>
              prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
            );
            for (const field of Object.keys(patch)) componentWrite.clearFieldError(field);
          }}
          routingOperationOptions={(selected) => selectableOptions(operations, selected)}
          /* 윗 모품목에 공정 흐름이 하나도 없으면 고를 값이 없다 — 감추지 않고 사유를 붙인다(배치 규범 4). */
          routingOperationDisabledReason={
            operations.isLoading || operations.entries.length > 0
              ? undefined
              : t.component.actionReasons.routingOperationEmpty
          }
          processOptions={(selected) => selectableOptions(processes, selected)}
          fieldErrors={componentWrite.fieldErrors}
          banner={<SaveErrorBanner error={componentWrite.error} />}
          isDirty={
            formState !== null && !isSameBomComponentValues(formState.values, formState.baseline)
          }
          isSaving={componentWrite.isSaving}
          onSave={() => {
            if (formState === null) return;
            componentWrite.write(formState.values);
          }}
          onClose={() => {
            componentWrite.reset();
            setEditing(null);
          }}
        />
      )}

      {pendingDefault !== null && (
        <SetDefaultDialog
          bomName={bomName(pendingDefault)}
          isSaving={setDefaultWrite.isSaving}
          banner={<SaveErrorBanner error={setDefaultWrite.error} />}
          onClose={() => {
            setDefaultWrite.reset();
            setPendingDefault(null);
          }}
          onConfirm={() => {
            setDefaultWrite.write(pendingDefault.bomId);
          }}
        />
      )}
    </>
  );
};

const EMPTY_BOMS: Bom[] = [];

type ParentRow = Item;

/**
 * W-06-05 「품목·BOM 정보」의 BOM 탭. 품목 탭(`screen.tsx`)과 셸 탭 막대로 오간다.
 *
 * 「ERP 연동 현황·이력 > BOM」과 같은 짜임이다(사용자 지시 2026-10-28): 위에 조건(유형 · BOM 있는 품목만 · 품목코드·
 * 품목명), 왼쪽 모품목 목록 | 오른쪽 고른 모품목의 상세와 기본 BOM(없으면 첫 BOM) 하이라키. 그 화면과 달리 여기서는
 * 줄마다 구성품 **확장 열**을 고치고 기본 BOM 을 지정한다. 조건 · 쪽 · 고른 모품목 · 고른 BOM 을 전부 주소에 둔다.
 */
export const ItemBomScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const page = readId(searchParams.get('page')) ?? 1;
  const parentItemId = readId(searchParams.get('item'));
  const requestedBomId = readId(searchParams.get('rev'));

  const parents = useParentItems({
    itemTypeCode: filters.type,
    ...(filters.hasBom ? { hasBom: true } : {}),
    ...(filters.q === '' ? {} : { q: filters.q }),
    ...(page > 1 ? { page } : {}),
  });
  const itemTypes = useItemTypeOptions();
  const typeName = (code: string): string => codeValueName(itemTypes.data, code);
  const parentRows = parents.data?.items ?? EMPTY_PARENTS;
  const pageView = toPageView(
    parents.data?.page ?? { page, size: PARENT_PAGE_SIZE, total: 0 },
    parentRows.length,
  );

  const parentColumns: Column<ParentRow>[] = [
    /* 고르는 단추 자리(`BoardTable` 의 `pick`) — 품목코드는 굵게. */
    {
      key: 'itemCode',
      header: t.origin.fields.itemCode,
      width: '152px',
      render: (row) => <span className="bom-tree-code bom-code-cell">{row.itemCode}</span>,
    },
    {
      key: 'itemName',
      header: t.origin.fields.itemName,
      render: (row) => <OneLine text={row.itemName} />,
    },
    {
      key: 'itemTypeCode',
      header: t.origin.fields.itemType,
      width: '80px',
      render: (row) => typeName(row.itemTypeCode),
    },
  ];

  const listContent = (): ReactNode => {
    // 조회에 실패했으면 표도 빈 상태도 내지 않는다 — 실패를 「없습니다」로 보이면 안 된다.
    if (parents.isError) {
      return <LoadErrorBanner error={parents.error} onRetry={() => void parents.refetch()} />;
    }
    if (parents.isPending) {
      return (
        <div role="status" aria-label={tb.loading.parents}>
          <SkeletonText lines={4} />
        </div>
      );
    }
    return (
      <>
        <BoardTable
          label={tb.panes.parents}
          widthKey="omf-mes:item-boms:columns:parents"
          minWidth="26rem"
          columns={parentColumns}
          rows={parentRows}
          getRowId={(row) => String(row.itemId)}
          pick={{
            columnKey: 'itemCode',
            label: (row) => t.pickItem(row.itemCode),
            currentId: parentItemId === null ? null : String(parentItemId),
            onPick: (row) => {
              setSearchParams(toSearchParams(filters, page, row.itemId));
            },
          }}
          empty={
            <EmptyState
              size="sm"
              live
              title={pageView.isBeyondLast ? tb.empty.parentsBeyondLast : tb.empty.noParentsTitle}
            />
          }
        />
        <PageNav
          view={pageView}
          onChange={(next) => {
            setSearchParams(toSearchParams(filters, next, parentItemId));
          }}
        />
      </>
    );
  };

  return (
    <BoardFrame
      splitKey="omf-mes:item-boms:split"
      initialRatio={0.35}
      splitter={{ label: tb.splitter, collapseLabel: tb.listCollapse, expandLabel: tb.listExpand }}
      above={{
        label: t.panes.filter,
        content: (
          <div className="pane po-board-filter">
            <FilterBar
              applied={filters}
              typeName={typeName}
              onSearch={(next) => {
                setSearchParams(toSearchParams(next));
              }}
            />
          </div>
        ),
      }}
      list={{ label: tb.panes.parents, content: listContent() }}
      detail={{
        label: t.component.paneTitle,
        scroll: false,
        content:
          parentItemId === null ? (
            <EmptyState size="sm" title={tb.empty.noParentTitle} />
          ) : (
            <BomDetail
              key={parentItemId}
              parentItemId={parentItemId}
              requestedBomId={requestedBomId}
              onPickBom={(bomId) => {
                setSearchParams(toSearchParams(filters, page, parentItemId, bomId));
              }}
            />
          ),
      }}
    />
  );
};

const EMPTY_PARENTS: Item[] = [];
