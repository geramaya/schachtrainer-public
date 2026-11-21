export interface AudioText {
  id: string
  kind: 'eroeffnung' | 'variante'
  refId: string
  title: string
  text: string
  sources: { kind: string; ref: string }[]
}
