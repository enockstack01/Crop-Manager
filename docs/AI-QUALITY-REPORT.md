# Classifier accuracy report

Source: `C:/Users/ADMIN/Documents/Crop-review/2026-11-05/review.csv`
Photos in the file: 225. Answered by the classifier: 187. Fell back to the assistant alone (no classifier answer): 38.

> Photos from the training set overstate real-world accuracy. Treat these figures as an upper bound.

## Overall

| Measure | Result |
| --- | --- |
| Top-1 correct | 70% (131 of 187) |
| Top-3 contains the truth | 75% |
| Flagged confident | 159 photos, 81% correct |
| Not confident | 28 photos, 7% correct |
| Called unrecognised | 17 photos |

## By crop

| Crop | Photos | Top-1 | Top-3 |
| --- | ---: | ---: | ---: |
| Maize | 25 | 68% | 72% |
| Bean | 25 | 56% | 56% |
| Tomato | 25 | 60% | 68% |
| Potato | 25 | 52% | 56% |
| Banana | 25 | 68% | 68% |
| Coffee | 25 | 84% | 100% |
| Tea | 25 | 96% | 100% |
| Cassava | 12 | 83% | 92% |

## Is the confidence honest?

| Top-1 confidence | Photos | Actually correct |
| --- | ---: | ---: |
| 0–40% | 8 | 0% |
| 40–60% | 14 | 14% |
| 60–80% | 10 | 20% |
| 80–95% | 17 | 41% |
| 95–100% | 138 | 87% |

A trustworthy model is right about as often as it says. A "95–100%" band that is right far less often than that means the confidence numbers should not be shown to farmers as probabilities.

## Most confused

| Truth → model said | Photos |
| --- | ---: |
| Coffee___Brown eye spot → coffee_phoma_leaf_spot | 3 |
| Maize___Nitrogen deficiency → maize_fall_armyworm | 2 |
| Maize___Banded leaf and sheath blight → maize_fall_armyworm | 2 |
| Bean___Powdery mildew → bean_healthy | 2 |
| Potato___Bacterial wilt → potato_aphids | 2 |
| Banana___Sigatoka leaf spot → banana_healthy | 2 |
| Banana___Panama wilt → banana_panama_disease_fusarium_wilt | 2 |
| Maize___Downy mildew → maize_fall_armyworm | 1 |
| Maize___Leaf spot → maize_northern_leaf_blight | 1 |
| Maize___Turcicum leaf blight → maize_gray_leaf_spot | 1 |
| Maize___Stem borer → maize_fall_armyworm | 1 |
| Bean___Bean beetle → bean_healthy | 1 |

## Agronomist verdicts

The verdict column is empty. Ask an agronomist to fill it in; then run this again to count their judgement instead of the folder name.

## What this tells us (read with care)

Measured 8 Nov 2026 on the 225-photo review run of 5 Nov 2026 (`server/src/scripts/eval-classifier.mjs`). Most of those photos come from the data the model was trained on, so real field accuracy is probably lower.

1. **The "not sure" flag is doing its job.** Photos the model was not confident about were right 7% of the time; confident ones 81%. The retake-photo notice for the first group is justified.
2. **Confidence is too high at the top.** In the 95–100% band the model was right 87% of the time, so showing "98%" to a farmer overstates what we know. Prefer words ("very likely", "possible") to percentages until the model is calibrated on unseen field photos.
3. **Some "mistakes" are naming, not disease.** For example Banana "Panama wilt" against `banana_panama_disease_fusarium_wilt` is the same disease under two names, so true accuracy is a little higher than 70%. The label list should be reviewed so that one disease has one name (see the AI prompt in docs/ENGINEER-PROMPTS).
4. **Weak spots:** potato (52%), bean (56%), tomato (60%). Maize stem borer, nitrogen deficiency and several leaf diseases are called fall armyworm. Strong: tea (96%), coffee (84%), cassava (83%).
5. **Not yet measured:** photos the model has never seen; photos that are not plants; low-light and whole-plant photos; the agronomist verdict column (empty). Run the evaluator again when those exist.
