import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { ConversionState } from './conversion';
import { COLLECTION_METHOD, emptyUsageDraft, type UsageDraft } from './types';
import { canSave, hasInput, incrementOf, saveDisabledReason, type SaveGuard } from './usage-draft';

const t = messages.toolUsage;

const READY: ConversionState = { kind: 'ready', ratio: 2.5 };
const UNSET: ConversionState = { kind: 'unset' };

const direct = (shotCount: string): UsageDraft => ({ ...emptyUsageDraft, shotCount });
const converted = (baseQty: string): UsageDraft => ({
  ...emptyUsageDraft,
  method: COLLECTION_METHOD.converted,
  baseQty,
});

const openGuard = (patch: Partial<SaveGuard> = {}): SaveGuard => ({
  hasTool: true,
  hasEntry: true,
  isOnline: true,
  isSaving: false,
  increment: 1250,
  ...patch,
});

describe('incrementOf', () => {
  it('직접 입력은 친 값을 그대로 보낸다', () => {
    expect(incrementOf(direct('1250'), READY)).toBe(1250);
  });

  it('빈 칸을 0 으로 읽지 않는다 — 0 회짜리 실적이 나가면 안 된다', () => {
    expect(incrementOf(direct(''), READY)).toBeNull();
    expect(incrementOf(direct('   '), READY)).toBeNull();
  });

  it('0 과 음수는 보낼 값이 아니다', () => {
    expect(incrementOf(direct('0'), READY)).toBeNull();
    expect(incrementOf(direct('-5'), READY)).toBeNull();
  });

  it('소수 타발수는 받지 않는다 — 계약이 정수로 받는다', () => {
    expect(incrementOf(direct('1.5'), READY)).toBeNull();
  });

  it('환산은 수량에 비율을 곱한 값이다', () => {
    expect(incrementOf(converted('500'), READY)).toBe(1250);
  });

  it('환산 비율이 없으면 수량만으로 타발수를 지어내지 않는다', () => {
    expect(incrementOf(converted('500'), UNSET)).toBeNull();
  });

  it('반올림 결과가 0 이면 보낼 값이 없는 것이다', () => {
    expect(incrementOf(converted('1'), { kind: 'ready', ratio: 0.2 })).toBeNull();
  });
});

describe('saveDisabledReason', () => {
  it('막힌 데가 없으면 열린다', () => {
    expect(saveDisabledReason(openGuard())).toBeUndefined();
    expect(canSave(openGuard())).toBe(true);
  });

  it('나가는 중이 가장 앞이다 — 뒤에 두면 값을 채운 사용자가 잠긴 버튼을 본다', () => {
    expect(saveDisabledReason(openGuard({ isSaving: true, hasTool: false }))).toBe(
      t.actionReasons.saving,
    );
  });

  it('진입 컨텍스트가 없으면 값의 사정보다 먼저 말한다', () => {
    expect(saveDisabledReason(openGuard({ hasEntry: false, increment: null }))).toBe(
      t.actionReasons.noEntry,
    );
  });

  it('연결이 끊기면 저장을 막고 그 사실을 말한다 — 이 저장소에는 보낼 것 보관함이 없다', () => {
    expect(saveDisabledReason(openGuard({ isOnline: false }))).toBe(t.actionReasons.offline);
  });

  it('툴을 고르기 전에는 툴을 말한다', () => {
    expect(saveDisabledReason(openGuard({ hasTool: false }))).toBe(t.actionReasons.noTool);
  });

  it('타발수가 없으면 마지막으로 그것을 말한다', () => {
    expect(saveDisabledReason(openGuard({ increment: null }))).toBe(t.actionReasons.noShot);
  });
});

describe('hasInput', () => {
  it('지울 것이 있을 때만 「다시 입력」이 열린다', () => {
    expect(hasInput(emptyUsageDraft)).toBe(false);
    expect(hasInput(direct('12'))).toBe(true);
    expect(hasInput(converted('12'))).toBe(true);
  });
});
