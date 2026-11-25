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
  type Column,
  useToast,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import {
  HANDOVER_ALERT_ORDER,
  handoverTypeName,
  useHandoverAlertTypes,
} from '../../patterns/handover-alert-types';
import { useClientPage } from '../../patterns/client-page';
import { ErpDetailFields } from '../erp-item/erp-data-parts';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { hasChangedFilters } from '../../patterns/filter-more';
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
  rebaseHandover,
  sameHandover,
  toHandoverBody,
  toHandoverValues,
  validateHandover,
  withHandoverSection,
  type HandoverTemplateValues,
} from './handover-templates';
import { useConnection, useEventNames, useReplaceConnection, zaloConnectionKeys } from './queries';
import { handoverParamsOf, paramsOf } from './template-params';
import type { Connection, ConnectionFormValues, SaveSection } from './types';
import {
  rebaseValues,
  sameValues,
  toFormValues,
  toReplaceBody,
  validateConnection,
  withSection,
} from './validation';
import { LoadErrorAlert } from '../../patterns/load-error-banner';
import { LeaveGuard } from '../routing/leave-guard';

const t = messages.zaloConnection;
const w = t.workspace;
const hub = messages.common.inspectionHub;
const leave = messages.common.unsavedLeave;

/** 템플릿명 검색 칸 — 왼쪽 라벨(「템플릿명」)과 잇는다. */
const SEARCH_ID = 'zalo-template-search';
const TEMPLATE_ID_FIELD = 'zalo-template-id';
const TEMPLATE_ID_HELP = 'zalo-template-id-help';

type SecretField = 'secretKey' | 'refreshToken';

/** 저장 결과(오류 · 저장했습니다)를 보이는 상자 — 저장한 상자 안에 보인다. */
type FeedbackArea = 'connection' | 'template';
/** [수정]으로 여는 일반 칸 — 비밀값(앱 비밀 키 · 갱신 토큰)은 따로(`secretRow`). */
type PlainField = 'appId' | 'paramMaxLength';

const CONNECTION_SECTION: SaveSection = { kind: 'connection' };

