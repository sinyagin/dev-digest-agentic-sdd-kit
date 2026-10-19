/** Joins a site-relative path onto the configured base (e.g. "/dev-digest-agentic-sdd-kit/"). */
export function withBase(path = ""): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  return base + path.replace(/^\//, "");
}
