import { ThemeProvider, ToastProvider } from '@crefle/web-ui';
import type { ReactNode } from 'react';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * 앱 전역 프로바이더. Phase 2에서 데이터 프로바이더가 이 파일에 추가된다.
 */
export const AppProviders = ({ children }: AppProvidersProps) => {
  return (
    <ThemeProvider defaultTheme="system">
      <ToastProvider position="bottom-right">{children}</ToastProvider>
    </ThemeProvider>
  );
};
