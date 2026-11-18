# Greenhouse tab and the fruit counter

A farmer chooses the greenhouse crops they grow, then records the fruit on a plant with a **photo**, a **row ID** and the **number of fruit**.
The photo is counted by a Python and OpenCV service and the result is compared with the number the farmer recorded.

## What the farmer sees

| Where | What |
| --- | --- |
| Greenhouse > My crops | Ten greenhouse crops ready to tick (cherry tomato, tomato, sweet pepper, hot pepper, cucumber, eggplant, strawberry, zucchini, melon, green beans), and a form to add their own crop with its fruit colours. |
| Greenhouse > Fruit counts | A list of counts, and "Add a fruit count": crop, greenhouse, **row ID**, plant, date, **number of fruit**, **photo**. A "Check the photo" button shows the result before saving. |
| Greenhouse > Dashboard | Fruit counted, plants counted, average fruit per plant, share of photos that agree; fruit by crop; average per plant week by week; rows; photos that do not match; rows not counted for a week. |

Both the website (`/greenhouse`) and the phone app (menu and home shortcut) have it.

## Greenhouse layout, 3D view and recording on the plan

The manager sets up each greenhouse once under **Greenhouse > Layout**: its name, length and width in metres, the number of rows, the plants in each row, the main crop, and optionally a different crop for some rows. The system then creates a place for every plant, named like `R3 P7` (row 3, plant 7), with a position inside the house.

- **Website:** a 3D greenhouse (three.js): the house, a bed for each row, and every plant. A marker on each plant is coloured by the result of its last photo check, or by how much fruit it has, and is bigger when there is more fruit. Drag to turn, scroll to zoom, click a plant to see its counts, photos and checks. Plants are drawn like the real crops: tomato compound leaves, lobed cucumber, zucchini and melon leaves, trifoliate bean and strawberry leaves, flowers, support poles for climbing crops and a drip line on every bed. On-screen controls: move (arrows), turn, tilt, zoom, slow spin and full screen; keyboard: arrows or W A S D move, Q and E turn, R and F tilt, plus and minus zoom (click the view first); mouse drag turns, wheel zooms, right-drag moves, and touch drag and pinch work. A flat **Plan** view of the same layout is also there (and is used automatically when the browser has no 3D).
- **Recording:** switch from *Look* to *Record* and click the plant you are standing at: the fruit count form opens already filled with the greenhouse, row and plant. The agronomist uses the same view as the manager.
- **Phone:** the same layout as a plan (rows and plants as coloured squares) with the same look and record modes. The phone does not draw the 3D view.
- **Not automatic:** plant positions come from the layout the manager enters. They are not found from photos, because a photo does not say where in the house it was taken.
- A count belongs to a plant when it has the same greenhouse name, row ID and plant. Counts recorded before a layout existed keep working and appear on the matching plant. Removing a layout never deletes counts.

## Disease check, health card and health history

Every checked photo is also sent to the disease classifier (ViT-L) that the rest of the app uses, for the crop of the count.

- **Plant level (always, when the classifier is on):** the whole photo is classified: healthy, a named disease with its confidence and the other likely ones, or not sure. This is what the classifier was trained for.
- **Fruit level (only where it is valid):** each counted fruit is cut out of the photo and classified, and the fruit judged diseased get a dashed red ring and a ! on the marked photo and are listed by number on the health card. The classifier knows fruit (not only leaves) for banana, mango and papaya only. For tomato, peppers, cucumber, eggplant, strawberry, zucchini and beans it was trained on leaves, so the card says so and does **not** call single fruit sick or healthy. Judging single fruit of those crops needs a fruit-disease model trained on labelled fruit photos, which does not exist yet.
- **Health card and history:** clicking a plant shows its latest health card and a list of earlier checks with the disease and how many fruit were sick; the 3D view and plan can be coloured by health; the layout summary counts plants with possible disease; the assistant can answer "which plants have disease?".

## Asking in plain words

The chat assistant can read the greenhouse: "how many fruit on row 3 plant 7 in House 1?", "which plants have not been counted this week?", "which photos did not match?", "which plants have the most fruit?". It uses a read-only tool (`greenhouse_info`) scoped to the signed-in farmer.

## The verdict on each photo

