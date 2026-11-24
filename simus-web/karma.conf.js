// Configuración de Karma para las pruebas de la web.
// Los tiempos son holgados a propósito: con la máquina cargada (varias pilas, colas de validación en paralelo) Chrome sin
// cabeza tardaba en responder y Karma lo daba por desconectado a mitad de la suite («DISCONNECTED»), lo que dejaba pruebas
// rojas al azar. Se tolera la desconexión y se vuelve a conectar en lugar de abortar.
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: { jasmine: {}, clearContext: false },
    reporters: ['progress'],
    browsers: ['ChromeHeadless'],
    browserNoActivityTimeout: 240000,
    browserDisconnectTimeout: 120000,
    browserDisconnectTolerance: 3,
    captureTimeout: 240000,
    restartOnFileChange: true,
  });
};
