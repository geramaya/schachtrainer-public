import type { QuipTags, QuipVoices } from '../../src/audio/quip-audio.ts'

/**
 * The ONE place to change the teacher voices, expression tags and the speech model of the quips (preliminary assignment).
 * Model: OpenRouter `elevenlabs/eleven-v4` (80 USD per million characters, mp3). Voices of that model: george, sarah, adam,
 * alice, bella, bill, brian, callum, charlie, chris, daniel, eric, harry, jessica, laura, liam, lily, matilda, river, roger, will.
 * Listen first: `npm run audio:lehrer -- --proben` writes one sample per voice to public/audio/proben/elevenlabs/.
 * After a change run `npm run audio:lehrer` again: texts with a changed voice, tag or model are generated anew.
 * All other texts (explanations) stay with HeyGen / nadine; they are not configured here.
 */
export const QUIP_MODEL = 'elevenlabs/eleven-v4'

/** Language hint sent to the speech provider (ElevenLabs `language_code`); '' = none. */
export const QUIP_LANGUAGE = 'de'

export const QUIP_VOICES: QuipVoices = {
  mann: 'chris',
  frau: 'alice',
  meister: 'bill',
  fuchs: 'callum',
}

/** Expression tag in front of each quip (ElevenLabs v4 audio tags in square brackets, e.g. [sarcastic] [laughs] [whispers] [excited] [warm] [mischievous]); '' = none. Never shown in the app. */
export const QUIP_TAGS: QuipTags = {
  mann: '[cheerful]',
  frau: '[sarcastic]',
  meister: '[warm]',
  fuchs: '[mischievous]',
}
