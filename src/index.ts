import type { Plugin } from "vite";

const inlineMap =
  /(\n\/\/# sourceMappingURL=data:application\/json(?:;charset=[^;,]+)?;base64,)([A-Za-z0-9+/=]+)(\s*)$/;
const etagSuffix = '-vite-dev-source-map-v1"';

type DemoSourceMap = {
  version: number;
  sources: string[];
  sourcesContent?: (string | null)[];
  sourceRoot?: string;
};

/** Give original source files distinct URLs without changing generated code or mappings. */
export function devSourceMap(): Plugin {
  return {
    name: "vite-plugin-dev-source-map",
    apply: "serve",
    configureServer(server) {
      const sourcePrefix = `${server.config.base}src/`;
      server.middlewares.use((req, res, next) => {
        const moduleUrl = new URL(req.url ?? "/", "http://vite.demo");
        if (
          !moduleUrl.pathname.startsWith(sourcePrefix) ||
          !/\.[cm]?[jt]sx?$/.test(moduleUrl.pathname) ||
          moduleUrl.searchParams.has("raw") ||
          moduleUrl.searchParams.has("url")
        ) {
          next();
          return;
        }

        // An unchanged JS ETag must not reuse a response containing the old source URLs.
        const cachedEtag = req.headers["if-none-match"];
        if (typeof cachedEtag === "string" && cachedEtag.endsWith(etagSuffix)) {
          req.headers["if-none-match"] = `${cachedEtag.slice(0, -etagSuffix.length)}"`;
        } else {
          delete req.headers["if-none-match"];
        }

        const end = res.end.bind(res);
        res.end = ((...args: Parameters<typeof res.end>) => {
          const chunk = args[0];
          if (
            res.statusCode === 200 &&
            String(res.getHeader("Content-Type")).includes("javascript") &&
            (typeof chunk === "string" || Buffer.isBuffer(chunk))
          ) {
            const etag = res.getHeader("Etag");
            if (typeof etag === "string" && etag.endsWith('"')) {
              res.setHeader("Etag", `${etag.slice(0, -1)}${etagSuffix}`);
            }
            const body = chunk.toString();
            args[0] = body.replace(inlineMap, (match, prefix, encoded, suffix) => {
              try {
                const map: DemoSourceMap = JSON.parse(
                  Buffer.from(encoded, "base64").toString("utf8"),
                );
                if (map.version !== 3 || !Array.isArray(map.sources)) return match;
                const sourceBase = map.sourceRoot
                  ? new URL(`${map.sourceRoot.replace(/\/$/, "")}/`, moduleUrl)
                  : moduleUrl;
                let changed = false;
                const sources = map.sources.map((source, index) => {
                  const url = new URL(source, sourceBase);
                  if (
                    url.origin === moduleUrl.origin &&
                    url.pathname.startsWith(sourcePrefix) &&
                    typeof map.sourcesContent?.[index] === "string"
                  ) {
                    changed = true;
                    return `vite-source:///${url.pathname.slice(server.config.base.length)}`;
                  }
                  // Keep non-target sources on the browser's real origin after removing sourceRoot.
                  return url.origin === moduleUrl.origin
                    ? `${url.pathname}${url.search}${url.hash}`
                    : url.href;
                });
                if (!changed) return match;
                map.sources = sources;
                delete map.sourceRoot;
                return `${prefix}${Buffer.from(JSON.stringify(map)).toString("base64")}${suffix}`;
              } catch {
                server.config.logger.warnOnce(
                  "[vite-plugin-dev-source-map] Could not rewrite an inline sourcemap; keeping the original.",
                );
                return match;
              }
            });
            if (res.hasHeader("Content-Length")) {
              res.setHeader("Content-Length", Buffer.byteLength(args[0]));
            }
          }
          return end(...args);
        }) as typeof res.end;
        next();
      });
    },
  };
}

export default devSourceMap;
