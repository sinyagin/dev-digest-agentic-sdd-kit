// Selected plugins for the install builder, kept in localStorage when available.
const KEY = "sddkit.install.v1";
const EVENT = "sddkit:install";
let memory: string[] = [];

export function getSelected(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((p) => typeof p === "string");
    }
    return raw === null ? memory : [];
  } catch {
    return memory;
  }
}

export function setSelected(plugins: string[]): void {
  memory = [...new Set(plugins)].sort();
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: memory }));
}

export function toggleSelected(plugin: string, on = !getSelected().includes(plugin)): void {
  const current = getSelected().filter((p) => p !== plugin);
  setSelected(on ? [...current, plugin] : current);
}

export function onSelectedChange(fn: (plugins: string[]) => void): void {
  window.addEventListener(EVENT, () => fn(getSelected()));
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) fn(getSelected());
  });
}
