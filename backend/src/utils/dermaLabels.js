const LABELS_FR = {
  melanoma: "Mélanome",
  nevus: "Nævus (grain de beauté)",
  basal_cell_carcinoma: "Carcinome basocellulaire",
  actinic_keratosis: "Kératose actinique",
  benign_keratosis: "Kératose bénigne",
  dermatofibroma: "Dermatofibrome",
  vascular_lesion: "Lésion vasculaire",
};

export function labelFr(key) {
  return LABELS_FR[key] ?? key;
}