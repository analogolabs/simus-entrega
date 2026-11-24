# Imagen reproducible de SIMUS main: Angular se incorpora al wwwroot del API para
# que portal y API compartan dominio y las cookies de sesion no crucen origenes.
FROM node:24-bookworm-slim AS web
WORKDIR /src/simus-web
COPY simus-web/package.json simus-web/package-lock.json ./
RUN npm ci
COPY simus-web/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS publicar
WORKDIR /src
COPY simus-api/ ./simus-api/
RUN dotnet restore simus-api/SIMUS.Api.sln
RUN dotnet publish simus-api/src/SIMUS.Api/SIMUS.Api.csproj --configuration Release --no-restore --output /out
RUN mkdir -p /out/wwwroot
COPY --from=web /src/simus-web/dist/simus-web/browser/ /out/wwwroot/

FROM mcr.microsoft.com/dotnet/aspnet:10.0
LABEL org.opencontainers.image.title="SIMUS" \
      org.opencontainers.image.description="SIMUS, Sistema de Información de la Música" \
      org.opencontainers.image.authors="Edder Jiménez <edderjimenezg@gmail.com>" \
      org.opencontainers.image.vendor="Fundación El Poliedro" \
      org.opencontainers.image.licenses="Todos los derechos reservados"
WORKDIR /app
COPY --from=publicar /out/ ./
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_FORWARDEDHEADERS_ENABLED=true
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "SIMUS.Api.dll"]
