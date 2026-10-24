// Every string the recipe check shows. The kitchen is in Tokyo, so English and Japanese.
import type { Text } from "@/lib/types"

export const s = {
  eyebrow: { en: "Caterer · dishes cooked in Japan for the Tokyo → Delhi leg", ja: "機内食会社・東京発デリー行きの日本調理メニュー" },
  title: { en: "Recipe check", ja: "レシピチェック" },
  subtitle: {
    en: "Upload a Japanese recipe sheet. We read every ingredient, our rules decide which diets it suits, and a person approves it.",
    ja: "日本語のレシピを読み込みます。すべての食材を読み取り、ルールで各食事制限への適否を判定し、担当者が承認します。",
  },
  upload: { en: "Add a recipe sheet", ja: "レシピを追加" },
  drop: { en: "Drop a photo of the sheet here, or choose a file", ja: "レシピの写真をここにドロップ、またはファイルを選択" },
  chooseFile: { en: "Choose photo", ja: "写真を選択" },
  photoTypes: { en: "PNG, JPEG or WebP, up to 8 MB", ja: "PNG・JPEG・WebP、8 MBまで" },
  orPaste: { en: "Or paste the sheet's text", ja: "またはレシピの文章を貼り付け" },
  pastePlaceholder: { en: "料理名：…\n材料\n・…", ja: "料理名：…\n材料\n・…" },
  check: { en: "Check text", ja: "文章をチェック" },
  reading: { en: "Reading the sheet", ja: "読み取り中" },
  demo: { en: "Demo sheets", ja: "デモ用レシピ" },
  history: { en: "Checked sheets", ja: "チェック済みのレシピ" },
  noSheets: { en: "Nothing checked yet. Add a sheet above, or try a demo sheet.", ja: "まだありません。上から追加するか、デモ用レシピを試してください。" },
  pickOne: { en: "Pick a sheet on the left, or add one, to see what's in it.", ja: "左のレシピを選ぶか追加すると、内容が表示されます。" },
  verdicts: { en: "Who can eat it", ja: "食事制限ごとの判定" },
  sheet: { en: "The sheet", ja: "レシピ" },
  photo: { en: "Photo", ja: "写真" },
  asRead: { en: "Text as read", ja: "読み取った文章" },
  ingredients: { en: "Ingredients", ja: "食材" },
  colJa: { en: "Japanese", ja: "日本語" },
  colEn: { en: "English", ja: "英語" },
  colTags: { en: "Rule tags", ja: "ルールのタグ" },
  colConf: { en: "Sure", ja: "確度" },
  colEvidence: { en: "Read from", ja: "根拠" },
  unread: { en: "Not recognised: a person checks it", ja: "未判別：担当者が確認" },
  modelOffline: { en: "Model offline: dictionary only", ja: "モデル停止中：辞書のみ" },
  cached: { en: "From cache", ja: "キャッシュ" },
  approvedBy: { en: "Approved by", ja: "承認者" },
  approve: { en: "Approve as a meal spec", ja: "機内食仕様として承認" },
  approving: { en: "Approving", ja: "承認中" },
  approved: { en: "Approved", ja: "承認済み" },
  unsafeFor: { en: "Unsafe for {n}", ja: "{n}件で不適合" },
  needsReview: { en: "Needs review", ja: "確認待ち" },
  specMade: { en: "Meal spec {id} is ready for the matcher and crew.", ja: "機内食仕様 {id} をマッチングと乗務員向けに登録しました。" },
  rulesNote: {
    en: "The model only reads the sheet. These verdicts come from our rules, and each names the rule that fired.",
    ja: "モデルは読み取りのみを行います。判定はルールによるもので、適用されたルールを表示します。",
  },
} satisfies Record<string, Text>

export const ENGINE: Record<string, Text> = {
  dictionary: { en: "Dictionary", ja: "辞書" },
  gemini: { en: "Gemini", ja: "Gemini" },
  "dictionary+gemini": { en: "Dictionary + Gemini", ja: "辞書 + Gemini" },
}
