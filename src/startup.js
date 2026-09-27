/* Independent, conservative-syntax diagnostics: must load before the solver. */
(function () {
  function show(message) {
    var box = document.getElementById('startupError');
    if (!box || !box.hidden) return;
    box.hidden = false;
    box.textContent = 'Startup error: ' + message + '\nBrowser: ' + navigator.userAgent;
  }
  window.addEventListener('error', function (event) {
    if (window.TE_APP_READY) return;
    if (event.target && event.target.tagName === 'SCRIPT') {
      show('Could not load ' + event.target.src + '. Extract the entire ZIP, including the assets folder.');
    } else {
      show((event.message || 'Unknown script error') + ' — ' + (event.filename || '') + ':' + (event.lineno || ''));
    }
  }, true);
  window.addEventListener('load', function () {
    if (!window.TE_APP_READY && document.getElementById('startupError').hidden) show('The application did not initialize. Keep index.html and assets together.');
  });
}());
