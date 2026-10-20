import {
  AlertBanner,
  Breadcrumb,
  Button,
  type Column,
  EmptyState,
  PageHeader,
  SkeletonText,
  Table,
  TextField,
} from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { ItemPickerDialog } from '../../patterns/item-picker';
import { toApiError } from '../../patterns/request';
import {
  type BomListQuery,
  type NameOf,
  useBomComponents,
  useBomList,
  useItemLabels,
  useStatusNames,
  useUomNames,
} from './queries';
import type { Bom, ErpBomComponent } from './types';

const t = messages.erpBom;

/**
 * 조회 실패의 원인을 한 줄 안내로 옮긴다. 조치가 재시도뿐이라 액션도 하나다.
 * 다른 화면 슬라이스의 같은 함수를 가져다 쓰지 않는다 — 슬라이스끼리 참조하면 한쪽 사정이 번진다.
 */
const describeLoadError = (error: ApiError): string => {
  switch (error.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http':
      if (error.status === 403) return messages.httpError.forbidden;
      // 서버가 빈 message를 주는 일이 있다. ??는 빈 문자열을 통과시켜 본문을 지운다.
      return error.message === undefined || error.message === ''
        ? messages.httpError.description
        : error.message;
    case 'conflict':
      return error.message === '' ? messages.httpError.description : error.message;
    case 'stateLocked':
    case 'validation': {
      const lines = error.errors.map((item) => item.message).join(' ');
      return lines === '' ? messages.httpError.description : lines;
    }
  }
};

const LoadErrorBanner = ({ error, onRetry }: { error: unknown; onRetry: () => void }) => (
  <div className="banner-slot">
    <AlertBanner
      variant="error"
      title={messages.httpError.loadTitle}
      action={
        <Button variant="outlined" size="sm" onClick={onRetry}>
          {messages.common.retry}
        </Button>
      }
    >
      {describeLoadError(toApiError(error))}
    </AlertBanner>
  </div>
);

/**
 * 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다.
 * ⭐ 0 은 값이다 — ERP 자품목 순번은 0 으로도 온다(장부 P-67).
 */
const orEmpty = (value: string | number | null | undefined): ReactNode =>
  value === null || value === undefined || value === '' ? t.values.empty : String(value);

const yesNo = (value: boolean): string => (value ? t.values.yes : t.values.no);

const formatQty = (qty: number, uom: string): string => `${qty.toLocaleString()} ${uom}`;

/** 손실률은 0~1 비율로 온다(A-8) — 퍼센트로 옮겨 낸다. 부동소수 꼬리는 소수 둘째 자리에서 자른다. */
const formatRate = (rate: number): string => `${String(Math.round(rate * 10000) / 100)}%`;

/** 주소의 조건. 조건은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다. */
interface Filters {
  parentItemId: number | null;
  bomCode: string;
}

const EMPTY_FILTERS: Filters = { parentItemId: null, bomCode: '' };

const readId = (value: string | null): number | null => {
  const id = Number(value ?? '');
  return Number.isInteger(id) && id > 0 ? id : null;
};

const toSearchParams = (filters: Filters, sel: number | null = null) => {
  const next = new URLSearchParams();
  if (filters.parentItemId !== null) next.set('item', String(filters.parentItemId));
  if (filters.bomCode !== '') next.set('code', filters.bomCode);
  if (sel !== null) next.set('sel', String(sel));
  return next;
};

const toListQuery = (filters: Filters): BomListQuery | null =>
  filters.parentItemId === null
    ? null
    : {
        parentItemId: filters.parentItemId,
        ...(filters.bomCode !== '' ? { bomCode: filters.bomCode } : {}),
      };

interface FilterBarProps {
  applied: Filters;
  parentLabel: string;
  onSearch: (filters: Filters) => void;
  onReset: () => void;
}

/**
 * 조건 줄. BOM 코드는 입력 중인 값을 이 줄이 갖고 「조회」를 눌러야 주소로 옮긴다.
 * 모품목은 대화상자에서 고르는 순간 조회한다 — 계약이 모품목을 필수로 요구해 그것 없이는 볼 것이 없다.
 */
