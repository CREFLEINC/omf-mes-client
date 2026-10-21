import {
  AlertBanner,
  Breadcrumb,
  Button,
  Chip,
  Dialog,
  EmptyState,
  PageHeader,
  Skeleton,
  Switch,
  Table,
  useToast,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
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
  const selectedCode =
    events.data?.some((event) => event.eventCode === eventParam) === true
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
            if (departmentId === null || event.eventCode === selectedCode) return;
            requestMove({ department: String(departmentId), event: event.eventCode });
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

  const departmentOptions =
    departments.data?.items.map((item) => ({
      value: String(item.departmentId),
      label: `${item.departmentCode} · ${item.departmentName}`,
    })) ?? [];

  const loadError = (onRetry: () => void) => (
    <AlertBanner
      variant="error"
      title={messages.httpError.loadTitle}
      action={
        <Button variant="outlined" size="sm" onClick={onRetry}>
          {messages.common.retry}
        </Button>
      }
    >
      {messages.httpError.description}
    </AlertBanner>
  );

  const settingBody = () => {
    if (detail.isError) return loadError(() => void detail.refetch());
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
            <Switch
              label={t.fields.zalo}
              checked={draft.zaloEnabled}
              disabled={!draft.enabled}
              aria-describedby={zaloNoteId}
              onChange={(event) => change({ ...draft, zaloEnabled: event.target.checked })}
            />
            <span id={zaloNoteId} className="field-note">
              {draft.enabled ? t.state.zaloHelp : t.state.zaloNeedsEnabled}
            </span>
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

  const workspace = () => {
    if (departmentId === null) {
      return <EmptyState size="sm" title={t.state.selectDepartment} />;
    }

    return (
      <div className="two-pane alarm-recipient-layout">
        <section className="pane alarm-recipient-pane" aria-labelledby="alarm-events-title">
          <h2 id="alarm-events-title" className="pane-title">
            {t.panes.events}
          </h2>
          {events.isError || summary.isError ? (
            loadError(() => {
              void events.refetch();
              void summary.refetch();
            })
          ) : events.isPending || summary.isPending ? (
            <Skeleton variant="rect" height="12rem" />
          ) : (
            <Table
              columns={eventColumns}
              rows={events.data}
              getRowId={(event) => event.eventCode}
              density="compact"
              caption={t.panes.events}
              empty={<EmptyState size="sm" title={t.state.noEvents} />}
            />
          )}
        </section>

        <section className="pane alarm-recipient-pane" aria-labelledby="alarm-setting-title">
          <h2 id="alarm-setting-title" className="pane-title">
            {t.panes.setting(eventLabel(selectedEvent, selectedCode ?? ''))}
          </h2>
          {selectedCode === null ? (
            <EmptyState size="sm" title={t.state.noEvents} />
          ) : (
            settingBody()
          )}
        </section>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />

      {/* 연결이 없어도 Switch 는 켤 수 있다 — 지금은 알림센터로만 간다는 사실만 밝힌다. */}
      {summary.data !== undefined && summary.data.zaloStatus !== 'ACTIVE' && (
        <div className="banner-slot">
          <AlertBanner
            variant="warning"
            action={
              canOpenConnection ? (
                <Link to={ZALO_CONNECTION_PATH}>{t.actions.openConnection}</Link>
              ) : undefined
            }
          >
            {t.state.zaloNotActive}
          </AlertBanner>
        </div>
      )}

      <div className="alarm-department-bar">
        {departments.isError ? (
          loadError(() => void departments.refetch())
        ) : departments.data !== undefined && departments.data.items.length === 0 ? (
          <EmptyState size="sm" title={t.state.noDepartments} />
        ) : (
          <SelectField
            label={t.fields.department}
            options={departmentOptions}
            value={departmentId === null ? '' : String(departmentId)}
            placeholder={t.fields.department}
            disabled={departments.isPending}
            note={departments.data?.truncated === true ? t.state.departmentsTruncated : undefined}
            onChange={(value) => {
              if (value === String(departmentId)) return;
              requestMove({ department: value, event: selectedCode });
            }}
          />
        )}
      </div>

      {workspace()}

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
