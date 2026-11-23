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
- **Phone:** the same plan, drawn to scale (door, compass, sub rows, patterns) with zoom buttons, and the same look and record modes. The phone does not draw the 3D view.
- **Not automatic:** plant positions come from the layout the manager enters. They are not found from photos, because a photo does not say where in the house it was taken.
- A count belongs to a plant when it has the same greenhouse name, row ID and plant. Counts recorded before a layout existed keep working and appear on the matching plant. Removing a layout never deletes counts.

## Shape of the house, plant positions, photos and sizes

**The shape of a greenhouse** (Greenhouse > Layout, owner only). Besides the size, each row can have its own number of positions, can start further along the house, and can be a **double row**: two sub rows, A and B, side by side on the same line (named `R3A P1`, `R3B P1`). The owner sets which way the top wall of the plan faces (compass degrees, with a red N on the plan and in 3D), where the **door** is (wall, place along the wall, width) and how the plants stand: **grid**, **zig-zag** (alternate either side of the line) or **staggered** (every second row shifted half a step). Distances between plants and between rows are spread evenly unless the owner types them. The form previews the plan before saving. A greenhouse holds at most 6000 positions. The website, the phone and the server place every plant with the same maths (checked by tests).

**Add, freeze, deactivate.** Positions can be added at the end of a row (both sub rows grow in a double row). A plant can be **frozen** (a diseased plant to leave alone: it stays on the plan and can still be recorded) or its position **deactivated** (uprooted: it takes no new counts and is no longer expected to be counted). Both need a **reason**; every change (and every added position) is kept in a history with who did it and when. A position can also be given a name, and a count can carry a **label** (for example "first flush"), editable later. Frozen plants are light blue with a dashed ring on the plan, deactivated positions dark grey with a cross; in 3D a deactivated position shows only a stake.

**Several photos of one plant.** Take as many photos as needed (up to 12) so every fruit is in exactly one photo. The server joins them into one collage (a grid, one cell per photo) and that collage is counted by the fruit counter and checked for disease once, so the count and the health card are about the whole plant. The counter service also compares the photos two by two (ORB feature matching) and the result warns "photos 1 and 3 seem to show the same part of the plant" so a fruit is not counted twice. It is a warning, not a measurement. Each cell is 960 by 720 pixels and the server tells the counter the grid, so the counter counts **cell by cell at full size** and adds the cells up: every fruit keeps its place on the collage, the marked picture is the whole collage, and the result also lists how many fruit each photo gave. (Counting the whole collage as one picture was tried first and lost most of the fruit, because every fruit shrinks: 12 photos with 96 fruit gave 3.) A collage made before this change is checked again with the 640 by 480 cells it was built with.

**Disease check of a collage.** The disease model was trained on single photos, so each photo of the collage is judged on its own and the answers are combined: the plant is **sick** when any photo shows a disease (the most certain one is reported, with the photos that show it), **healthy** only when every photo that could be judged is healthy, and not sure otherwise. Counted fruit are checked three or four at a time so a plant with many fruit does not take minutes. **Waiting time:** the counter gets 30 seconds plus 5 per photo (at most 75) and the website and phone wait up to 150 seconds. **Storage:** the collage and the marked photo are made by the server for one count, so they are deleted when the count is deleted or its photos are replaced; the farmer's own photographs are never deleted. If the counter service has not been redeployed it ignores the grid, so the server marks such a count low confidence and says the counter needs updating.

**Fruit size.** A count is for all sizes (no categories) or for small, medium or large fruit. For one size, the fruit the counter found are ordered by size and cut into thirds, and the recorded number is compared with that third. This is approximate and needs at least 3 fruit in the photo; with fewer the check says it cannot tell sizes apart.

## Who can do what (roles)

The farm owner invites people by email under **Greenhouse > Team**. A person signs in with the invited address (it must be verified), then chooses the farm from the **Farm** list. Their own account must be approved like any other. The server checks the role on every request.

