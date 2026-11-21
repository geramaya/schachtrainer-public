import type { AudioText } from './types.ts'

const DOC = { kind: 'dokument', ref: 'docs/repertoire-v1.8.md' }
const wiki = (page: string) => ({ kind: 'wikipedia', ref: `https://en.wikipedia.org/wiki/${page}` })

/** Italienisch, Alapin, Wiener Partie: Hintergrund und Grundidee (Geschichte nur nach Wikipedia, Abruf 2026-11-20). */
export const openingTextsOpen: AudioText[] = [
  {
    id: 'italian',
    kind: 'eroeffnung',
    refId: 'italian',
    title: 'Italienische Partie: Hintergrund und Grundidee',
    sources: [wiki('Italian_Game'), wiki('Evans_Gambit'), DOC],
    text: `Die Italienische Partie ist deine Alternative gegen Bauer e5, wenn du es aggressiv willst. Sie beginnt mit Bauer e4, Bauer e5, Springer f3, Springer c6 und dann Läufer c4.
Zur Herkunft: Laut Wikipedia wurde die Eröffnung im sechzehnten Jahrhundert von Pedro Damiano und Giulio Polerio entwickelt. Spielsammlungen aus der Zeit um sechzehnhundertzwanzig führen sie ebenfalls. Der Name Giuoco Piano heißt traditionell ruhiges Spiel. Im Englischen setzte sich der Name Italian erst im späten zwanzigsten Jahrhundert durch, weil viele Linien alles andere als ruhig sind. Das Evans-Gambit mit Bauer b4 stammt aus dem frühen neunzehnten Jahrhundert und wurde schon im Wettkampf von La Bourdonnais gegen McDonnell im Jahr achtzehnhundertvierunddreißig gespielt.
Die Grundidee: Dein Läufer auf c4 ist der Scharfschütze. Er zielt auf f7, und dort steht nur der König als Verteidiger. Dein Dokument will keine ruhige Partie, sondern die taktische Entscheidung.
Zwei Wege: Gegen Läufer c5 spielst du Bauer b4, das Evans-Gambit. Gegen Springer f6 spielst du Springer g5 und greifst f7 an, das ist der Springerangriff mit dem Fried Liver.
Das Dokument nennt es High Risk, High Reward, besonders stark gegen unvorbereitete Gegner bis siebzehnhundert Elo. Als Chamäleon kannst du mit einem frühen Bauern d4 in schottische Strukturen wechseln. Der Preis der Gambits: Du gibst Material für Initiative.`,
  },
  {
    id: 'alapin',
    kind: 'eroeffnung',
    refId: 'alapin',
    title: 'Alapin-Variante: Hintergrund und Grundidee',
    sources: [wiki('Sicilian_Defence,_Alapin_Variation'), DOC],
    text: `Die Alapin-Variante ist deine solide Option gegen das Sizilianische. Sie beginnt mit Bauer e4, Bauer c5 und dann Bauer c3.
Zur Herkunft: Laut Wikipedia heißt sie nach dem russischen Meister Semyon Alapin, der von achtzehnhundertsechsundfünfzig bis neunzehnhundertdreiundzwanzig lebte. Frühe Kritiker wie Tarrasch und Korn lehnten sie ab, weil Schwarz mit Bauer d5 leicht ausgleichen konnte. Heute gilt sie als eine der solidesten Anti-Sizilianischen Varianten. Unter anderen haben Anand, Kasparov, Karpov, Topalov und Kramnik sie gespielt. Auch der Computer Deep Blue wählte sie im Jahr neunzehnhundertsechsundneunzig gegen Kasparov.
Die Grundidee: Der Bauer c3 bereitet Bauer d4 vor. Du baust ein klassisches Zentrum mit Bauern auf e4 und d4, statt dich in die Theorie des offenen Sizilianers zu stürzen. Dein Dokument nennt das die Clean-Code-Lösung. Sie nimmt dem Sizilianer die Schärfe.
Zwei Antworten solltest du kennen. Auf Bauer d5 schlägst du auf d5, Schwarz nimmt mit der Dame zurück, und du spielst Bauer d4. Auf Springer f6 stößt du mit Bauer e5 vor, der Springer geht nach d5, und du spielst auch hier Bauer d4.
Im Dokument ist die Alapin stabil bis Weltmeister-Niveau. Wird dir das Smith-Morra-Gambit zu riskant, ist sie dein Upgrade.`,
  },
  {
    id: 'vienna',
    kind: 'eroeffnung',
    refId: 'vienna',
    title: 'Wiener Partie: Hintergrund und Grundidee',
    sources: [wiki('Vienna_Game'), DOC],
    text: `Die Wiener Partie ist dein Sicherheits-Hybrid gegen Bauer e5. Sie beginnt mit Bauer e4, Bauer e5 und Springer c3.
Zur Herkunft: Laut Wikipedia ist sie nach Wien benannt. Eine Besprechung der New York Times von achtzehnhundertachtundachtzig nannte sie die einzige neue Eröffnung seit Morphy. Wilhelm Steinitz bevorzugte das Steinitz-Gambit mit Bauer f4. Der Österreicher Carl Hamppe ist mit dem Hamppe-Muzio-Gambit verbunden. Nick de Firmian schreibt in Modern Chess Openings, dass sie bei bestem Spiel zum Ausgleich führt.
Die Grundidee: Dein Springer c3 deckt den Bauern e4, und der Läufer f1 bleibt frei. Dein Dokument beschreibt die Struktur mit Springer c3 und Bauern auf e4 und d3 als spiegelverkehrtes Londoner System. Viele Spieler auf deinem Niveau sind nur auf Springer f3 vorbereitet, du holst sie aus ihrer Vorbereitung.
Das Besondere: Du kannst ruhig bleiben oder das Feuer eröffnen. Der Bauer f4, das Wiener Gambit, ist laut Wikipedia im Kern ein verzögertes Königsgambit: Du opferst einen Bauern für das Zentrum.
Das Dokument nennt es Stabilität mit der Option auf Feuer. Beachte: Den ruhigen dritten Zug, Springer f3, hat dieser Trainer gewählt, das Dokument nennt ihn nicht.`,
  },
]
