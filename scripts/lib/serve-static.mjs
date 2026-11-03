import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
};

// Sirve `dir` en un puerto libre de 127.0.0.1; `server.address().port` da el puerto.
export function serveStatic(dir) {
  const root = resolve(dir);
  const server = createServer((req, res) => {
    let ruta;
    try {
      ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
    } catch {
      res.writeHead(400).end("bad request");
      return;
    }
    if (ruta.endsWith("/")) ruta += "index.html";
    const fichero = join(root, ruta);
    if (!fichero.startsWith(root + sep) || !existsSync(fichero) || statSync(fichero).isDirectory()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[extname(fichero)] || "application/octet-stream" });
    createReadStream(fichero).pipe(res);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}
