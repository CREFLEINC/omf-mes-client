import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  Dialog,
  EmptyState,
  Icon,
  SearchInput,
  SkeletonText,
  Table,
  TextField,
  useToast,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useEffect, useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { useColumnWidths } from '../../patterns/column-resize';
import { SaveErrorBanner, codeLockMessage, useMasterWrite } from '../../patterns/master';
import { PageNav, type PageSize } from '../../patterns/page-nav';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import { runRequest } from '../../patterns/request';
import { Select } from '../../patterns/select';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import {
  codeValueToFormValues,
  emptyCodeValueFormValues,
  isSameCodeValueValues,
  toCodeValueCreate,
  toCodeValueUpdate,
} from './code-value-mappers';
import { type CodeUsage, UsageChips } from '../defect-cause-code/usage-chips';
import { codeValueDetailPath, codeValueKeys, useCodeValueDetail } from './code-value-queries';
import type { CodeValue, CodeValueFormValues } from './code-value-types';
import { CODE_VALUE_FORM_FIELDS, validateCodeValueForm } from './code-value-validation';
import { DateField } from './date-field';
import { LoadErrorBanner } from './load-error-banner';

type CodeValueDetailResponse = components['schemas']['CodeValueDetailResponse'];

const t = messages.judgmentCode.editor;
const hubText = messages.common.inspectionHub;
const requiredMessage = messages.commonCode.codeValue.validation.required;

/** 목록 · 상세 배치는 「품질 코드 관리」 묶음의 탭끼리 함께 쓴다 — 불량코드 탭과 같은 저장 키(#209). */
const DEFECT_JUDGMENT_ORIENTATION_KEY = 'omf-mes:defect-judgment-hub:split-orientation';

type FormSource = string | CodeValueDetailResponse;

interface FormState {
  source: FormSource;
  baseline: CodeValueFormValues;
  values: CodeValueFormValues;
}

export interface JudgmentCodeEditorProps {
  codeGroupId: number;
  selectedCodeValueId: number | null;
  onSelectCodeValue: (codeValueId: number) => void;
  isCreating: boolean;
  onOpenCreate: () => void;
  onCloseCreate: () => void;
  /** 탭 줄의 사용 여부 칩(전체 · 사용 · 미사용) — 불량코드 탭과 같다(#209). */
  usage: CodeUsage;
  onUsageChange: (usage: CodeUsage) => void;
  /** 적용된 검색어(코드 · 이름 · 한국어명 · 베트남어명) */
  keyword: string;
  /** 적용된 판정 유형(코드). 빈 문자열이면 전체 */
  typeCode: string;
  /** 조회 · 초기화가 검색어와 판정 유형을 함께 적용한다 */
  onFiltersChange: (next: { keyword: string; typeCode: string }) => void;
  page: number;
  onPageChange: (page: number) => void;
}

const orEmpty = (value: string | null | undefined): string =>
  value === null || value === undefined || value === '' ? t.values.empty : value;

const periodOf = (row: CodeValue): string => {
  const from = row.effectiveFrom ?? '';
  const to = row.effectiveTo ?? '';
  return from === '' && to === '' ? t.values.periodAlways : t.values.period(from, to);
};

/** 이름 옆 빨간 「*」 — 화면 읽기는 `aria-required` 로 듣는다(불량코드 창과 같다). */
const FieldLabel = ({
  htmlFor,
  label,
  required,
}: {
  htmlFor: string;
  label: string;
  required: boolean;
}) => (
  <span className="field-label">
    <label htmlFor={htmlFor}>{label}</label>
    {required && (
      <span className="required-mark" aria-hidden="true">
        {' '}
        *
      </span>
    )}
  </span>
);

/**
 * 판정 유형 코드 탭의 편집기(사용자 지시 2026-10-29 · omf-all-around#209) — 불량코드 탭과 같은 짜임이다:
 * 조회 카드(미사용 포함 · 판정 유형 추가) / 목록 표(가운데 정렬 · 열 순서 · 폭 · 쪽 이동) / 상세 카드(이름표 상자) /
 * 추가 · 수정 · 사용 중지 창.
 *
 * **조회 · 저장 · 잠금 규칙은 공통코드의 코드값 편집기(`code-value-section.tsx`)와 같다** — 같은 조회 훅 ·
 * 변환 · 검증을 그대로 쓴다. 공통코드 화면은 그 편집기를 그대로 쓰므로 이 탭을 고쳐도 바뀌지 않는다.
 */
