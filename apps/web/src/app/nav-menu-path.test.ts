import { ko, vi } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { NAV_GROUPS } from './nav-tree';

/**
 * 화면이 다른 화면으로 안내하는 메뉴 경로(`menuPath`)가 실제 메뉴 라벨과 같은가.
 *
 * 화면은 `app/` 을 부를 수 없어 메뉴 라벨을 i18n 에 한 번 더 적는다 — 메뉴 이름이 바뀌면
 * 안내가 사용자가 누를 수 없는 이름을 가리키게 되므로 여기서 짝을 잰다.
 */
const menuPathOf = (to: string, locale: 'ko' | 'vi'): string | null => {
  const name = (named: { label: string; labelVi: string }) =>
    locale === 'vi' ? named.labelVi : named.label;

  for (const group of NAV_GROUPS) {
    for (const entry of group.items) {
      const tab = entry.tabs?.find((candidate) => candidate.to === to);
      /* 첫 탭 이름이 묶음 이름과 같으면 탭 단계는 적지 않는다(브레드크럼과 같다). */
      if (tab !== undefined)
        return (
          name(tab) === name(entry)
            ? [name(group), name(entry)]
            : [name(group), name(entry), name(tab)]
        ).join(' › ');
      if (entry.tabs === undefined && entry.to === to)
        return [name(group), name(entry)].join(' › ');
    }
  }

  return null;
};

describe('안내용 메뉴 경로', () => {
  it.each([
    ['/production/work-order-close', 'workOrderClose'],
    ['/production/production-orders', 'productionOrder'],
    ['/master-data/integration-sync', 'integrationSync'],
    ['/system/terminal-process-map', 'terminalProcessMap'],
  ] as const)('%s 의 menuPath 가 메뉴 라벨과 같다', (to, key) => {
    expect(ko[key].menuPath).toBe(menuPathOf(to, 'ko'));
    expect(vi[key].menuPath).toBe(menuPathOf(to, 'vi'));
  });
});
