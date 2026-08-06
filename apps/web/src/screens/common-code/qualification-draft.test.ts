import type { components } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import {
  createQualificationDraft,
  duplicateKeyOf,
  isSameQualificationDrafts,
  removeQualificationDraft,
  toQualificationDrafts,
  toQualificationsPayload,
  upsertQualificationDraft,
} from './qualification-draft';

type WorkerQualification = components['schemas']['WorkerQualification'];

const saved = (overrides: Partial<WorkerQualification> = {}): WorkerQualification => ({
  workerQualificationId: 8001,
  workerId: 5001,
  qualificationTypeCode: 'PENDING',
  processId: 6001,
  certificateNo: 'SYN-CERT-01',
  validFrom: '2026-08-01',
  validTo: '2026-12-31',
  certifiedBy: 7001,
  ...overrides,
});

describe('toQualificationDrafts', () => {
  it('서버 값을 초안으로 옮긴다', () => {
    const [draft] = toQualificationDrafts([saved()]);

    expect(draft).toMatchObject({
      qualificationTypeCode: 'PENDING',
      processId: '6001',
      certificateNo: 'SYN-CERT-01',
      validFrom: '2026-08-01',
      validTo: '2026-12-31',
    });
  });

  /*
   * 화면에 입력칸이 없는 값이다 — 초안에 담아 두지 않으면 저장할 때
   * 서버에 있던 값이 **조용히 지워진다**.
   */
  it('인증자를 초안에 보존한다', () => {
    expect(toQualificationDrafts([saved()])[0]?.certifiedBy).toBe(7001);
  });

  it('널·없음을 빈 문자열과 널로 모은다', () => {
    const [draft] = toQualificationDrafts([
      saved({ processId: null, certificateNo: null, validTo: null, certifiedBy: null }),
    ]);

    expect(draft).toMatchObject({ processId: '', certificateNo: '', validTo: '' });
    expect(draft?.certifiedBy).toBeNull();
  });

  it('행마다 서로 다른 초안 키를 준다', () => {
    const drafts = toQualificationDrafts([
      saved({ workerQualificationId: 8001 }),
      saved({ workerQualificationId: 8002 }),
    ]);

    expect(new Set(drafts.map((draft) => draft.draftId)).size).toBe(2);
  });
});

describe('createQualificationDraft', () => {
  it('빈 행을 만들고 인증자는 널이다 — 화면이 값을 만들 수 없다', () => {
    const draft = createQualificationDraft();

    expect(draft.qualificationTypeCode).toBe('');
    expect(draft.processId).toBe('');
    expect(draft.certifiedBy).toBeNull();
  });

  it('새 행끼리도 초안 키가 겹치지 않는다', () => {
    expect(createQualificationDraft().draftId).not.toBe(createQualificationDraft().draftId);
  });

  it('저장된 행의 키와 겹치지 않는다', () => {
    const savedKey = toQualificationDrafts([saved()])[0]?.draftId ?? '';

    expect(createQualificationDraft().draftId).not.toBe(savedKey);
  });
});

describe('upsertQualificationDraft · removeQualificationDraft', () => {
  it('없는 키는 뒤에 더한다', () => {
    const drafts = toQualificationDrafts([saved()]);
    const added = createQualificationDraft();

    expect(upsertQualificationDraft(drafts, added)).toHaveLength(2);
  });

  /* 수정이 순서를 흔들면 사용자가 다시 찾아야 한다. */
  it('있는 키는 자리를 지킨 채 값만 바꾼다', () => {
    const drafts = toQualificationDrafts([
      saved({ workerQualificationId: 8001 }),
      saved({ workerQualificationId: 8002, processId: 6002 }),
    ]);
    const edited = { ...drafts[0]!, certificateNo: 'SYN-CERT-99' };

    const next = upsertQualificationDraft(drafts, edited);
    expect(next).toHaveLength(2);
    expect(next[0]?.certificateNo).toBe('SYN-CERT-99');
  });

  it('지운 행이 빠진다', () => {
    const drafts = toQualificationDrafts([
      saved({ workerQualificationId: 8001 }),
      saved({ workerQualificationId: 8002, processId: 6002 }),
    ]);

    expect(removeQualificationDraft(drafts, drafts[0]!.draftId)).toHaveLength(1);
  });
});

