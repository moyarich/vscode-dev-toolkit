const content = document.querySelector("#content");
const nav = document.querySelector("#navigation");
const search = document.querySelector("#search");
const pages = await fetch("./registry.json").then((r) => {
  if (!r.ok) throw Error("Failed to load content");
  return r.json();
});
const escape = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
function format(line) {
  return escape(line).replace(/`([^`]+)`/g, "<code>$1</code>");
}
function markdown(source) {
  let code = false;
  return source
    .split("\n")
    .map((line) => {
      if (line.startsWith("```")) {
        code = !code;
        return code ? "<pre><code>" : "</code></pre>";
      }
      if (code) return escape(line) + "\n";
      const match = /^(#{1,3}) (.*)$/.exec(line);
      if (match)
        return (
          "<h" +
          match[1].length +
          ">" +
          format(match[2]) +
          "</h" +
          match[1].length +
          ">"
        );
      if (line.startsWith("- "))
        return "<p>• " + format(line.slice(2)) + "</p>";
      return line.trim() ? "<p>" + format(line) + "</p>" : "";
    })
    .join("\n");
}
let active = new URLSearchParams(location.search).get("page") || pages[0]?.id;
function render() {
  const selected = pages.find((p) => p.id === active) || pages[0];
  nav.replaceChildren();
  for (const group of [...new Set(pages.map((p) => p.group))]) {
    const title = document.createElement("h2");
    title.textContent = group;
    nav.append(title);
    for (const page of pages.filter(
      (p) =>
        p.group === group &&
        (p.title + " " + p.id)
          .toLowerCase()
          .includes(search.value.toLowerCase()),
    )) {
      const button = document.createElement("button");
      button.textContent = page.title;
      button.setAttribute(
        "aria-current",
        page.id === selected?.id ? "page" : "false",
      );
      button.onclick = () => {
        active = page.id;
        history.pushState({}, "", "?page=" + encodeURIComponent(active));
        render();
      };
      nav.append(button);
    }
  }
  if (!selected) {
    content.textContent = "No pages found.";
    return;
  }
  if (selected.type === "html") {
    content.replaceChildren();
    const h = document.createElement("h1");
    h.textContent = selected.title;
    const frame = document.createElement("iframe");
    frame.title = selected.title;
    frame.src = "./" + selected.url;
    frame.setAttribute("sandbox", "allow-scripts");
    frame.className = "preview";
    content.append(h, frame);
  } else content.innerHTML = markdown(selected.content);
}
window.addEventListener("popstate", () => {
  active = new URLSearchParams(location.search).get("page") || pages[0]?.id;
  render();
});
search.addEventListener("input", render);
render();
