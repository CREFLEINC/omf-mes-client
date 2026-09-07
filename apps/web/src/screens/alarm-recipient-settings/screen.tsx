import {
  AlertBanner,
  Breadcrumb,
  Button,
  Checkbox,
  Chip,
  EmptyState,
  PageHeader,
  Skeleton,
  Table,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import {
  emptyRecipient,
  hasDraftErrors,
  sameRecipients,
  toDraft,
  toReplaceBody,
  validateDraft,
} from './draft';
import {
  useEvents,
  usePreview,
  useReferenceLists,
  useReplaceSubscription,
  useSubscription,
  useSubscriptions,
} from './queries';
import { SelectField } from './select-field';
import type { DraftError, NotificationEvent, Option, PreviewResult, RecipientDraft } from './types';

const t = messages.alarmRecipientSettings;
const EMPTY_RECIPIENTS: RecipientDraft[] = [];
const TYPE_OPTIONS: Option[] = [
  { value: 'ROLE', label: t.values.role },
  { value: 'USER', label: t.values.user },
];

const formatResolvedAt = (value: string): string => value.replace('T', ' ').slice(0, 16);

export const AlarmRecipientSettingsScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const events = useEvents();
  const subscriptions = useSubscriptions();
  const eventCodeFromUrl = searchParams.get('event');
  const selectedCode =
    events.data?.some((event) => event.eventCode === eventCodeFromUrl) === true
      ? eventCodeFromUrl
      : (events.data?.[0]?.eventCode ?? null);
  const detail = useSubscription(selectedCode);
  const references = useReferenceLists();
  const [draft, setDraft] = useState<RecipientDraft[]>(EMPTY_RECIPIENTS);
  const [baseline, setBaseline] = useState<RecipientDraft[]>(EMPTY_RECIPIENTS);
  const [errors, setErrors] = useState<DraftError[]>([]);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCode === null || eventCodeFromUrl === selectedCode) return;
    setSearchParams({ event: selectedCode }, { replace: true });
  }, [eventCodeFromUrl, selectedCode, setSearchParams]);

  useEffect(() => {
    if (detail.data === undefined) return;
    const next = toDraft(detail.data?.recipients ?? []);
    setDraft(next);
    setBaseline(next);
    setErrors([]);
    setPreviewResult(null);
  }, [detail.data, selectedCode]);

  const preview = usePreview(setPreviewResult);
  const replace = useReplaceSubscription(selectedCode, (saved) => {
    const next = toDraft(saved.recipients);
    setDraft(next);
    setBaseline(next);
    setErrors([]);
    setPreviewResult(null);
    setFlash(t.state.saved);
  });

  const options = useMemo(() => {
    const inactive = t.values.inactive;
    return {
      businessUnits:
        references.businessUnits.data?.map((item) => ({
          value: String(item.businessUnitId),
          label: `${item.businessUnitCode} · ${item.businessUnitName}${item.isActive ? '' : inactive}`,
        })) ?? [],
      roles:
        references.roles.data?.map((item) => ({
          value: String(item.roleId),
          label: `${item.roleCode} · ${item.roleName}${item.isActive ? '' : inactive}`,
        })) ?? [],
      users:
        references.users.data?.map((item) => ({
          value: String(item.appUserId),
          label: `${item.loginId} · ${item.userName}${item.isActive ? '' : inactive}`,
        })) ?? [],
    };
  }, [references.businessUnits.data, references.roles.data, references.users.data]);

  const updateDraft = (index: number, patch: Partial<RecipientDraft>): void => {
    setDraft((current) =>
      current.map((recipient, position) =>
        position === index ? { ...recipient, ...patch } : recipient,
      ),
    );
    setErrors([]);
    setPreviewResult(null);
    setFlash(null);
    preview.reset();
    replace.reset();
  };

  const resetEditingFeedback = (): void => {
    setErrors([]);
    setPreviewResult(null);
    setFlash(null);
    preview.reset();
    replace.reset();
  };

  const validateAndRun = (action: 'preview' | 'save'): void => {
    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);
    if (hasDraftErrors(nextErrors)) return;
    const body = toReplaceBody(draft, detail.data?.zaloEnabled ?? false);
    if (action === 'preview') preview.write(body);
    else replace.write(body);
  };

  const isDirty = !sameRecipients(draft, baseline);
  const referenceFailed =
    references.businessUnits.isError || references.roles.isError || references.users.isError;
  const counts = new Map(
    subscriptions.data?.map((subscription) => [
      subscription.eventCode,
      subscription.recipients.length,
    ]),
  );

  const eventColumns: Column<NotificationEvent>[] = [
    {
      key: 'event',
      header: t.columns.event,
      render: (event) => (
        <Button
          variant={event.eventCode === selectedCode ? 'filled' : 'text'}
          size="sm"
          onClick={() => {
            setFlash(null);
            setSearchParams({ event: event.eventCode });
          }}
          aria-current={event.eventCode === selectedCode ? 'true' : undefined}
        >
          {event.eventName.trim() === '' ? event.eventCode : event.eventName}
        </Button>
      ),
    },
    {
      key: 'count',
      header: t.columns.count,
      align: 'end',
      render: (event) => {
        const count = counts.get(event.eventCode) ?? 0;
        return <Chip status={count === 0 ? 'warning' : 'idle'}>{String(count)}</Chip>;
      },
    },
  ];

  const previewColumns: Column<PreviewResult['users'][number]>[] = [
    { key: 'user', header: t.columns.user, render: (user) => user.userName },
    {
      key: 'department',
      header: t.columns.department,
      render: (user) => user.departmentName ?? '—',
    },
    {
      key: 'status',
      header: t.columns.status,
      render: (user) => (
        <Chip status={user.isActive ? 'success' : 'warning'}>
          {user.isActive ? '사용 중' : '비활성'}
        </Chip>
      ),
    },
  ];

  const loading = events.isPending || subscriptions.isPending;
  const loadError = events.isError || subscriptions.isError;

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />
      <div className="two-pane alarm-recipient-layout">
        <section className="pane alarm-recipient-pane" aria-labelledby="alarm-events-title">
          <h2 id="alarm-events-title" className="pane-title">
            {t.panes.events}
          </h2>
          {loadError ? (
            <AlertBanner
              variant="error"
              title={messages.httpError.loadTitle}
              action={
                <Button
                  variant="outlined"
                  size="sm"
                  onClick={() => {
                    void events.refetch();
                    void subscriptions.refetch();
                  }}
                >
                  {messages.common.retry}
                </Button>
              }
            >
              {messages.httpError.description}
            </AlertBanner>
          ) : loading ? (
            <Skeleton variant="rect" height="12rem" />
          ) : (
            <Table
              columns={eventColumns}
              rows={events.data ?? []}
              getRowId={(event) => event.eventCode}
              density="compact"
              caption={t.panes.events}
              empty={<EmptyState size="sm" title={t.state.noEvents} />}
            />
          )}
        </section>

        <div className="pane-stack">
          <section className="pane alarm-recipient-pane" aria-labelledby="alarm-rules-title">
            <div className="alarm-recipient-heading">
              <h2 id="alarm-rules-title" className="pane-title">
                {t.panes.recipients}
              </h2>
              {selectedCode !== null && <Chip>{selectedCode}</Chip>}
            </div>

            {detail.isError ? (
              <AlertBanner
                variant="error"
                title={messages.httpError.loadTitle}
                action={
                  <Button
                    variant="outlined"
                    size="sm"
                    onClick={() => {
                      void detail.refetch();
                    }}
                  >
                    {messages.common.retry}
                  </Button>
                }
              >
                {messages.httpError.description}
              </AlertBanner>
            ) : detail.isPending && selectedCode !== null ? (
              <Skeleton variant="rect" height="14rem" />
            ) : selectedCode === null ? (
              <EmptyState size="sm" title={t.state.noEvents} />
            ) : (
              <>
                {referenceFailed && (
                  <div className="banner-slot">
                    <AlertBanner
                      variant="error"
                      action={
                        <Button
                          variant="outlined"
                          size="sm"
                          onClick={() => {
                            void references.businessUnits.refetch();
                            void references.roles.refetch();
                            void references.users.refetch();
                          }}
                        >
                          {messages.common.retry}
                        </Button>
                      }
                    >
                      {t.errors.lookupFailed}
                    </AlertBanner>
                  </div>
                )}
                <SaveErrorBanner error={preview.error} />
                <SaveErrorBanner
                  error={replace.error}
                  onReload={() => {
                    replace.reset();
                    void detail.refetch();
                  }}
                />
                {flash !== null && (
                  <div className="banner-slot">
                    <AlertBanner variant="success">{flash}</AlertBanner>
                  </div>
                )}
                {draft.length === 0 && (
                  <div className="banner-slot">
                    <AlertBanner variant="warning">{t.state.noRecipientsWarning}</AlertBanner>
                  </div>
                )}

                <div className="alarm-recipient-rules">
                  {draft.length === 0 ? (
                    <EmptyState size="sm" title={t.state.noRecipients} />
                  ) : (
                    draft.map((recipient, index) => (
                      <fieldset key={recipient.key} className="alarm-recipient-rule">
                        <legend>{`${t.panes.recipients} ${String(index + 1)}`}</legend>
                        <div className="alarm-recipient-rule-grid">
                          <SelectField
                            label={t.fields.recipientType}
                            options={TYPE_OPTIONS}
                            value={recipient.recipientTypeCode}
                            placeholder={t.fields.recipientType}
                            onChange={(value) =>
                              updateDraft(index, {
                                recipientTypeCode: value as RecipientDraft['recipientTypeCode'],
                                businessUnitId: '',
                                roleId: '',
                                userId: '',
                              })
                            }
                          />
                          {recipient.recipientTypeCode === 'ROLE' ? (
                            <>
                              <SelectField
                                label={t.fields.businessUnit}
                                options={options.businessUnits}
                                value={recipient.businessUnitId}
                                placeholder={t.fields.businessUnit}
                                error={errors[index]?.businessUnitId}
                                note={
                                  references.businessUnits.isPending
                                    ? t.state.lookupLoading
                                    : undefined
                                }
                                disabled={
                                  references.businessUnits.isPending ||
                                  references.businessUnits.isError
                                }
                                onChange={(value) => updateDraft(index, { businessUnitId: value })}
                              />
                              <SelectField
                                label={t.fields.role}
                                options={options.roles}
                                value={recipient.roleId}
                                placeholder={t.fields.role}
                                error={errors[index]?.roleId}
                                note={
                                  references.roles.isPending ? t.state.lookupLoading : undefined
                                }
                                disabled={references.roles.isPending || references.roles.isError}
                                onChange={(value) => updateDraft(index, { roleId: value })}
                              />
                            </>
                          ) : (
                            <SelectField
                              label={t.fields.user}
                              options={options.users}
                              value={recipient.userId}
                              placeholder={t.fields.user}
                              error={errors[index]?.userId}
                              note={references.users.isPending ? t.state.lookupLoading : undefined}
                              disabled={references.users.isPending || references.users.isError}
                              onChange={(value) => updateDraft(index, { userId: value })}
                            />
                          )}
                          <div className="alarm-recipient-remove">
                            <Button
                              variant="text"
                              size="sm"
                              onClick={() => {
                                setDraft((current) =>
                                  current.filter((_, position) => position !== index),
                                );
                                resetEditingFeedback();
                              }}
                            >
                              {t.actions.remove}
                            </Button>
                          </div>
                        </div>
                        {errors[index]?.duplicate !== undefined && (
                          <p className="field-error">{errors[index]?.duplicate}</p>
                        )}
                      </fieldset>
                    ))
                  )}
                </div>

                <Button
                  variant="outlined"
                  size="sm"
                  onClick={() => {
                    setDraft((current) => [...current, emptyRecipient()]);
                    resetEditingFeedback();
                  }}
                >
                  {t.actions.add}
                </Button>

                <div className="alarm-zalo-setting">
                  <Checkbox disabled checked={detail.data?.zaloEnabled ?? false}>
                    {t.fields.zalo}
                  </Checkbox>
                  <p className="field-note">{t.state.zaloDisabled}</p>
                </div>

                <div className="form-actions">
                  {!isDirty && (
                    <span className="field-note form-actions-secondary">{t.state.clean}</span>
                  )}
                  <Button
                    variant="outlined"
                    disabled={preview.isSaving}
                    onClick={() => validateAndRun('preview')}
                  >
                    {t.actions.preview}
                  </Button>
                  <Button
                    disabled={!isDirty || replace.isSaving}
                    onClick={() => validateAndRun('save')}
                  >
                    {t.actions.save}
                  </Button>
                </div>
              </>
            )}
          </section>

          {previewResult !== null && (
            <section className="pane alarm-recipient-pane" aria-labelledby="alarm-preview-title">
              <h2 id="alarm-preview-title" className="pane-title">
                {t.panes.preview}
              </h2>
              <p className="alarm-preview-meta">
                {t.state.previewReady(
                  previewResult.totalCount,
                  formatResolvedAt(previewResult.resolvedAt),
                )}
              </p>
              <Table
                columns={previewColumns}
                rows={previewResult.users}
                getRowId={(user) => String(user.userId)}
                density="compact"
                caption={t.panes.preview}
                empty={<EmptyState size="sm" title={t.state.previewEmpty} />}
              />
            </section>
          )}
        </div>
      </div>
    </>
  );
};