describe('toQualificationsPayload', () => {
  /*
   * C67 — 계약의 요청 항목은 여섯뿐이고 **식별자가 없다.**
   * W-06-01·W-06-02의 전체 치환과 반대다.
   */
  it('행 식별자와 작업자 번호를 싣지 않는다', () => {
    const [item] = toQualificationsPayload(toQualificationDrafts([saved()]));
    const body = item as unknown as Record<string, unknown>;

    expect('workerQualificationId' in body).toBe(false);
    expect('workerId' in body).toBe(false);
  });

  /* C68 — 되돌려 싣지 않으면 서버에 저장돼 있던 값이 조용히 지워진다. */
  it('기존 행의 인증자를 서버가 준 값 그대로 싣는다', () => {
    expect(toQualificationsPayload(toQualificationDrafts([saved()]))[0]?.certifiedBy).toBe(7001);
  });

  /* C68 — 새 행에는 그 값을 만들 수 없다. 널을 싣지 않고 **키 자체를 빼**야 한다. */
  it('새 행에는 인증자 키 자체가 없다', () => {
    const body = toQualificationsPayload([createQualificationDraft()])[0] as unknown as Record<
      string,
      unknown
    >;

    expect('certifiedBy' in body).toBe(false);
  });

  it('빈 문자열을 계약의 널로 옮긴다', () => {
    const draft = {
      ...createQualificationDraft(),
      qualificationTypeCode: 'PENDING',
      validFrom: '2026-08-01',
    };

    expect(toQualificationsPayload([draft])[0]).toMatchObject({
      processId: null,
      certificateNo: null,
      validTo: null,
    });
  });

  it('앞뒤 공백을 턴다 — 눈으로 구분되지 않는 다른 값이 된다', () => {
    const draft = {
      ...createQualificationDraft(),
      qualificationTypeCode: 'PENDING',
      certificateNo: ' SYN-CERT-01 ',
      validFrom: '2026-08-01',
    };

    expect(toQualificationsPayload([draft])[0]?.certificateNo).toBe('SYN-CERT-01');
  });

  it('지운 행은 본문에서 빠진다', () => {
    const drafts = toQualificationDrafts([
      saved({ workerQualificationId: 8001 }),
      saved({ workerQualificationId: 8002, processId: 6002 }),
    ]);

    expect(
      toQualificationsPayload(removeQualificationDraft(drafts, drafts[0]!.draftId)),
    ).toHaveLength(1);
  });
});

describe('duplicateKeyOf', () => {
  /*
   * 계약의 유일 제약이 `COALESCE(process_id,0)`으로 접힌다 —
   * **공정을 비운 두 줄은 같은 짝이다.**
   */
  it('공정을 비운 줄끼리 같은 키를 갖는다', () => {
    const a = { ...createQualificationDraft(), qualificationTypeCode: 'PENDING' };
    const b = { ...createQualificationDraft(), qualificationTypeCode: 'PENDING' };

    expect(duplicateKeyOf(a)).toBe(duplicateKeyOf(b));
  });

  it('공정이 다르면 다른 키다', () => {
    const a = {
      ...createQualificationDraft(),
      qualificationTypeCode: 'PENDING',
      processId: '6001',
    };
    const b = {
      ...createQualificationDraft(),
      qualificationTypeCode: 'PENDING',
      processId: '6002',
    };

    expect(duplicateKeyOf(a)).not.toBe(duplicateKeyOf(b));
  });

  it('자격 유형이 다르면 다른 키다', () => {
    const a = { ...createQualificationDraft(), qualificationTypeCode: 'PENDING' };
    const b = { ...createQualificationDraft(), qualificationTypeCode: 'OTHER' };

    expect(duplicateKeyOf(a)).not.toBe(duplicateKeyOf(b));
  });

  /* 공정 `0`은 계약에 없는 값이지만 접힌 축과 섞이지 않게 둔다. */
  it('공정이 비어 있는 것과 0인 것을 같은 축으로 접는다', () => {
    const empty = { ...createQualificationDraft(), qualificationTypeCode: 'PENDING' };
    const zero = {
      ...createQualificationDraft(),
      qualificationTypeCode: 'PENDING',
      processId: '0',
    };

    expect(duplicateKeyOf(empty)).toBe(duplicateKeyOf(zero));
  });
});

describe('isSameQualificationDrafts', () => {
  it('같은 목록이면 참이다', () => {
    const drafts = toQualificationDrafts([saved()]);

    expect(isSameQualificationDrafts(drafts, [...drafts])).toBe(true);
  });

  it('값이 하나라도 다르면 거짓이다', () => {
    const drafts = toQualificationDrafts([saved()]);

    expect(
      isSameQualificationDrafts(drafts, [{ ...drafts[0]!, certificateNo: 'SYN-CERT-99' }]),
    ).toBe(false);
  });

  it('건수가 다르면 거짓이다', () => {
    const drafts = toQualificationDrafts([saved()]);

    expect(isSameQualificationDrafts(drafts, [])).toBe(false);
  });
});
