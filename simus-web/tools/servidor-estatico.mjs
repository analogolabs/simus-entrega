#!/usr/bin/env node
/**
 * Servidor estatico minimo para el artefacto ya construido, con respaldo de SPA.
 *
 * POR QUE EXISTE. Las pruebas de extremo a extremo necesitan el sitio servido
 * por algo. `ng serve` no vale para esto: compila en modo desarrollo, no aplica
 * los `fileReplacements` de produccion —los que dejan fuera la barra de
 * herramientas y las cuentas de desarrollo— y tarda. Lo que hay que verificar es
 * el artefacto que se despliega, no una compilacion parecida.
 *
 * POR QUE NO UNA DEPENDENCIA. Traer `http-server` o similar por 40 lineas anade
 * un paquete al lockfile y una superficie que mantener. Esto no necesita nada
 * que no traiga Node.
 *
 * RESPALDO DE SPA: cualquier ruta que no corresponda a un fichero devuelve
 * index.html, porque el enrutado lo hace Angular en el navegador. Sin esto,
 * abrir /agenda directamente da 404 y la prueba mide un error del servidor
 * creyendo que mide la pagina.
 *
 * NO SIRVE PARA PRODUCCION y no pretende hacerlo: sin compresion, sin cache,
 * sin TLS, sin limites. Es instrumental de pruebas.
 *
 * CON API (D-08). Para capturar pantallas, grabar o correr los recorridos de navegador contra una pila
 * aislada, `--api <puerto>` (o la variable SIMUS_LOCAL_API_PORT con `--con-api`) reenvia `/api/*` a esa API
 * como lo hace `proxy.conf.js` en `ng serve`, pero SIN la capa de desarrollo: es el artefacto de
 * produccion, sin cuentas de desarrollo y sin peticiones a servicios locales.
 * Sin esa opcion `/api/*` sigue dando 404, para que una prueba no mida el index.html por una API.
 *
 * USO:
 *   node tools/servidor-estatico.mjs [--puerto 4201] [--raiz dist/simus-web/browser] [--api 8180 | --con-api]
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const valor = (n, porDefecto) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : porDefecto;
};

const PUERTO = Number(valor("--puerto", process.env.SIMUS_PUERTO_ESTATICO ?? process.env.PNMC_PUERTO_ESTATICO ?? (args.includes("--con-api") ? process.env.SIMUS_LOCAL_WEB_PORT : undefined) ?? "4201"));
const API_PUERTO = (() => {
  const explicito = valor("--api", "");
  if (explicito) return Number(explicito);
  return args.includes("--con-api") ? Number(process.env.SIMUS_LOCAL_API_PORT ?? "8180") : 0;
})();
const RAIZ = path.resolve(valor("--raiz", path.join(AQUI, "..", "dist", "simus-web", "browser")));

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

if (!fs.existsSync(path.join(RAIZ, "index.html"))) {
  console.error(`No hay index.html en ${RAIZ}. Construye antes con 'npm run build'.`);
  process.exit(1);
}

const servidor = http.createServer((req, res) => {
  let ruta;
  try {
    ruta = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("URL mal formada");
    return;
  }

  // Normalizar y encerrar dentro de RAIZ: sin esto, '/../..' sirve cualquier
  // fichero del disco. Es instrumental de pruebas, pero escucha en un socket.
  const destino = path.resolve(RAIZ, "." + path.posix.normalize(ruta));
  const dentro = destino === RAIZ || destino.startsWith(RAIZ + path.sep);

  const servir = (fichero, codigo = 200) => {
    fs.readFile(fichero, (err, datos) => {
      if (err) {
        res.writeHead(500).end("Error de lectura");
        return;
      }
      res.writeHead(codigo, {
        "Content-Type": TIPOS[path.extname(fichero).toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(datos);
    });
  };

  if (dentro && fs.existsSync(destino) && fs.statSync(destino).isFile()) {
    servir(destino);
    return;
  }

  // Respaldo de SPA. Se excluyen las rutas de API a proposito: si una prueba
  // pide /api/... y le devolvemos el index.html, el cliente recibe HTML donde
  // esperaba JSON y el fallo aparece en un sitio que no tiene nada que ver.
  if (ruta.startsWith("/api/") && API_PUERTO) {
    // Reenvio tal cual: mismo metodo, cabeceras (cookies y token CSRF incluidos) y cuerpo.
    const reenvio = http.request(
      { host: "127.0.0.1", port: API_PUERTO, method: req.method, path: req.url, headers: req.headers },
      (respuesta) => {
        res.writeHead(respuesta.statusCode ?? 502, respuesta.headers);
        respuesta.pipe(res);
      },
    );
    reenvio.on("error", () => {
      if (!res.headersSent) res.writeHead(502, { "Content-Type": "application/json" });
      res.end('{"error":"la API de la pila no responde"}');
    });
    req.pipe(reenvio);
    return;
  }
  if (ruta.startsWith("/api/")) {
    res.writeHead(404, { "Content-Type": "application/json" }).end('{"error":"sin API en el servidor estatico"}');
    return;
  }

  servir(path.join(RAIZ, "index.html"));
});

servidor.listen(PUERTO, "127.0.0.1", () => {
  console.log(`Sirviendo ${RAIZ} en http://127.0.0.1:${PUERTO} (respaldo de SPA activo${API_PUERTO ? `, /api -> 127.0.0.1:${API_PUERTO}` : ""})`);
});

for (const senal of ["SIGINT", "SIGTERM"]) {
  process.on(senal, () => servidor.close(() => process.exit(0)));
}