const FilterBar = ({ applied, parentLabel, onSearch, onReset }: FilterBarProps) => {
  const [bomCode, setBomCode] = useState(applied.bomCode);
  const [pickerOpen, setPickerOpen] = useState(false);
  const parentLabelId = useId();

  // 뒤로가기 등으로 주소가 바뀌면 입력칸도 따라간다.
  useEffect(() => {
    setBomCode(applied.bomCode);
  }, [applied.bomCode]);

  return (
    <>
      <form
        className="filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch({ parentItemId: applied.parentItemId, bomCode: bomCode.trim() });
        }}
      >
        <div className="field-cell">
          <span className="field-label" id={parentLabelId}>
            {t.fields.parentItem}
          </span>
          <div className="filter-actions">
            <span role="status" aria-labelledby={parentLabelId}>
              {parentLabel}
            </span>
            <Button
              variant="outlined"
              size="sm"
              onClick={() => {
                setPickerOpen(true);
              }}
            >
              {t.actions.pickParent}
            </Button>
          </div>
        </div>
        <TextField
          label={t.fields.bomCode}
          value={bomCode}
          onChange={(event) => {
            setBomCode(event.target.value);
          }}
        />
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            {/* 모품목이 없으면 조회할 수 없다 — 계약이 모품목을 필수로 요구한다. */}
            <Button type="submit" disabled={applied.parentItemId === null}>
              {messages.common.search}
            </Button>
            <Button variant="outlined" onClick={onReset}>
              {messages.common.reset}
            </Button>
          </div>
        </div>
      </form>

      {pickerOpen && (
        <ItemPickerDialog
          multiple={false}
          /* 지난 자료를 보는 창이다 — 사용 중지된 품목의 BOM 도 찾을 수 있어야 한다. */
          includeInactive
          showAvailability={false}
          confirmLabel={t.actions.confirmPick}
          onClose={() => {
            setPickerOpen(false);
          }}
          onConfirm={(items) => {
            setPickerOpen(false);
            const [picked] = items;
            if (picked === undefined) return;
            onSearch({ parentItemId: picked.itemId, bomCode: bomCode.trim() });
          }}
        />
      )}
    </>
  );
};

interface ComponentPaneProps {
  bomId: number | null;
  uomNameOf: NameOf;
}

/**
 * 고른 BOM 의 구성품. **ERP 원본 열만** 보인다 — 공정·LOT 추적·자동 차감 같은 MES 확장 열은
 * 품목 확장속성 화면의 몫이다. 여기서 함께 보이면 「ERP 가 준 값」으로 읽힌다.
 */
