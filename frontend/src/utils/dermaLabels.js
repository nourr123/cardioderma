const LABELS_FR = {
  "acne and rosacea": "Acné et rosacée",
  "actinic keratosis basal cell carcinoma and other malignant lesions":
    "Kératose actinique, carcinome basocellulaire et autres lésions malignes",
  "atopic dermatitis": "Dermatite atopique",
  "bullous disease": "Maladies bulleuses",
  "cellulitis impetigo and other bacterial infections":
    "Cellulite infectieuse, impétigo et autres infections bactériennes",
  eczema: "Eczéma",
  "exanthems and drug eruptions": "Exanthèmes et éruptions médicamenteuses",
  "hair loss photos alopecia and other hair diseases":
    "Chute de cheveux, alopécie et autres maladies du cheveu",
  "herpes hpv and other stds photos": "Herpès, HPV et autres IST",
  "light diseases and disorders of pigmentation":
    "Maladies de la lumière et troubles de la pigmentation",
  "lupus and other connective tissue diseases":
    "Lupus et autres maladies du tissu conjonctif",
  "melanoma skin cancer nevi and moles": "Mélanome, nævus et grains de beauté",
  "nail fungus and other nail disease": "Mycose et autres maladies des ongles",
  "poison ivy photos and other contact dermatitis":
    "Dermatite de contact (herbe à puce et autres)",
  "psoriasis pictures lichen planus and related diseases":
    "Psoriasis, lichen plan et maladies apparentées",
  "scabies lyme disease and other infestations and bites":
    "Gale, maladie de Lyme et autres infestations et piqûres",
  "seborrheic keratoses and other benign tumors":
    "Kératoses séborrhéiques et autres tumeurs bénignes",
  "systemic disease": "Maladies systémiques",
  "tinea ringworm candidiasis and other fungal infections":
    "Teigne, candidose et autres infections fongiques",
  "urticaria hives": "Urticaire",
  "vascular tumors": "Tumeurs vasculaires",
  "vasculitis photos": "Vascularites",
  "warts molluscum and other viral infections":
    "Verrues, molluscum et autres infections virales",
};

// Mots-clés de repli si le nom exact ne correspond pas
const KEYWORDS_FR = [
  ["melanoma", "Mélanome et lésions pigmentées"],
  ["malignant", "Lésions malignes"],
  ["acne", "Acné et rosacée"],
  ["atopic", "Dermatite atopique"],
  ["eczema", "Eczéma"],
  ["psoriasis", "Psoriasis et maladies apparentées"],
  ["urticaria", "Urticaire"],
  ["fungal", "Infection fongique"],
  ["nail", "Maladie des ongles"],
  ["wart", "Infection virale (verrues)"],
  ["lupus", "Lupus et maladies du tissu conjonctif"],
  ["vasculitis", "Vascularite"],
  ["vascular", "Tumeur vasculaire"],
  ["bullous", "Maladie bulleuse"],
  ["hair", "Maladie du cheveu"],
  ["scabies", "Infestation ou piqûre"],
  ["bacterial", "Infection bactérienne"],
  ["benign", "Tumeur bénigne"],
  ["pigmentation", "Trouble de la pigmentation"],
  ["systemic", "Maladie systémique"],
  ["exanthem", "Éruption cutanée"],
  ["herpes", "Herpès et IST"],
  ["poison", "Dermatite de contact"],
];

const normalize = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function labelFr(key) {
  if (!key) return "";
  const n = normalize(key);
  if (LABELS_FR[n]) return LABELS_FR[n];
  const hit = KEYWORDS_FR.find(([k]) => n.includes(k));
  if (hit) return hit[1];
  return String(key).replace(/_/g, " ");
}