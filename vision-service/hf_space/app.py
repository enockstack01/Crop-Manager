"""Vision API as a Hugging Face ZeroGPU Space (Gradio). One endpoint: `classify(image, crop)` -> JSON.

The ViT-Large weights live in this Space's `model/` folder. The GPU is attached only while `_logits` runs; ZeroGPU
charges that time to the CALLER's daily quota (call it with gradio_client and an HF token, see README.md).
Calibration, the crop filter and the out-of-distribution check are the same as in logistack/vision_api/main.py.
"""
import json
import os
from pathlib import Path

import gradio as gr
import torch
from PIL import Image, ImageOps
from transformers import ViTForImageClassification, ViTImageProcessor

try:
    import spaces
    gpu = spaces.GPU(duration=30)
except ImportError:                      # running locally without ZeroGPU: plain CPU
    def gpu(fn):
        return fn

HERE = Path(__file__).parent
MODEL = Path(os.environ.get("VIT_PATH", HERE / "model"))
THRESHOLD = float(os.environ.get("CONFIDENCE_THRESHOLD", "0.60"))
DEV = "cuda" if (torch.cuda.is_available()) else "cpu"

proc = ViTImageProcessor.from_pretrained(MODEL)
# ZeroGPU: place the model on cuda at module level (a CUDA emulation is active outside @spaces.GPU functions)
vit = ViTForImageClassification.from_pretrained(MODEL, torch_dtype=torch.float16 if DEV == "cuda" else torch.float32).to(DEV).eval()
card = json.loads((MODEL / "model_card.json").read_text())
T, OOD_FLOOR, VERSION = float(card.get("temperature", 1.0)), card.get("ood_floor"), card["model_version"]
LABELS = {l["key"]: l for l in json.loads((MODEL / "labels.json").read_text(encoding="utf-8"))["labels"]}
ID2LABEL = vit.config.id2label


@gpu
def _logits(img: Image.Image) -> list:
    x = proc(images=img, return_tensors="pt").to(DEV, vit.dtype)
    with torch.inference_mode():
        return vit(**x).logits[0].float().cpu().tolist()


def classify(image: Image.Image, crop: str = "", part: str = "") -> dict:
    if image is None:
        raise gr.Error("Send an image.")
    img = ImageOps.exif_transpose(image).convert("RGB")
    raw = torch.tensor(_logits(img))
    allowed = [i for i in range(len(ID2LABEL)) if (not crop or LABELS[ID2LABEL[i]]["crop"].lower() == crop.lower()) and (not part or LABELS[ID2LABEL[i]]["part"].lower() == part.lower())]
    if not allowed:
        raise gr.Error(f"No classes for crop '{crop}' part '{part}'.")
    probs = (raw[allowed] / T).softmax(0)
    top = probs.topk(min(3, len(allowed)))
    preds = [{"label": ID2LABEL[allowed[i]], "confidence": round(p, 4)} for p, i in zip(top.values.tolist(), top.indices.tolist())]
    unfamiliar = OOD_FLOOR is not None and raw.max().item() < OOD_FLOOR
    out = {"model_version": VERSION, "predictions": preds, "confident": preds[0]["confidence"] >= THRESHOLD and not unfamiliar}
    if unfamiliar:
        out["unrecognised"] = True
    return out


demo = gr.Interface(fn=classify, inputs=[gr.Image(type="pil", label="Plant photo"), gr.Textbox(label="Crop (optional)"), gr.Textbox(label="Part: leaf or fruit (optional)")],
                    outputs=gr.JSON(), api_name="classify", title="Crop Health Detector",
                    description="Screening aid, not a diagnosis.", flagging_mode="never")
demo.queue(max_size=16)

if __name__ == "__main__":
    demo.launch()
