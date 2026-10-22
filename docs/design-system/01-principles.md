# Principles

Five principles decide every trade-off. When two components or layouts both work, pick the one that serves these better.

## 1. The page is the product

People come to make a CV, and every later feature (matching, tailoring, reviews, sharing) works on that page. Keep the sheet (`PaperSheet`) and the person's words at the centre; chrome is `canvas` and `surface`, never decoration.

- Do show the live CV next to the form it comes from (Split view), and highlight the section being edited.
- Don't put marketing, tips or upsells between the person and their document.

## 2. One next step

Every view answers "what do I do now?" with one blue button.

- Do label it with where it goes: "Continue to Education", "Save to tracker", "Accept and rate".
- Don't show two primary buttons, or make people choose between equal options when one is clearly better.

## 3. Show the evidence

Scores, matches, views and AI output always explain themselves.

- Do pair every score (`ScoreRing`, `MatchScore`) with what counted and how to raise it.
- Do mark anything the AI couldn't know as a [placeholder]; never let it invent numbers or employers.
- Don't show a number without its base or period ("82% match with your Long CV", "3 views this week").

## 4. Calm under pressure

Job hunting is stressful. The product never adds to it.

- Do use neutral colour for normal states: a weak match is grey, not red; rejections are muted.
- Do prefer Undo over confirmation dialogs, and say what happened in plain words.
- Don't use urgency tricks, countdowns or guilt ("You're falling behind!").

## 5. Built for two directions, two themes, one hand

Pakistan and the Gulf are core markets: Urdu and Arabic read right to left, and most people are on phones.

- Do design every screen at 360px first, then widen.
- Do use logical sides (`start`/`end`) everywhere and check each screen in right-to-left and in dark.
- Don't rely on hover; everything reachable by hover is reachable by tap and keyboard.
