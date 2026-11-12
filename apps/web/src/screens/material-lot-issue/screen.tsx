import {
  AlertBanner,
  Button,
  Checkbox,
  Chip,
  EmptyState,
  Skeleton,
  TextField,
  useToast,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { LoadErrorAlert } from '../../patterns/load-error-banner';
import { useUomOptions } from '../../patterns/material-lot-batch';
import { plantToday } from '../../patterns/plant-time';
import { Select } from '../../patterns/select';
import { useSession } from '../../patterns/session';
import { DefaultsText } from './defaults-text';
import { DetailDialog } from './detail-dialog';
import { IssueDialog } from './issue-dialog';
import { usePlantDefaults, usePlants, useWaitingGroups } from './queries';
import { defaultsIndex, formatAt, groupKey, parseGroupKey, waitingOf, type Group } from './types';

const t = messages.materialLotIssue;
const tl = t.list;

/** 열린 발행 창 — 목록 위 단추(고르기)거나 상세 창의 조합(고정). */
type IssueOpen = { fixed: Group | null } | null;

const NO_GROUPS: Group[] = [];
const NO_SCOPES: never[] = [];

/**
 * W-01-14 자재 관리 LOT 발행(005 · omf-all-around#254 · screens/W-01-14.md). 「구매 / 자재 관리 › 입고 관리」 탭 묶음의
 * 한 탭이다(머리 · 탭은 셸이 세운다). 공급사·품목을 골라 자재 관리 LOT 를 대기 상태로 만들고, 대기 LOT 를 보고
 * 폐기한다 — POP P-01-01 과 같은 결과(US1-8).
 *
 * ⛔ **라벨은 여기서 찍지 않는다** — POP 「자재 관리 LOT 라벨」에서만(배너가 말한다).
 * 주소: 공장(`plant`) · 공급사(`supplier`) · 품목 찾기(`q`) · 대기 있는 것만(`waiting`) · 연 공급사·품목(`open`).
 */
export const MaterialLotIssueScreen = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const plantParam = searchParams.get('plant') ?? '';
  const supplierParam = searchParams.get('supplier') ?? '';
  const query = searchParams.get('q') ?? '';
  const waitingOnly = searchParams.get('waiting') === '1';
  const openKey = searchParams.get('open');

  const [issueOpen, setIssueOpen] = useState<IssueOpen>(null);

  const { session } = useSession();
  const plants = usePlants(session?.scopes ?? NO_SCOPES);
  const plantFieldId = useId();
  const supplierFieldId = useId();
  const itemFieldId = useId();
  const viewLabelId = useId();
  const plant =
    plants.data?.find((row) => String(row.plantId) === plantParam) ?? plants.data?.[0] ?? null;
  const plantId = plant?.plantId ?? null;
  const groups = useWaitingGroups(plantId);
  const defaults = usePlantDefaults(plantId);
  const uoms = useUomOptions();
  const byPair = defaultsIndex(defaults.data ?? []);

  const update = (patch: Record<string, string | null>): void => {
    const next = new URLSearchParams(searchParams);
    for (const [name, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(name);
      else next.set(name, value);
    }
    setSearchParams(next, { replace: true });
  };

  const all = groups.data ?? NO_GROUPS;
  const needle = query.trim().toLocaleLowerCase('ko-KR');
  const rows = all.filter(
    (group) =>
      (supplierParam === '' || String(group.supplierId) === supplierParam) &&
      (needle === '' ||
        `${group.itemCode} ${group.itemName}`.toLocaleLowerCase('ko-KR').includes(needle)) &&
      (!waitingOnly || group.waitingCount > 0),
  );
  const suppliers = [
    ...new Map(all.map((group) => [group.supplierId, group] as const)).values(),
  ].sort((left, right) => left.supplierName.localeCompare(right.supplierName, 'ko'));

  const openPair = parseGroupKey(openKey);
  const opened =
    openPair === null
      ? null
      : (all.find(
          (group) => group.supplierId === openPair.supplierId && group.itemId === openPair.itemId,
        ) ?? null);

  /* 칸마다 이름을 위에 단다 — 시안 「공장 · 공급사 · 품목 · 보기」(G2 L21). */
  const filters = (
    <section className="filter-bar mlot-issue-filters" aria-label={t.filters.label}>
      {(plants.data?.length ?? 0) > 1 && (
        <div className="field-cell">
          <label className="field-label" htmlFor={plantFieldId}>
            {t.filters.plant}
          </label>
          <Select
            id={plantFieldId}
            value={plantId === null ? null : String(plantId)}
            options={(plants.data ?? []).map((row) => ({
              value: String(row.plantId),
              label: row.plantName,
            }))}
            onChange={(value) => update({ plant: value, supplier: null, open: null })}
          />
        </div>
      )}
      <div className="field-cell">
        <label className="field-label" htmlFor={supplierFieldId}>
          {t.filters.supplier}
        </label>
        <Select
          id={supplierFieldId}
          value={supplierParam === '' ? '' : supplierParam}
          options={[
            { value: '', label: t.filters.supplierAll },
            ...suppliers.map((group) => ({
              value: String(group.supplierId),
              label: `${group.supplierName} ${group.supplierCode}`,
            })),
          ]}
          onChange={(value) => update({ supplier: value })}
        />
      </div>
      <div className="field-cell">
        <label className="field-label" htmlFor={itemFieldId}>
          {t.filters.item}
        </label>
        <TextField
          id={itemFieldId}
          placeholder={t.filters.itemPlaceholder}
          type="search"
          value={query}
          onChange={(event) => update({ q: event.target.value })}
        />
      </div>
      <div className="field-cell" role="group" aria-labelledby={viewLabelId}>
        <span className="field-label" id={viewLabelId}>
          {t.filters.view}
        </span>
        <Checkbox
          checked={waitingOnly}
          onChange={(event) => update({ waiting: event.target.checked ? '1' : null })}
        >
          {t.filters.waitingOnly}
        </Checkbox>
      </div>
    </section>
  );

  const table = (): ReactNode => {
    if (plants.isError || groups.isError) {
      const error = plants.error ?? groups.error;
      return (
        <LoadErrorAlert
          error={error}
          onRetry={() => void (plants.isError ? plants.refetch() : groups.refetch())}
        />
      );
    }
    if (plants.isPending) return <Skeleton variant="rect" height="16rem" />;
    if (plantId === null) return <EmptyState size="sm" title={t.noPlant} />;
    if (groups.isPending) return <Skeleton variant="rect" height="16rem" />;
    if (rows.length === 0) return <EmptyState size="sm" title={tl.empty} />;

    return (
      <div className="mlot-issue-table-scroll">
        <table className="mlot-issue-table is-wrap-head" aria-label={tl.label}>
          <thead>
            <tr>
              <th scope="col">{tl.columns.supplier}</th>
              <th scope="col">{tl.columns.item}</th>
              <th scope="col">{tl.columns.baseUom}</th>
              <th scope="col">{tl.columns.defaults}</th>
              <th scope="col" className="is-number">
                {tl.columns.waiting}
              </th>
              <th scope="col" className="is-number">
                {tl.columns.unprinted}
              </th>
              <th scope="col">{tl.columns.lastIssued}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((group) => {
              const key = groupKey(group);
              const open = (): void => update({ open: key });
              return (
                /* 행 어디를 눌러도 상세 창. 키보드는 공급사 칸의 단추가 맡는다. */
                <tr
                  key={key}
                  className="is-clickable"
                  aria-selected={openKey === key ? true : undefined}
                  onClick={open}
                >
                  <td>
                    <button
                      type="button"
                      className="link-cell"
                      aria-label={tl.open(
                        group.supplierName,
                        `${group.itemCode} ${group.itemName}`,
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        open();
                      }}
                    >
                      {group.supplierName}{' '}
                      <span className="mlot-issue-code">{group.supplierCode}</span>
                    </button>
                  </td>
                  <td className="is-wrap">
                    <span className="mlot-issue-code">{group.itemCode}</span> {group.itemName}
                  </td>
                  <td>{group.uomCode}</td>
                  <td className="is-wrap">
                    <DefaultsText group={group} defaults={byPair.get(key)} uoms={uoms.data} />
                  </td>
                  <td className="is-number">
                    {group.waitingCount > 0 ? (
                      <Chip size="sm" status="warning">
                        {String(group.waitingCount)}
                      </Chip>
                    ) : (
                      <span className="field-note">0</span>
                    )}
                  </td>
                  <td className="is-number">
                    {group.unprintedCount > 0 ? (
                      <Chip size="sm" status="info">
                        {String(group.unprintedCount)}
                      </Chip>
                    ) : (
                      <span className="field-note">0</span>
                    )}
                  </td>
                  <td>{formatAt(group.lastIssuedAt) ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="mlot-issue">
      <AlertBanner variant="info">{t.banner}</AlertBanner>
      {filters}
      <div className="mlot-issue-section-head">
        <h2>{tl.count(rows.length)}</h2>
        <span className="field-note">{tl.note(plant?.plantName ?? '', plantToday().slice(5))}</span>
        <span className="mlot-issue-actions">
          <Button
            disabled={plantId === null}
            loading={groups.isPending}
            onClick={() => setIssueOpen({ fixed: null })}
          >
            {tl.issue}
          </Button>
        </span>
      </div>
      {table()}
      <p className="field-note mlot-issue-help">{tl.help}</p>

      {opened !== null && issueOpen === null && (
        <DetailDialog
          group={opened}
          defaults={byPair.get(groupKey(opened))}
          uoms={uoms.data}
          onClose={() => update({ open: null })}
          onIssue={() => setIssueOpen({ fixed: opened })}
          onVoided={(result) => {
            const done = result.items.filter((item) => item.voided).length;
            const failed = result.items.length - done;
            toast.show({
              variant: failed > 0 ? 'warning' : 'success',
              description: failed > 0 ? t.toast.voidedPartly(done, failed) : t.toast.voided(done),
            });
          }}
        />
      )}
      {issueOpen !== null && plantId !== null && (
        <IssueDialog
          plantId={plantId}
          groups={all}
          fixed={issueOpen.fixed}
          onClose={() => setIssueOpen(null)}
          onIssued={(created, group) => {
            setIssueOpen(null);
            update({ open: groupKey(group) });
            toast.show({ variant: 'success', description: t.toast.issued(created.lots.length) });
          }}
        />
      )}
    </div>
  );
};
