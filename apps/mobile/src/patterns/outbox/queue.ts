import { readLocal, writeLocal } from '../local-store';

export type OutboxMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * 저장이 무엇으로 보이는가.
 *
 * 기록성 작업은 담긴 순간 끝난 것으로 보여도 된다. 실물이 움직이는 작업은 서버가 받아야
 * 확정이라, 담긴 것만으로 끝났다고 하면 작업자가 이미 옮긴 물건을 되돌릴 기회를 잃는다.
 */
export type OutboxConfirmation = 'immediate' | 'pending';

export interface OutboxEntry {
  id: string;
  idempotencyKey: string;
  method: OutboxMethod;
  path: string;
  body: unknown;
  /** 단말 시계가 정한 발생 시각. 서버 수신 시각과 다르다. */
  occurredAt: string;
  confirmation: OutboxConfirmation;
  /**
   * 앞뒤가 딸린 건들의 묶음 이름. 앞이 거부되면 뒤도 함께 되돌려야 한다 —
   * 뒤는 앞이 만든 식별자를 참조하므로 혼자서는 반드시 실패한다.
   */
  batchId?: string;
}

export interface OutboxDraft extends Omit<OutboxEntry, 'id'> {
  id?: string;
}

export const OUTBOX_KEY = 'outbox';

const newId = (): string => {
  const buffer = new Uint8Array(8);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const readQueue = async (): Promise<OutboxEntry[]> => {
  const stored = await readLocal(OUTBOX_KEY);

  if (stored === null) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
  } catch {
    // 읽지 못한 큐를 비우지 않는다. 지우면 보내지 못한 것이 조용히 사라진다.
    return [];
  }
};

export const writeQueue = async (entries: OutboxEntry[]): Promise<void> => {
  await writeLocal(OUTBOX_KEY, JSON.stringify(entries));
};

/**
 * 큐 안의 중복만 미리 거른다.
 *
 * 유일 제약을 확정 판정할 수 있는 것은 서버뿐이다. 여기서 보는 것은 같은 키가 두 번 담기는
 * 것뿐이고, 그것마저 두면 서버가 하나를 흡수해 화면은 두 건이 갔다고 믿는다.
 */
export const appendEntry = (entries: OutboxEntry[], draft: OutboxDraft): OutboxEntry[] => {
  if (entries.some((entry) => entry.idempotencyKey === draft.idempotencyKey)) {
    return entries;
  }

  return [...entries, { ...draft, id: draft.id ?? newId() }];
};
