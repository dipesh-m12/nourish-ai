# Art prompts (Gemini)

Sources go in `mobile/assets/images/v1/` (git-ignored). Shipped files are cut out, trimmed and saved as
WebP ≤ 40 KB in `assets/images/world/` and `assets/images/cat/`.

**Always attach `mobile/assets/images/world/bowl-full.webp` as the reference**: it is the Mochi
style (yellow and white kitten, thick black outline, big round head, simple kawaii face).

## Style block (paste before every prompt)
```
Match the attached cat exactly: same yellow and white kitten, same thick black outline, same big
round head, same simple kawaii face. Flat vector, clean flat colours, no gradients, no paper grain.
One centred subject, plenty of empty space around it, plain flat white background.
Absolutely no text, letters, words, numbers, currency signs, prices, logos, postmarks or captions
anywhere. No shadow on the ground, no 3D, no photorealism.
```

## Dropped (not used in the app after the 1.1 redesign)
| File | Prompt |
|---|---|
| `mochi-sleeping.png` | The same kitten curled up asleep in a ball on a small round coral (#E07A5F) cushion, eyes closed as two curved lines, three small soft white circles floating above its head. |
| `mochi-wakeup.png` | The same kitten sitting on a coral cushion, stretching both front paws up and yawning, eyes closed. Behind it a soft mustard (#D99A2B) half-circle sun. Square image. |
| `stamp-park.png` | A postage stamp shape: cream (#F7F6F2) with a wavy perforated black edge. Inside, a tiny park: one round sage-green tree and a wooden bench on a grass path. A small coral paw print in the bottom-left corner. **No text of any kind on the stamp.** Square image. |
| `stamp-gym.png` | The same stamp style. Inside: a rolled-out sage yoga mat and a water bottle on a light floor. Small coral paw print bottom-left. No dumbbells. **No text.** Square image. |
| `stamp-home.png` | The same stamp style. Inside: a small cream house with a sage door and a round bush beside it. Small coral paw print bottom-left. **No text.** Square image. |

## Done (in the app)
`world/bowl-empty`, `world/bowl-full`, `world/sprout`, `world/flower-bloom`, `world/flower-wilted`,
`world/garden-ground` (grass strip cropped from `garden.png`; Mochi is placed in code), `cat/left`.