| | Owner | Farm manager | Data collector |
|---|---|---|---|
| Plan and 3D map, layout, crops, team | yes | no | plan only, no layout, crops or team |
| Dashboard | yes | yes | no |
| Records (fruit counts) | all, edit, delete | read all, with disease details | record and edit their own; sees only their own; no delete |
| Harvest value (fruit, healthy share, disease loss, money) and its history | yes | yes | no |
| Theft and loss alerts, explaining them | yes | yes | no |
| First page | dashboard | Overview | Today |
| Prices of the crops | set | no | no |
| Disease report (number of diseased plants, disease, confidence, sick fruit numbers, photos) | yes | yes | no (the verdict of the photo check only) |
| Freeze, deactivate, add positions | yes | no | yes (with a reason) |

## Harvest value: price, healthy fruit and disease loss

**Greenhouse > Harvest value** (owner and farm manager; the data collector does not see it) estimates what the harvest could be worth. The owner types the **price per kilogram**, the **weight of one fruit** and the **currency** of each crop under **My crops** (weights start at a typical value, for example 150 g for a tomato, so change them to match your fruit). From the latest count of every active plant and the health check of that count the page works out:

| | How |
|---|---|
| Gross | every counted fruit x weight x price: everything sold as it is |
| Sick fruit | fruit the check marked sick. The check looks at up to 20 fruit, so the share found sick among the checked fruit is applied to the whole count |
| At risk | on a plant the check calls sick, a share of the remaining fruit may be lost too: 20 per cent unless the viewer changes it |
| Expected value | gross without the sick fruit and the fruit at risk |
| Best / worst | best loses only the sick fruit; worst loses every fruit of every sick plant |
| Whole greenhouse | plants not counted yet get the average of the counted plants of the main crop of that house, with the same loss |

Deactivated plants are left out; frozen plants are included. Money is never added across currencies: each currency is shown on its own. A crop without a price still shows fruit and kilograms, and the page says which prices are missing, how many plants have no health check (their fruit are taken as healthy) and when a count covers one fruit size only. It is an estimate: it is only as good as the counts, the weights and the prices behind it. The API is `GET /api/greenhouse/revenue?greenhouse=<name>&risk=<per cent>`; prices are set with `PUT /api/greenhouse/crops/:id` (owner only).

## Value over time, theft alerts, the two dashboards, recording without a signal

**Value over the weeks.** Under **Harvest value** a chart shows, week by week, the expected value (or the fruit counted when there are no prices) and the share lost to disease, with a sentence saying whether the loss is growing, falling or steady. Each week uses only the counts made by the end of that week (the latest count of each plant by then), with today's prices and weights. `GET /api/greenhouse/revenue/history?weeks=12&greenhouse=&risk=20` (owner and farm manager).

**Theft and loss alerts** (owner and farm manager only, never the data collector, so nobody is tipped off). Computed from the counts; `GET /api/greenhouse/alerts?days=30`.

| Alert | When |
|---|---|
| Recorded below the photo | the photo check says "does not match", the photo shows clearly more fruit than was recorded (at least 3, and at least a quarter of the photo count), with a counter that was sure. High when the record is under half of the photo or 10 or more fruit are missing |
| Count fell | between two counts of the same plant, at most 21 days apart, the count fell by at least 30 per cent and 3 fruit (plants under 5 fruit are too small to judge), on the recorded number or on the photo count. The strongest sign is the photo showing fewer fruit while the recorded number stayed the same. High when both fell, when the photo fell and the record did not follow, or when the fall is 60 per cent or more |
| A person | a data collector whose counts are often below the photos (at least 5 checked counts and 40 per cent or more below) |

These are signs to look into, not proof: fruit also drops after a harvest, pruning, wind, pests and disease. The owner or farm manager **explains** each alert (a reason is required, for example "harvested on Tuesday") and it stops counting as open; it can be opened again (`PUT /api/greenhouse/counts/:id/alert`). Alerts compare only counts of all fruit sizes. The assistant can answer "which plants have numbers that do not add up?" and "is disease loss growing?".

