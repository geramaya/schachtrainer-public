import type { AudioText } from './types.ts'

const DOC = { kind: 'dokument', ref: 'docs/repertoire-v1.8.md' }
const wiki = (page: string) => ({ kind: 'wikipedia', ref: `https://en.wikipedia.org/wiki/${page}` })

/** Background texts of the Black repertoire against 1. d4 (Nimzo-Indian, Tarrasch); history only with the checked source. */
export const openingTextsD4: AudioText[] = [
  {
    id: 'nimzo-indian',
    kind: 'eroeffnung',
    refId: 'nimzo-indian',
    title: 'Nimzo-Indisch: Hintergrund und Grundidee',
    sources: [wiki('Nimzo-Indian_Defence'), DOC],
    text: `Das Nimzo-Indische ist deine stabile Option B gegen Bauer d4. In deinem Dokument ist es das Enterprise Upgrade: Fesselung statt Bauernstruktur. Es beginnt mit Bauer d4, Springer f6, Bauer c4, Bauer e6, Springer c3 und dann Läufer b4.
Zur Herkunft: Laut Wikipedia ist die Eröffnung nach Aron Nimzowitsch benannt, der sie auf Meisterniveau eingeführt hat. Als Ursprungspartie nennt Wikipedia ein Spiel zwischen Berthold Englisch und Joseph Henry Blackburne, London, achtzehnhundertdreiundachtzig. Und laut Wikipedia hat jeder Weltmeister seit Capablanca sie gespielt.
Die Grundidee: Der Läufer b4 fesselt den Springer c3. Laut Wikipedia verhindert Schwarz damit das drohende Bauer e4. Dein Springer f6 überwacht außerdem das Feld e4.
Typisch ist der Tausch Läufer gegen Springer auf c3. Danach hat Weiß oft Doppelbauern auf der c-Linie, dafür aber das Läuferpaar. Schwarz versucht laut Wikipedia, die Stellung zu schließen und das weiße Zentrum zu blockieren.
Weiß hat viele Wege, auf die Fesselung zu antworten. Am häufigsten ist laut Wikipedia das Rubinstein-System mit Bauer e3. Dazu kommen die Klassische Variante mit Dame c2 und die Sämisch-Variante mit Bauer a3. Du brauchst für jede einen Plan.
Achte darauf: Spielt Weiß Springer f3 oder Bauer g3 statt Springer c3, gibt es keine Fesselung. Dort ist dein Zug Bauer d5.`,
  },
  {
    id: 'tarrasch',
    kind: 'eroeffnung',
    refId: 'tarrasch',
    title: 'Tarrasch-Verteidigung: Hintergrund und Grundidee',
    sources: [wiki('Tarrasch_Defense'), DOC],
    text: `Die Tarrasch-Verteidigung ist deine aktive Option C gegen Bauer d4. In deinem Dokument heißt sie Open Source: Du nimmst einen isolierten Bauern in Kauf, damit deine Figuren maximale Freiheit haben. Sie beginnt mit Bauer d4, Bauer d5, Bauer c4, Bauer e6, Springer c3 und dann Bauer c5.
Zur Herkunft: Laut Wikipedia heißt sie nach dem Deutschen Siegbert Tarrasch, der sie vertreten hat. Er hielt die größere Beweglichkeit von Schwarz für die Schwäche des isolierten Mittelbauern wert. In seinem Buch Die moderne Schachpartie gab er seiner Linie ein Ausrufezeichen. Viele Meister nach Wilhelm Steinitz lehnten sie dagegen wegen dieser Schwäche ab. In den zehner Jahren dieses Jahrhunderts hat Daniil Dubov laut Wikipedia eine fast vergessene Linie wieder auf höchstes Niveau gebracht.
Die Grundidee: Mit Bauer c5 greifst du den Bauern d4 sofort an. Nach Bauer schlägt d5 und Bauer e6 schlägt zurück entsteht nach dem Tausch auf d4 ein isolierter Bauer auf d5. Zählbar heißt das: Auf der c-Linie und der e-Linie steht kein schwarzer Bauer. Die c-Linie ist offen, die e-Linie halboffen.
Laut Wikipedia gibt der Bauer d5 Schwarz Halt im Zentrum, und die Läufer bekommen offene Linien. Er kann aber nicht mehr von Bauern gedeckt werden, deshalb müssen Figuren ihn halten.
Dein Dokument warnt: Die Verteidigung erfordert genaues Spiel im Endspiel.`,
  },
]
