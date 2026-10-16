// A classic script, so a browser too old for the app's modules still reads this.
(function () {
  var supported = true;
  try {
    new RegExp("(?<!a)b");
  } catch (e) {
    supported = false;
  }
  if (!window.indexedDB) {
    supported = false;
  }
  if (!supported) {
    window.__unsupported = true;
    document.addEventListener("DOMContentLoaded", function () {
      var app = document.getElementById("app");
      if (app) {
        app.textContent =
          "Tortoise Spelling needs Safari 16.4 or newer, or a current Chrome, Edge or Firefox.";
      }
    });
  }
})();
