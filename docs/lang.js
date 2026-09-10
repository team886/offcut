// No inline script, so the same CSP discipline the extension follows (§17)
// holds on the published page too.
(() => {
  const show = (id) => {
    for (const s of ["en", "tr"]) {
      document.getElementById(s).hidden = s !== id;
      document.getElementById("l-" + s).setAttribute("aria-current", s === id ? "page" : "false");
    }
  };
  for (const s of ["en", "tr"]) {
    document.getElementById("l-" + s).addEventListener("click", (e) => {
      e.preventDefault(); history.replaceState(null, "", "#" + s); show(s);
    });
  }
  const initial = location.hash.slice(1);
  show(initial === "tr" ? "tr" : (navigator.language || "en").startsWith("tr") ? "tr" : "en");
})();
