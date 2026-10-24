// Picker state changes and summary chips. No React here, so it is easy to test.
import { chip } from "./i18n";
import type { DietValue, PickerGroup, Preset, Text } from "./types";

const uniq = (xs: string[]) => [...new Set(xs)];
const without = (xs: string[], drop: string[]) => xs.filter((x) => !drop.includes(x));

export const EMPTY_DIET: DietValue = { presets: [], forbid: [], allow: [] };

/** A group is ticked when every one of its tags is forbidden. */
export function isGroupOn(value: DietValue, group: PickerGroup): boolean {
  return group.tags.every((t) => value.forbid.includes(t));
}

export function toggleGroup(value: DietValue, group: PickerGroup): DietValue {
  if (isGroupOn(value, group)) {
    return { ...value, forbid: without(value.forbid, group.tags) };
  }
  return {
    ...value,
    forbid: uniq([...value.forbid, ...group.tags]),
    allow: without(value.allow, group.tags),
  };
}

/**
 * Tapping a preset ticks its tags. Tapping it again takes back only the tags
 * that no other selected preset needs.
 */
export function togglePreset(value: DietValue, preset: Preset, all: Preset[]): DietValue {
  if (!value.presets.includes(preset.id)) {
    const forbid = uniq([...value.forbid, ...preset.forbid]);
    return {
      presets: [...value.presets, preset.id],
      forbid,
      allow: without(uniq([...value.allow, ...preset.allow]), forbid),
    };
  }
  const others = all.filter((p) => p.id !== preset.id && value.presets.includes(p.id));
  const keepForbid = new Set(others.flatMap((p) => p.forbid));
  const keepAllow = others.flatMap((p) => p.allow);
  const forbid = value.forbid.filter((t) => keepForbid.has(t) || !preset.forbid.includes(t));
  // Another preset's "OK" can come back once this one stops forbidding it (vegan off, vegetarian on: dairy OK).
  const allow = uniq([...value.allow.filter((t) => keepAllow.includes(t) || !preset.allow.includes(t)), ...keepAllow]);
  return {
    presets: value.presets.filter((id) => id !== preset.id),
    forbid,
    allow: without(allow, forbid),
  };
}

/** Allergen tags go to Profile.allergens on submit; the rest stay in forbid. */
export function allergensOf(value: DietValue, groups: PickerGroup[]): string[] {
  const tags = groups.filter((g) => g.kind === "allergen").flatMap((g) => g.tags);
  return value.forbid.filter((t) => tags.includes(t));
}

const CORE = ["meat", "seafood", "egg"];

/**
 * Chips for the summary, e.g. "No meat, fish, egg · No onion or garlic · Dairy OK".
 * `tagLabels` names forbidden tags that no group covers (pork, gelatin, ...).
 */
export function summaryChips(
  value: DietValue,
  groups: PickerGroup[],
  tagLabels: Record<string, Text>,
): { id: string; tone: "no" | "ok" | "allergy"; text: Text }[] {
  const out: { id: string; tone: "no" | "ok" | "allergy"; text: Text }[] = [];
  const on = groups.filter((g) => isGroupOn(value, g));
  const diet = on.filter((g) => g.kind === "diet");

  const core = diet.filter((g) => CORE.includes(g.id));
  if (core.length) out.push({ id: "core", tone: "no", text: chip.noCore(core.map((g) => g.id)) });

  for (const g of diet.filter((g) => !CORE.includes(g.id))) {
    out.push({ id: g.id, tone: "no", text: chip.noGroup[g.id] ?? chip.noList([g.labels]) });
  }

  const covered = new Set(groups.flatMap((g) => g.tags));
  const extra = value.forbid.filter((t) => !covered.has(t));
  if (extra.length) {
    out.push({ id: "extra", tone: "no", text: chip.alsoNo(extra.map((t) => tagLabels[t] ?? { en: t })) });
  }

  const allergens = on.filter((g) => g.kind === "allergen");
  if (allergens.length) {
    out.push({ id: "allergy", tone: "allergy", text: chip.allergy(allergens.map((g) => g.labels)) });
  }

  for (const t of value.allow) {
    if (!value.forbid.includes(t) && chip.ok[t]) out.push({ id: `ok-${t}`, tone: "ok", text: chip.ok[t] });
  }
  return out;
}
