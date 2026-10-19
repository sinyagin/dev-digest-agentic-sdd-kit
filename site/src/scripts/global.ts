// Behaviour shared by every page: copy buttons, "Add plugin" buttons, install counter.
import { getSelected, onSelectedChange, toggleSelected } from "../install/store";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export function syncAddButtons(selected = getSelected()): void {
  document.querySelectorAll<HTMLButtonElement>("[data-add-plugin]").forEach((btn) => {
    const on = selected.includes(btn.dataset.addPlugin!);
    btn.setAttribute("aria-pressed", String(on));
    btn.textContent = on ? "✓ Added" : btn.dataset.label ?? "+ Add plugin";
  });
  const count = document.getElementById("install-count");
  if (count) {
    count.textContent = String(selected.length);
    count.hidden = selected.length === 0;
  }
}

document.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;

  const copy = target.closest<HTMLButtonElement>("[data-copy], [data-copy-from]");
  if (copy && !copy.disabled) {
    const source = copy.dataset.copyFrom ? document.getElementById(copy.dataset.copyFrom)?.textContent : copy.dataset.copy;
    if (source == null) return;
    const label = copy.textContent;
    copy.textContent = (await copyText(source)) ? "Copied" : "Copy failed";
    setTimeout(() => (copy.textContent = label), 1500);
    return;
  }

  const add = target.closest<HTMLButtonElement>("[data-add-plugin]");
  if (add) toggleSelected(add.dataset.addPlugin!);
});

onSelectedChange(syncAddButtons);
syncAddButtons();
