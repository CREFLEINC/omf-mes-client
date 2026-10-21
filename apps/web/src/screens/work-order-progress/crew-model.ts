import { masterName } from '../../patterns/master-name';
import type {
  ProductionResultForward,
  WorkSessionWorkerForward,
  components,
} from '@omf-mes/api-client';

type WorkSession = components['schemas']['WorkSession'];

export type CrewRole = 'MAIN' | 'SUB';
export type CrewRoleLabel = CrewRole | 'BOTH';

export interface ParticipantRow {
  workSessionWorkerId: number;
  workerId: number;
  workerNo: string | null;
  workerName: string | null;
  role: CrewRole;
  joinedAt: string;
  leftAt: string | null;
  participatedMinutes: number | null;
}

export interface SessionView {
  workSessionId: number;
  sessionNo: number;
  startedAt: string;
  endedAt: string | null;
  participants: ParticipantRow[];
}

export const QTY_KEYS = ['goodQty', 'defectQty', 'holdQty', 'scrapQty', 'reworkQty'] as const;
export type QtyKey = (typeof QTY_KEYS)[number];

export interface WorkerResultRow extends Record<QtyKey, number> {
  workerId: number;
  workerNo: string | null;
  workerName: string | null;
  role: CrewRoleLabel;
}

/** 옛 행의 역할 `OPERATOR` 는 부다 — 정은 `MAIN` 하나뿐이다. */
export const toCrewRole = (code: string): CrewRole => (code === 'MAIN' ? 'MAIN' : 'SUB');

const byJoinedAt = (left: ParticipantRow, right: ParticipantRow): number =>
  left.joinedAt === right.joinedAt
    ? left.workSessionWorkerId - right.workSessionWorkerId
    : left.joinedAt < right.joinedAt
      ? -1
      : 1;

/** 세션마다 남아 있는 사람과 떠난 사람을 합쳐 참여 순으로 놓는다. */
export const toSessionViews = (
  sessions: readonly WorkSession[],
  workersBySession: ReadonlyMap<number, readonly WorkSessionWorkerForward[]>,
): SessionView[] =>
  [...sessions]
    .sort((left, right) => left.sessionNo - right.sessionNo)
    .map((session) => ({
      workSessionId: session.workSessionId,
      sessionNo: session.sessionNo,
      startedAt: session.startedAt,
      endedAt: session.endedAt ?? null,
      participants: (workersBySession.get(session.workSessionId) ?? [])
        .map((worker) => ({
          workSessionWorkerId: worker.workSessionWorkerId,
          workerId: worker.workerId,
          workerNo: worker.workerNo ?? null,
          workerName: worker.workerName ?? null,
          role: toCrewRole(worker.workerRoleCode),
          joinedAt: worker.joinedAt,
          leftAt: worker.leftAt ?? null,
          participatedMinutes: worker.participatedMinutes ?? null,
        }))
        .sort(byJoinedAt),
    }));

export interface DefectTypeRow {
  /** 유형 없이 수량만 남은 불량은 `null` 한 줄로 모은다 */
  defectCodeId: number | null;
  /** 「대분류 › 상세」 — 대분류를 모르면 상세 이름만. 유형 없음이면 `null` */
  label: string | null;
  qty: number;
}

/** 정정되지 않은 잎 실적 — 정정은 덧붙는 레코드라 원본과 정정본이 둘 다 온다. */
const leafResults = (
  results: readonly ProductionResultForward[],
): readonly ProductionResultForward[] => {
  const corrected = new Set(
    results.flatMap((result) =>
      result.correctsProductionResultId === undefined ? [] : [result.correctsProductionResultId],
    ),
  );
  return results.filter((result) => !corrected.has(result.productionResultId));
};

/**
 * 이 W/O 의 불량을 유형별로 합친다. 정정된 원본은 세지 않는다.
 *
 * ⚠ 서버는 유형 없이 불량 수량만 받기도 한다 — 실적의 불량 수량에서 유형별 합을 뺀 나머지를
 *   「유형 없음」 한 줄로 모아, 합계가 「작업자별 실적」의 불량과 맞게 한다.
 */
export const toDefectTypes = (results: readonly ProductionResultForward[]): DefectTypeRow[] => {
  const rows = new Map<number | null, DefectTypeRow>();
  const add = (defectCodeId: number | null, label: string | null, qty: number) => {
    rows.set(defectCodeId, { defectCodeId, label, qty: (rows.get(defectCodeId)?.qty ?? 0) + qty });
  };
  for (const result of leafResults(results)) {
    const defects = result.defects ?? [];
    for (const defect of defects) {
      const name = masterName(defect, defect.defectName);
      add(
        defect.defectCodeId,
        defect.parentDefectName == null
          ? name
          : `${masterName(
              { nameKo: defect.parentNameKo, nameVi: defect.parentNameVi },
              defect.parentDefectName,
            )} › ${name}`,
        defect.qty,
      );
    }
    const untyped = result.defectQty - defects.reduce((sum, defect) => sum + defect.qty, 0);
    if (untyped > 0) add(null, null, untyped);
  }
  /* 「유형 없음」은 맨 끝 — 유형별 줄을 다 읽은 뒤의 나머지다. */
  return [...rows.values()].sort(
    (left, right) => Number(left.defectCodeId === null) - Number(right.defectCodeId === null),
  );
};

/**
 * 이 W/O 의 실적을 작업자별로 합친다.
 *
 * ⛔ 정정된 원본은 세지 않는다 — 정정은 덧붙는 레코드라 원본과 정정본이 둘 다 오는데, 서버
 *    집계와 같게 정정되지 않은 잎만 센다.
 * ⚠ 배분이 없는 실적(세션 없이 적었거나 참여자가 없던 세션)은 실적을 적은 사람의 몫이다.
 * ⚠ 서버는 그 구간에 참여하지 않은 세션 참여자도 0 몫으로 싣는다 — 몫이 없는 줄은 세지 않는다.
 */
export const toWorkerResults = (
  results: readonly ProductionResultForward[],
  known: readonly ParticipantRow[],
): WorkerResultRow[] => {
  const rows = new Map<number, WorkerResultRow>();
  const add = (
    workerId: number,
    workerNo: string | null,
    workerName: string | null,
    role: CrewRole,
    qty: Record<QtyKey, number>,
  ) => {
    const current = rows.get(workerId);
    const row: WorkerResultRow = current ?? {
      workerId,
      workerNo,
      workerName,
      role,
      goodQty: 0,
      defectQty: 0,
      holdQty: 0,
      scrapQty: 0,
      reworkQty: 0,
    };
    if (current !== undefined && current.role !== role) row.role = 'BOTH';
    row.workerNo ??= workerNo;
    row.workerName ??= workerName;
    for (const key of QTY_KEYS) row[key] += qty[key];
    rows.set(workerId, row);
  };

  for (const result of leafResults(results)) {
    const allocations = result.workerAllocations ?? [];
    if (allocations.length === 0) {
      const person = known.find((participant) => participant.workerId === result.workerId);
      add(result.workerId, person?.workerNo ?? null, person?.workerName ?? null, 'MAIN', result);
      continue;
    }
    for (const allocation of allocations) {
      if (QTY_KEYS.every((key) => allocation[key] === 0)) continue;
      add(
        allocation.workerId,
        allocation.workerNo,
        allocation.workerName,
        toCrewRole(allocation.workerRoleCode),
        allocation,
      );
    }
  }

  return [...rows.values()];
};
