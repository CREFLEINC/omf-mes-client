import { causeCodeAdapter, defectCodeAdapter, type CodeAdapter } from './adapters';
import type { CodeKind } from './types';

/**
 * 탭 정의. **이 배열이 정본이다** — 공정 매핑 탭처럼 나중에 붙을 탭은 여기에 한 줄만 더하면 된다.
 * 화면과 테스트가 모두 이 배열을 순회하므로 탭이 늘면 검증도 함께 는다.
 */

export interface CodeTabDefinition {
  kind: CodeKind;
  adapter: CodeAdapter;
}

const toTab = (adapter: CodeAdapter): CodeTabDefinition => ({ kind: adapter.kind, adapter });

/** 비어 있지 않은 배열로 두어 「첫 탭」이 언제나 존재함을 타입으로 보장한다. */
export const CODE_TABS: readonly [CodeTabDefinition, ...CodeTabDefinition[]] = [
  toTab(defectCodeAdapter),
  toTab(causeCodeAdapter),
];

/**
 * 주소의 `tab` 값을 탭으로 옮긴다. 모르는 값·빈 값이면 첫 탭으로 떨어진다 —
 * 주소를 손으로 고쳐도 빈 화면이 되지 않아야 한다.
 */
export const resolveTab = (param: string | null): CodeTabDefinition =>
  CODE_TABS.find((tab) => tab.kind === param) ?? CODE_TABS[0];