export const JudgmentCodeEditor = ({
  codeGroupId,
  selectedCodeValueId,
  onSelectCodeValue,
  isCreating,
  onOpenCreate,
  onCloseCreate,
  usage,
  onUsageChange,
  keyword,
  typeCode,
  onFiltersChange,
  page,
  onPageChange,
}: JudgmentCodeEditorProps) => {
  const toast = useToast();
  const { client } = useApiClient();
  const codeId = useId();
  const nameId = useId();
  const orderId = useId();
  const codeLockId = useId();

  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:judgment-code:split', 0.45);
  const layout = useSplitOrientation(DEFECT_JUDGMENT_ORIENTATION_KEY);

  /*
   * 판정 유형은 몇 건뿐이라 미사용까지 끝까지 받아 화면이 거르고 쪽도 나눈다(#209) —
   * 칩 건수(전체 · 사용 · 미사용)와 「미사용만」은 서버 조건에 없다. 저장 뒤 무효화는 `codeValueKeys.all` 이 맡는다.
   */
  const list = useQuery({
    queryKey: [...codeValueKeys.all, 'judgment-all', codeGroupId],
    queryFn: () =>
      fetchAllPages((nextPage, size) =>
        runRequest(() =>
          client.GET('/mdm/code-values', {
            params: { query: { codeGroupId, includeInactive: true, page: nextPage, size } },
          }),
        ),
      ),
  });
  const allValues = list.data?.items ?? [];
  const usageCounts: Record<CodeUsage, number> | null = list.isSuccess
    ? {
        all: allValues.length,
        active: allValues.filter((row) => row.isActive).length,
        inactive: allValues.filter((row) => !row.isActive).length,
      }
    : null;
  const needle = keyword.trim().toLowerCase();
  const matched = allValues.filter(
    (row) =>
      (usage === 'all' || row.isActive === (usage === 'active')) &&
      (typeCode === '' || row.code === typeCode) &&
      (needle === '' ||
        [row.code, row.codeName, row.nameKo ?? '', row.nameVi ?? '']
          .join(' ')
          .toLowerCase()
          .includes(needle)),
  );
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const codeValues = matched.slice((page - 1) * pageSize, page * pageSize);

  /* 조회 카드의 검색어 — 「조회」·Enter 로 적용한다(불량코드 탭과 같은 트리거). */
  const [draftKeyword, setDraftKeyword] = useState(keyword);
  const [draftTypeCode, setDraftTypeCode] = useState(typeCode);
  useEffect(() => {
    setDraftKeyword(keyword);
  }, [keyword]);
  useEffect(() => {
    setDraftTypeCode(typeCode);
  }, [typeCode]);
  const typeFieldId = useId();

  /* 수정 창 — 고른 값을 고친다. 등록 창은 바깥(주소)이 연다. */
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);

  /* 상세 카드는 등록 창이 열려 있어도 고른 값을 그대로 보인다(불량코드 탭과 같다). */
  const detail = useCodeValueDetail(selectedCodeValueId);

  const [formState, setFormState] = useState<FormState | null>(null);
  const formSource: FormSource | null = isCreating
    ? `create:${String(codeGroupId)}`
    : isEditOpen
      ? (detail.data ?? null)
      : null;

  if (formSource === null) {
    if (formState !== null) setFormState(null);
  } else if (formState?.source !== formSource) {
    const seeded =
      typeof formSource === 'string'
        ? emptyCodeValueFormValues()
        : codeValueToFormValues(formSource.codeValue);
    setFormState({ source: formSource, baseline: seeded, values: seeded });
  }

  const isDirty =
    formState !== null && !isSameCodeValueValues(formState.values, formState.baseline);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /* 수정 — 이 행 하나만 보낸다(공통코드 편집기와 같다). */
  const updateWrite = useMasterWrite<CodeValueFormValues, CodeValue>({
    request: (values, headers) =>
      client.PUT('/mdm/code-values/{codeValueId}', {
        params: {
          path: { codeValueId: selectedCodeValueId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: toCodeValueUpdate(values),
      }),
    etagPath: selectedCodeValueId === null ? null : codeValueDetailPath(selectedCodeValueId),
    invalidateKeys: [codeValueKeys.all],
    knownFields: CODE_VALUE_FORM_FIELDS,
    onSuccess: () => {
      setFieldErrors({});
      setIsEditOpen(false);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const createWrite = useMasterWrite<CodeValueFormValues, CodeValue>({
    request: (values, headers) =>
      client.POST('/mdm/code-values', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: toCodeValueCreate(codeGroupId, values),
      }),
    etagPath: null,
    invalidateKeys: [codeValueKeys.all],
    knownFields: CODE_VALUE_FORM_FIELDS,
    onSuccess: (saved) => {
      setFieldErrors({});
      /* 고르는 것 자체가 등록을 끝냈다는 뜻 — 바깥이 주소를 한 번에 고친다(공통코드 편집기와 같다). */
      onSelectCodeValue(saved.codeValueId);
      toast.show({ variant: 'success', description: messages.common.created });
    },
  });

  const deactivateWrite = useMasterWrite<void, CodeValue>({
    request: (_variables, headers) =>
      client.POST('/mdm/code-values/{codeValueId}:deactivate', {
        params: {
          path: { codeValueId: selectedCodeValueId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
      }),
    etagPath: selectedCodeValueId === null ? null : codeValueDetailPath(selectedCodeValueId),
    invalidateKeys: [codeValueKeys.all],
    knownFields: [],
    onSuccess: () => {
      setIsDeactivateOpen(false);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const activeWrite = isCreating ? createWrite : updateWrite;

  const resetEditing = () => {
    updateWrite.reset();
    createWrite.reset();
    deactivateWrite.reset();
    setIsEditOpen(false);
    setIsDeactivateOpen(false);
    setFormState(null);
    setFieldErrors({});
  };

  const changeValues = (patch: Partial<CodeValueFormValues>) => {
    setFormState((prev) =>
      prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
    );
    for (const field of Object.keys(patch)) {
      activeWrite.clearFieldError(field);
      setFieldErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSave = () => {
    if (formState === null) return;
    const errors = validateCodeValueForm(formState.values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    activeWrite.write(formState.values);
  };

  const closeForm = () => {
    createWrite.reset();
    updateWrite.reset();
    setFieldErrors({});
    setFormState(null);
    setIsEditOpen(false);
    if (isCreating) onCloseCreate();
  };

  const reloadDetail = () => {
    updateWrite.reset();
    deactivateWrite.reset();
    setFieldErrors({});
    setFormState(null);
    void detail.refetch();
  };

  /* ---------- 목록 표 ---------- */
  const columns: Column<CodeValue>[] = [
    {
      key: 'code',
      align: 'center',
      header: t.fields.code,
      width: '200px',
      /* 코드는 링크 모양을 걷고 본문 글자로 둔다 — 줄 아무 곳이나 눌러 고른다(불량코드 탭과 같다). */
      render: (row) => (
        <button
          type="button"
          className="inspection-standard-plan-open judgment-code-open"
          aria-current={row.codeValueId === selectedCodeValueId ? 'true' : undefined}
          title={row.code}
          onClick={() => {
            resetEditing();
            onSelectCodeValue(row.codeValueId);
          }}
        >
          {row.code}
        </button>
      ),
    },
    {
      key: 'codeName',
      align: 'center',
      header: t.fields.name,
      width: '180px',
      render: (row) => <span title={row.codeName}>{row.codeName}</span>,
    },
    {
      key: 'nameKo',
      align: 'center',
      header: t.fields.nameKo,
      width: '140px',
      render: (row) => orEmpty(row.nameKo),
    },
    {
      key: 'nameVi',
      align: 'center',
      header: t.fields.nameVi,
      width: '140px',
      render: (row) => orEmpty(row.nameVi),
    },
    {
      key: 'displayOrder',
      align: 'center',
      header: t.fields.displayOrder,
      width: '110px',
      render: (row) => String(row.displayOrder),
    },
    {
      key: 'period',
      align: 'center',
      header: t.fields.period,
      width: '220px',
      render: (row) => periodOf(row),
    },
    {
      key: 'isActive',
      align: 'center',
      header: t.fields.isActive,
      width: '100px',
      render: (row) => (
        <Chip variant="status" size="sm" status={row.isActive ? 'success' : 'idle'}>
          {row.isActive ? t.values.chipActive : t.values.chipInactive}
        </Chip>
      ),
    },
  ];

  const ordered = useColumnOrder('omf-mes:judgment-code:columns:order:v2', columns);
  const resizable = useColumnWidths('omf-mes:judgment-code:columns:v2', ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true });

  const listSlot = (): ReactNode => {
    if (list.isError) {
      return <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />;
    }
    if (list.isPending) {
      return (
        <div role="status" aria-label={t.loading.list}>
          <SkeletonText lines={3} />
        </div>
      );
    }
    return (
      <div
        ref={fit.ref}
        className="inspection-queue-table inspection-standard-plan-rows inspection-standard-table-box defect-cause-rows"
        style={resizable.style}
        onClick={(event) => {
          const target = event.target as Element;
          if (target.closest('button, a, input, select, textarea') !== null) return;
          target
            .closest('tbody tr')
            ?.querySelector<HTMLButtonElement>('.judgment-code-open')
            ?.click();
        }}
      >
        <Table
          density="compact"
          columns={fit.columns}
          rows={codeValues}
          getRowId={(row) => String(row.codeValueId)}
          empty={
            <EmptyState
              size="sm"
              live
              icon={
                <span className="inspection-standard-empty-icon">
                  <Icon name="list_alt" size={20} />
                </span>
              }
              /* 등록된 값이 있는데 조건에 걸러져 빈 경우는 따로 알린다 — 「등록된 것이 없다」로 읽히지 않게. */
              title={allValues.length === 0 ? t.empty.noneTitle : t.empty.noMatchTitle}
              description={
                allValues.length === 0 ? t.empty.noneDescription : t.empty.noMatchDescription
              }
            />
          }
        />
      </div>
    );
  };

  /* ---------- 상세 카드 ---------- */
  const renderDetail = (): ReactNode => {
    if (selectedCodeValueId === null) {
      return (
        <section className="pane" aria-label={t.detailTitle}>
          <EmptyState
            size="sm"
            icon={
              <span className="inspection-standard-empty-icon">
                <Icon name="layers" size={20} />
              </span>
            }
            title={t.empty.notSelectedTitle}
            description={t.empty.notSelectedDescription}
          />
        </section>
      );
    }
    if (detail.isError) {
      return (
        <section className="pane" aria-label={t.detailTitle}>
          <LoadErrorBanner error={detail.error} onRetry={() => void detail.refetch()} />
        </section>
      );
    }
    if (detail.data === undefined) {
      return (
        <section className="pane" aria-label={t.detailTitle}>
          <div role="status" aria-label={t.loading.detail}>
            <SkeletonText lines={4} />
          </div>
        </section>
      );
    }

    const value = detail.data.codeValue;
    return (
      <section className="pane inspection-standard-detail-card" aria-label={t.detailTitle}>
        <div className="inspection-standard-plan-head-card">
          <div className="inspection-standard-plan-head">
            <div className="inspection-standard-plan-chips">
              <h2 className="pane-title">{t.detailTitle}</h2>
              <Chip variant="status" status={value.isActive ? 'success' : 'idle'}>
                {value.isActive ? t.values.chipActive : t.values.chipInactive}
              </Chip>
            </div>
            <div className="defect-cause-head-actions">
              <Button
                variant="outlined"
                disabled={!value.isActive}
                title={value.isActive ? undefined : t.deactivate.alreadyInactive}
                onClick={() => {
                  deactivateWrite.reset();
                  setIsDeactivateOpen(true);
                }}
              >
                {messages.common.deactivate}
              </Button>
              <Button
                variant="outlined"
                leadingIcon={<Icon name="edit" size={18} />}
                onClick={() => {
                  updateWrite.reset();
                  setFieldErrors({});
                  setIsEditOpen(true);
                }}
              >
                {t.actions.edit}
              </Button>
            </div>
          </div>
          <dl className="inspection-standard-facts-line inspection-standard-plan-facts">
            {[
              { label: t.fields.code, value: value.code },
              { label: t.fields.name, value: value.codeName },
              { label: t.fields.nameKo, value: orEmpty(value.nameKo) },
              { label: t.fields.nameVi, value: orEmpty(value.nameVi) },
              { label: t.fields.displayOrder, value: String(value.displayOrder) },
              { label: t.fields.period, value: periodOf(value) },
            ].map((fact) => (
              <div key={fact.label}>
                <dt className="field-label">{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    );
  };

  /* ---------- 추가 · 수정 창 ---------- */
  const renderFormDialog = (): ReactNode => {
    if (formState === null) return null;
    if (!isCreating && (!isEditOpen || detail.data === undefined)) return null;

    const errors = { ...activeWrite.fieldErrors, ...fieldErrors };
    const codeLockReason =
      !isCreating && detail.data !== undefined ? codeLockMessage(detail.data.editability) : null;
    const codeLocked = codeLockReason !== null;
    /* 처음 열 때는 빨간 테두리 없이 「*」로 알리고, 비운 채 저장하면 테두리만 빨갛게(불량코드 창과 같다). */
    const errorProps = (key: string) => {
      const error = errors[key];
      if (error === undefined) return {};
      return error === requiredMessage
        ? { error, containerClassName: 'inspection-standard-border-only' }
        : { error };
    };

    return (
      <Dialog
        open
        size="lg"
        title={isCreating ? t.createTitle : t.editTitle}
        onClose={closeForm}
        closeOnBackdropClick={false}
        showCloseButton={false}
        footer={
          <>
            <Button variant="outlined" onClick={closeForm}>
              {messages.common.cancel}
            </Button>
            <Button
              disabled={!isDirty || activeWrite.isSaving}
              loading={activeWrite.isSaving}
              onClick={handleSave}
            >
              {messages.common.save}
            </Button>
          </>
        }
      >
        <SaveErrorBanner
          error={activeWrite.error}
          onReload={isCreating ? undefined : reloadDetail}
        />
        {/*
         * 값 추가 경고 — 추가 창 안에서만 낸다(사용자 지시 2026-10-29 · #209). 불량코드 창의 대분류 경고와 같은 모양.
         * 늘 보이는 경고는 읽히지 않아, 값을 늘리는 그 순간에만 낸다.
         */}
        {isCreating && (
          <div className="banner-slot">
            <AlertBanner variant="warning">{t.form.addWarning}</AlertBanner>
          </div>
        )}
        {/*
         * 첫 줄 판정 코드 · 판정 유형명 · 표시 순서, 둘째 줄 사용 시작일 · 종료일(사용자 지시 2026-10-29 · #209).
         * 창 문구는 `t.form` — 표 · 상세 카드의 이름은 그대로 둔다.
         */}
        <div className="form-grid defect-cause-form-grid judgment-code-form-grid">
          <div className="field-cell">
            <FieldLabel htmlFor={codeId} label={t.form.code} required={!codeLocked} />
            <TextField
              id={codeId}
              placeholder={t.form.codePlaceholder}
              value={formState.values.code}
              onChange={(event) => changeValues({ code: event.target.value })}
              disabled={codeLocked}
              trailingIcon={codeLocked ? <Icon name="lock" size={18} /> : undefined}
              aria-describedby={codeLocked ? codeLockId : undefined}
              aria-required={!codeLocked}
              {...errorProps('code')}
            />
          </div>
          <div className="field-cell">
            <FieldLabel htmlFor={nameId} label={t.fields.name} required />
            <TextField
              id={nameId}
              placeholder={t.placeholders.name}
              value={formState.values.codeName}
              onChange={(event) => changeValues({ codeName: event.target.value })}
              aria-required
              {...errorProps('codeName')}
            />
          </div>
          <div className="field-cell">
            <FieldLabel htmlFor={orderId} label={t.form.displayOrder} required />
            <TextField
              id={orderId}
              type="number"
              step={1}
              placeholder={t.form.displayOrderPlaceholder}
              value={formState.values.displayOrder}
              onChange={(event) => changeValues({ displayOrder: event.target.value })}
              aria-required
              {...errorProps('displayOrder')}
            />
          </div>
          {codeLocked && (
            <p
              id={codeLockId}
              className="iqc-inspection-action-note defect-cause-form-wide defect-cause-lock-note"
              data-tone="info"
            >
              <Icon name="info" size={14} aria-hidden />
              {codeLockReason}
            </p>
          )}
          <div className="judgment-code-form-half">
            <DateField
              label={t.form.effectiveFrom}
              value={formState.values.effectiveFrom}
              onChange={(effectiveFrom) => changeValues({ effectiveFrom })}
              error={errors.effectiveFrom}
            />
          </div>
          <div className="judgment-code-form-half">
            <DateField
              label={t.form.effectiveTo}
              value={formState.values.effectiveTo}
              onChange={(effectiveTo) => changeValues({ effectiveTo })}
              error={errors.effectiveTo}
            />
          </div>
        </div>
      </Dialog>
    );
  };

  return (
    <>
      {/* 탭 줄 오른쪽 — 사용 여부 칩 다음에 좌우·상하 배치(불량코드 탭과 같다 · #209). */}
      <UsageChips
        counts={usageCounts}
        value={usage}
        onChange={(next) => {
          resetEditing();
          onUsageChange(next);
        }}
      />
      <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} />

      {/* 조회 조건 — 불량코드 탭처럼 목록과 다른 카드에 둔다(#209). */}
      <section
        ref={aboveRef}
        className="pane inspection-standard-search defect-cause-search"
        role="search"
      >
        <div className="filter-bar">
          {/* 「미사용 포함」 확인칸은 걷었다 — 탭 줄의 사용 여부 칩이 맡는다(불량코드 탭과 같다 · #209). */}
          {/* 판정 유형 선택 — 불량코드 탭의 처분 유형 선택과 같은 자리 · 모양(사용자 지시 2026-10-29 · #209). */}
          <div className="field-cell defect-cause-filter-select">
            <span className="field-label">
              <label htmlFor={typeFieldId}>{t.search.typeLabel}</label>
            </span>
            <Select
              id={typeFieldId}
              options={[
                { value: '', label: t.search.typeAll },
                ...allValues.map((row) => ({ value: row.code, label: row.codeName })),
              ]}
              value={draftTypeCode}
              onChange={setDraftTypeCode}
            />
          </div>
          <SearchInput
            containerClassName="judgment-code-search-field"
            label={t.search.label}
            placeholder={t.search.placeholder}
            value={draftKeyword}
            onChange={(event) => setDraftKeyword(event.target.value)}
            onSearch={(value) => {
              resetEditing();
              onFiltersChange({ keyword: value.trim(), typeCode: draftTypeCode });
            }}
            clearLabel={messages.common.clear}
          />
          <div className="filter-actions field-cell-unlabeled">
            <Button
              variant="filled"
              onClick={() => {
                resetEditing();
                onFiltersChange({ keyword: draftKeyword.trim(), typeCode: draftTypeCode });
              }}
            >
              {messages.common.search}
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                resetEditing();
                setDraftKeyword('');
                setDraftTypeCode('');
                onFiltersChange({ keyword: '', typeCode: '' });
              }}
            >
              {messages.common.reset}
            </Button>
            <span className="inspection-standard-filter-divider" aria-hidden />
            <Button
              leadingIcon={<Icon name="add" size={18} />}
              disabled={isCreating}
              onClick={() => {
                resetEditing();
                onOpenCreate();
              }}
            >
              {t.actions.add}
            </Button>
          </div>
        </div>
      </section>

      <div
        ref={splitRef}
        className={`po-board-split inspection-split inspection-standard-split defect-cause-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
      >
        <section
          className="pane inspection-standard-list-pane defect-cause-list-pane"
          aria-label={t.list}
        >
          {listSlot()}
          {!list.isError && !list.isPending && (
            <PageNav
              meta={{ page, size: pageSize, total: matched.length }}
              buttonSize="md"
              onChangePage={(next) => {
                resetEditing();
                onPageChange(next);
              }}
              onChangeSize={(next) => {
                resetEditing();
                setPageSize(next);
                onPageChange(1);
              }}
            />
          )}
        </section>

        <PaneSplitter label={hubText.splitter} ratio={split.ratio} onChange={split.commit} />
        {layout.orientation === 'column' && (
          <PaneHeightSplitter
            label={hubText.heightSplitter}
            height={layout.listHeight}
            onChange={layout.changeListHeight}
          />
        )}

        <div className="inspection-standard-detail">{renderDetail()}</div>
      </div>

      {renderFormDialog()}

      {isDeactivateOpen && (
        <Dialog
          open
          size="sm"
          title={t.deactivate.title}
          onClose={() => {
            setIsDeactivateOpen(false);
            deactivateWrite.reset();
          }}
          closeOnBackdropClick={false}
          showCloseButton={false}
          footer={
            <>
              <Button
                variant="outlined"
                onClick={() => {
                  setIsDeactivateOpen(false);
                  deactivateWrite.reset();
                }}
              >
                {messages.common.cancel}
              </Button>
              <Button
                loading={deactivateWrite.isSaving}
                disabled={deactivateWrite.isSaving}
                onClick={() => deactivateWrite.write(undefined)}
              >
                {messages.common.deactivate}
              </Button>
            </>
          }
        >
          <SaveErrorBanner error={deactivateWrite.error} onReload={reloadDetail} />
          <p>{t.deactivate.description}</p>
        </Dialog>
      )}
    </>
  );
};
