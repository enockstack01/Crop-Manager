---
title: Crop Health Detector
emoji: 🌿
colorFrom: green
colorTo: yellow
sdk: gradio
sdk_version: 5.49.1
app_file: app.py
pinned: false
---

Crop disease classifier (ViT-Large-384, 229 classes). API endpoint: `/classify`.

```python
from gradio_client import Client, handle_file
r = Client("USER/crop-health-detector", token="hf_...").predict(handle_file("leaf.jpg"), "Maize", api_name="/classify")
```
Screening aid, not a diagnosis.
