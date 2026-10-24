import { describe, expect, it } from "vitest";
import { allergensOf, EMPTY_DIET, isGroupOn, summaryChips, toggleGroup, togglePreset } from "./diet";
import { pick } from "./i18n";
import { MOCK_PICKER_GROUPS as groups, MOCK_PRESETS as presets, MOCK_TAG_LABELS as labels } from "./mock";

const preset = (id: string) => presets.find((p) => p.id === id)!;
const group = (id: string) => groups.find((g) => g.id === id)!;
const ticked = (v: typeof EMPTY_DIET) => groups.filter((g) => isGroupOn(v, g)).map((g) => g.id);

describe("DietPicker state", () => {
  it("Jain ticks meat, fish, egg, onion/garlic, root vegetables and honey", () => {
    const v = togglePreset(EMPTY_DIET, preset("jain"), presets);
    expect(ticked(v)).toEqual(["meat", "seafood", "egg", "onion_garlic", "root_veg", "honey"]);
    expect(v.allow).toEqual(["dairy"]);
  });

  it("unticking a group after a preset keeps the preset and drops only that group", () => {
    let v = togglePreset(EMPTY_DIET, preset("jain"), presets);
    v = toggleGroup(v, group("honey"));
    expect(v.presets).toEqual(["jain"]);
    expect(ticked(v)).not.toContain("honey");
    expect(ticked(v)).toContain("root_veg");
  });

  it("tapping a preset again takes back only its own tags", () => {
    let v = togglePreset(EMPTY_DIET, preset("vegetarian"), presets);
    v = togglePreset(v, preset("no_onion_garlic"), presets);
    v = togglePreset(v, preset("no_onion_garlic"), presets);
    expect(ticked(v)).toEqual(["meat", "seafood", "egg"]);
  });

  it("vegan off brings back dairy OK from vegetarian", () => {
    let v = togglePreset(EMPTY_DIET, preset("vegetarian"), presets);
    v = togglePreset(v, preset("vegan"), presets);
    expect(v.allow).not.toContain("dairy");
    v = togglePreset(v, preset("vegan"), presets);
    expect(v.forbid).not.toContain("dairy");
    expect(v.allow).toContain("dairy");
  });

  it("ticking dairy removes it from allow", () => {
    let v = togglePreset(EMPTY_DIET, preset("vegetarian"), presets);
    v = toggleGroup(v, group("dairy"));
    expect(v.allow).not.toContain("dairy");
  });

  it("allergen tags are split out for the profile", () => {
    let v = togglePreset(EMPTY_DIET, preset("vegetarian"), presets);
    v = toggleGroup(v, group("peanut"));
    expect(allergensOf(v, groups)).toEqual(["peanut"]);
  });
});

describe("DietSummary chips", () => {
  it("Priya: vegetarian + no onion or garlic", () => {
    let v = togglePreset(EMPTY_DIET, preset("vegetarian"), presets);
    v = togglePreset(v, preset("no_onion_garlic"), presets);
    const chips = summaryChips(v, groups, labels);
    expect(chips.map((c) => pick(c.text, "en")).join(" · ")).toBe("No meat, fish, egg · No onion or garlic · Dairy OK");
    expect(chips.map((c) => pick(c.text, "ja"))[0]).toBe("肉・魚・卵なし");
    expect(chips.map((c) => pick(c.text, "hi"))[0]).toBe("मांस, मछली, अंडा नहीं");
  });

  it("halal lists tags no group covers", () => {
    const v = togglePreset(EMPTY_DIET, preset("halal"), presets);
    const en = summaryChips(v, groups, labels).map((c) => pick(c.text, "en"));
    expect(en).toEqual(["No alcohol", "Also no pork, lard, gelatin"]);
  });
});
