# [Bug] onboarding (avatar/univers/prénom) — Transforme l'experience en photobooth, flash, animation, reg

Issue: https://github.com/dg280/IIL/issues/2 (#2)

[Célestine — remontée]
Version: v0.9 (bmrk1mkvo)
Écran: onboarding (avatar/univers/prénom)
Quand: 2026-07-14T10:14:34.203Z
Contexte: joueuse=? · univers=sakura · gems=290 · persos=[Camille, Alix, Robin] · Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/
—
Transforme l'experience en photobooth, flash, animation, reglage tabouret, reveal. 4 essais qui sont stockés dans des slots

---
Traité le 2026-07-14 : idée de fonctionnalité (pas un bug). Écran « À quoi ressembles-tu »
transformé en **Photomaton magique** — cabine + rideaux, tabouret réglable (hauteur d'assise),
flash + son de déclencheur, développement « Polaroïd » à la révélation, et **4 pellicules**
pour garder les essais et choisir sa photo préférée. Implémenté dans src/screens/AvatarMaker.tsx,
src/player/voice.ts (playShutter) et src/styles.css.
