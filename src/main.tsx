
import './services/polyfills'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initCtvTools } from './services/ctvTools'

async function loadRemoteConfig() {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(
      'https://edge-manifest-proxy.cinelartv.lat/remote_config',
      {
        cache: 'no-store',
        signal: controller.signal,
      },
    )

    if (!response.ok) {
      throw new Error(`remote_config failed: HTTP ${response.status}`)
    }

    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

async function bootstrap() {
  initCtvTools()

  if (import.meta.env.DEV) {
    const native =
      /* @ts-ignore */
      (window as Record<string, unknown>).CinelarNative as
      | Record<string, unknown>
      | undefined ?? {}
      /* @ts-ignore */
      ; (window as Record<string, unknown>).CinelarNative = {
        ...native,
        getPlatform:
          (native.getPlatform as (() => string) | undefined) ??
          (() => 'web'),
        getAppVersion:
          (native.getAppVersion as (() => string) | undefined) ??
          (() => '0.0.0'),
        getDeviceModel:
          (native.getDeviceModel as (() => string) | undefined) ??
          (() => 'Desktop'),
        getDeviceName:
          (native.getDeviceName as (() => string) | undefined) ??
          (() => navigator.userAgent),
        getModel:
          (native.getModel as (() => string) | undefined) ??
          (() => navigator.platform),
        getNativeVersion:
          (native.getNativeVersion as (() => string) | undefined) ??
          (() => '1'),
        getNativeVersionName:
          (native.getNativeVersionName as (() => string) | undefined) ??
          (() => '1.0.0'),
        supportsLiveTV:
          (native.supportsLiveTV as (() => boolean) | undefined) ??
          (() => true),
        playLiveChannel:
          (native.playLiveChannel as
            | ((json: string) => boolean)
            | undefined) ??
          ((json: string) => {
            console.log('[Mock] playLiveChannel:', JSON.parse(json))
            const info = JSON.parse(json) as { url: string }
            window.open(info.url, '_blank')
            return true
          }),
        prefersNative:
          (native.prefersNative as (() => boolean) | undefined) ??
          (() => false),
        launchNativePlayer:
          (native.launchNativePlayer as
            | ((json: string) => void)
            | undefined) ??
          ((json: string) => {
            console.log('[Mock] launchNativePlayer:', JSON.parse(json))
          }),
      }
  }

  let remoteConfig

  try {
    remoteConfig = await loadRemoteConfig()
    console.log('[remote_config]', remoteConfig)
      /* @ts-ignore */

      ; (window as Record<string, unknown>).__REMOTE_CONFIG__ = remoteConfig
  } catch (error) {
    console.error('[remote_config] unavailable:', error)

    // Fallback opcional.
    remoteConfig = {}
      /* @ts-ignore */
      ; (window as Record<string, unknown>).__REMOTE_CONFIG__ = remoteConfig
  }

  createRoot(document.getElementById('root')!).render(<App />)

  document.getElementById('loading-screen')?.remove()
}

void bootstrap()