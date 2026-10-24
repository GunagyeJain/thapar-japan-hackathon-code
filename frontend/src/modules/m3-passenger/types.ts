// Shapes from shared/api.md that m3 reads. Field names match the API exactly.

export type Lang = "en" | "hi" | "ja";
export type Text = { en: string; hi?: string; ja?: string };

export type Preset = { id: string; labels: Text; forbid: string[]; allow: string[] };

export type PickerGroup = {
  id: string;
  kind: "diet" | "allergen";
  labels: Text;
  tags: string[];
};

export type CodeOption = {
  code: string;
  recommended: boolean;
  safety_gaps: string[];
  preference_losses: string[];
  kitchen_note: string | null;
  label_mark: Text;
  why: Text;
};

export type BookingCheck = {
  ok: boolean;
  problem?: { contains: string[]; message: Text };
  suggested_code?: string;
};

/** What DietPicker edits. `forbid` also holds allergen tags; they are split out on submit. */
export type DietValue = { presets: string[]; forbid: string[]; allow: string[] };

export type Consent = {
  this_trip: boolean;
  save_profile: boolean;
  share_with_caterer: boolean;
  cross_border_ack: boolean;
  at?: string;
};
