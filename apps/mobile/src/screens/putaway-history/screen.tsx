import { AlertBanner, Chip, EmptyState, IconButton, Tabs } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import { BottomActionBar } from '../../patterns/bottom-action-bar';
import { Button } from '../../patterns/button';
import { FailureBanner } from '../../patterns/failure-banner';
import { useLoadFailure } from '../../patterns/load-failure';
import { useOutbox } from '../../patterns/outbox';
import { plantClock, plantToday } from '../../patterns/plant-time';
import { toApiError } from '../../patterns/request';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import {
  putawayRecordKeys,
  usePutawayRecords,
  type PutawayRecord,
  type PutawayRecordScope,
} from './queries';
import './screen.css';

const t = messages.putawayHistory;

/** 오늘에서 며칠 전까지 볼 수 있는가(FR-006 — 오늘 ~ 6일 전, 서버도 같은 범위만 받는다). */
const OLDEST_DAY = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 공장 영업일 `YYYY-MM-DD` 에서 며칠 앞의 날짜와 요일. 날짜 글만 다루므로 기기 시간대와 무관하다. */
const shiftDay = (today: string, back: number): { date: string; weekday: number } => {
  const at = new Date(Date.parse(`${today}T00:00:00.000Z`) - back * DAY_MS);

  return { date: at.toISOString().slice(0, 10), weekday: at.getUTCDay() };
};

const modeOf = (record: PutawayRecord): string => {
  switch (record.putawayModeCode) {
    case 'TASK':
      return t.mode.TASK(t.source[record.sourceCode]);
    case 'TASK_TEMPORARY':
      return t.mode.TASK_TEMPORARY(t.source[record.sourceCode]);
    default:
      return t.mode[record.putawayModeCode];
  }
};

/**
 * 적치 한 줄 — 「LOT → 위치 수량」, 품목, 위치 경로, 칩, 번호 · 시각 · 작업자(시안 M-01-14).
 *
 * 읽기 전용이다(FR-016). 누를 곳을 두지 않는다 - 취소 · 수정은 관리웹의 일이다.
 */
const RecordRow = ({ record }: { record: PutawayRecord }) => {
  const cancelled = record.receiptStatusCode === 'CANCELLED';

  return (
    <li
      className={
        cancelled ? 'putaway-history__row putaway-history__row--cancelled' : 'putaway-history__row'
      }
    >
      <p className="putaway-history__route">
        {record.lot.lotNo} → <strong>{record.location.locationCode}</strong>{' '}
        {`${record.qty} ${record.uomCode}`}
      </p>
      <p className="putaway-history__item">{`${record.item.itemCode} ${record.item.itemName}`}</p>
      <p className="putaway-history__sub">{record.location.path}</p>
      <span className="putaway-history__chips">
        <Chip>{modeOf(record)}</Chip>
        {record.qualityStatusCode === 'DEFECTIVE' ? (
          <Chip status="error">{t.defective}</Chip>
        ) : null}
        {cancelled ? <Chip status="warning">{t.cancelled}</Chip> : null}
        {record.receiptStatusCode === 'CANCEL_REQUESTED' ? (
          <Chip status="warning">{t.cancelRequested}</Chip>
        ) : null}
      </span>
      <p className="putaway-history__sub">
        {t.meta(
          record.documentNo,
          plantClock(record.recordedAt),
          `${record.worker.workerNo} ${record.worker.workerName}`,
        )}
      </p>
    </li>
  );
};

/**
 * M-01-14 적치 기록 — 서버에 남은 적치를 「내 기록」 또는 「이 단말」로 영업일 하루씩 본다.
 *
 * 적치 화면 아래에 쌓던 「적치됨」 목록을 옮겨 온 자리다(피처 011). 그 목록은 화면 메모리에만 있어
 * 나갔다 오면 비었다. 여기는 서버 이력이라 화면을 나갔다 오거나 앱을 다시 켜도 같은 것이 보인다.
 * 전송 대기는 서버에 아직 없으므로 줄에 섞지 않고 건수와 입구만 보인다(FR-014).
 */
