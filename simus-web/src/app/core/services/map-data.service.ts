import { inject, Injectable } from '@angular/core';
import { forkJoin, Observable, of, OperatorFunction } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { FestivalesParaElMapaService } from './festivales-para-el-mapa.service';
import { EventosParaElMapaService } from './eventos-para-el-mapa.service';
import { MercadosParaElMapaService } from './mercados-para-el-mapa.service';
import { TalleresParaElMapaService } from './talleres-para-el-mapa.service';
import { EspaciosParaElMapaService } from './espacios-para-el-mapa.service';
import { RedesParaElMapaService } from './redes-para-el-mapa.service';
import { CatalogService } from './catalog.service';
import {
  contarRegistrosPlanosPorDepartamento,
  contarRegistrosPorDepartamento,
  crearConteosBaseDeCartografia,
} from '../territorio/conteos-territoriales';

@Injectable({
  providedIn: 'root'
})
export class MapDataService {
  private readonly festivales = inject(FestivalesParaElMapaService);
  private readonly eventos = inject(EventosParaElMapaService);
  private readonly mercados = inject(MercadosParaElMapaService);
  private readonly talleres = inject(TalleresParaElMapaService);
  private readonly espacios = inject(EspaciosParaElMapaService);
  private readonly redes = inject(RedesParaElMapaService);
  private readonly catalog = inject(CatalogService);

  /**
   * Cada fuente que no se pudo leer se anota en `fallas` (con su motivo) en vez de tragarse: el mapa se pinta con lo
   * que sí llegó, pero quien lo ve debe saber que falta algo y poder reintentar, no creer que no hay registros.
   */
  fetchMapCountsBundle(): Observable<any> {
    const fallas: { fuente: string; motivo: string }[] = [];
    const sinFallar = <S, T>(fuente: string, vacio: T): OperatorFunction<S, S | T> => catchError((fallo: unknown): Observable<T> => {
      const e = fallo as { message?: string; status?: number } | null;
      const motivo = e?.status === 0 ? 'Sin conexión con el servidor.'
        : e?.status ? `Código ${e.status}${e.message ? `: ${e.message}` : ''}` : (e?.message || 'Error desconocido.');
      fallas.push({ fuente, motivo });
      return of(vacio);
    });
    return forkJoin({
      geoJson: this.catalog.fetchColombiaGeoJson().pipe(
        sinFallar('la cartografía', { type: 'FeatureCollection', features: [], municipalities: { type: 'FeatureCollection', features: [] } })
      ),
      festivals: this.festivales.consultar().pipe(
        sinFallar('los festivales', { records: [] })
      ),
      // LA AGENDA ENTRA AL MAPA. Cada evento guarda su departamento y su municipio; nunca se había
      // llevado allí. Va en el mismo `forkJoin` para que el mapa se pinte una vez con todo, en vez
      // de dos veces con la mitad.
      agenda: this.eventos.consultar().pipe(
        sinFallar('la agenda', { records: [] })
      ),
      // MERCADOS ENTRA AL MAPA. Su capa existía con sus colores y su escala, y se alimentaba de una
      // lista vacía porque sus tablas se habían retirado; la decisión escrita entonces fue que
      // «cada proceso volverá con su modelo y su revisión propios», y ya volvió.
      mercados: this.mercados.consultar().pipe(
        sinFallar('los mercados', { records: [] })
      ),
      // LUTERÍA ENTRA AL MAPA: los talleres publicados alimentan la capa «Lutieres», que existía sin datos.
      talleres: this.talleres.consultar().pipe(
        sinFallar('la lutería', { records: [] })
      ),
      // LOS ESPACIOS PARA MÚSICA EN VIVO ENTRAN AL MAPA: los publicados alimentan la capa «Espacios».
      espacios: this.espacios.consultar().pipe(
        sinFallar('los espacios', { records: [] })
      ),
      // REDES Y DOCUMENTACIÓN ENTRA AL MAPA: las redes publicadas alimentan la capa «Redes de Documentación».
      redes: this.redes.consultar().pipe(
        sinFallar('las redes', { records: [] })
      )
    }).pipe(
      map(({ geoJson, festivals, agenda, mercados, talleres, espacios, redes }) => {
        const baseCounts = crearConteosBaseDeCartografia(geoJson);

        const festivalRecords = festivals.records || [];
        const agendaRecords = agenda.records || [];
        const marketRecords = mercados.records || [];
        return {
          geoJson,
          fallas,
          baseCounts,
          festivalRecords,
          agendaRecords,
          /*
           * LAS TRES LISTAS VACIAS NO SON UN OLVIDO, Y CONVIENE QUE QUEDE ESCRITO AQUI.
           *
           * MERCADOS MUSICALES YA SALIO DE AQUI: volvió con su modelo,
           * su circuito de revisión y su ruta pública, que es justo la condición que este comentario
           * ponía. Quedan tres.
           *
           * Escuelas de música, redes de documentación y lutieres son tres de los cinco procesos
           * cuyas tablas retiró `V20260904_01`, con sus clases del modelo y sus rutas. No hay de dónde leerlos: la decisión vigente es que «Festival es el único proceso
           * habilitado; cada proceso volverá con su modelo y su revisión propios».
           *
           * Se conservan como listas vacías —y no se borran— porque el geovisor las agrega para su
           * vista General y quitarlas obligaría a reescribir esa aritmética por algo que va a
           * volver. Lo que SI cambió es la pantalla: esas cuatro capas ya no se ofrecen como si
           * fueran consultables, se anuncian «en preparación».
           */
          schoolRecords: [],
          marketRecords,
          redesRecords: redes.records || [],
          luthierRecords: talleres.records || [],
          spaceRecords: espacios.records || [],
          festivalCounts: { ...baseCounts, ...contarRegistrosPorDepartamento(festivalRecords) },
          // SE CUENTA CON EL MISMO CONTADOR que Festivales: resuelve el departamento probando las
          // cuatro claves y normaliza el nombre. Un segundo contador aquí daría dos cifras para el
          // mismo territorio en cuanto uno de los dos cambiara.
          agendaCounts: { ...baseCounts, ...contarRegistrosPorDepartamento(agendaRecords) },
          schoolCounts: baseCounts,
          /*
            MERCADOS SE CUENTA APARTE DE FESTIVALES, y no por capricho.

            `buildFestivalCounts` lee `record.fields.departamento`, y un mercado es un registro
            PLANO: `map-domain.ts` declara desde hace meses los alias de las columnas del
            cuestionario de caracterización y los aplana a `department`, `municipality`… Toda la
            maquinaria de mercados que ya existe —el recuento por departamento, los totales, la
            ficha del mapa— lee esa forma. Pasarle un registro plano al contador de festivales
            devolvía cero para todos los departamentos, y el mapa enseñaba la capa encendida con
            «0 mercados» teniéndolos.
          */
          marketCounts: { ...baseCounts, ...contarRegistrosPlanosPorDepartamento(marketRecords) },
        };
      })
    );
  }
}
