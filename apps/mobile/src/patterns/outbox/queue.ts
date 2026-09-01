import { readLocal, writeLocal } from '../local-store';

export type OutboxMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * 저장이 무엇으로 보이는가.
 *
 * 기록성 작업은 담긴 순간 끝난 것으로 보여도 된다. 실물이 움직이는 작업은 서버가 받아야
 * 확정이라, 담긴 것만으로 끝났다고 하면 작업자가 이미 옮긴 물건을 되돌릴 기회를 잃는다.
 */
export type OutboxConfirmation = 'immediate' | 'pending';

/**
 * 본문 대신 파일을 보내는 건.
 *
 * 단말 보관소는 문자열만 담아 base64 로 둔다. 사진은 한 장이 수 MB 라 큐가 금세 커지므로,
 * 담는 쪽이 몇 장까지 받을지 정한다.
 */
export interface OutboxFile {
  fileName: string;
  mimeType: string;
  data: string;
}

/**
 * 앞 건의 응답에서 값을 받아 경로를 완성한다.
 *
 * 사진처럼 앞 건이 만든 것에 붙는 요청이 있다. 그 식별자는 보내 봐야 나오므로 담을 때는 알 수
 * 없고, 앞 건이 못 가면 이 건은 붙을 곳 자체가 없다.
 */
export interface OutboxPathFrom {
  entryId: string;
  field: string;
  token: string;
}

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
  file?: OutboxFile;
  pathFrom?: OutboxPathFrom;
}

export interface OutboxDraft extends Omit<OutboxEntry, 'id'> {
  id?: string;
}

export const OUTBOX_KEY = 'outbox';

/** 읽지 못한 큐를 옮겨 두는 자리. 다음 저장이 덮어 없애는 것을 막는다. */
export const OUTBOX_BROKEN_KEY = 'outbox-broken';

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

    if (Array.isArray(parsed)) {
      return parsed as OutboxEntry[];
    }
  } catch {
    // 아래에서 함께 다룬다.
  }

  /*
   * 읽지 못한 것은 보낼 수 없지만, 그대로 두면 다음 저장이 덮어 없앤다. 다른 자리로 옮겨
   * 원본을 남긴다.
   */
  await writeLocal(OUTBOX_BROKEN_KEY, stored);

  return [];
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
