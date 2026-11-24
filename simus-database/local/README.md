# Base local de SIMUS

```bash
cp .env.example .env
# definir SIMUS_LOCAL_SA_PASSWORD
./scripts/local/local-db-up.sh
./scripts/local/schema-local.sh migrar
```

La conexión predeterminada es:

- Servidor: `127.0.0.1,14344`.
- Base: `SIMUS_LOCAL`.
- Usuario: `sa`.
- Contraseña: valor local de `SIMUS_LOCAL_SA_PASSWORD`.
- Certificado del servidor: confiar en entorno local.

El contenedor se llama `simus-desarrollo-sqlserver`. El puerto se enlaza únicamente a
`127.0.0.1`. `./scripts/local/dev-down.sh` lo detiene sin borrar el volumen.

Las semillas amplias y de demostración son opcionales. Antes de aplicarlas, revise su
contenido y confirme que la base admite cambios destructivos o datos sintéticos.

