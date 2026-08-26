import { ThemeProvider, ToastProvider } from '@crefle/web-ui';
import type { ReactNode } from 'react';

interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders = ({ children }: AppProvidersProps) => {
  return (
    <ThemeProvider defaultTheme="system">
      <ToastProvider position="top-center">{children}</ToastProvider>
    </ThemeProvider>
  );
};
