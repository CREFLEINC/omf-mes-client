import {
  AlertBanner,
  Button,
  Chip,
  EmptyState,
  Icon,
  SearchInput,
  Skeleton,
  Table,
  TextField,
  type ChipStatus,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import {
  HANDOVER_ALERT_ORDER,
  handoverTypeName,
  useHandoverAlertTypes,
} from '../../patterns/handover-alert-types';
import { useClientPage } from '../../patterns/client-page';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { hasChangedFilters } from '../../patterns/filter-more';
import {
  FIT_PLACEHOLDER_CLASS,
  useFitPlaceholderWidth,
} from '../../patterns/fit-placeholder-width';
import { SaveErrorBanner } from '../../patterns/master';
import { PageNav } from '../../patterns/page-nav';
import {
  PaneListHead,
  PaneSplitter,
  useFitToViewport,
  usePaneSplit,
} from '../../patterns/po-board';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import { formatPlantDateTime } from '../../patterns/plant-time';
import {
  sameHandover,
  toHandoverBody,
  toHandoverValues,
  validateHandover,
  type HandoverTemplateValues,
} from './handover-templates';
import { useConnection, useEventNames, useReplaceConnection, zaloConnectionKeys } from './queries';
import { handoverParamsOf, paramsOf } from './template-params';
import type { Connection, ConnectionFormValues } from './types';
import { sameValues, toFormValues, toReplaceBody, validateConnection } from './validation';
import { LoadErrorAlert } from '../../patterns/load-error-banner';

const t = messages.zaloConnection;
const w = t.workspace;
const hub = messages.common.inspectionHub;

const STATUS_CHIP: Record<Connection['status'], ChipStatus> = {
  ACTIVE: 'success',
  NOT_CONFIGURED: 'idle',
  REAUTH_REQUIRED: 'error',
};

const when = (value: string | null): string =>
  value === null ? t.values.none : (formatPlantDateTime(value) ?? value);

type SecretField = 'secretKey' | 'refreshToken';

/** 템플릿 목록 한 줄 — 이벤트별 템플릿과 인계 작업 템플릿을 한 목록에 둔다(#358). */
interface TemplateRow {
  /** `event:<코드>` · `handover:<코드>` */
  key: string;
  kind: 'event' | 'handover';
  code: string;
  name: string;
}

/**
 * W-CO-12 알림 연결 설정 — Zalo 연결 정보와 이벤트별 템플릿 ID(001 신설, 결정 #20).
 * 비밀값은 다시 보이지 않는다. [바꾸기]로 새 값을 넣을 때만 보낸다.
 */
export const ZaloConnectionScreen = () => {
  const queryClient = useQueryClient();
  const connection = useConnection();
  const events = useEventNames();
  const handoverTypes = useHandoverAlertTypes();
  const [values, setValues] = useState<ConnectionFormValues | null>(null);
  const [baseline, setBaseline] = useState<ConnectionFormValues | null>(null);
  const [handover, setHandover] = useState<HandoverTemplateValues>({});
  const [handoverBaseline, setHandoverBaseline] = useState<HandoverTemplateValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<string | null>(null);
  /* 템플릿 이름 검색 — 화면 안에서만 거른다(#358). 입력 중인 글과 [조회]로 건 글을 따로 든다. */
  const [search, setSearch] = useState('');
  const searchRef = useFitPlaceholderWidth(w.searchPlaceholder);
  const [keyword, setKeyword] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:zalo-connection:split', 0.45);
  const layout = useSplitOrientation('omf-mes:zalo-connection:split-orientation');

  const seed = (data: Connection): void => {
    const next = toFormValues(data);
    const nextHandover = toHandoverValues(data, HANDOVER_ALERT_ORDER);
    setValues(next);
    setBaseline(next);
    setHandover(nextHandover);
    setHandoverBaseline(nextHandover);
    setErrors({});
  };

  useEffect(() => {
    if (connection.data !== undefined) seed(connection.data);
  }, [connection.data]);

  const replace = useReplaceConnection((saved) => {
    /*
     * ⭐ 조회 캐시도 저장 응답으로 바꾼다 — 상태 Chip·「등록됨」은 캐시를 읽으므로, 폼만 다시 채우면
     * 첫 조회(미설정)가 새로 고칠 때까지 남는다(G2 실측).
     */
    queryClient.setQueryData(zaloConnectionKeys.connection, saved);
    seed(saved);
    setFlash(t.state.saved);
  });

  const touched = (): void => {
    setErrors({});
    setFlash(null);
    replace.reset();
  };

  const change = (patch: Partial<ConnectionFormValues>): void => {
    setValues((current) => (current === null ? current : { ...current, ...patch }));
    touched();
  };

  const changeHandover = (code: string, templateId: string): void => {
    setHandover((current) => ({ ...current, [code]: templateId }));
    touched();
  };

  const handoverName = (code: string): string =>
    handoverTypeName(
      handoverTypes.data?.find((type) => type.alertTypeCode === code),
      code,
    );

  const eventOrder = connection.data?.templates.map((item) => item.eventCode) ?? [];
  const eventName = (code: string): string => {
    const name = events.data?.find((event) => event.eventCode === code)?.eventName ?? '';
    return name.trim() === '' ? code : name;
  };

  const save = (): void => {
    if (values === null) return;
    const found = { ...validateConnection(values), ...validateHandover(handover) };
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    replace.write({
      ...toReplaceBody(values, eventOrder),
      handoverTemplates: toHandoverBody(handover, HANDOVER_ALERT_ORDER),
    });
  };

  const reload = (): void => {
    replace.reset();
    void connection.refetch().then((result) => {
      if (result.data !== undefined) seed(result.data);
    });
  };

  const copy = async (params: string): Promise<void> => {
    /* 보안 연결이 아니면 클립보드가 없다 — 파라미터는 화면에 보이므로 조용히 둔다. */
    try {
      await navigator.clipboard.writeText(params);
      setFlash(t.state.copied);
    } catch {
      setFlash(null);
    }
  };

  const isDirty =
    values !== null &&
    ((baseline !== null && !sameValues(values, baseline)) ||
      !sameHandover(handover, handoverBaseline));

  const revert = (): void => {
    if (baseline !== null) change(baseline);
    setHandover(handoverBaseline);
  };

  const fieldError = (key: string): string | undefined => errors[key] ?? replace.fieldErrors[key];

  /** 연결 정보 한 줄 — 라벨은 왼쪽 같은 폭, 값은 같은 자리에서 시작한다(앱 ID · 앱 비밀 키 · 갱신 토큰). */
  const fieldRow = (label: string, value: ReactNode, required = false): ReactNode => (
    <div className="zalo-field-row">
      <span className="field-label">
        {label}
        {required && (
          <span className="required-mark" aria-hidden="true">
            *
          </span>
        )}
      </span>
      <div className="zalo-field-value">{value}</div>
    </div>
  );

  const secretRow = (field: SecretField, label: string, isSet: boolean): ReactNode => {
    const value = values?.[field] ?? null;
    if (value === null) {
      return fieldRow(
        label,
        <div className="zalo-secret">
          <span>{isSet ? t.values.registered : t.values.notRegistered}</span>
          <Button
            variant="outlined"
            size="sm"
            aria-label={`${label} ${t.actions.change}`}
            onClick={() => change({ [field]: '' })}
          >
            {t.actions.change}
          </Button>
        </div>,
      );
    }

    /* [바꾸기]로 연 칸은 비우면 저장을 막는다(secretRequired) — 필수. */
    return fieldRow(
      label,
      <div className="zalo-secret">
        <TextField
          aria-label={label}
          required
          type="password"
          autoComplete="new-password"
          value={value}
          onChange={(event) => change({ [field]: event.target.value })}
          error={fieldError(field)}
        />
        <Button variant="text" size="sm" onClick={() => change({ [field]: null })}>
          {t.actions.cancelChange}
        </Button>
      </div>,
      true,
    );
  };

  /* 목록 — 이벤트별 템플릿(서버가 준 순서) 다음 인계 작업 템플릿(업무 흐름 순서). 값은 폼 상태에 그대로 둔다. */
  const allTemplates: TemplateRow[] = [
    ...eventOrder.map((code) => ({
      key: `event:${code}`,
      kind: 'event' as const,
      code,
      name: eventName(code),
    })),
    ...HANDOVER_ALERT_ORDER.map((code) => ({
      key: `handover:${code}`,
      kind: 'handover' as const,
      code,
      name: handoverName(code),
    })),
  ];
  const needle = keyword.trim().toLowerCase();
  const shownTemplates = allTemplates.filter(
    (row) => needle === '' || row.name.toLowerCase().includes(needle),
  );
  const templatePage = useClientPage(shownTemplates);
  const selectedRow = allTemplates.find((row) => row.key === selectedKey);

  const templateIdOf = (row: TemplateRow): string =>
    row.kind === 'event' ? (values?.templates[row.code] ?? '') : (handover[row.code] ?? '');
  const templateErrorOf = (row: TemplateRow): string | undefined =>
    fieldError(row.kind === 'event' ? `templates.${row.code}` : `handoverTemplates.${row.code}`);

  const templateColumns: Column<TemplateRow>[] = [
    {
      key: 'kind',
      align: 'center',
      header: w.kind,
      width: '110px',
      render: (row) => w.kinds[row.kind],
    },
    {
      key: 'name',
      /* 템플릿명 열만 왼쪽 정렬 — 열 순서를 바꿔도 따라가게 머리글에 표식을 단다(app.css `.notify-name-head`). */
      header: <span className="notify-name-head">{w.name}</span>,
      render: (row) => (
        <button
          type="button"
          className="users-roles-row-pick"
          aria-current={row.key === selectedKey ? 'true' : undefined}
          onClick={() => setSelectedKey((prev) => (prev === row.key ? null : row.key))}
        >
          {row.name}
        </button>
      ),
    },
    {
      key: 'templateId',
      align: 'center',
      header: w.templateId,
      width: '150px',
      render: (row) => {
        if (templateErrorOf(row) !== undefined) {
          return (
            <Chip size="sm" status="error">
              {w.hasError}
            </Chip>
          );
        }
        const id = templateIdOf(row).trim();
        return id === '' ? t.values.none : id;
      },
    },
  ];
  /* 열 순서 · 폭은 사용자가 바꾸고 브라우저에 남는다(단말 관리와 같다 · #358). */
  const orderedColumns = useColumnOrder('omf-mes:zalo-connection:columns:order', templateColumns);
  const resizable = useColumnWidths('omf-mes:zalo-connection:columns', orderedColumns);
  const fit = useFitColumns(resizable.columns);

  const listCollapse = {
    collapsed: split.collapsed,
    onToggle: split.toggleCollapsed,
    collapseLabel: hub.listCollapse,
    expandLabel: hub.listExpand,
    count: connection.data === undefined ? undefined : shownTemplates.length,
  };

  /** 고정 상자 — 연결 상태 · 연결 정보와 저장(저장 범위는 종전과 같다: 연결 정보 + 템플릿 ID 전부). */
  const connectionBox = (): ReactNode => {
    if (connection.isError) {
      return <LoadErrorAlert error={connection.error} onRetry={() => void connection.refetch()} />;
    }
    if (connection.isPending || values === null) return <Skeleton variant="rect" height="10rem" />;

    const data = connection.data;

    return (
      <>
        {/* 제목 · 연결 상태 배지 · 발송 상태 한 줄, 아래에 토큰 일시(사용자 지시 2026-11-24). 저장은 화면 위 오른쪽. */}
        <div className="zalo-connection-head">
          <h2 className="pane-title">{t.panes.connection}</h2>
          <div className="zalo-status" role="group" aria-label={t.panes.status}>
            <Chip status={STATUS_CHIP[data.status]}>{t.status[data.status]}</Chip>
            <span className="zalo-delivery" data-on={data.deliveryEnabled ? 'true' : 'false'}>
              {data.deliveryEnabled ? t.state.deliveryOn : t.state.deliveryDisabled}
            </span>
          </div>
        </div>
        <dl className="zalo-token-times">
          <div>
            <dt>{t.fields.expiresAt}</dt>
            <dd>{when(data.accessTokenExpiresAt)}</dd>
          </div>
          <div>
            <dt>{t.fields.refreshedAt}</dt>
            <dd>{when(data.lastRefreshedAt)}</dd>
          </div>
        </dl>
        {/*
         * 연결 오류는 안내 줄 하나로 — 한글 요약, 코드 · 원문은 「오류 상세」를 펼쳐 본다(사용자 지시 2026-11-24).
         * 갱신 토큰 교체 안내는 재등록 필요(REAUTH_REQUIRED — 서버가 갱신 토큰으로 새 토큰을 받지 못했을 때만 둔다)일 때만.
         */}
        {data.status === 'REAUTH_REQUIRED' && data.lastErrorCode === null && (
          <AlertBanner variant="error">{t.state.reauth}</AlertBanner>
        )}
        {data.lastErrorCode !== null && (
          <AlertBanner variant="error">
            {t.state.lastError(data.lastErrorCode)}
            {data.status === 'REAUTH_REQUIRED' && <> {t.state.reauth}</>}
            {/* 「오류 상세」 — 글 링크가 아니라 작은 테두리 단추 모양의 펼침(접힘이 처음). */}
            <details className="zalo-error-detail">
              <summary>
                <Icon name="expand_more" size={16} aria-hidden />
                {t.actions.errorDetail}
              </summary>
              <dl>
                <dt>{t.fields.errorCode}</dt>
                <dd>{data.lastErrorCode}</dd>
                <dt>{t.fields.errorMessage}</dt>
                <dd>{data.lastErrorMessage ?? t.values.none}</dd>
              </dl>
            </details>
          </AlertBanner>
        )}
        {replace.error?.kind === 'conflict' ? (
          <AlertBanner
            variant="error"
            action={
              <Button variant="outlined" size="sm" onClick={reload}>
                {t.actions.reload}
              </Button>
            }
          >
            {t.state.conflict}
          </AlertBanner>
        ) : (
          <SaveErrorBanner error={replace.error} />
        )}
        {flash !== null && <AlertBanner variant="success">{flash}</AlertBanner>}

        <div className="zalo-form">
          {fieldRow(
            t.fields.appId,
            <TextField
              aria-label={t.fields.appId}
              inputMode="numeric"
              value={values.appId}
              onChange={(event) => change({ appId: event.target.value })}
              error={fieldError('appId')}
            />,
          )}
          {secretRow('secretKey', t.fields.secretKey, data.secretKeySet)}
          {secretRow('refreshToken', t.fields.refreshToken, data.refreshTokenSet)}
        </div>
      </>
    );
  };

  const templateList = (): ReactNode => {
    if (connection.isError) return null;
    if (connection.isPending || values === null) return <Skeleton variant="rect" height="12rem" />;

    return (
      <>
        {/* 템플릿명 검색 — 목록 제목 바로 아래 한 줄(종전 위 조회 상자를 없앴다). 화면 안에서만 거른다. */}
        <div className="notify-list-search">
          <SearchInput
            containerClassName={`notify-search-input ${FIT_PLACEHOLDER_CLASS}`}
            label={w.search}
            value={search}
            placeholder={w.searchPlaceholder}
            ref={searchRef}
            onChange={(event) => setSearch(event.target.value)}
            onSearch={(value) => setKeyword(value)}
            clearLabel={messages.common.clear}
          />
          <div className="filter-actions field-cell-unlabeled">
            <Button onClick={() => setKeyword(search)}>{w.apply}</Button>
            {/* 초기화는 검색어가 처음 값(빈칸)과 다를 때만 보인다. */}
            {hasChangedFilters({ q: '' }, { q: search }, { q: keyword }) && (
              <Button
                variant="outlined"
                onClick={() => {
                  setSearch('');
                  setKeyword('');
                }}
              >
                {w.clear}
              </Button>
            )}
          </div>
        </div>
        {/* 줄 아무 곳이나 눌러도 고른다 — DS 표에 줄 클릭이 없어 눌린 줄의 단추로 넘긴다(단말 관리와 같다). */}
        <div
          ref={fit.ref}
          className="users-roles-list inspection-queue-table notify-list-table"
          style={resizable.style}
          onClick={(event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target.closest('button, a, input, select, textarea') !== null) return;
            target
              .closest('tbody tr')
              ?.querySelector<HTMLButtonElement>('.users-roles-row-pick')
              ?.click();
          }}
        >
          <Table
            density="compact"
            columns={fit.columns}
            rows={templatePage.rows}
            getRowId={(row) => row.key}
            aria-label={w.list}
            empty={<EmptyState size="sm" live title={w.empty} />}
          />
        </div>
        <PageNav {...templatePage.nav} buttonSize="md" />
      </>
    );
  };

  const templateDetail = (): ReactNode => {
    if (selectedRow === undefined || values === null) {
      return (
        <EmptyState
          size="sm"
          className="users-roles-pick-empty"
          icon={
            <span className="inspection-standard-empty-icon">
              <Icon name="sms" size={20} />
            </span>
          }
          title={w.selectTitle}
          description={w.select}
        />
      );
    }

    const row = selectedRow;
    const params = row.kind === 'event' ? paramsOf(row.code) : handoverParamsOf(row.code);
    return (
      <div className="zalo-template-detail">
        <h2 className="pane-title">{row.name}</h2>
        <TextField
          label={t.fields.templateId}
          value={templateIdOf(row)}
          onChange={(event) => {
            if (row.kind === 'event') {
              change({ templates: { ...values.templates, [row.code]: event.target.value } });
            } else {
              changeHandover(row.code, event.target.value);
            }
          }}
          error={templateErrorOf(row)}
        />
        {/* 템플릿 변수 — 라벨 아래 변수 이름과 [복사]를 나란히(사용자 지시 2026-11-24). 복사하는 글은 그대로다. */}
        <div className="field-cell">
          <span className="field-label">{t.fields.params}</span>
          <div className="zalo-template-params">
            <code>{params}</code>
            <Button
              variant="outlined"
              size="sm"
              aria-label={
                row.kind === 'event' ? t.actions.copyFor(row.name) : t.handover.copyFor(row.name)
              }
              onClick={() => void copy(params)}
            >
              {t.actions.copy}
            </Button>
          </div>
        </div>
        {/* 인계 작업 — 템플릿 ID 를 넣는 법 · 비워 두면 어떻게 되는지. */}
        {row.kind === 'handover' && (
          <p className="iqc-inspection-action-note" data-tone="info" role="note">
            <Icon name="info" size={16} aria-hidden />
            {t.handover.notice}
          </p>
        )}
      </div>
    );
  };

  const isStacked = layout.orientation === 'column';

  return (
    <div className="list-detail-workspace">
      {/* 머리글(경로 · 화면 이름)은 두지 않는다 — 사이드바가 위치를 말한다(단말 관리와 같은 틀 · #358). */}
      {/* 연결 정보와 템플릿 ID 는 한 번에 저장한다(종전과 같은 범위) — 그래서 두 카드 밖 화면 위 오른쪽에 둔다(사용자 지시 2026-11-24). */}
      <div className="list-detail-toolbar">
        {values !== null && (
          <div className="zalo-save-actions">
            {/* 저장 범위 안내는 고친 것이 있을 때만 버튼 옆 한 줄. */}
            {isDirty && <span className="field-note">{t.state.saveScope}</span>}
            <Button variant="outlined" disabled={!isDirty} onClick={revert}>
              {t.actions.revert}
            </Button>
            <Button
              disabled={!isDirty || replace.isSaving}
              loading={replace.isSaving}
              onClick={save}
            >
              {t.actions.save}
            </Button>
          </div>
        )}
        <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} inline />
      </div>

      {/* 위 — Zalo 연결 정보(연결 상태 · 연결 칸). 아래 — 템플릿 설정(공통 값 · 목록 | 상세). */}
      <section
        ref={aboveRef}
        className="pane zalo-pane zalo-connection-box"
        aria-label={t.panes.connection}
      >
        {connectionBox()}
      </section>

      {/* 템플릿 설정 — 제목 아래 모든 템플릿 공통 값(변수 값 최대 길이) 한 줄, 단위는 입력란 옆(사용자 지시 2026-11-25). */}
      {values !== null && (
        <section className="pane zalo-template-common" aria-label={t.panes.templates}>
          <h2 className="pane-title">{t.panes.templates}</h2>
          <div className="zalo-field-row">
            <span className="field-label">
              {t.fields.paramMaxLength}
              <span className="required-mark" aria-hidden="true">
                *
              </span>
            </span>
            <div className="zalo-field-value zalo-param-max">
              <TextField
                aria-label={t.fields.paramMaxLength}
                required
                inputMode="numeric"
                value={values.paramMaxLength}
                onChange={(event) => change({ paramMaxLength: event.target.value })}
                error={fieldError('paramMaxLength')}
              />
              <span className="zalo-param-unit">{t.values.charUnit}</span>
            </div>
          </div>
        </section>
      )}

      <div
        ref={splitRef}
        className={`po-board-split inspection-split list-detail-split${isStacked ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
        data-left-collapsed={split.collapsed ? 'true' : undefined}
      >
        <section className="pane list-detail-list notify-fit-list" aria-label={w.list}>
          <PaneListHead title={w.list} collapse={listCollapse} />
          {templateList()}
        </section>

        <PaneSplitter
          label={hub.splitter}
          ratio={split.ratio}
          onChange={split.commit}
          collapse={listCollapse}
        />
        {isStacked && (
          <PaneHeightSplitter
            label={hub.heightSplitter}
            height={layout.listHeight}
            onChange={layout.changeListHeight}
            collapse={listCollapse}
          />
        )}

        <section
          className="pane list-detail-detail zalo-template-pane"
          aria-label={selectedRow === undefined ? w.selectTitle : selectedRow.name}
        >
          {templateDetail()}
        </section>
      </div>
    </div>
  );
};
