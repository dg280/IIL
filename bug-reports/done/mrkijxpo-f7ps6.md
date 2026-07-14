# [Bug] onboarding (avatar/univers/prénom) — la photo n'apparait pas dans le photomaton, je dois cliquer 

Issue: https://github.com/dg280/IIL/issues/3 (#3)

[Célestine — remontée]
Version: v0.10 (bmrki8izh)
Écran: onboarding (avatar/univers/prénom)
Quand: 2026-07-14T10:33:39.274Z
Contexte: joueuse=? · univers=sakura · gems=290 · persos=[Camille, Alix, Robin] · Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/
—
la photo n'apparait pas dans le photomaton, je dois cliquer pour la valider et la mettre dans le slot. Dans le photomaton je vois juste le portrait mais dans le slot tu stockes en plan pied, possible de cliquer sur le slot pour reprendre une photo. et a la fin on valide son deck de 4 photo.
attention le focus doit revenir sur le photomaton quand on clique pour prendre la photo, et les 4 pohotos fobt la la meme taille que la photo le sunes en dessous des autres. demande à expert UI/UX

---
Traité le 2026-07-14 : retours de Rose sur le photomaton (consultation UI/UX incluse).
- BUG corrigé : la photo n'apparaissait pas → l'overlay de flash restait blanc (opacity
  par défaut 1 après l'anim) ; base mise à opacity:0.
- La pellicule devient une bande VERTICALE de 4 poses à la même taille que la cabine
  (perforations façon film), cadrage identique partout (9:16, object-fit:contain).
- Sélection vs reprise : taper une pose l'affiche en grand (ruban « 👁 vue ») ; bouton
  🔄 sur chaque pose pour la reprendre en place ; case vide = tirer une photo dedans.
- Bouton final « ✨ Valider ma photo (n/4) », actif seulement quand une pose est choisie.
- Le focus remonte sur la cabine (scrollIntoView block:'start') à chaque prise.
Fichiers : src/screens/AvatarMaker.tsx, src/styles.css.
