import type { AppProps } from 'next/app';
import { ThemeProvider } from '../context/ThemeContext';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
