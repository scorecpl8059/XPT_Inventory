const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')

/**
 * Recursively find all .ts handler files under src/handlers/
 * Excludes test files.
 */
function findHandlers(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      findHandlers(fullPath, results)
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.includes('.test.')) {
      results.push(fullPath)
    }
  }
  return results
}

const handlersDir = path.join(__dirname, 'src', 'handlers')
const handlerFiles = findHandlers(handlersDir)

if (handlerFiles.length === 0) {
  console.log('No handler files found yet — skipping build.')
  process.exit(0)
}

const builds = handlerFiles.map((file) => {
  // src/handlers/transactions/create.ts → dist/handlers/transactions/create/index.js
  const relativePath = path.relative(path.join(__dirname, 'src'), file)
  const withoutExt = relativePath.replace(/\.ts$/, '')
  const outfile = path.join(__dirname, 'dist', withoutExt, 'index.js')

  return esbuild.build({
    entryPoints: [file],
    bundle: true,
    outfile,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    // AWS SDK v3 is available in Lambda Node 20 runtime — exclude to reduce bundle size
    external: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb'],
    minify: process.env.NODE_ENV === 'production',
    sourcemap: false,
  })
})

Promise.all(builds)
  .then(() => console.log(`✓ Built ${builds.length} Lambda handler(s)`))
  .catch((err) => {
    console.error('Build failed:', err)
    process.exit(1)
  })