export const PutawayHistoryScreen = () => {
  useScreenTitle(t.title);

  const navigate = useNavigate();
  const { worker } = useWorkerSession();
  const { countPending } = useOutbox();
  const failureText = useLoadFailure();

  const [scope, setScope] = useState<PutawayRecordScope>('WORKER');
  const [back, setBack] = useState(0);

  const today = plantToday();
  const day = shiftDay(today, back);
  const records = usePutawayRecords(scope, worker?.workerNo ?? null, day.date);

  /* 이 화면에서 적치로 담긴 것 — 적치 · 입고 완료와 임시 위치 적재 둘 다(FR-009 범위). */
  const queued =
    countPending(messages.putaway.record) + countPending(messages.temporaryPutaway.record);

  /*
   * 전송 대기가 줄면 그만큼 서버에 들어갔다 — 화면을 연 채로 보내져도 목록에 나타나게 다시 부른다(FR-014 · H12).
   * 안내만 사라지고 목록이 그대로면 「보내지면 여기에 나옵니다」가 거짓이 된다.
   */
  const queryClient = useQueryClient();
  const queuedBefore = useRef(queued);
  useEffect(() => {
    if (queued < queuedBefore.current) {
      void queryClient.invalidateQueries({ queryKey: putawayRecordKeys.all });
    }
    queuedBefore.current = queued;
  }, [queryClient, queued]);

  const unreachable = records.isError && toApiError(records.error).kind === 'network';
  const list = records.data;
  /* 불러온 목록이 없으면(끊김 · 실패 · 불러오는 중) 「0건」이라고 하지 않는다. */
  const count = list?.total ?? null;

  const basis =
    scope === 'WORKER'
      ? worker === null
        ? null
        : t.basis.mine(worker.workerNo, worker.workerName, count)
      : t.basis.terminal(list?.items[0]?.terminalCode ?? null, count);

  const body: ReactNode = (
    <div className="putaway-history__body">
      <div className="putaway-history__date">
        <IconButton
          icon="chevron_left"
          size="lg"
          aria-label={t.prevDay}
          disabled={back >= OLDEST_DAY}
          onClick={() => setBack((value) => Math.min(OLDEST_DAY, value + 1))}
        />
        <div className="putaway-history__day">
          <strong>{t.dateLabel(day.date, t.weekdays[day.weekday] ?? '', back === 0)}</strong>
          {basis === null ? null : <span className="putaway-history__sub">{basis}</span>}
        </div>
        <IconButton
          icon="chevron_right"
          size="lg"
          aria-label={t.nextDay}
          disabled={back === 0}
          onClick={() => setBack((value) => Math.max(0, value - 1))}
        />
      </div>

      {queued === 0 ? null : (
        <AlertBanner variant="info" title={t.queued.title(queued)}>
          <Link to="/outbox">{t.queued.action}</Link>
        </AlertBanner>
      )}

      {/*
       * 연결이 끊긴 채 열면 이번 실행에서 받아 둔 목록을 그때 시각과 함께 그대로 보인다. 받은 적이 없으면
       * 「없습니다」라고 하지 않고 연결되면 불러온다고만 말한다.
       */}
      {unreachable ? (
        <AlertBanner variant="error" title={t.offline.title}>
          {list === undefined
            ? t.offline.none
            : t.offline.loadedAt(plantClock(new Date(records.dataUpdatedAt).toISOString()))}
        </AlertBanner>
      ) : null}
      {records.isError && !unreachable ? (
        <FailureBanner variant="error" title={failureText(records.error, t.loadFailed)} />
      ) : null}

      {records.isPending && records.fetchStatus === 'fetching' ? (
        <p role="status" className="putaway-history__sub">
          {t.loading}
        </p>
      ) : null}

      {list === undefined ? null : list.items.length === 0 ? (
        records.isSuccess ? (
          <EmptyState
            size="sm"
            title={t.empty.title}
            description={scope === 'WORKER' ? t.empty.mine : t.empty.terminal}
          />
        ) : null
      ) : (
        <>
          <ul className="putaway-history__list" aria-label={t.listLabel}>
            {list.items.map((record) => (
              <RecordRow key={`${record.recordType}-${String(record.recordId)}`} record={record} />
            ))}
          </ul>
          {records.hasNextPage ? (
            <Button
              variant="outlined"
              size="lg"
              className="putaway-history__more"
              loading={records.isFetchingNextPage}
              onClick={() => void records.fetchNextPage()}
            >
              {t.more(list.items.length, list.total)}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );

  return (
    <div className="putaway-history with-bottom-action-bar">
      <Tabs
        aria-label={t.tabsLabel}
        value={scope}
        onChange={(value) => setScope(value === 'TERMINAL' ? 'TERMINAL' : 'WORKER')}
        items={[
          { value: 'WORKER', label: t.tabs.mine, content: scope === 'WORKER' ? body : null },
          {
            value: 'TERMINAL',
            label: t.tabs.terminal,
            content: scope === 'TERMINAL' ? body : null,
          },
        ]}
      />

      <BottomActionBar
        secondary={{
          label: t.back(messages.putaway.title),
          onClick: () => void navigate('/putaway'),
        }}
      />
    </div>
  );
};
