import './services/polyfills'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initCtvTools } from './services/ctvTools'
import { initRuntime } from './runtime'
import { getRuntimeConfig } from '@/runtime';
import { $body } from "./lib/dom-selector"


initRuntime()
initCtvTools()

if (import.meta.env.DEV) {
  /* @ts-ignore */
  const native = (window as Record<string, unknown>).CinelarNative as Record<string, unknown> | undefined ?? {};
  /* @ts-ignore */
  (window as Record<string, unknown>).CinelarNative = {
    ...native,
    getPlatform: (native.getPlatform as (() => string) | undefined) ?? (() => 'web'),
    getAppVersion: (native.getAppVersion as (() => string) | undefined) ?? (() => '0.0.0'),
    getDeviceModel: (native.getDeviceModel as (() => string) | undefined) ?? (() => 'Desktop'),
    getDeviceName: (native.getDeviceName as (() => string) | undefined) ?? (() => navigator.userAgent),
    getModel: (native.getModel as (() => string) | undefined) ?? (() => navigator.platform),
    getNativeVersion: (native.getNativeVersion as (() => string) | undefined) ?? (() => '1'),
    getNativeVersionName: (native.getNativeVersionName as (() => string) | undefined) ?? (() => '1.0.0'),
    supportsLiveTV: (native.supportsLiveTV as (() => boolean) | undefined) ?? (() => true),
    playLiveChannel: (native.playLiveChannel as ((json: string) => boolean) | undefined) ?? ((json: string) => {
      console.log('[Mock] playLiveChannel:', JSON.parse(json));
      const info = JSON.parse(json) as { url: string };
      window.open(info.url, '_blank');
      return true;
    }),
    prefersNative: (native.prefersNative as (() => boolean) | undefined) ?? (() => false),
    launchNativePlayer: (native.launchNativePlayer as ((json: string) => void) | undefined) ?? ((json: string) => {
      console.log('[Mock] launchNativePlayer:', JSON.parse(json));
    }),
  };
}

/* 
  Dependiendo del tipo de render, añadir clases al body
*/
const runtimeConfig = getRuntimeConfig()
const { appQuality } = runtimeConfig
$body?.classList.add(`app-quality--${appQuality.toLowerCase()}`)

createRoot(document.getElementById('root')!).render(<App />)
