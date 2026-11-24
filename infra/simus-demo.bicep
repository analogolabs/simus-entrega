// SIMUS main — entorno DEMO independiente.
// Frontend Angular y API .NET se sirven desde el mismo origen para preservar las cookies.
// El plan F1 y la base SQL gratuita mantienen el consumo inicial en cero.

targetScope = 'resourceGroup'

@minLength(3)
@maxLength(40)
param nombreDelSitio string

param ubicacion string = resourceGroup().location

@allowed([
  'F1'
  'B1'
  'P0v4'
])
param skuDelPlan string = 'F1'

@description('Nombre de la base demo. No use una base institucional ni de integracion.')
param nombreDeBase string = 'simus_demo'

@description('Administrador SQL exclusivo de la demo.')
param usuarioSql string

@secure()
@description('Se entrega solo al despliegue; no se versiona.')
param claveSql string

@description('IP temporal para una migracion manual. Vacia por defecto.')
param ipDeAdministracion string = ''

param etiquetas object = {
  proyecto: 'SIMUS'
  ambiente: 'demo'
  propietario: 'AnalogoLabs'
  costo: 'free-first'
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'plan-${nombreDelSitio}'
  location: ubicacion
  tags: etiquetas
  sku: {
    name: skuDelPlan
    tier: skuDelPlan == 'F1' ? 'Free' : (skuDelPlan == 'B1' ? 'Basic' : 'PremiumV4')
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource servidorSql 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: 'sql-${nombreDelSitio}'
  location: ubicacion
  tags: etiquetas
  properties: {
    administratorLogin: usuarioSql
    administratorLoginPassword: claveSql
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

resource baseDeDatos 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: servidorSql
  name: nombreDeBase
  location: ubicacion
  tags: etiquetas
  sku: {
    name: 'GP_S_Gen5_2'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 2
  }
  properties: {
    collation: 'Modern_Spanish_CI_AI'
    maxSizeBytes: 34359738368
    autoPauseDelay: 60
    minCapacity: json('0.5')
    requestedBackupStorageRedundancy: 'Local'
    useFreeLimit: true
    freeLimitExhaustionBehavior: 'AutoPause'
  }
}

resource sitio 'Microsoft.Web/sites@2023-12-01' = {
  name: nombreDelSitio
  location: ubicacion
  tags: etiquetas
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      alwaysOn: skuDelPlan != 'F1'
      http20Enabled: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      numberOfWorkers: 1
      appSettings: [
        {
          // Demo = misma seguridad que Production (appsettings.Demo.json la replica) y además
          // permite operar sin correo confirmado, porque la demo no envía correos.
          name: 'ASPNETCORE_ENVIRONMENT'
          value: 'Demo'
        }
        {
          name: 'Cors__AllowedOrigins__0'
          value: 'https://${nombreDelSitio}.azurewebsites.net'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
        {
          name: 'WEBSITE_DISABLE_OVERLAPPED_RECYCLING'
          value: '1'
        }
        {
          name: 'Security__RutaDeClaves'
          value: '/home/simus-claves'
        }
      ]
      connectionStrings: [
        {
          name: 'SqlServer'
          type: 'SQLAzure'
          connectionString: 'Server=tcp:${servidorSql.properties.fullyQualifiedDomainName},1433;Initial Catalog=${baseDeDatos.name};User ID=${usuarioSql};Password=${claveSql};Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;'
        }
      ]
    }
  }
}

// Las IPs de salida se asignan DESPUES de crear el sitio y Bicep no puede usarlas
// en un bucle del mismo despliegue. Esta regla permite el primer arranque desde Azure;
// configurar-acceso-sql-demo.sh la reemplaza de inmediato por las IPs exactas del sitio.
resource reglaDeArranque 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: servidorSql
  name: 'AzureServicesBootstrap'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource reglaDeAdministracion 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = if (!empty(ipDeAdministracion)) {
  parent: servidorSql
  name: 'AdministracionTemporal'
  properties: {
    startIpAddress: ipDeAdministracion
    endIpAddress: ipDeAdministracion
  }
}

output direccionDelSitio string = 'https://${sitio.properties.defaultHostName}'
output nombreDelServidorSql string = servidorSql.name
output servidorDeBaseDeDatos string = servidorSql.properties.fullyQualifiedDomainName
output nombreDeLaBase string = baseDeDatos.name
output ipsDeSalidaDelSitio string = sitio.properties.outboundIpAddresses
