import io
import json
from pathlib import Path

import torch
import torch.nn as nn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from torchvision import transforms
from torchvision.models import efficientnet_v2_s

BASE = Path(__file__).parent / "models"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Valeurs issues du notebook / rapport
IMG_SIZE = 256
MEAN, STD = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]
TEMPERATURE = 1.166
CONF_THRESHOLD = 0.60
HIGH_RISK_KEYWORDS = ["malignant", "melanoma", "lupus", "vasculitis", "cellulitis",
                      "bullous", "systemic", "exanthems", "vascular tumors"]

class_names = json.loads((BASE / "class_names.json").read_text(encoding="utf-8"))
NUM_CLASSES = len(class_names)

eval_tf = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(MEAN, STD),
])


def load_model(path: Path) -> nn.Module:
    m = efficientnet_v2_s(weights=None)
    m.classifier = nn.Sequential(
        nn.Dropout(0.3), nn.Linear(m.classifier[1].in_features, NUM_CLASSES)
    )
    m.load_state_dict(torch.load(path, map_location=DEVICE))
    return m.to(DEVICE).eval()


MODELS = [load_model(BASE / "best_effv2s.pt"), load_model(BASE / "best_effv2s_mix.pt")]


def needs_doctor(name: str) -> bool:
    return any(k in name.lower() for k in HIGH_RISK_KEYWORDS)


app = FastAPI(title="CardioDerma AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "classes": NUM_CLASSES, "device": str(DEVICE)}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        img = Image.open(io.BytesIO(await file.read())).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="Image invalide ou corrompue")

    x = eval_tf(img).unsqueeze(0).to(DEVICE)
    with torch.inference_mode():
        # TTA (miroir) + ensemble des 2 modèles, comme dans le notebook
        logits = torch.stack([
            (m(x).float() + m(torch.flip(x, dims=[3])).float()) / 2 for m in MODELS
        ]).mean(0)

    probs = (logits / TEMPERATURE).softmax(1)[0].cpu()
    top_p, top_i = probs.topk(3)
    best, conf = class_names[top_i[0]], top_p[0].item()

    if conf < CONF_THRESHOLD:
        reco, reason = "consultation", "Confiance faible : avis médical recommandé"
    elif needs_doctor(best):
        reco, reason = "consultation", "Pathologie nécessitant un avis médical"
    else:
        reco, reason = "conseil", "Cas simple : conseils généraux"

    return {
        "prediction": best,
        "confidence": round(conf, 3),
        "top3": [{"class": class_names[i], "prob": round(p.item(), 3)}
                 for p, i in zip(top_p, top_i)],
        "recommendation": reco,
        "reason": reason,
        "disclaimer": "Aide à l'orientation, ne constitue pas un diagnostic médical.",
    }