| Verdict | Meaning |
| --- | --- |
| Matches | The photo shows exactly the number recorded. |
| Close | Within one fruit (up to 10 fruit), then within 10 per cent. |
| Does not match | The photo clearly shows a different number. The message says whether there is more or less fruit in the photo. |
| Not sure | The counter itself is not sure (green fruit among green leaves, a blurry or dark photo, a background the colour of the fruit). It neither confirms nor contradicts the record, and says why. |
| Not checked | The fruit counter is not connected. The record is saved. |
| Check failed | The counter could not be reached or could not read the photo. The record is saved and can be checked again from its page. |

Every checked photo also comes back with a copy of the photo with a ring and a number on every fruit that was counted, so the farmer can see exactly what the counter saw.

## How it fits together

```
phone / website  -->  CropManager server (/api/greenhouse)  -->  fruit counter (vision-service, Python + OpenCV)
                       stores crops, counts, verdicts             counts the fruit in the photo
```

- `vision-service/` is the counter: FastAPI, OpenCV, NumPy. It has its own tests (`python -m pytest vision-service/tests`) and a `Dockerfile`.
- The server decides the verdict (`server/src/lib/greenhouse/verify.js`), stores the data (`greenhouse.models.js`) and serves the dashboard.
- Everything is the signed-in farmer's own: a photo must be one they uploaded, a crop must be one of theirs, and the dashboard only sums their records.

## Setting it up

1. **Run the counter.** Locally: `cd vision-service && pip install -r requirements.txt && uvicorn app:app --port 8090`. In production: a Docker web service on Render from the `vision-service` folder (it listens on `$PORT`).
2. **Tell the server where it is.** On the CropManager server set `FRUIT_COUNTER_URL` (for example `https://cropmanager-counter.onrender.com`). Optional shared secret: set `FRUIT_COUNTER_TOKEN` to the same value on both.
3. Without `FRUIT_COUNTER_URL` the tab still works: photos are saved, and every record says "Not checked: the fruit counter is not connected".

Optional: `GREENHOUSE_CHECKS_PER_MINUTE` (default 20) limits photo checks per farmer per minute, because each check runs the counter.

A free Render service sleeps when idle, so the first check after a quiet spell can take up to a minute. The apps wait up to 90 seconds.

## How accurate it is, honestly

The counter is classical computer vision (colour segmentation, then splitting of touching fruit), not a trained model.

- On **drawn test photos** with a known number of fruit it counted exactly in 97 to 100 per cent of cases and was never off by more than one, except one 4-fruit undercount on a very crowded photo.
- On **real photos with no fruit** (about 180 diseased-leaf and field photos) it counted no fruit in 88 per cent of photos for red fruit (on average 0.4 per photo); for orange and yellow fruit colours it wrongly found fruit in about 40 per cent of such photos, mostly dry leaves and soil, on average 5 per photo. This is why a photo whose background is mostly fruit-coloured is reported as "not sure".
- It has **not yet been measured on real greenhouse photos with a known count**: none were available. Before relying on it, take 20 to 30 photos of plants where you have counted the fruit by hand and compare. Adjusting the colour ranges in `vision-service/fruitcount/counter.py` for your crops and lighting is the first thing to do if it over- or under-counts.
- It counts fruit it can **see**. Fruit hidden behind leaves or behind other fruit cannot be counted, so "fewer than recorded" is often a hidden-fruit problem, not a recording mistake. The message says so.
- Green fruit on green plants (cucumber, zucchini, green beans, unripe tomatoes) cannot be told from leaves reliably. They are marked "photo check not conclusive" and always get a "not sure" verdict.

## The trained fruit model (YOLO11x)

`vision-service/training/train_kaggle.py` fine-tunes YOLO11x on labelled public datasets (boxes on every fruit) for nine classes: tomato, sweet pepper, hot pepper, cucumber, eggplant, strawberry, zucchini, melon, green bean. It runs on Kaggle (see `kernel-metadata.json`). When its weights are placed at `vision-service/models/fruit_yolo11x.pt` (or `FRUIT_YOLO_WEIGHTS`) and `ultralytics` is installed (`requirements-yolo.txt`), the counter uses it for those crops and falls back to colour counting for any other crop or if the model fails. The result says which method counted (`method`). The model needs a few GB of memory: it will not run on the smallest free hosting.