const areaOf = (section: SaveSection): FeedbackArea =>
  section.kind === 'connection' ? 'connection' : 'template';

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
 * 비밀값은 다시 보이지 않는다. [등록]·[수정]으로 새 값을 넣을 때만 보낸다.
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
  const [feedbackAt, setFeedbackAt] = useState<FeedbackArea | null>(null);
  /** 보내는 중인 저장 — 어느 단위를, 어떤 저장 값 위에 얹었는지(응답이 오면 나머지 고친 값을 새 값 위로 옮긴다). */
  const pendingRef = useRef<{
    section: SaveSection;
    before: ConnectionFormValues;
    handoverBefore: HandoverTemplateValues;
  } | null>(null);
  /* 템플릿 이름 검색 — 화면 안에서만 거른다(#358). 입력 중인 글과 [조회]로 건 글을 따로 든다. */
  const [search, setSearch] = useState('');
  const [keyword, setKeyword] = useState('');
  /* 구분 거르기 라벨 — 누르면 바로 걸리고, 다시 누르면 풀린다(사용자 지시 2026-11-25). */
  const [kindFilter, setKindFilter] = useState<TemplateRow['kind'] | null>(null);
  /* 오류 안내 줄 오른쪽 「오류 상세」 — 처음엔 접힘. */
  const [errorDetailOpen, setErrorDetailOpen] = useState(false);
  /* 앱 ID · 변수 값 길이 제한 — 처음엔 값만 보이고 [수정]을 눌러야 입력 칸이 열린다(사용자 지시 2026-11-25). */
  const [editing, setEditing] = useState<ReadonlySet<PlainField>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { splitRef, aboveRef } = useFitToViewport();
  const rootRef = useRef<HTMLDivElement>(null);
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
    setEditing(new Set());
  };

  /* 처음 한 번만 채운다 — 저장 뒤 캐시를 바꿔도 다른 상자의 저장 안 한 값을 지우지 않는다(다시 불러오기는 `reload`). */
  useEffect(() => {
    if (connection.data !== undefined && baseline === null) seed(connection.data);
  }, [connection.data]);

  /*
   * 위 상자(Zalo 발송 설정 · 템플릿 조회)의 높이가 바뀌면 목록 | 상세의 윗변을 다시 잰다 — 창 바닥까지 채우는
   * 높이가 어긋나지 않게(ListDetailWorkspace 와 같다).
   */
  useLayoutEffect(() => {
    const root = rootRef.current;
    const splitEl = splitRef.current;
    if (root === null || splitEl === null || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        splitEl.style.setProperty(
          '--split-top',
          `${String(splitEl.getBoundingClientRect().top)}px`,
        );
      });
    });
    observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [splitRef]);

  const replace = useReplaceConnection((saved) => {
    /*
     * ⭐ 조회 캐시도 저장 응답으로 바꾼다 — 상태 Chip·「등록」은 캐시를 읽으므로, 폼만 다시 채우면
     * 첫 조회(미설정)가 새로 고칠 때까지 남는다(G2 실측).
     */
    queryClient.setQueryData(zaloConnectionKeys.connection, saved);
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending === null) {
      seed(saved);
    } else {
      /* 저장한 단위는 응답 값으로, 다른 상자에서 고친 값은 고친 채 새 저장 값 위로 옮긴다. */
      const next = toFormValues(saved);
      const nextHandover = toHandoverValues(saved, HANDOVER_ALERT_ORDER);
      setValues((current) =>
        current === null ? next : rebaseValues(current, pending.before, next, pending.section),
      );
      setHandover((current) =>
        rebaseHandover(current, pending.handoverBefore, nextHandover, pending.section),
      );
      setBaseline(next);
      setHandoverBaseline(nextHandover);
      setErrors({});
      /* 저장한 상자의 연 칸은 닫는다 — 비밀값 칸이 저장 뒤 「등록 [수정]」으로 돌아가는 것과 같다. */
      if (pending.section.kind === 'connection') setEditing(new Set());
    }
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

  /**
   * 한 상자 저장 — 본문은 종전처럼 전체(PUT · If-Match)지만, 마지막 저장 값 위에 이 단위의 고친 값만 얹는다.
   * 다른 상자의 저장 안 한 값은 싣지 않고 화면에 고친 채 남는다(#358).
   */
  const save = (section: SaveSection): void => {
    if (values === null || baseline === null) return;
    const body = withSection(baseline, values, section);
    const handoverBody = withHandoverSection(handoverBaseline, handover, section);
    const found = { ...validateConnection(body), ...validateHandover(handoverBody) };
    setErrors(found);
    setFeedbackAt(areaOf(section));
    if (Object.keys(found).length > 0) return;
    pendingRef.current = { section, before: baseline, handoverBefore: handoverBaseline };
    replace.write({
      ...toReplaceBody(body, eventOrder),
      handoverTemplates: toHandoverBody(handoverBody, HANDOVER_ALERT_ORDER),
    });
  };

  const reload = (): void => {
    replace.reset();
    void connection.refetch().then((result) => {
      if (result.data !== undefined) seed(result.data);
    });
  };

  const toast = useToast();
  const copy = async (params: string): Promise<void> => {
    /* 보안 연결이 아니면 클립보드가 없다 — 파라미터는 화면에 보이므로 조용히 둔다. */
    try {
      await navigator.clipboard.writeText(params);
      /* 복사 알림은 화면 오른쪽 아래 잠깐 뜨는 알림으로(사용자 지시 2026-11-25) — 상세 상자 안 안내 줄은 쓰지 않는다. */
      toast.show({ variant: 'success', description: t.state.copied });
    } catch {
      /* 실패는 조용히 둔다(종전과 같다). */
    }
  };

  const isDirty = (section: SaveSection): boolean =>
    values !== null &&
    baseline !== null &&
    (!sameValues(withSection(baseline, values, section), baseline) ||
      !sameHandover(withHandoverSection(handoverBaseline, handover, section), handoverBaseline));

  /** 이 상자의 칸만 저장 값으로 되돌린다 — 다른 상자에서 고친 값은 그대로. */
  const revert = (section: SaveSection): void => {
    if (baseline === null) return;
    setValues((current) => (current === null ? current : withSection(current, baseline, section)));
    setHandover((current) => withHandoverSection(current, handoverBaseline, section));
    if (section.kind === 'connection') setEditing(new Set());
    touched();
  };

  /** 상자 아래 오른쪽 [취소][저장] — 다른 화면과 같은 자리. */
  const sectionActions = (section: SaveSection): ReactNode => {
    const dirty = isDirty(section);
    /* 필수 칸(연 비밀값 · 변수 값 길이 제한)이 비어 있으면 [저장]을 막는다(사용자 지시 2026-11-25). */
    const missingRequired =
      section.kind === 'connection' &&
      values !== null &&
      (values.secretKey?.trim() === '' ||
        values.refreshToken?.trim() === '' ||
        values.paramMaxLength.trim() === '');
    return (
      <div className="form-actions">
        <Button variant="outlined" disabled={!dirty} onClick={() => revert(section)}>
          {t.actions.revert}
        </Button>
        <Button
          disabled={!dirty || missingRequired || replace.isSaving}
          loading={replace.isSaving && feedbackAt === areaOf(section)}
          onClick={() => save(section)}
        >
          {t.actions.save}
        </Button>
      </div>
    );
  };

  /** 저장 결과 — 저장(복사)한 상자 안에만 보인다. */
  const feedback = (area: FeedbackArea): ReactNode => {
    if (feedbackAt !== area) return null;
    return (
      <>
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
      </>
    );
  };

  const fieldError = (key: string): string | undefined => errors[key] ?? replace.fieldErrors[key];

  /** 연결 정보 한 줄 — 라벨은 왼쪽 같은 폭, 값은 같은 자리에서 시작한다(앱 ID · 앱 비밀 키 · 갱신 토큰). */
  const fieldRow = (
    label: string,
    value: ReactNode,
    required = false,
    note: ReactNode = null,
  ): ReactNode => (
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
      {note}
    </div>
  );

  /**
   * 앱 ID · 변수 값 길이 제한 — 닫혀 있으면 「저장 값 [수정]」(앱 ID 가 비었으면 「미등록 [등록]」), 열면 입력 칸 · [취소].
   * 칸별 [취소]는 없다 — 상자 아래 [취소]가 연 칸을 닫고 저장 값으로 되돌린다. 저장 본문 · 검사는 종전 그대로.
   */
  const plainRow = (
    field: PlainField,
    label: string,
    input: ReactNode,
    shown: string,
    required: boolean,
  ): ReactNode => {
    if (!editing.has(field)) {
      const isSet = shown !== '';
      const action = isSet ? t.actions.change : t.actions.register;
      return fieldRow(
        label,
        <div className="zalo-secret">
          <span>{isSet ? shown : t.values.notRegistered}</span>
          <Button
            variant="outlined"
            size="sm"
            aria-label={`${label} ${action}`}
            leadingIcon={<Icon name={isSet ? 'edit' : 'add'} size={16} aria-hidden />}
            onClick={() => setEditing((current) => new Set(current).add(field))}
          >
            {action}
          </Button>
        </div>,
        /* 빨간 * 는 입력 칸이 열렸을 때만 — 비밀값 칸과 같다. */
        false,
      );
    }
    return fieldRow(label, <div className="zalo-secret">{input}</div>, required);
  };

  const secretRow = (
    field: SecretField,
    label: string,
    isSet: boolean,
    note: ReactNode = null,
  ): ReactNode => {
    const value = values?.[field] ?? null;
    if (value === null) {
      /* 없으면 「미등록 [등록]」, 있으면 「등록 [수정]」. */
      const action = isSet ? t.actions.change : t.actions.register;
      return fieldRow(
        label,
        <div className="zalo-secret">
          {/* 「등록」 · 「미등록」은 라벨 모양(사용자 지시 2026-11-25) — 등록은 초록, 미등록은 무채색. */}
          <Chip size="sm" status={isSet ? 'success' : 'idle'}>
            {isSet ? t.values.registered : t.values.notRegistered}
          </Chip>
          <Button
            variant="outlined"
            size="sm"
            aria-label={`${label} ${action}`}
            leadingIcon={<Icon name={isSet ? 'edit' : 'add'} size={16} aria-hidden />}
            onClick={() => change({ [field]: '' })}
          >
            {action}
          </Button>
        </div>,
        false,
        note,
      );
    }

    /*
     * [등록]·[수정]으로 연 칸은 필수 — 비어 있으면 [저장]이 막힌다. 칸별 [취소]는 두지 않는다(사용자 지시 2026-11-25):
     * 상자 아래 [취소]가 연 칸을 모두 닫고 저장 값으로 되돌린다.
     */
    return fieldRow(
      label,
      <div className="zalo-secret">
        {/* 필수인데 비어 있으면 빨간 테두리(사용자 지시 2026-11-25 · 다른 화면 `*-required-empty` 와 같은 방식). */}
        <TextField
          aria-label={label}
          required
          containerClassName={value.trim() === '' ? 'zalo-required-empty' : undefined}
          type="password"
          autoComplete="new-password"
          value={value}
          onChange={(event) => change({ [field]: event.target.value })}
          error={fieldError(field)}
        />
      </div>,
      true,
      note,
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
    (row) =>
      (needle === '' || row.name.toLowerCase().includes(needle)) &&
      (kindFilter === null || row.kind === kindFilter),
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
      /* 이름 열도 다른 열처럼 가운데 · 보통 굵기(알림 수신자 · 인계작업 알림 목록과 같다 · app.css `.notify-list-centered`). */
      header: w.name,
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

  /** 고정 상자 — 연결 상태 · 연결 정보. 아래 오른쪽 [취소][저장]은 앱 ID · 앱 비밀 키 · 갱신 토큰 · 변수 값 길이 제한만 저장한다. */
  const connectionBox = (): ReactNode => {
    if (connection.isError) {
      return <LoadErrorAlert error={connection.error} onRetry={() => void connection.refetch()} />;
    }
    if (connection.isPending || values === null) return <Skeleton variant="rect" height="10rem" />;

    const data = connection.data;
    /* 연결 오류 — 재등록 필요이거나 마지막 오류가 남아 있을 때(아래 오류 안내 줄과 같은 조건). */
    const hasConnectionError = data.status === 'REAUTH_REQUIRED' || data.lastErrorCode !== null;
    /* 토큰 일시 — 값이 있는 것만 작은 보조 글로. */
    const tokenTimes = [
      { label: t.fields.expiresAt, value: data.accessTokenExpiresAt },
      { label: t.fields.refreshedAt, value: data.lastRefreshedAt },
    ].flatMap((item) =>
      item.value === null
        ? []
        : [{ label: item.label, value: formatPlantDateTime(item.value) ?? item.value }],
    );

    return (
      <>
        {/* 제목 옆 상태 칩 — 해당할 때만 「연결 오류」(경고색) · 「발송 꺼짐」(무채색). */}
        <div className="zalo-connection-head">
          <h2 className="pane-title">{t.panes.connection}</h2>
          {(hasConnectionError || !data.deliveryEnabled) && (
            <div className="zalo-status" role="group" aria-label={t.panes.status}>
              {hasConnectionError && (
                <Chip size="sm" status="warning">
                  {t.chips.connectionError}
                </Chip>
              )}
              {!data.deliveryEnabled && (
                <Chip size="sm" status="idle">
                  {t.chips.deliveryOff}
                </Chip>
              )}
            </div>
          )}
        </div>
        {/*
         * 연결 오류는 안내 줄 하나로 — 한글 요약, 코드 · 원문은 「오류 상세」를 펼쳐 본다(사용자 지시 2026-11-24).
         * 갱신 토큰 교체 안내는 재등록 필요(REAUTH_REQUIRED — 서버가 갱신 토큰으로 새 토큰을 받지 못했을 때만 둔다)일 때만.
         */}
        {data.status === 'REAUTH_REQUIRED' && data.lastErrorCode === null && (
          <AlertBanner variant="error">{t.state.reauth}</AlertBanner>
        )}
        {data.lastErrorCode !== null && (
          <AlertBanner variant="error">
            {/* 한 줄 — 왼쪽 요약, 오른쪽 「오류 상세」(테두리 단추 모양 유지 · 시안 2026-11-25). 펼치면 코드 · 원문이 아래에. */}
            <div className="zalo-error-line">
              <span>
                {t.state.lastError(data.lastErrorCode)}
                {data.status === 'REAUTH_REQUIRED' && <> {t.state.reauth}</>}
              </span>
              {/* 「Zalo 연결 설정」 단추와 같은 작은 테두리 단추 — 색은 오류 줄 글자색(사용자 지시 2026-11-25). */}
              <Button
                variant="outlined"
                size="sm"
                className="zalo-error-toggle"
                aria-expanded={errorDetailOpen}
                trailingIcon={<Icon name="chevron_right" size={16} aria-hidden />}
                onClick={() => setErrorDetailOpen((open) => !open)}
              >
                {t.actions.errorDetail}
              </Button>
            </div>
            {errorDetailOpen && (
              <dl className="zalo-error-detail-list">
                <dt>{t.fields.errorCode}</dt>
                <dd>{data.lastErrorCode}</dd>
                <dt>{t.fields.errorMessage}</dt>
                <dd>{data.lastErrorMessage ?? t.values.none}</dd>
              </dl>
            )}
          </AlertBanner>
        )}
        {feedback('connection')}

        <div className="zalo-form">
          {plainRow(
            'appId',
            t.fields.appId,
            <TextField
              aria-label={t.fields.appId}
              inputMode="numeric"
              value={values.appId}
              onChange={(event) => change({ appId: event.target.value })}
              error={fieldError('appId')}
            />,
            baseline?.appId ?? '',
            false,
          )}
          {secretRow('secretKey', t.fields.secretKey, data.secretKeySet)}
          {/* 토큰 일시는 갱신 토큰 칸 아래 보조 글(사용자 지시 2026-11-25) — 갱신 토큰으로 받는 접속 토큰의 시각이다. */}
          {secretRow(
            'refreshToken',
            t.fields.refreshToken,
            data.refreshTokenSet,
            tokenTimes.length > 0 ? (
              <dl className="zalo-token-times">
                {tokenTimes.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null,
          )}
          {plainRow(
            'paramMaxLength',
            t.fields.paramMaxLength,
            <div className="zalo-param-max">
              <TextField
                aria-label={t.fields.paramMaxLength}
                required
                containerClassName={
                  values.paramMaxLength.trim() === '' ? 'zalo-required-empty' : undefined
                }
                inputMode="numeric"
                value={values.paramMaxLength}
                onChange={(event) => change({ paramMaxLength: event.target.value })}
                error={fieldError('paramMaxLength')}
              />
              <span className="zalo-param-unit">{t.values.charUnit}</span>
            </div>,
            baseline === null || baseline.paramMaxLength === ''
              ? ''
              : `${baseline.paramMaxLength}${t.values.charUnit}`,
            true,
          )}
        </div>
        {/* 아래 줄 — 오른쪽 [취소][저장](시안 2026-11-25). */}
        <div className="zalo-connection-foot">{sectionActions(CONNECTION_SECTION)}</div>
      </>
    );
  };

  const templateList = (): ReactNode => {
    if (connection.isError) return null;
    if (connection.isPending || values === null) return <Skeleton variant="rect" height="12rem" />;

    return (
      <>
        {/* 줄 아무 곳이나 눌러도 고른다 — DS 표에 줄 클릭이 없어 눌린 줄의 단추로 넘긴다(단말 관리와 같다). */}
        <div
          ref={fit.ref}
          className="inspection-queue-table notify-list-table notify-list-centered"
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

  /* 템플릿명 검색 — 라벨 · 입력 칸 · [조회] · [초기화]를 한 줄에 붙여 둔다(템플릿 조회 상자 안). */
  const listSearch = (
    <div className="filter-bar zalo-template-search">
      {/* 이름은 입력 칸 위(다른 화면 조회 칸과 같다 · 사용자 지시 2026-11-25). */}
      <div className="field-cell zalo-search-cell">
        <label className="field-label" htmlFor={SEARCH_ID}>
          {w.search}
        </label>
        <SearchInput
          id={SEARCH_ID}
          containerClassName="zalo-search-input"
          value={search}
          placeholder={w.searchPlaceholder}
          onChange={(event) => setSearch(event.target.value)}
          onSearch={(value) => setKeyword(value)}
          clearLabel={messages.common.clear}
        />
      </div>
      {/* [조회]·[초기화]는 줄 오른쪽 끝(사용자 지시 2026-11-25). */}
      <div className="filter-actions field-cell-unlabeled zalo-search-actions">
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
  );

  /*
   * 구분 거르기 라벨 — 화면 위 줄 「⋯」 바로 왼쪽(사용자 지시 2026-11-25).
   * 누르면 바로 걸리고 다시 누르면 풀린다. 건수는 검색어로 거른 뒤의 수다.
   */
  const kindChips = (
    <div className="inspection-hub-counts" role="group" aria-label={w.kind}>
      {(['event', 'handover'] as const).map((kind) => (
        <Chip
          key={kind}
          variant="filter"
          size="sm"
          selected={kindFilter === kind}
          aria-pressed={kindFilter === kind}
          onSelectedChange={() => setKindFilter(kindFilter === kind ? null : kind)}
        >
          {w.kindWithCount(
            w.kinds[kind],
            allTemplates.filter(
              (row) =>
                row.kind === kind && (needle === '' || row.name.toLowerCase().includes(needle)),
            ).length,
          )}
        </Chip>
      ))}
    </div>
  );

  const templateDetail = (): ReactNode => {
    if (selectedRow === undefined || values === null) {
      /* 고르기 전 — 다른 알림 화면과 같은 빈 안내(아이콘 + 한 줄, 사용자 지시 2026-11-25). */
      return (
        <EmptyState
          size="sm"
          className="users-roles-pick-empty"
          icon={
            <span className="inspection-standard-empty-icon">
              <Icon name="notifications" size={20} />
            </span>
          }
          title={w.selectTitle}
        />
      );
    }

    const row = selectedRow;
    const params = row.kind === 'event' ? paramsOf(row.code) : handoverParamsOf(row.code);
    const section: SaveSection =
      row.kind === 'event'
        ? { kind: 'event', code: row.code }
        : { kind: 'handover', code: row.code };
    return (
      <div className="zalo-template-detail">
        {/* 제목은 「템플릿 상세」, 구분 · 템플릿명 · 템플릿 변수는 정보 표시 상자로(사용자 지시 2026-11-25 · 공통코드 상세와 같은 모양). */}
        <div className="erp-data-detail erp-data-detail-fill">
          <ErpDetailFields
            title={w.detailTitle}
            fields={[
              { key: 'kind', label: w.kind, value: w.kinds[row.kind] },
              { key: 'name', label: w.name, value: row.name },
              /* 템플릿 변수 — 정보 칸 안에 변수 이름과 [변수명 복사]를 나란히(사용자 지시 2026-11-25). 복사하는 글은 그대로다. */
              {
                key: 'params',
                label: t.fields.params,
                value: (
                  <span className="zalo-template-params">
                    <code>{params}</code>
                    <Button
                      variant="outlined"
                      size="sm"
                      aria-label={
                        row.kind === 'event'
                          ? t.actions.copyFor(row.name)
                          : t.handover.copyFor(row.name)
                      }
                      onClick={() => void copy(params)}
                    >
                      {t.actions.copy}
                    </Button>
                  </span>
                ),
              },
            ]}
          />
        </div>
        {feedback('template')}
        {/*
         * 「템플릿 ID」 이름 오른쪽에 인계 작업 도움말을 파란 안내 라벨로(사용자 지시 2026-11-25) — 입력 칸 아래 도움말 대신.
         * 입력 칸의 설명(aria-describedby)으로 이어 둔다.
         */}
        <div className="zalo-template-id-head">
          <label className="field-label" htmlFor={TEMPLATE_ID_FIELD}>
            {t.fields.templateId}
          </label>
          {row.kind === 'handover' && (
            <p id={TEMPLATE_ID_HELP} className="iqc-inspection-action-note" data-tone="info">
              <Icon name="info" size={16} aria-hidden />
              {t.handover.templateIdHelp}
            </p>
          )}
        </div>
        <TextField
          id={TEMPLATE_ID_FIELD}
          aria-describedby={row.kind === 'handover' ? TEMPLATE_ID_HELP : undefined}
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
        {/* 이 템플릿의 ID 만 저장한다 — 다른 템플릿 · 연결 정보에서 고친 값은 싣지 않는다. */}
        {sectionActions(section)}
      </div>
    );
  };

  const isStacked = layout.orientation === 'column';

  /* 어느 상자든 저장하지 않은 값이 있으면 다른 화면으로 가기 전에 묻는다(#358). */
  const hasUnsavedChanges =
    values !== null &&
    baseline !== null &&
    (!sameValues(values, baseline) || !sameHandover(handover, handoverBaseline));

  return (
    <div ref={rootRef} className="list-detail-workspace">
      <LeaveGuard
        when={hasUnsavedChanges}
        discardTitle={leave.title}
        discardBody={leave.body}
        stayLabel={leave.keep}
        leaveLabel={leave.confirm}
        showCloseButton={false}
        size="sm"
      />
      {/* 머리글(경로 · 화면 이름)은 두지 않는다 — 사이드바가 위치를 말한다(단말 관리와 같은 틀 · #358). */}
      <div className="list-detail-toolbar">
        {kindChips}
        <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} inline />
      </div>

      {/*
       * 템플릿 조회 — 템플릿명 검색 · [조회]만(길이 제한은 Zalo 발송 설정 상자로 옮겼다 · 사용자 지시 2026-11-25).
       * 목록 · 상세에는 저장 단추를 두지 않는다(상세 저장은 고른 템플릿 상자 안).
       */}
      <section className="pane zalo-template-box" aria-label={t.panes.templates}>
        {listSearch}
      </section>

      {/* 템플릿 조회 아래 — Zalo 발송 설정(연결 정보 + 변수 값 길이 제한). 아래 오른쪽 [취소][저장]은 이 상자의 칸만 저장한다. */}
      <section
        ref={aboveRef}
        className="pane zalo-pane zalo-connection-box"
        aria-label={t.panes.connection}
      >
        {connectionBox()}
      </section>

      <div
        ref={splitRef}
        className={`po-board-split inspection-split list-detail-split zalo-split${isStacked ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
        data-left-collapsed={split.collapsed ? 'true' : undefined}
      >
        <section className="pane list-detail-list" aria-label={w.list}>
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
          className="pane list-detail-detail"
          aria-label={selectedRow === undefined ? w.selectTitle : selectedRow.name}
        >
          {templateDetail()}
        </section>
      </div>
    </div>
  );
};
