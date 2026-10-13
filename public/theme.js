// Runs before the page is drawn, so a dark device never flashes the light theme and Arabic never
// flashes left to right. Reads the same preferences as src/app/document-sync.tsx, which takes over
// once the app has started.
(function () {
  var html = document.documentElement;
  try {
    var theme = localStorage.getItem("m2.theme");
    var dark = theme === "dark" || (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    html.dataset.theme = dark ? "dark" : "light";
    var lang = localStorage.getItem("m2.uiLang");
    if (lang) {
      html.lang = lang;
      html.dir = lang === "ar" ? "rtl" : "ltr";
    }
  } catch {
    // Storage blocked: the app sets these itself once it starts.
  }
})();