**The first page of each role** (`GET /api/greenhouse/overview`). The **farm manager's Overview**: totals (fruit, healthy fruit, loss, expected value), the last eight weeks, each greenhouse (plants counted, not counted for 7 days, diseased plants), the diseased plants, who is recording, and the alerts. The **data collector's Today**: counts and fruit recorded today and this week, how many plants are left this week and which to record next in each greenhouse, counts to redo because the photo did not match (verdict only), their latest counts, and the plants frozen on purpose. A collector never sees totals, alerts or disease details.

**Recording without a signal (phone).** With no signal, or when a photo exists only on the phone, saving a count keeps it on the phone (the photos are copied into the app's own folder). When the phone is back online, when the app is opened and every minute while counts wait, they are sent in the order they were recorded: first each photo is uploaded (and remembered, so it is never uploaded twice), then the count. Every count carries its own id (`client_id`) so a count sent twice, for example after a reply was lost on a bad connection, is saved once; the real time it was recorded is kept (`recorded_at`). A count the server refuses (a plant that was deactivated meanwhile) stays in the list with the reason, to try again or delete, and never blocks the others. The banner at the top of the Greenhouse screen shows what is waiting. Checking the photo before saving, and editing a saved count, need a connection. A count dated one day ahead of the server's date is accepted, so a phone east of UTC can record late in the evening.

**Excel export.** The .xlsx files are written by the server's own small writer (`server/src/lib/xlsxWriter.js`, no library), replacing a spreadsheet library whose dependencies had open security advisories. Same look: bold title, green header row, striped rows, wrapped text, column widths, frozen header and filter. Codes with a leading zero and numbers longer than 15 digits stay as text.

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

`vision-service/training/train_kaggle.py` fine-tunes YOLO11x on labelled public datasets (boxes on every fruit) for seven classes: tomato, sweet pepper, hot pepper, cucumber, eggplant, strawberry, melon. Zucchini and green beans were dropped (no box-labelled public photos exist for them); they are counted by colour. It runs on Kaggle (see `kernel-metadata.json`).

**Two trained models, one per crop.** The second training added the vegetable, chili and strawberry sets. Both models were scored on the same 795 held-out photos (`training/compare/`, results in `models/fruit_yolo_compare.json`). The newer one is much better for hot pepper (0.07 to 0.90 mAP50), eggplant (0.02 to 0.34), cucumber (0.17 to 0.24) and equal for sweet pepper and strawberry, but worse for tomato (0.60 to 0.55) and melon (0.54 to 0.29). So `models/fruit_yolo_routing.json` sends each crop to the better model, and a crop below 0.35 is left to the colour method (cucumber, eggplant). The older model had seen many of the comparison photos in its training, so its scores are, if anything, flattering. Real greenhouse photos are still unmeasured.

### Deploying the trained counter

Build the counter service with the model: Docker build argument `WITH_YOLO=1` (about 1 GB larger; needs 2 GB of memory or more, so not the smallest free tier). Set on that service `HF_TOKEN` (a read token for your Hugging Face account) and `FRUIT_YOLO_HF_REPO=enockstack/greenhouse-fruit-yolo11x`: the weights download on first use. `/health` then lists `trained_model_used_for`. Without these the service counts by colour only.

**On Google Cloud Run instead of Render.** Needs a Google Cloud project with billing on (set a budget alert), the Google Cloud CLI and `gcloud auth login` once. Then run `powershell -File scripts\deploy-counter-cloudrun.ps1 -Project YOUR_PROJECT_ID -EnvFile path	o-fruit-counter.env`. It turns on the services, stores `FRUIT_COUNTER_TOKEN` and `HF_TOKEN` in Secret Manager, builds the image with the trained models (`vision-service/cloudbuild.yaml`), starts the service with 2 vCPUs and 4 GB (scales to zero when idle) and prints the address for `FRUIT_COUNTER_URL`. Cloud Run refuses requests over 32 MB, so a very large set of full-size photos for the overlap check can fail there. The first request after a quiet spell downloads the weights and can take a minute or more. Hugging Face Docker Spaces were tried and need a paid PRO plan.
