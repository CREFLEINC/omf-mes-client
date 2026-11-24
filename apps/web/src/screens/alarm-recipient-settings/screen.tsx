import {
  AlertBanner,
  Button,
  Chip,
  Dialog,
  EmptyState,
  Icon,
  Skeleton,
  Switch,
  Table,
  useToast,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useClientPage } from '../../patterns/client-page';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { InfoTip } from '../../patterns/info-tip';
import { ListDetailWorkspace } from '../../patterns/list-detail-workspace';
import { SaveErrorBanner } from '../../patterns/master';
import { PageNav } from '../../patterns/page-nav';
import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
import { LoadErrorAlert } from '../../patterns/load-error-banner';
import {
  addRecipients,
  hasInactiveRecipient,
  isApproverEvent,
  lacksRecipients,
  noPhoneCount,
  removeRecipient,
  sameDraft,
  toDraft,
  toReplaceBody,
} from './draft';
import {
  alarmRecipientKeys,
  useDepartments,
  useEvents,
  useReplaceSetting,
  useSettingDetail,
  useSettingSummary,
} from './queries';
import { RecipientPicker } from './recipient-picker';
import { SelectField } from './select-field';
import type { NotificationEvent, SettingDraft, SettingSummaryItem } from './types';

const t = messages.alarmRecipientSettings;
const w = t.workspace;
const ZALO_CONNECTION_PATH = '/notification/zalo-connection';

/** 아직 한 번도 저장하지 않은 행의 요약 — 서버의 미설정 기본값과 같다(끔·끔·0). */
const EMPTY_SUMMARY = { enabled: false, zaloEnabled: false, recipientCount: 0, noPhoneCount: 0 };

const eventLabel = (event: NotificationEvent | undefined, code: string): string =>
  event === undefined || event.eventName.trim() === '' ? code : event.eventName;

const onOffChip = (on: boolean) => (
  <Chip size="sm" status={on ? 'success' : 'idle'}>
    {on ? t.values.on : t.values.off}
  </Chip>
);

const parseId = (value: string | null): number | null =>
  value !== null && /^[1-9][0-9]*$/.test(value) ? Number(value) : null;

/** 이동할 자리 — 저장하지 않은 변경이 있으면 확인 뒤에 간다. */
interface Move {
  department: string;
  event: string | null;
}

/**
 * W-CO-11 알림 수신자 설정 — 부서 × 이벤트(001 재설계, 결정 #19).
 *
 * 부서와 이벤트는 URL(`?department=&event=`)이 든다. 알림센터가 정본이고 Zalo 는 부가 전달이다.
 */
export const AlarmRecipientSettingsScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const zaloNoteId = useId();
  const { session } = useSession();
  /* W-CO-12 권한이 있을 때만 연결 설정으로 가는 길을 단다 — 사이드바와 같은 판정이다. */
  const canOpenConnection = toWebAccess(session?.permissions).allows(ZALO_CONNECTION_PATH);

  const departments = useDepartments();
  const events = useEvents();
  const departmentId = parseId(searchParams.get('department'));
  const eventParam = searchParams.get('event');
  /* 고른 이벤트를 다시 눌러 푼 상태는 빈 `event` 로 둔다 — 그때는 첫 이벤트로 되돌리지 않는다. */
  const isEventCleared = eventParam === '';
  const selectedCode = isEventCleared
    ? null
    : events.data?.some((event) => event.eventCode === eventParam) === true
      ? eventParam
      : (events.data?.[0]?.eventCode ?? null);
  const selectedEvent = events.data?.find((event) => event.eventCode === selectedCode);
  const approver = isApproverEvent(selectedEvent);

  const summary = useSettingSummary(departmentId);
  const detail = useSettingDetail(departmentId, departmentId === null ? null : selectedCode);

  const [draft, setDraft] = useState<SettingDraft | null>(null);
  const [baseline, setBaseline] = useState<SettingDraft | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<Move | null>(null);

  /*
   * 처음 들어오면 로그인한 계정의 부서를 미리 골라 둔다(사용자 지시 2026-11-24). 한 번만 한다 — [초기화]로
   * 비운 뒤에는 다시 채우지 않는다. 계정에 부서가 없거나 목록에 없으면 종전처럼 비워 둔다.
   */
  const accountDepartmentId = session?.departmentId;
  const autoPicked = useRef(false);
  useEffect(() => {
    if (autoPicked.current || departments.data === undefined) return;
    autoPicked.current = true;
    if (departmentId !== null || accountDepartmentId === undefined) return;
    if (!departments.data.items.some((item) => item.departmentId === accountDepartmentId)) return;
    setSearchParams({ department: String(accountDepartmentId) }, { replace: true });
  }, [accountDepartmentId, departmentId, departments.data, setSearchParams]);

  /* 부서를 고른 뒤 이벤트가 URL 에 없으면 첫 이벤트를 적어 둔다 — 새로고침해도 같은 행이 열린다. */
  useEffect(() => {
    if (departmentId === null || selectedCode === null || eventParam === selectedCode) return;
    setSearchParams({ department: String(departmentId), event: selectedCode }, { replace: true });
  }, [departmentId, eventParam, selectedCode, setSearchParams]);

  const seed = (next: SettingDraft): void => {
    setDraft(next);
    setBaseline(next);
    setInlineError(null);
  };

  useEffect(() => {
    if (detail.data === undefined) return;
    seed(toDraft(detail.data));
  }, [detail.data]);

  const replace = useReplaceSetting(departmentId, selectedCode, (saved) => {
    queryClient.setQueryData(alarmRecipientKeys.detail(departmentId, selectedCode), saved);
    seed(toDraft(saved));
    toast.show({ variant: 'success', description: t.state.saved });
  });

  const isDirty = draft !== null && baseline !== null && !sameDraft(draft, baseline);

  const go = (move: Move): void => {
    setInlineError(null);
    replace.reset();
    /* 고르기를 풀면 고치던 내용은 버린다 — 남겨 두면 다음 이벤트를 누를 때 버릴지 또 묻는다. */
    if (move.event === '') setDraft(baseline);
    /* 초기화 — 부서를 고르기 전 처음 주소로(#358). */
    if (move.department === '') setSearchParams({});
    else
      setSearchParams(
        move.event === null ? { department: move.department } : { ...move, event: move.event },
      );
  };

  const requestMove = (move: Move): void => {
    if (isDirty) setPendingMove(move);
    else go(move);
  };

  const change = (next: SettingDraft): void => {
    setDraft(next);
    setInlineError(null);
    replace.reset();
  };

  const save = (): void => {
    if (draft === null) return;
    if (!approver && hasInactiveRecipient(draft)) {
      setInlineError(t.errors.inactiveRecipient);
      return;
    }
    replace.write(toReplaceBody(draft, approver));
  };

  const reload = (): void => {
    replace.reset();
    void detail.refetch().then((result) => {
      if (result.data !== undefined) seed(toDraft(result.data));
    });
  };

  const summaries = new Map(summary.data?.items.map((item) => [item.eventCode, item]));
  const summaryOf = (eventCode: string): Omit<SettingSummaryItem, 'eventCode'> =>
    summaries.get(eventCode) ?? EMPTY_SUMMARY;

  const eventColumns: Column<NotificationEvent>[] = [
    {
      key: 'event',
      header: t.columns.event,
      render: (event) => (
        <Button
          variant={event.eventCode === selectedCode ? 'filled' : 'text'}
          size="sm"
          aria-current={event.eventCode === selectedCode ? 'true' : undefined}
          onClick={() => {
            if (departmentId === null) return;
            requestMove({
              department: String(departmentId),
              event: event.eventCode === selectedCode ? '' : event.eventCode,
            });
          }}
        >
          {eventLabel(event, event.eventCode)}
        </Button>
      ),
    },
    {
      key: 'enabled',
      header: t.columns.enabled,
      render: (event) => onOffChip(summaryOf(event.eventCode).enabled),
    },
    {
      key: 'zalo',
      header: t.columns.zalo,
      render: (event) => onOffChip(summaryOf(event.eventCode).zaloEnabled),
    },
    {
      key: 'recipients',
      header: t.columns.recipients,
      render: (event) => {
        if (isApproverEvent(event)) return t.values.approver;
        const item = summaryOf(event.eventCode);
        return (
          <span>
            {String(item.recipientCount)}
            {item.noPhoneCount > 0 && (
              <>
                {' '}
                <Chip size="sm" status="warning">{`⚠${String(item.noPhoneCount)}`}</Chip>
              </>
            )}
          </span>
        );
      },
    },
  ];

  /* 열 순서 · 폭은 사용자가 바꾸고 브라우저에 남는다(단말 관리와 같다 · #358). */
  const orderedColumns = useColumnOrder(
    'omf-mes:alarm-recipient-settings:columns:order',
    eventColumns,
  );
  const resizable = useColumnWidths('omf-mes:alarm-recipient-settings:columns', orderedColumns);
  const fit = useFitColumns(resizable.columns);
  /* 이벤트는 한 번에 다 받는 작은 목록이라 화면 안에서 쪽을 나눈다. */
  const eventPage = useClientPage(departmentId === null ? [] : (events.data ?? []));

  const departmentOptions =
    departments.data?.items.map((item) => ({
      value: String(item.departmentId),
      label: `${item.departmentCode} · ${item.departmentName}`,
    })) ?? [];

  const loadError = (error: unknown, onRetry: () => void) => (
    <LoadErrorAlert error={error} onRetry={onRetry} />
  );

  const settingBody = () => {
    if (detail.isError) return loadError(detail.error, () => void detail.refetch());
    if (detail.isPending || draft === null) return <Skeleton variant="rect" height="14rem" />;

    const missingPhones = noPhoneCount(draft);

    return (
      <>
        {replace.error?.kind === 'conflict' ? (
          <div className="banner-slot">
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
          </div>
        ) : (
          <SaveErrorBanner error={replace.error} />
        )}
        {inlineError !== null && (
          <div className="banner-slot">
            <AlertBanner variant="error">{inlineError}</AlertBanner>
          </div>
        )}

        <div className="alarm-switches">
          <Switch
            label={t.fields.enabled}
            checked={draft.enabled}
            onChange={(event) => change({ ...draft, enabled: event.target.checked })}
          />
          <div>
            {/* 실패해도 알림센터는 받는다는 규칙은 Switch 옆 ⓘ 로(관리웹 정리 시안 A). */}
            <span className="info-label">
              <Switch
                label={t.fields.zalo}
                checked={draft.zaloEnabled}
                disabled={!draft.enabled}
                aria-describedby={draft.enabled ? undefined : zaloNoteId}
                onChange={(event) => change({ ...draft, zaloEnabled: event.target.checked })}
              />
              <InfoTip text={t.state.zaloHelp} />
            </span>
            {/* 잠긴 사유는 잠겼을 때만 Switch 아래에 둔다. */}
            {!draft.enabled && (
              <span id={zaloNoteId} className="field-note">
                {t.state.zaloNeedsEnabled}
              </span>
            )}
          </div>
        </div>

        {approver ? (
          <p className="alarm-approver-notice">{t.state.approverNotice}</p>
        ) : (
          <div className="alarm-recipients">
            <div className="alarm-recipients-heading">
              <h3>{t.fields.recipients(draft.recipients.length)}</h3>
              <Button variant="outlined" size="sm" onClick={() => setPickerOpen(true)}>
                {`+ ${t.actions.add}`}
              </Button>
            </div>
            {draft.recipients.length === 0 ? (
              <p className="field-note">{t.state.noRecipients}</p>
            ) : (
              <ul className="alarm-recipient-list" aria-label={t.columns.recipients}>
                {draft.recipients.map((recipient) => (
                  <li key={recipient.appUserId}>
                    <span>
                      {`${recipient.userName} (${recipient.departmentName ?? t.values.noDepartment})`}
                    </span>
                    {!recipient.hasPhone && (
                      <Chip size="sm" status="warning">{`📵 ${t.values.noPhone}`}</Chip>
                    )}
                    {!recipient.active && (
                      <Chip size="sm" status="error">
                        {t.values.inactive}
                      </Chip>
                    )}
                    <Button
                      variant="text"
                      size="sm"
                      aria-label={`${recipient.userName} ${t.actions.remove}`}
                      onClick={() => change(removeRecipient(draft, recipient.appUserId))}
                    >
                      {t.actions.remove}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {missingPhones > 0 && (
              <AlertBanner variant="info">{t.state.noPhoneNotice(missingPhones)}</AlertBanner>
            )}
            {lacksRecipients(draft, approver) && (
              <AlertBanner variant="warning">{t.state.noRecipientsWarning}</AlertBanner>
            )}
          </div>
        )}

        <div className="form-actions">
          <Button
            variant="outlined"
            disabled={!isDirty}
            onClick={() => {
              if (baseline !== null) change(baseline);
            }}
          >
            {t.actions.revert}
          </Button>
          <Button disabled={!isDirty || replace.isSaving} loading={replace.isSaving} onClick={save}>
            {t.actions.save}
          </Button>
        </div>

        <RecipientPicker
          open={pickerOpen}
          existingIds={new Set(draft.recipients.map((recipient) => recipient.appUserId))}
          onClose={() => setPickerOpen(false)}
          onAdd={(picked) => {
            change(addRecipients(draft, picked));
            setPickerOpen(false);
          }}
        />
      </>
    );
  };

  const eventList = () => {
    if (departmentId === null) return <EmptyState size="sm" title={t.state.selectDepartment} />;
    if (events.isError || summary.isError) {
      return loadError(events.error ?? summary.error, () => {
        void events.refetch();
        void summary.refetch();
      });
    }
    if (events.isPending || summary.isPending) return <Skeleton variant="rect" height="12rem" />;

    return (
      <>
        {/* 줄 아무 곳이나 눌러도 고른다 — DS 표에 줄 클릭이 없어 눌린 줄의 이벤트 단추로 넘긴다(단말 관리와 같다). */}
        <div
          ref={fit.ref}
          className="inspection-queue-table notify-list-table"
          style={resizable.style}
          onClick={(event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target.closest('button, a, input, select, textarea') !== null) return;
            target.closest('tbody tr')?.querySelector<HTMLButtonElement>('td button')?.click();
          }}
        >
          <Table
            columns={fit.columns}
            rows={eventPage.rows}
            getRowId={(event) => event.eventCode}
            density="compact"
            aria-label={t.panes.events}
            empty={<EmptyState size="sm" title={t.state.noEvents} />}
          />
        </div>
        <PageNav {...eventPage.nav} buttonSize="md" />
      </>
    );
  };

  const settingPane = () => {
    if (departmentId === null || selectedCode === null) {
      return (
        <EmptyState
          size="sm"
          className="users-roles-pick-empty"
          icon={
            <span className="inspection-standard-empty-icon">
              <Icon name="notifications" size={20} />
            </span>
          }
          title={departmentId === null || isEventCleared ? w.selectEventTitle : t.state.noEvents}
          description={w.selectEvent}
        />
      );
    }

    return (
      <>
        <h2 className="pane-title notify-detail-title">
          {t.panes.setting(eventLabel(selectedEvent, selectedCode))}
        </h2>
        {settingBody()}
      </>
    );
  };

  const filter = (
    <>
      <div className="filter-bar notify-filter-row">
        {departments.isError ? (
          loadError(departments.error, () => void departments.refetch())
        ) : departments.data !== undefined && departments.data.items.length === 0 ? (
          <EmptyState size="sm" title={t.state.noDepartments} />
        ) : (
          <SelectField
            required
            label={t.fields.department}
            options={departmentOptions}
            value={departmentId === null ? '' : String(departmentId)}
            placeholder={t.fields.departmentPlaceholder}
            disabled={departments.isPending}
            note={departments.data?.truncated === true ? t.state.departmentsTruncated : undefined}
            onChange={(value) => {
              if (value === String(departmentId)) return;
              requestMove({ department: value, event: selectedCode });
            }}
          />
        )}
        {/* 부서는 고르는 즉시 적용한다. [조회]는 그 부서의 목록을 다시 부르고, [초기화]는 부서를 고르기 전으로 —
            부서가 골라져 있을 때만 보인다(#358). */}
        <div className="filter-actions field-cell-unlabeled">
          <Button
            onClick={() => {
              void departments.refetch();
              if (departmentId === null) return;
              void events.refetch();
              void summary.refetch();
            }}
          >
            {w.apply}
          </Button>
          {departmentId !== null && (
            <Button
              variant="outlined"
              onClick={() => {
                requestMove({ department: '', event: null });
              }}
            >
              {w.clear}
            </Button>
          )}
        </div>
      </div>

      {/* 연결이 없어도 Switch 는 켤 수 있다 — 지금은 알림센터로만 간다는 사실만 밝힌다. */}
      {/* Zalo 미연결 안내 — 다른 화면과 같은 노란 안내 한 줄 + 끝에 이동 링크(사용자 지시 2026-11-24). */}
      {summary.data !== undefined && summary.data.zaloStatus !== 'ACTIVE' && (
        <p
          className="iqc-inspection-action-note notify-filter-note"
          data-tone="warning"
          role="note"
        >
          <Icon name="warning" size={16} aria-hidden />
          {t.state.zaloNotActive}
          {canOpenConnection && (
            <Link className="notify-filter-note-link" to={ZALO_CONNECTION_PATH}>
              {t.actions.openConnection}
            </Link>
          )}
        </p>
      )}
    </>
  );

  return (
    <>
      {/* 머리글(경로 · 화면 이름)은 두지 않는다 — 사이드바가 위치를 말한다(단말 관리와 같은 틀 · #358). */}
      <ListDetailWorkspace
        storageKey="omf-mes:alarm-recipient-settings"
        filter={{ label: w.filter, content: filter }}
        list={{
          label: w.list,
          title: w.list,
          count: departmentId === null ? undefined : events.data?.length,
          content: eventList(),
        }}
        detail={{
          label:
            departmentId === null || selectedCode === null
              ? w.selectEventTitle
              : t.panes.setting(eventLabel(selectedEvent, selectedCode)),
          content: settingPane(),
        }}
      />

      <Dialog
        open={pendingMove !== null}
        onClose={() => setPendingMove(null)}
        title={t.state.unsavedTitle}
        size="sm"
        footer={
          <>
            <Button variant="outlined" onClick={() => setPendingMove(null)}>
              {t.actions.cancel}
            </Button>
            <Button
              onClick={() => {
                if (pendingMove !== null) go(pendingMove);
                setPendingMove(null);
              }}
            >
              {t.actions.discard}
            </Button>
          </>
        }
      >
        {t.state.unsavedBody}
      </Dialog>
    </>
  );
};
