# vite-plugin-dev-source-map

[简体中文](./README.zh-CN.md)

Give original source files distinct URLs in **Vite development sourcemaps**, so browser DevTools can distinguish original TSX/TS/JSX/JS from transformed JavaScript.

## Why

During development, a transformed module such as `/src/Component.tsx` can have a sourcemap whose original source resolves to the same URL. Tools that open a source by URL may then reveal the transformed JavaScript with coordinates from the original source.

This plugin rewrites original source URLs to `vite-source:///src/Component.tsx`. It keeps generated code, mappings, names and embedded source content intact. This can help React DevTools **Rendered by** links and other DevTools source navigation when the problem is a source URL collision.

## Install

```sh
npm install -D vite-plugin-dev-source-map
```

Requirements: **Vite 8** and Node.js **20.19+ (20.x) or 22.12+**. The package exports an ESM default export and the named `devSourceMap` export, with TypeScript declarations. Vite 6 and 7 have not been tested.

## Usage

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import devSourceMap from 'vite-plugin-dev-source-map'

export default defineConfig({
  plugins: [react(), devSourceMap()],
})
```

Restart the dev server and reload the page after adding the plugin. In Chrome, keep JavaScript source maps enabled in DevTools settings.

The plugin only runs during `vite dev` / `vite serve`. It is excluded from production builds and `vite preview`.

## Scope

- Rewrites inline, base64-encoded JS sourcemaps on development responses for files under the Vite root's `src/` directory.
- Supports a non-root Vite `base`, such as `/demo/`.
- Preserves original source content and line/column mappings.
- Leaves `?raw` and `?url` imports alone.
- Versions ETags so cached responses with old source URLs are refreshed, while current responses can still use 304.
- Keeps the original response if a sourcemap cannot be parsed.

`vite-source:` is a virtual debugging URL, not a fetchable endpoint. Chrome reads the original source from `sourcesContent`. Sources without embedded content are not rewritten. This first release does not process external `.map` files, CSS maps, dependencies, files outside `src/`, or indexed sourcemaps. It does not enable sourcemaps that another plugin has disabled.

Changing source identity addresses URL collisions. Navigation still depends on the consuming DevTools extension using the mapped source URL.

## Try the React example

```sh
git clone https://github.com/sexyHuang/vite-plugin-dev-source-map.git
cd vite-plugin-dev-source-map
npm ci
npm run dev
```

Open the printed URL, select `Child` in React DevTools Components, and click the `Parent` callsite under **Rendered by**. The expected original file is `vite-source:///src/App.tsx`, at the `<Child />` callsite. The example also includes an interactive counter.

## Development

```sh
npm ci
npm test
npm pack
```

Tests exercise actual Vite HTTP responses, original source coordinates, cached responses, raw/URL imports and module invalidation. CI tests Node.js 20, 22 and 24. No runtime dependencies are bundled; Vite is a peer dependency.

## License

MIT
