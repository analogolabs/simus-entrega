import assert from 'node:assert/strict';
import { coincidencias, revisar, sinComentarios } from './trinquete-textos.mjs';

// Lo que debe atrapar.
assert.equal(coincidencias('<p>Todavía no la ve el Programa.</p>').length, 1);
assert.equal(coincidencias("mensaje = 'Te avisaremos cuando el Programa decida.';").length, 1);
assert.equal(coincidencias('actor = "Equipo del Programa";').length, 1);
assert.equal(coincidencias('<p>Pedimos ajustes al Programa y esperamos.</p>').length, 1);
assert.equal(coincidencias('<p>\n      Programa lo publique.\n    </p>').length, 1);
assert.equal(coincidencias('<p>Se lo envían al\n   Programa para revisión</p>').length, 1);

// Lo que no.
assert.equal(coincidencias('<!-- el Programa lo custodia -->').length, 0);
assert.equal(coincidencias('/// El Programa decide.\nvar x = 1;').length, 0);
assert.equal(coincidencias('// el Programa decide').length, 0);
assert.equal(coincidencias('/* del Programa */ const a = 1;').length, 0);
assert.equal(coincidencias('<p>El Programa Nacional de Estímulos publicó…</p>').length, 0);
assert.equal(coincidencias('<p>El PNMC revisa y el equipo del PNMC responde.</p>').length, 0);
assert.equal(coincidencias('public sealed record X(ProgramaEditorialDto Programa, int Y);').length, 0);
assert.equal(sinComentarios('a\n<!-- b\nc -->\nd').split('\n').length, 4);

// Y el árbol entero está limpio.
assert.deepEqual(revisar(), []);
console.log('trinquete-textos.prueba: bien.');
