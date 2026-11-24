// Capturas a 390 px (y a 700 px) de cada correo que hay en un Mailpit LOCAL, más un index.html comparador
// con el texto de «antes» (correo plano anterior) y el de «ahora». Lo invoca vista-previa-de-correos.sh.
// Uso: node capturas-de-correos.mjs <dir-de-playwright> <dir-de-salida>   (SIMUS_MAILPIT_WEB = URL de Mailpit)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [, , pw, salida] = process.argv;
const web = process.env.SIMUS_MAILPIT_WEB ?? 'http://127.0.0.1:8025';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(web)) throw new Error('Solo se admite Mailpit local.');
const require = createRequire(path.join(pw, 'node_modules', 'x.js'));
const { chromium } = require('playwright-core');

const ANTES = {
  'invitacion-equipo-editor': 'Hola.\n\nTe invitan a unirte a Corporación Cantares del Pacífico en SIMUS como editora o editor. Abre este enlace para aceptar:\n\n/ecosistema/invitacion-organizacion?testigo=…\n\nEl enlace sirve una sola vez y vence en 7 días. Si no esperabas esta invitación, puedes ignorarla.\n\n(NO decía quién invita.)',
  'invitacion-equipo-administrador': 'Igual que el de editor, con «administradora o administrador». No decía quién invita.',
  'invitacion-agenda-de-citas': 'Hola.\n\n«Circulart» (2026) te invita a su agenda de citas en SIMUS como comprador o booker, para que veas a los artistas inscritos y gestiones tus citas. Abre este enlace para aceptar: …',
  'confirmar-correo': 'Hola, Ana.\n\nPara terminar de activar tu cuenta en SIMUS necesitamos comprobar que este correo es tuyo. Abre este enlace: …\n\nEl enlace vence en 3 días. Si no lo pediste tú, puedes ignorar este mensaje.',
  'restablecer-contrasena': 'Hola.\n\nRecibimos una solicitud para restablecer la contraseña de tu cuenta en SIMUS. Abre este enlace para elegir una nueva: …',
  'contrasena-cambiada': 'Hola.\n\nLa contraseña de tu cuenta en SIMUS se restableció con un enlace de recuperación y se cerraron las demás sesiones. …',
  'festival-enviado-a-revision': 'Estimado(a) Ana.\n\nLe informamos que su solicitud de registro del Festival “…” ha sido enviada correctamente. …',
  'festival-por-validar': 'La organización “…” envió a revisión el Festival “…”.\n\nLe informamos que se le ha asignado una solicitud de preregistro para su respectiva validación:\n\n/administracion/solicitudes/…',
  'boletin-confirmar': 'Ya tenía la plantilla del boletín v3 (sin cambios).',
};
const ANTES_FESTIVAL = 'Estimado(a) Ana.\n\nEl equipo del PNMC … tu Festival “…”. (texto plano, sin botón ni organización)';

const lista = await (await fetch(`${web}/api/v1/messages?limit=100`)).json();
const mensajes = lista.messages.map((m) => ({ id: m.ID, asunto: m.Subject, etiqueta: /^\[([^\]]+)\]/.exec(m.Subject)?.[1] })).filter((m) => m.etiqueta);
mkdirSync(salida, { recursive: true });
const navegador = await chromium.launch();
const filas = [];
for (const m of mensajes.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta))) {
  const detalle = await (await fetch(`${web}/api/v1/message/${m.id}`)).json();
  const html = { Inline: detalle.Inline ?? [] };
  const cuerpoHtml = await (await fetch(`${web}/view/${m.id}.html`)).text();
  const texto = await (await fetch(`${web}/view/${m.id}.txt`)).text();
  for (const [ancho, sufijo] of [[390, '390'], [700, '700']]) {
    const pagina = await navegador.newPage({ viewport: { width: ancho, height: 800 } });
    await pagina.setContent(cuerpoHtml.replace(/src="\/api\//g, `src="${web}/api/`).replace(/src="cid:([^"]+)"/g, (_, cid) => `src="${web}/api/v1/message/${m.id}/part/${html.Inline.find((i) => i.ContentID === cid)?.PartID}"`), { waitUntil: 'load' });
    await pagina.screenshot({ path: path.join(salida, `${m.etiqueta}-${sufijo}.png`), fullPage: true });
    await pagina.close();
  }
  filas.push({ ...m, texto, antes: ANTES[m.etiqueta] ?? (m.etiqueta.startsWith('festival-') ? ANTES_FESTIVAL : '') });
}
await navegador.close();

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
writeFileSync(path.join(salida, 'index.html'), `<!doctype html><html lang="es"><meta charset="utf-8"><title>Correos del sistema · antes y ahora</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#F2EEF4;color:#1F2933}header{background:#4C2C54;color:#fff;padding:20px 28px;border-bottom:6px solid #FFC93C}
main{padding:24px 28px}section{background:#fff;margin:0 0 28px;padding:18px;border-radius:6px;box-shadow:0 1px 3px #0002}h2{margin:0 0 4px;color:#4C2C54}.asunto{color:#5B6670;margin:0 0 14px}
.fila{display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start}.col{flex:1 1 280px}.col h3{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#5B6670;margin:0 0 6px}
pre{white-space:pre-wrap;background:#F7F4F8;padding:12px;border-radius:4px;font:13px/1.5 ui-monospace,monospace;margin:0}img{max-width:100%;border:1px solid #ddd}</style>
<header><h1>Correos del sistema · antes y ahora</h1><p>Punto 37: plantilla común (boletín v3). Captura a 390 px (móvil) y 700 px (escritorio).</p></header><main>
${filas.map((f) => `<section><h2>${esc(f.etiqueta)}</h2><p class="asunto">Asunto: ${esc(f.asunto.replace(/^\[[^\]]+\]\s*/, ''))}</p><div class="fila">
<div class="col"><h3>Antes (texto plano)</h3><pre>${esc(f.antes || '—')}</pre></div>
<div class="col"><h3>Ahora · 390 px</h3><img src="${f.etiqueta}-390.png" alt=""></div>
<div class="col"><h3>Ahora · 700 px</h3><img src="${f.etiqueta}-700.png" alt=""></div>
<div class="col"><h3>Texto plano alternativo</h3><pre>${esc(f.texto)}</pre></div></div></section>`).join('\n')}</main></html>`);
console.log(`[simus] ${filas.length} correos capturados en ${salida}`);
