const P = 'sicilian-defense-smith-morra-gambit'

export const INTROS = {
  [P]: {
    text: 'Du gibst früh einen Bauern, um Springer und Läufer schnell ins Spiel zu bringen: Sxc3, Sf3, Lc4, dann rochierst du. Achte auf 7… Lxc3: Mit diesem Tausch wechselt die Bewertung zu deinen Gunsten, und nach 8. bxc3 gehören dir die halboffenen b- und d-Linien.',
    belege: ['doc:Z82', 'zugfolge', 'kritischerZug', 'offeneLinien'],
  },
  [`${P}-accepted`]: {
    text: 'Schwarz nimmt den Bauern an; das ist dieselbe Linie wie die Grundvariante, nur unter dem Namen der angenommenen Variante. Du hast den Entwicklungsvorsprung, er den Mehrbauern: Springer c3 und f3, Läufer c4 und die Rochade stehen, nach dem Tausch auf c3 hast du das Läuferpaar, aber isolierte a- und c-Bauern. Am Ende stehst du leicht besser.',
    belege: ['doc:Z82', 'zugfolge', 'rochade', 'struktur', 'endbewertung'],
  },
  [`${P}-declined-alapin-formation`]: {
    text: 'Schwarz lehnt ab und greift mit 3… Sf6 sofort den Bauern e4 an; das Material ist am Ende ausgeglichen. Dein Plan: e5 spielen, mit cxd4 zurückschlagen und nach dem Damentausch auf g6 rochieren; Schwarz bleibt mit Doppelbauern auf der g-Linie und ohne Rochade zurück. Achte auf 3… Sf6 selbst, es hebt die Bewertung zu deinen Gunsten.',
    belege: ['zugfolge', 'struktur', 'rochade', 'material', 'kritischerZug', 'endbewertung'],
  },
  [`${P}-declined-center-formation`]: {
    text: 'Schwarz stellt sich mit e5 ins Zentrum, statt den Bauern zu nehmen; du bist am Ende einen Bauern im Rückstand. Dein Plan: mit cxd4 exd4 Sxd4 holst du Raum und Tempo, und nach dem Tausch auf c6 bleibt Schwarz ein isolierter a-Bauer. Entscheidend ist 13… Lxc3 14. bxc3 Sxe4, danach liegst du in der Bewertung klar vorn.',
    belege: ['doc:Z82', 'zugfolge', 'struktur', 'material', 'kritischerZug', 'endbewertung'],
  },
  [`${P}-declined-push-variation`]: {
    text: 'Schwarz schiebt den Bauern nach d3, statt zu schlagen, und du schlägst ihn mit dem Läufer weg; Läufer gegen Springer wird getauscht, das Material bleibt gleich. Danach entwickelst du ruhig: Sc3, Sge2, Le3, Rochade. Achte darauf, dass Schwarz mit Se5 deinen Läufer auf d3 tauscht; die Linie endet mit Vorteil für dich.',
    belege: ['zugfolge', 'rochade', 'material', 'endbewertung'],
  },
  [`${P}-declined-scandinavian-formation`]: {
    text: 'Schwarz antwortet mit d5 und holt die Dame früh heraus. Du schlägst mit cxd4 zurück, entwickelst dich schnell und rochierst, während Schwarz unrochiert bleibt, denn dein Ziel ist, Schwarz zu überrennen, bevor er seine Buchhaltung fertig hat. Achte auf 12… Tc8, hier kippt die Stellung deutlich zu deinen Gunsten.',
    belege: ['doc:Z83', 'zugfolge', 'rochade', 'kritischerZug'],
  },
  [`${P}-declined-wing-formation`]: {
    text: 'Schwarz bringt die Dame schon im dritten Zug nach a5, und du bleibst einen Bauern im Rückstand. Du entwickelst ohne Hast: Ld2, Sc3, Sf3, Le3 und die Rochade, so stehen vier Leichtfiguren draußen, und Schwarz bleibt unrochiert. Mit Dxb7 schlägst du in der Linie einen Bauern und bleibst im Vorteil.',
    belege: ['doc:Z82', 'zugfolge', 'entwicklung', 'rochade', 'material', 'endbewertung'],
  },
  [`${P}-declined-dubois-variation`]: {
    text: 'Dieselbe Linie wie die Push-Variante, hier unter dem Namen Dubois-Variante: Schwarz fianchettiert mit g6 und Lg7 und behält das Läuferpaar, du hältst die halboffene d-Linie und rochierst. Achte auf 4… Sc6, ab da liegt Weiß vorn; am Damenflügel halten Tc1, b3 und a4 den Druck.',
    belege: ['etappe', 'zugfolge', 'struktur', 'offeneLinien', 'rochade', 'wendepunkte'],
  },
  [`${P}-accepted-fianchetto-defense`]: {
    text: 'Schwarz baut den Läufer auf g7 auf, und das Material ist am Ende ausgeglichen. Du jagst mit Db3 und Sb5 auf die Felder b7 und d6. Achte auf 7… d6, danach bricht Schwarz ein, und 12. Sd6+ treibt den König nach f8, wo er nicht mehr rochiert.',
    belege: ['zugfolge', 'material', 'kritischerZug', 'rochade'],
  },
  [`${P}-accepted-kan-formation`]: {
    text: 'Schwarz geht mit e6 und a6 in die Kan-Aufstellung, und du stößt mit e5 vor, bringst Läufer f4 und d3 ins Spiel und greifst mit h4 am Königsflügel an. In der Abtauschfolge nach 11. exd6 fällt der Bauer f7 mit Schach; beide Könige bleiben unrochiert, am Ende stehst du nur leicht besser.',
    belege: ['doc:Z82', 'zugfolge', 'rochade', 'endbewertung'],
  },
  [`${P}-accepted-morphy-defense`]: {
    text: 'Schwarz stellt den Läufer früh nach c5, und du vertreibst ihn mit a3 und b4 nach b6. Mit b5 jagst du außerdem den Springer von c6 weg. Beide Seiten rochieren, c-, d- und e-Linie sind offen und das Material ist ausgeglichen; achte auf 9… d5, mit dem Schwarz das Zentrum selbst öffnet.',
    belege: ['zugfolge', 'rochade', 'offeneLinien', 'material', 'endbewertung'],
  },
  [`${P}-accepted-paulsen-formation`]: {
    text: 'Schwarz zieht Dc7 und a6 und lässt seinen König in der Mitte. Dein Turm auf e1 und die offene e-Linie sind der Hebel: Nach Sd5 und dem Tausch auf d5 gibt Te1+ Schach, und bei 10… Kd8 kippt es deutlich zu deinen Gunsten, der König rochiert nicht mehr, und am Ende hast du die Qualität und einen Bauern mehr. Dein Ziel war, Schwarz zu überrennen, bevor er seine Buchhaltung fertig hat.',
    belege: ['doc:Z83', 'zugfolge', 'offeneLinien', 'rochade', 'material', 'kritischerZug'],
  },
  [`${P}-accepted-pin-defense`]: {
    text: 'Dieselbe Linie wie die Grundvariante, hier unter dem Namen Pin-Verteidigung: Schwarz greift mit dem Läufer auf b4 den Springer c3 an und tauscht ihn. Du hast danach das Läuferpaar, aber isolierte a- und c-Bauern; mit Dd6 und h4 hältst du Druck, und die Bewertung pendelt knapp um deinen Vorteil.',
    belege: ['zugfolge', 'struktur', 'wendepunkte', 'endbewertung'],
  },
  [`${P}-accepted-scheveningen-formation`]: {
    text: 'Schwarz setzt mit d6 und e6 auf eine feste Bauernkette; du rochierst und stellst De2 und Td1 auf die offenen c- und d-Linien. Dein Plan: e5 als Sprengung, der schnelle Angriff, wie in deinem Repertoire. Achte auf 11… Sxd6, danach kippt die Stellung klar zu dir, und das bleibt auch nach 14. Sb5 Lxh2+ so.',
    belege: ['doc:Z83', 'zugfolge', 'rochade', 'offeneLinien', 'kritischerZug', 'endbewertung'],
  },
  [`${P}-accepted-siberian-variation`]: {
    text: 'Schwarz zieht die Dame früh nach c7 und lockt dich in die Sibirische Falle; die Falle selbst führt die Linie unter eigenem Namen weiter. Achte auf 7. De2, denn mit diesem Zug verlierst du deinen Vorteil in der Bewertung, und Schwarz greift danach mit Sg4 an.',
    belege: ['zugfolge', 'etappe', 'kritischerZug'],
  },
  [`${P}-accepted-chicago-defense`]: {
    text: 'Schwarz spielt d6 und e6 und lässt nach e5 den Damentausch zu; du bist am Ende einen Bauern im Rückstand. Dein Plan: mit Sxe5 den Bauern zurückholen; der schwarze König zieht nach e8 und rochiert nicht, du bist rochiert. Die Stellung endet ausgeglichen, auf den Linien c und d liegt noch Spiel.',
    belege: ['zugfolge', 'rochade', 'material', 'offeneLinien', 'endbewertung'],
  },
  [`${P}-accepted-classical-formation`]: {
    text: 'Eine ruhige Variante: Schwarz spielt d6 und a6 und tauscht mit Lg4 seinen Läufer gegen deinen Springer auf f3. Du behältst das Läuferpaar, bringst Lf4 ins Spiel und besetzt mit Tfd1 und Dg3 die d-Linie. Dein Plan: Txd6 zum rechten Zeitpunkt; dabei gibst du die Qualität, die Linie endet ausgeglichen.',
    belege: ['zugfolge', 'struktur', 'offeneLinien', 'material', 'endbewertung'],
  },
  [`${P}-accepted-finegold-defense`]: {
    text: 'Schwarz setzt auf d6 und e6 mit Le7 und Dc7, und du bleibst einen Bauern im Rückstand. Dein Plan: e5 sprengt das Zentrum, dein Springer landet auf e5, und Sg6 greift den Turm auf f8 an. Schwarz hat in der Linie nur eine Leichtfigur entwickelt, am Ende stehst du leicht besser.',
    belege: ['doc:Z82', 'zugfolge', 'material', 'entwicklung', 'endbewertung'],
  },
  [`${P}-accepted-larsen-defense`]: {
    text: 'Schwarz spielt Dc7 und a6 und rochiert in der Linie nicht; du gehst einen Bauern im Minus. Achte auf 7. De2, hier verlierst du deinen Vorteil in der Bewertung; nach dem Tausch auf e5 und Sd5 gleichst du aus, und f4 greift den Läufer auf e5 an.',
    belege: ['zugfolge', 'rochade', 'material', 'kritischerZug', 'endbewertung'],
  },
  [`${P}-accepted-morphy-defense-deferred`]: {
    text: 'Schwarz schiebt erst a6, dann b5 und stellt den Läufer erst nach c5; Läufer gegen Springer wird getauscht, das Material bleibt gleich. Achte auf 8. Lb3: Danach steht Schwarz besser, erst mit 8… Lc5 ist es wieder ausgeglichen. Dein Plan: Lf4, Tc1 und Sd5 mit dem Tausch auf d5; am Ende stehst du leicht besser.',
    belege: ['zugfolge', 'material', 'wendepunkte', 'kritischerZug', 'endbewertung'],
  },
  [`${P}-accepted-siberian-variation-siberian-trap`]: {
    text: 'Dieselbe Linie wie die Sibirische Variante, nur mit dem Namen der Falle: Schwarz spielt Dc7, Sf6, Sg4 und Lc5 und nimmt zuletzt auf f2. Merk dir 7. De2 und dein Feld f2, denn dort fällt die Bewertung von deinem Vorteil in den Nachteil; am Ende stehst du leicht besser.',
    belege: ['etappe', 'zugfolge', 'kritischerZug', 'endbewertung'],
  },
}
