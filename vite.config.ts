import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

function findBlockEnd(css: string, blockStart: number): number {
  let depth = 0
  let quote: string | null = null
  let escaped = false
  let inComment = false

  for (let i = blockStart; i < css.length; i += 1) {
    const char = css[i]
    const next = css[i + 1]

    if (inComment) {
      if (char === '*' && next === '/') {
        inComment = false
        i += 1
      }
      continue
    }

    if (quote) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '/' && next === '*') {
      inComment = true
      i += 1
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }

  return -1
}

function flattenCascadeLayers(css: string): string {
  let result = css
  let changed = true

  while (changed) {
    changed = false
    let output = ''
    let cursor = 0

    for (let layerIndex = result.indexOf('@layer'); layerIndex !== -1; layerIndex = result.indexOf('@layer', cursor)) {
      const before = result[layerIndex - 1]
      if (before && /[a-zA-Z0-9_-]/.test(before)) {
        cursor = layerIndex + 6
        continue
      }

      output += result.slice(cursor, layerIndex)

      const headerEnd = result.slice(layerIndex).search(/[;{]/)
      if (headerEnd === -1) {
        output += result.slice(layerIndex)
        cursor = result.length
        break
      }

      const markerIndex = layerIndex + headerEnd
      const marker = result[markerIndex]

      if (marker === ';') {
        cursor = markerIndex + 1
        changed = true
        continue
      }

      const blockEnd = findBlockEnd(result, markerIndex)
      if (blockEnd === -1) {
        output += result.slice(layerIndex)
        cursor = result.length
        break
      }

      output += result.slice(markerIndex + 1, blockEnd)
      cursor = blockEnd + 1
      changed = true
    }

    output += result.slice(cursor)
    result = output
  }

  return result
}

function stripRegisteredProperties(css: string): string {
  return css.replace(/@property\s+--[^{]+{[^}]*}/g, '')
}

function legacyCssPlugin(): Plugin {
  return {
    name: 'cinelar-legacy-css',
    generateBundle(_, bundle) {
      for (const asset of Object.values(bundle)) {
        if (asset.type === 'asset' && asset.fileName.endsWith('.css') && typeof asset.source === 'string') {
          asset.source = stripRegisteredProperties(flattenCascadeLayers(asset.source))
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), legacyCssPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2018',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) {
            return 'vendor';
          }
          if (id.includes('norigin-spatial-navigation')) {
            return 'tv';
          }
        },
      },
    },
  },
})
