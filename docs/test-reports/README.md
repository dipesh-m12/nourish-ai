# Sample health reports (for testing)

Made-up lab, made-up patients, every page stamped "Sample · not a real report".
Rebuild with `python make_reports.py` (needs Chrome).

| File | Shows | What the app should suggest (feeling-led) |
|---|---|---|
| `report-1-vitamins-low` (.pdf / .png) | Vitamin D 14.2 (low), B12 168 (low), rest normal; "tired through the day" | Morning sunlight 15 min → more energy; curd or milk daily (veg B12) → less tired |
| `report-2-sugar-cholesterol-high` | HbA1c 6.1, fasting sugar 112, LDL 151, TG 196, HDL 38 | Walk after dinner 10 min; no sugar in chai; fewer fried snacks → steady energy |
| `report-3-iron-low` | Hb 10.4, ferritin 8.5, iron 42 (low); breathless on stairs | Iron-rich food daily (rajma, chana, spinach) + vitamin C with it; no tea with meals |

Test in the app: dashboard **+** → the report icon → pick a PDF, or the photo icon → pick the PNG.
Also in the chat: attach the report and ask "what should I do?".

## Challenge formats (how each kind is logged)

| Format | When it's used | Interaction |
|---|---|---|
| water | hydration, litres | glass that fills, pour per sip |
| timer | minutes + mindset / breathing / stretch | guided timer with a breathing orb |
| walk | movement in steps, km or a walk/run | live map + steps, auto-pause when still |
| place | showing up somewhere (gym, park, class) | pin once, check in on arrival (or automatically) |
| sleep | hours of sleep | bed + wake time, hours worked out |
| tally | counted things (sets, servings, rounds) | +1 per tap |
| amount | any other amount | how-much picker |
| check | done / not done (no sugar, phone away) | one tap |
| meal | food challenges (protein, veggies) | meal camera; the meal counts too |

Steps and sleep can also fill themselves from Health Connect.
