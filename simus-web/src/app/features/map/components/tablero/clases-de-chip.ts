/** Las clases de un botón-chip del tablero (filtros, preguntas, tipos de nodo): una sola definición, sin subrayado. */
export function clasesDeChip(activo: boolean): string {
  return 'inline-flex min-h-[calc(var(--spacing-control,2.25rem)-0.5rem)] cursor-pointer items-center gap-1.5 rounded-[var(--radius-control,0.5rem)] border px-3 text-cuerpo font-bold no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-foco)] '
    + (activo ? 'border-morado/40 bg-morado/10 text-morado' : 'border-slate-300 bg-white text-[color:var(--color-prosa)] hover:bg-slate-100 hover:text-morado');
}
