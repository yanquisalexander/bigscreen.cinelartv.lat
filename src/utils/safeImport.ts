let cachedManifest: Record<string, any> | null = null;

async function getManifest() {
  if (cachedManifest) return cachedManifest;
  try {
    const res = await fetch('/.vite/manifest.json', { cache: 'no-store' });
    if (res.ok) {
      cachedManifest = await res.json();
      return cachedManifest;
    }
  } catch (e) {
    console.error('[SafeImport] Failed to fetch manifest:', e);
  }
  return null;
}

export function safeImport(importFn: () => Promise<any>, sourceKey: string) {
  return async () => {
    try {
      return await importFn();
    } catch (err) {
      console.warn(`[SafeImport] Chunk load failed for ${sourceKey}, checking manifest...`, err);
      
      const manifest = await getManifest();
      if (!manifest || !manifest[sourceKey]) {
        throw err;
      }

      const entry = manifest[sourceKey];
      const chunkFile = '/' + entry.file;

      if (entry.css && Array.isArray(entry.css)) {
        for (const cssFile of entry.css) {
          const cssPath = '/' + cssFile;
          if (!document.querySelector(`link[href="${cssPath}"]`)) {
            await new Promise((resolve) => {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = cssPath;
              link.onload = resolve;
              link.onerror = resolve;
              document.head.appendChild(link);
            });
          }
        }
      }

      return await import(/* @vite-ignore */ chunkFile);
    }
  };
}
