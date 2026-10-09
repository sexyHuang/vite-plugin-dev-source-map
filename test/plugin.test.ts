import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createServer, resolveConfig, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";
import { describe, expect, it } from "vitest";
import devSourceMap from "../dist/index.js";

const source = `export function Child() {
  return <button>Source map demo</button>
}

export function Parent() {
  return <Child />
}
`;

function readMap(body: string) {
  const match = body.match(/\n\/\/# sourceMappingURL=data:application\/json;base64,([^\s]+)\s*$/);
  if (!match) throw new Error("Expected a Vite inline sourcemap");
  return {
    code: body.slice(0, match.index),
    map: JSON.parse(Buffer.from(match[1], "base64").toString("utf8")),
  };
}

describe("vite-plugin-dev-source-map", () => {
  it("separates original TSX URLs while preserving code, mappings, raw imports and updates", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "vite-source-map-demo-"));
    let server: ViteDevServer | undefined;
    const fixture = resolve(root, "src/Parent.tsx");
    try {
      await mkdir(resolve(root, "src"));
      await symlink(
        resolve("node_modules"),
        resolve(root, "node_modules"),
        process.platform === "win32" ? "junction" : "dir",
      );
      await writeFile(fixture, source);
      const start = async (enabled: boolean) => {
        server = await createServer({
          configFile: false,
          root,
          cacheDir: resolve(root, ".vite"),
          base: "/demo/",
          plugins: [react(), ...(enabled ? [devSourceMap()] : [])],
          optimizeDeps: { noDiscovery: true, include: [] },
          server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
        });
        await server.listen();
        return server.resolvedUrls!.local[0];
      };
      const baselineUrl = await start(false);
      const baseline = readMap(await (await fetch(`${baselineUrl}src/Parent.tsx`)).text());
      expect(new URL(baseline.map.sources[0], `${baselineUrl}src/Parent.tsx`).pathname).toBe(
        "/demo/src/Parent.tsx",
      );
      await server!.close();
      const url = await start(true);
      const response = await fetch(`${url}src/Parent.tsx`);
      const rewritten = readMap(await response.text());
      expect(rewritten.map.sources).toEqual(["vite-source:///src/Parent.tsx"]);
      const transformed = await server!.transformRequest("/src/Parent.tsx");
      expect(rewritten.code).toBe(transformed!.code);
      const stale = await fetch(`${url}src/Parent.tsx`, {
        headers: { "If-None-Match": transformed!.etag! },
      });
      expect(stale.status).toBe(200);
      expect(readMap(await stale.text()).map.sources).toEqual(["vite-source:///src/Parent.tsx"]);
      expect(rewritten.map.mappings).toBe(baseline.map.mappings);
      expect(rewritten.map.names).toEqual(baseline.map.names);
      expect(rewritten.map.sourcesContent).toEqual([source]);
      const parentLine =
        rewritten.code.split("\n").findIndex((line) => line.startsWith("export function Parent")) +
        1;
      expect(
        originalPositionFor(new TraceMap(rewritten.map), { line: parentLine, column: 7 }),
      ).toMatchObject({
        source: "vite-source:///src/Parent.tsx",
        line: 5,
        column: 7,
      });
      const raw = await (await fetch(`${url}src/Parent.tsx?raw`)).text();
      expect(raw).toContain(JSON.stringify(source));
      expect(raw).not.toContain("vite-source:");
      const urlImport = await (await fetch(`${url}src/Parent.tsx?url`)).text();
      expect(urlImport).not.toContain("vite-source:");
      const head = await fetch(`${url}src/Parent.tsx`, { method: "HEAD" });
      expect(head.status).toBe(200);
      expect(await head.text()).toBe("");
      const notModified = await fetch(`${url}src/Parent.tsx`, {
        headers: { "If-None-Match": response.headers.get("etag")! },
      });
      expect(notModified.status).toBe(304);
      const updated = source.replace("Source map demo", "Updated demo");
      await writeFile(fixture, updated);
      const module = await server!.moduleGraph.getModuleByUrl("/src/Parent.tsx");
      server!.moduleGraph.invalidateModule(module!);
      const refreshed = readMap(await (await fetch(`${url}src/Parent.tsx?t=123`)).text());
      expect(refreshed.map.sources).toEqual(["vite-source:///src/Parent.tsx"]);
      expect(refreshed.map.sourcesContent).toEqual([updated]);
    } finally {
      await server?.close();
      await rm(root, { recursive: true, force: true });
    }
  }, 20000);
});

it("is excluded from production builds", async () => {
  const config = await resolveConfig(
    { configFile: false, envFile: false, plugins: [devSourceMap()] },
    "build",
  );
  expect(config.plugins.some((plugin) => plugin.name === "vite-plugin-dev-source-map")).toBe(false);
});