const ComponentPane = ({ bomId, uomNameOf }: ComponentPaneProps) => {
  const components = useBomComponents(bomId);
  const rows = components.data ?? [];
  const itemLabelOf = useItemLabels(rows.map((row) => row.componentItemId));

  if (bomId === null) {
    return <p className="field-note">{t.empty.notSelected}</p>;
  }

  if (components.isError) {
    return <LoadErrorBanner error={components.error} onRetry={() => void components.refetch()} />;
  }

  if (components.data === undefined) {
    return (
      <div role="status" aria-label={t.loading.components}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  const columns: Column<ErpBomComponent>[] = [
    { key: 'sequenceNo', header: t.componentTable.sequenceNo, width: '72px', align: 'end' },
    {
      key: 'componentItemId',
      header: t.componentTable.componentItem,
      render: (row) => itemLabelOf(row.componentItemId),
    },
    {
      key: 'requiredQty',
      header: t.componentTable.requiredQty,
      width: '140px',
      align: 'end',
      render: (row) => formatQty(row.requiredQty, uomNameOf(row.uomId)),
    },
    {
      key: 'scrapRate',
      header: t.componentTable.scrapRate,
      width: '96px',
      align: 'end',
      render: (row) => formatRate(row.scrapRate),
    },
    {
      key: 'isMandatory',
      header: t.componentTable.isMandatory,
      width: '80px',
      render: (row) => yesNo(row.isMandatory),
    },
    {
      key: 'erpChildItemSeq',
      header: t.componentTable.erpChildItemSeq,
      width: '128px',
      align: 'end',
      render: (row) => orEmpty(row.erpChildItemSeq),
    },
  ];

  return (
    <div className="wide-table">
      <Table
        density="compact"
        columns={columns}
        rows={[...rows].sort((a, b) => a.sequenceNo - b.sequenceNo)}
        getRowId={(row) => String(row.bomComponentId)}
        empty={
          <EmptyState
            size="sm"
            live
            title={t.empty.noComponentTitle}
            description={t.empty.noComponentDescription}
          />
        }
      />
    </div>
  );
};

const EMPTY_BOMS: Bom[] = [];

/**
 * BOM 조회 (ERP) · W-06-18. ERP 가 보낸 BOM 헤더와 구성품을 읽기만 한다 — 쓰기 조작이 하나도 없다.
 *
 * 모품목 → BOM 목록 → 고른 BOM 의 구성품. 모품목·BOM 코드·고른 BOM 을 전부 주소에 둔다.
 * 모품목은 공용 품목 선택 대화상자로 고른다 — 품목 마스터가 수천 건이라 선택칸에 담을 수 없다.
 */
export const ErpBomScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: Filters = {
    parentItemId: readId(searchParams.get('item')),
    bomCode: searchParams.get('code') ?? '',
  };
  const selectedId = readId(searchParams.get('sel'));

  const list = useBomList(toListQuery(filters));
  const statusNameOf = useStatusNames();
  const uomNameOf = useUomNames();
  const itemLabelOf = useItemLabels(filters.parentItemId === null ? [] : [filters.parentItemId]);
  const boms = list.data ?? EMPTY_BOMS;

  /** 조건이 바뀌면 구성품을 닫는다 — 고른 BOM 이 새 결과에 없을 수 있다. */
  const applyQuery = (nextFilters: Filters) => {
    setSearchParams(toSearchParams(nextFilters));
  };

  const columns: Column<Bom>[] = [
    {
      key: 'bomCode',
      header: t.bomTable.bomCode,
      render: (row) => (
        // 접근 이름에 코드·Rev 를 넣는다 — 같은 코드의 여러 Rev 가 한 목록에 선다.
        <button
          type="button"
          className="link-cell"
          aria-label={t.bomTable.openAction(row.bomCode, row.bomVersion)}
          aria-pressed={row.bomId === selectedId}
          onClick={() => {
            setSearchParams(toSearchParams(filters, row.bomId));
          }}
        >
          {row.bomCode}
        </button>
      ),
    },
    { key: 'bomVersion', header: t.bomTable.bomVersion, width: '64px', align: 'end' },
    {
      key: 'statusCode',
      header: t.bomTable.status,
      width: '96px',
      render: (row) => statusNameOf(row.statusCode),
    },
    {
      key: 'isDefault',
      header: t.bomTable.isDefault,
      width: '72px',
      render: (row) => yesNo(row.isDefault),
    },
    { key: 'effectiveFrom', header: t.bomTable.effectiveFrom, width: '112px' },
    {
      key: 'effectiveTo',
      header: t.bomTable.effectiveTo,
      width: '112px',
      render: (row) => orEmpty(row.effectiveTo),
    },
    {
      key: 'baseQty',
      header: t.bomTable.baseQty,
      width: '128px',
      align: 'end',
      render: (row) => formatQty(row.baseQty, uomNameOf(row.baseUomId)),
    },
  ];

  const renderBoms = (): ReactNode => {
    if (filters.parentItemId === null) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noParentTitle}
          description={t.empty.noParentDescription}
        />
      );
    }
    // 조회에 실패했으면 표도 빈 상태도 내지 않는다 — 실패를 「없습니다」로 보이면 안 된다.
    if (list.isError) {
      return <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />;
    }
    if (list.isPending) {
      return (
        <div role="status" aria-label={t.loading.boms}>
          <SkeletonText lines={3} />
        </div>
      );
    }
    return (
      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={boms}
          getRowId={(row) => String(row.bomId)}
          empty={
            <EmptyState
              size="sm"
              live
              title={t.empty.noBomTitle}
              description={t.empty.noBomDescription}
            />
          }
        />
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />

      <section className="pane" aria-label={t.title}>
        <p className="field-note">{t.readOnlyNote}</p>
        <FilterBar
          applied={filters}
          parentLabel={
            filters.parentItemId === null ? t.values.notPicked : itemLabelOf(filters.parentItemId)
          }
          onSearch={applyQuery}
          onReset={() => {
            applyQuery(EMPTY_FILTERS);
          }}
        />
      </section>

      <section className="pane" aria-label={t.panes.boms}>
        <h2>{t.panes.boms}</h2>
        {renderBoms()}
      </section>

      <section className="pane" aria-label={t.panes.components}>
        <h2>{t.panes.components}</h2>
        <ComponentPane bomId={selectedId} uomNameOf={uomNameOf} />
      </section>
    </>
  );
};
