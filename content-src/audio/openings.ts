import type { AudioText } from './types.ts'

const DOC = { kind: 'dokument', ref: 'docs/repertoire-v1.8.md' }
const wiki = (page: string) => ({ kind: 'wikipedia', ref: `https://en.wikipedia.org/wiki/${page}` })

export const openingTexts: AudioText[] = [
  {
    id: 'scotch',
    kind: 'eroeffnung',
    refId: 'scotch',
    title: 'Schottische Partie: Hintergrund und Grundidee',
    sources: [wiki('Scotch_Game'), DOC],
    text: `Die Schottische Partie ist dein Main Backend mit Weiß. Sie beginnt mit Bauer e4, Bauer e5, Springer f3, Springer c6 und dann Bauer d4.
Zur Herkunft: Der Name geht laut Wikipedia auf ein Fernschachspiel zwischen Edinburgh und London im Jahr achtzehnhundertvierundzwanzig zurück. Erwähnt wird die Eröffnung sogar schon bei Ercole del Rio, in einem Buch von siebzehnhundertfünfzig. Später kam sie aus der Mode, und Garry Kasparov hat sie im späten zwanzigsten Jahrhundert wieder populär gemacht.
Die Grundidee ist schnell erzählt. Du fragst nicht um Erlaubnis. Du öffnest das Zentrum sofort. Dein Bauer d4 greift den Bauern e5 an, und danach bekommen deine Figuren offene Linien. Das bestraft passives Spiel.
Typisch ist ein offenes Zentrum ohne feste Bauernketten. In manchen Linien, etwa der Mieses-Variante, bekommt Schwarz sogar Doppelbauern auf der c-Linie. Dein Plan ist dann: Figuren entwickeln, Druck halten und die Initiative nicht mehr hergeben.
In deinem Dokument steht die Schottische Partie als Enterprise Grade, stabil bis über zweitausend Elo. Sie ist die Standardwaffe gegen Bauer e5.
Achte auf das Schottische Gambit mit Läufer c4. Das ist dein Schock-Modus, eine taktische Achterbahnfahrt. Wissende Gegner neutralisieren es mit Springer f6 und Bauer d5. Spiel es nur, wenn du Lust auf Chaos hast.`,
  },
  {
    id: 'smith-morra',
    kind: 'eroeffnung',
    refId: 'smith-morra',
    title: 'Smith-Morra-Gambit: Hintergrund und Grundidee',
    sources: [wiki('Smith%E2%80%93Morra_Gambit'), DOC],
    text: `Das Smith-Morra-Gambit ist deine Option A gegen das Sizilianische: Taktik statt Theorie. Es beginnt mit Bauer e4, Bauer c5, Bauer d4, Bauer schlägt d4 und dann Bauer c3.
Zur Herkunft: Der Name stammt von zwei Leuten. Laut Wikipedia sind es der Franzose Pierre Morra und Ken Smith vom Dallas Chess Club. Morra warb um das Jahr neunzehnhundertfünfzig mit einer Broschüre dafür. Smith schrieb später viele Bücher und Artikel darüber.
Die Grundidee: Du gibst einen Bauern. Nimmt Schwarz an, schlägst du mit dem Springer auf c3 zurück. Dafür bekommst du Tempo. Springer und Läufer kommen extrem schnell ins Spiel, der Läufer zielt von c4 auf f7. Dazu kommen Rochade, Dame e2 und Türme auf die offenen Linien.
Schwarz hat den Mehrbauern und eine Bauernmehrheit im Zentrum. Deshalb muss er genau die ersten Züge überleben und danach Material verteidigen.
In deinem Dokument ist das die Chaos-Option im Main Stack. Schwarz wird oft überrannt, bevor er seine Buchhaltung fertig hat. Die Skalierung ist gut bis etwa achtzehnhundert Elo.
Achte darauf: Viele Sizilianer lehnen das Gambit ab. Dann bist du ohne Bauernopfer unterwegs und spielst einfach Entwicklung. Wird dir das Risiko zu groß, ist die Alapin-Variante dein Upgrade.`,
  },
  {
    id: 'caro-kann',
    kind: 'eroeffnung',
    refId: 'caro-kann',
    title: 'Caro-Kann: Hintergrund und Grundidee',
    sources: [wiki('Caro%E2%80%93Kann_Defence'), DOC],
    text: `Die Caro-Kann-Verteidigung ist deine Festung gegen Bauer e4. In deinem Dokument ist sie der Docker-Container: stabil, logisch, mit starkem Endspiel. Sie beginnt mit Bauer e4, Bauer c6, Bauer d4 und Bauer d5.
Zur Herkunft: Laut Wikipedia heißt sie nach dem Engländer Horatio Caro und dem Österreicher Marcus Kann. Beide haben sie im Jahr achtzehnhundertsechsundachtzig analysiert, und die Analyse erschien in der Zeitschrift Brüderschaft.
Die Grundidee: Mit Bauer c6 bereitest du Bauer d5 vor. So kämpfst du um das Zentrum, ohne dich einzusperren. Anders als in der Französischen Verteidigung bleibt dein Läufer auf c8 frei. In der klassischen Variante entwickelst du ihn nach f5, bevor du Bauer e6 spielst.
Typisch ist eine sehr gesunde Bauernstruktur. Der c-Bauer stützt d5 und greift später mit Bauer c5 den Bauern d4 an.
Der Preis: Der Zug Bauer c6 kostet ein Tempo. Du kannst in der Entwicklung etwas hinterherhinken. Bleib deshalb ruhig und entwickle zielstrebig.
Im Dokument steht die Caro-Kann als Enterprise Grade, stabil bis Weltmeister-Niveau. Wenn du Ruhe willst und lieber im Endspiel gewinnst, ist das dein Werkzeug. Achte nur darauf, nicht passiv zu werden.`,
  },
  {
    id: 'budapest',
    kind: 'eroeffnung',
    refId: 'budapest',
    title: 'Budapester Gambit: Hintergrund und Grundidee',
    sources: [wiki('Budapest_Gambit'), DOC],
    text: `Das Budapester Gambit ist dein Chaos Monkey gegen Bauer d4. Es beginnt mit Bauer d4, Springer f6, Bauer c4 und dann Bauer e5. Du opferst einen Bauern und sprengst damit jede ruhige, geschlossene Stellung.
Zur Herkunft: Laut Wikipedia wurde es zum ersten Mal in einer lockeren Partie zwischen Mór Adler und Géza Maróczy in Budapest gespielt, am fünften März achtzehnhundertsechsundneunzig. Ernsthaft bekannt wurde es, als Milan Vidmar im Jahr neunzehnhundertachtzehn in Berlin damit Akiba Rubinstein schlug.
Die Grundidee: Schwarz gibt den Bauern e5 für schnelle Entwicklung. Typisch ist Springer g4, Läufer b4 mit Schach und Druck auf e5. Später kann sogar der Turm über a6 zum Königsflügel schwenken.
Dein Dokument nennt die Skalierung Bottleneck Warning: sehr stark bis etwa sechzehnhundert Elo. Danach wechselst du zu Nimzo-Indisch oder Tarrasch.
Und jetzt die Falle, dein tödlicher Exploit. Weiß schlägt auf e5, Springer geht nach g4, Läufer f4, Springer c6, Springer f3, Läufer b4 Schach, Springer bd2, Dame e7, Bauer a3. Dann schlägt dein Springer auf e5. Nimmt Weiß den Läufer mit dem Bauern, folgt Springer d3 und es ist ein ersticktes Matt.`,
  },
  {
    id: 'kings-indian',
    kind: 'eroeffnung',
    refId: 'kings-indian',
    title: 'Königsindischer Aufbau: Hintergrund und Grundidee',
    sources: [wiki('King%27s_Indian_Defence'), DOC],
    text: `Der Königsindische Aufbau ist dein Fallback. Er ist ein universelles System, das gegen fast alles funktioniert, vor allem gegen Bauer c4 und Springer f3. Die Bausteine merkst du dir leicht: Bauer g6, Läufer g7, Bauer d6.
Zur Herkunft: Laut Wikipedia galt die Verteidigung bis zur Mitte der dreißiger Jahre als zweifelhaft. Sowjetische Spieler wie Konstantinopolsky, Boleslawski und Bronstein machten sie respektabel und beliebt. Der heutige Name wird Hans Kmoch zugeschrieben.
Die Grundidee ist hypermodern. Du lässt Weiß ein breites Bauernzentrum bauen und greifst es später an. Dein Läufer auf g7 sitzt dafür auf der langen Diagonale und wartet.
Typische Pläne: Du sprengst das Zentrum mit Bauer e5 oder mit Bauer c5. Rückt Weiß mit Bauer d5 vor, kannst du am Damenflügel mit Bauer b5 spielen oder mit Bauer f5 einen Angriff am Königsflügel vorbereiten.
Die Stellungen werden unausgewogen, und genau das mögen wir. Jeder Flügel hat sein eigenes Spiel.
Im Dokument trägt er einen Prioritätsstern. Er ist die sichere Basis für alles, was du nicht vorbereitet hast. Achte darauf, den Aufbau nicht passiv zu spielen. Ohne den Gegenstoß ist er nur halb so gut.`,
  },
]
