import type { AudioText } from './types.ts'

const line = (id: string) => ({ kind: 'bundle', ref: `Zugfolge der Variante ${id} in public/content/bundle.json` })

const v = (id: string, title: string, text: string): AudioText => ({
  id: `variante-${id}`,
  kind: 'variante',
  refId: id,
  title: `${title}: Die Idee`,
  text,
  sources: [line(id)],
})

export const variantTextsD4: AudioText[] = [
  v('nimzo-indian-defense', 'Nimzo-Indisch', `Das ist die Grundstellung des Nimzo-Indischen. Nach Bauer d4, Springer f6, Bauer c4 und Bauer e6 entwickelt Weiß den Springer nach c3, und dein Läufer geht nach b4. Der Läufer fesselt den Springer: Das Feld d2 ist frei, und der König steht auf e1. Du setzt auf Fesselung statt Bauernstruktur. Dein Springer f6 überwacht außerdem das Feld e4. Lerne diese Stellung gut. Alle Varianten dieser Sammlung zweigen hier ab, je nachdem, wie Weiß die Fesselung beantwortet.`),
  v('nimzo-indian-defense-rubinstein-system', 'Rubinstein-System', `Weiß spielt Bauer e3 und baut kompakt auf. Du rochierst, und nach Läufer d3 setzt du mit Bauer d5 ein eigenes Zentrum. Nach Springer f3 greifst du mit Bauer c5 den Bauern d4 an. Später tauschst du den Läufer auf c3. Schlägt Weiß mit dem Bauern b2 zurück, hat er Doppelbauern auf der c-Linie, dafür aber das Läuferpaar. Zähle Angreifer und Verteidiger von d4, bevor du schlägst.`),
  v('nimzo-indian-defense-classical-variation', 'Klassische Variante', `Weiß stellt die Dame nach c2. Sie deckt den Springer c3 und kontrolliert das Feld e4. Schlägst du auf c3, kann Weiß mit der Dame zurückschlagen und behält seine Bauernstruktur. Du setzt deshalb mit Bauer d5 auf das Zentrum und greifst den Bauern c4 an. Nach Bauer a3 tauschst du auf c3. Danach geht dein Springer nach e4 und greift die Dame an. Später zielt der Bauer c5 auf d4.`),
  v('nimzo-indian-defense-samisch-variation', 'Sämisch-Variante', `Weiß fragt mit dem Bauern a3 sofort den Läufer. Du tauschst auf c3, und Weiß schlägt meist mit dem Bauern b2 zurück. Das Ergebnis sind Doppelbauern auf der c-Linie, beide von keiner Figur gedeckt. Weiß hat dafür das Läuferpaar. Dein Plan: Bauer c5 gegen d4, später Bauer b6 und Läufer b7, um den Bauern c4 unter Druck zu setzen.`),
  v('nimzo-indian-defense-kmoch-variation', 'Kmoch-Variante', `Weiß deckt mit dem Bauern f3 das Feld e4 und bereitet den Vorstoß e2 nach e4 vor. Der Preis: Der Springer g1 verliert das Feld f3. Du antwortest mit Bauer d5. Nach Bauer a3 tauschst du den Läufer gegen den Springer c3, und Weiß hat danach Doppelbauern auf der c-Linie. Greife das Zentrum mit Bauer c5 an, bevor Weiß seinen Bauern e4 aufbaut.`),
  v('nimzo-indian-defense-three-knights-variation', 'Drei-Springer-Variante', `Weiß entwickelt den Springer nach f3 und deckt damit d4. Der Bauer e3 fehlt noch, also hat der Läufer c1 seine Diagonale frei. Du greifst mit dem Bauern c5 an. Nach Bauer g3 tauschst du auf d4, rochierst und öffnest mit Bauer d5 das Zentrum. Der Springer c3 bleibt gefesselt, solange das Feld d2 frei ist.`),
  v('tarrasch-defense', 'Tarrasch-Verteidigung', `Das ist die Tarrasch-Verteidigung. Nach Bauer d4, Bauer d5, Bauer c4, Bauer e6 und Springer c3 spielst du den Bauern c5. Er greift den Bauern d4 an, der nur von der Dame gedeckt ist. Du nimmst später einen isolierten Bauern in Kauf, damit deine Figuren maximale Freiheit bekommen. So steht es in deinem Dokument. Schlägt Weiß auf d5, nimmst du mit dem Bauern e6 zurück.`),
  v('tarrasch-defense-two-knights-variation', 'Zwei-Springer-Variante', `Weiß schlägt auf d5, du nimmst mit dem Bauern e6 zurück. Beide Seiten haben danach sieben Bauern. Nach Springer f3 entwickelst du den Springer nach c6 und greifst d4 ein zweites Mal an. Der Bauer c5 ist vom Läufer f8 gedeckt, der Bauer d5 von der Dame. Aus dieser Stellung entstehen die großen Hauptlinien der Tarrasch-Verteidigung.`),
  v('tarrasch-defense-rubinstein-system', 'Rubinstein-System', `Weiß fianchettiert: erst Bauer g3, dann Läufer g2. Du entwickelst den Springer nach f6 und deckst den Bauern d5 damit zweimal, mit Dame und Springer. Weiß greift d5 mit dem Springer c3 und später mit dem Läufer g2 an. Dein Ziel ist, auf d4 zu tauschen und mit offenen Linien aktiv zu spielen. Rechne bei jedem Zug nach, wie oft d5 angegriffen und gedeckt ist.`),
  v('tarrasch-defense-classical-variation', 'Klassische Variante', `In der Klassischen Variante entwickeln beide Seiten ruhig. Weiß spielt Läufer g2 und rochiert, du entwickelst den Läufer nach e7 und rochierst ebenfalls. Dein Bauer c5 drückt auf d4. Der Läufer g2 steht noch hinter dem Springer f3 und wirkt erst, wenn der Springer weicht. Merke dir, wann der Tausch auf d4 kommt: Er öffnet die c-Linie und schafft die typische Struktur mit dem isolierten Bauern.`),
  v('tarrasch-defense-classical-variation-main-line', 'Hauptlinie', `Weiß stellt den Läufer nach g5 und greift den Springer f6 an, der vom Läufer e7 und vom Bauern g7 gedeckt ist. Du schlägst auf d4 und öffnest die c-Linie. Danach hast du einen isolierten Bauern auf d5: Auf der c- und der e-Linie steht kein schwarzer Bauer. Dafür ist die c-Linie offen und die e-Linie halboffen. Setze deine Figuren dort ein.`),
]
