# Fruit counter (Python and OpenCV)

A small web service that counts the fruit visible in a plant photo. CropManager's server sends it the photo and the fruit colours of the
crop and compares the number it returns with the number the farmer recorded.

```
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8090      # http://localhost:8090/health
python -m pytest tests                          # builds test photos with a known number of fruit and counts them
```

Settings: `FRUIT_COUNTER_TOKEN` (optional): when set, requests must send it as the `X-Token` header. Set the same value in the CropManager server.
In the CropManager server set `FRUIT_COUNTER_URL` (for example `https://your-counter.onrender.com`) and, if used, `FRUIT_COUNTER_TOKEN`.

Limits: a photo larger than 25 MB, a set of photos for the overlap check larger than 80 MB in all, or a picture with more than 80 million pixels is refused with a plain message (a small file can unpack to a huge picture and exhaust the memory). Without `FRUIT_COUNTER_TOKEN` anyone who knows the address can use the counter, so always set it in production; the service prints a warning at start-up when it is missing. The token is compared in constant time.

Deploy: a Docker web service from this folder (see `Dockerfile`). See `docs/GREENHOUSE.md` for how the whole feature fits together.

## What it is and is not

Classical computer vision, no trained model: colour segmentation in HSV space, clean-up, then splitting of touching fruit. It counts fruit
it can SEE and that stand out from the leaves. It does not see fruit hidden behind leaves, and it cannot tell green fruit from green leaves
reliably, so those photos come back with `confidence: low` and the server reports the check as "inconclusive".
