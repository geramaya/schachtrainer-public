# Geschriebene Einleitungstexte der Varianten

Eine Datei je Eröffnung: `content-src/intros/<openingId>.ts` (openingId: scotch, smith-morra, caro-kann, budapest,
kings-indian, italian, alapin, nimzo-indian, tarrasch, vienna).

```ts
export const INTROS = {
  'vienna-game-giraffe-attack': {
    text: 'Nach 1. e4 e5 2. Sc3 Lc5 ... (1 bis 3 Sätze, höchstens 700 Zeichen)',
    belege: ['abzweigung', 'doc:Z140'],
  },
}
```

Schlüssel = Varianten-ID (`variationId` im Faktenblatt). Grundlage: `content-src/intro-facts/<openingId>.json`
(erzeugt mit `node tools/intro-facts.ts`, nur Fakten).

Regeln (geprüft von `tools/lib/intro-check.ts`; ein abgelehnter Text bleibt Entwurf, Grund steht in der Ausgabe von
`node tools/add-intros.ts`):

- Zugfolgen deutsch mit Zugnummer: `1. e4 e5 2. Sf3`, Schwarz `2… Sc6`. Nur Züge der Linie.
- Figur plus Feld (`Läufer c4`) nur, wenn diese Figur dort in der Linie steht; Felder (`f7`) müssen in der Linie vorkommen.
- Bewertungen nur aus dem Faktenblatt: `+0,4`, `−1,2`, `1,2 Bauerneinheiten`, `120 cp`; Vorzeichen zählt, Toleranz 0,1 Bauern.
- Prozente nur aus `gegnerzuege` (Toleranz 1 Prozentpunkt), Partienzahlen (`4.426.862 Partien`, `4,4 Millionen Partien`) Toleranz 5 %.
- Sätze mit Plan, Idee, Ziel, Gedanke, Strategie, Absicht brauchen `belege`. Erlaubt: `zugfolge`, `abzweigung`, `etappe`,
  `entlangLinie`, `wendepunkte`, `kritischerZug`, `endbewertung`, `gegnerzuege`, `material`, `struktur`, `offeneLinien`,
  `rochade`, `koenigssicherheit`, `entwicklung`, `doc:Z<n>` (Zeile n im Dokumentauszug `dokument` der Faktendatei).
  Ein Schlüssel ohne Inhalt im Faktenblatt (z. B. `wendepunkte` leer) wird abgelehnt.
- Varianten mit Sprechtext aus dem Dokument (die 66 guten) behalten ihren Text; ein Eintrag dafür wird ignoriert.

## Richtungs- und Materialaussagen (ohne Zahl)

Geprüft wird nur, was in dieser Liste steht (`tools/lib/intro-claims.ts`); andere Formulierungen laufen ungeprüft durch,
also bei Bewertung und Material bei diesen Wendungen bleiben. Gemeint ist immer die Stellung nach dem zuletzt genannten
Zug des Satzes (`7… dxc3`, `1. e4 e5 2. Sf3`), mit „am Ende/endet" die Endbewertung, ohne Zugangabe der Linienschluss
bzw. beim Wechsel der kritische Zug. Bewertung in Weiß-Sicht aus dem Faktenblatt, Richtung aus Sicht deiner Repertoire-Seite.

| Wendung | Prüfung (Schwellen in cp) |
|---|---|
| `kippt/dreht/springt/wächst … zu dir / zu deinen Gunsten / zu Weiß / zu Schwarz`, `wächst dein Vorteil`, `springt … auf klaren Vorteil für dich` | Sprung durch den genannten Zug (bei mehreren Zügen von vor dem ersten bis nach dem letzten) in diese Richtung: mind. 50; mit „deutlich/klar/stark" 100; mit „leicht/etwas/kurz/klein" 20 |
| `sinkt/schwindet/verschwindet der weiße Vorteil`, `verliert Weiß seinen Vorteil` | Sprung weg von der Seite: mind. 20 |
| `du stehst (deutlich) besser/schlechter`, `steht Weiß/Schwarz/dein Gegner (leicht) besser/schlechter`, `steht es klar für dich`, `klarer Vorteil für Weiß` | Bewertung nach dem Zug in dieser Richtung: mind. 50; „deutlich/klar/stark" 100; „leicht/etwas/kurz/knapp/klein" 20 |
| `ausgeglichen` (ohne „Material" im Satzteil), `gleichst du aus` | Betrag unter 50 |
| `einen Bauern / zwei Bauern / einen Läufer / … mehr/weniger`, `die Qualität mehr/weniger`, `einen Bauern im Rückstand` | Figurenzahl-Differenz der Seite (Standard: du; sonst Subjekt: `hat Weiß …`, `dein Gegner hat …`) zum Zeitpunkt; stimmt, wenn die Stellung selbst oder die nach den offenen Rückschlägen passt, auch netto nach einer genannten Qualität |
| `Material ist/bleibt gleich/ausgeglichen` | Materialwert (Bauer 1, Leichtfigur 3, Turm 5, Dame 9) gleich |
| `Läuferpaar` mit Subjekt (Weiß, Schwarz, du, dein Gegner) | diese Seite hat zwei Läufer |

Eine Aufzählung braucht Zahlwörter und „und" (`einen Läufer und zwei Bauern mehr`); „Läufer gegen Springer" ist keine Aufzählung.
Ein Satzteil ohne eigenen Zug nach einem früheren Zug darf auf jede spätere Stellung der Linie zutreffen. Bewertungen, die für den
genannten Zug nicht im Faktenblatt stehen (z. B. der letzte Zug einer Schwarz-Linie), sind nicht belegbar: Zug davor nennen.
