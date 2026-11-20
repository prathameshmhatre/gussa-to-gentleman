import { PoliteResult, Tone } from './translate.service';

// ---------------------------------------------------------------------------
// Offline backup: used when the API is down or out of free quota.
// Simple keyword matching, no AI. Add your team's favourite rants here!
// ---------------------------------------------------------------------------

interface Entry {
  keywords: string[];
  meaning: string;
  idiom: string;
  idiomMeaning: string;
  replies: Record<Tone, string>;
  rageLevel: number;
}

const ENTRIES: Entry[] = [
  {
    keywords: ['requirement', 'badal', 'change', 'scope', 'naya', 'phir se', 'बदल'],
    meaning: 'The client keeps changing the requirements and it is exhausting.',
    idiom: 'Moving the goalposts',
    idiomMeaning: 'Changing the rules or targets after work has already started.',
    replies: {
      polite: 'Thanks for the update. Could we confirm the final requirements before we continue, so we deliver exactly what you need?',
      british: 'Just to make sure we are all on the same page, could we agree the goalposts and perhaps leave them where they are for this sprint?',
      firm: 'Happy to take this on as a change request. Once the scope is confirmed in writing, we will share a revised estimate and timeline.',
    },
    rageLevel: 4,
  },
  {
    keywords: ['deadline', 'kal tak', 'urgent', 'asap', 'jaldi', 'aaj hi', 'today itself'],
    meaning: 'The client wants something impossible done by tomorrow.',
    idiom: 'Rome was not built in a day',
    idiomMeaning: 'Good things take time; you cannot rush important work.',
    replies: {
      polite: 'We understand this is urgent. To keep the quality high, could we agree a realistic date, or prioritise the most critical part first?',
      british: 'We are keen to help, though even Rome took slightly longer than a day. Shall we agree which part matters most for tomorrow?',
      firm: 'Delivering all of this by tomorrow is not feasible without risking quality. We can deliver [part] by tomorrow and the rest by [date].',
    },
    rageLevel: 4,
  },
  {
    keywords: ['meeting', 'call', 'pointless', 'bakwas', 'time waste', 'faltu'],
    meaning: 'That meeting was a complete waste of time.',
    idiom: 'Talking round in circles',
    idiomMeaning: 'Discussing something for a long time without reaching a decision.',
    replies: {
      polite: 'Thanks for the discussion. To keep things moving, could we share a short agenda and decisions needed before the next call?',
      british: 'Lovely chat, as ever. Might it be worth sending a quick agenda next time, so we can reach a decision before the tea goes cold?',
      firm: 'To use everyone\'s time well, let us move this to email, and only meet once we have the specific decisions listed.',
    },
    rageLevel: 2,
  },
  {
    keywords: ['reply', 'jawab', 'response', 'ignore', 'no response', 'ghost', 'pending'],
    meaning: 'The client is not replying and we are blocked.',
    idiom: 'The ball is in your court',
    idiomMeaning: 'It is now the other person\'s turn to act or decide.',
    replies: {
      polite: 'Just following up on my earlier message. Once we hear back from you, we can continue straight away.',
      british: 'Just gently nudging this back to the top of your inbox. The ball is very much in your court whenever you are ready.',
      firm: 'We are currently blocked waiting on your input. Without a reply by [date], the delivery date will need to move accordingly.',
    },
    rageLevel: 3,
  },
  {
    keywords: ['bug', 'galti', 'blame', 'hamari galti nahi', 'not our fault', 'unka issue'],
    meaning: 'They are blaming us for a problem that is not our fault.',
    idiom: 'Pointing the finger',
    idiomMeaning: 'Blaming someone, often unfairly.',
    replies: {
      polite: 'Thanks for flagging this. We have looked into it and it seems to originate from [system]. Happy to work together on a fix.',
      british: 'Thank you for raising this. Having had a good look, the root cause appears to sit just outside our garden, but we are very happy to help tidy it up.',
      firm: 'We have investigated and the issue is caused by [system], not our change. We can support the fix once the owning team is engaged.',
    },
    rageLevel: 4,
  },
  {
    keywords: ['weekend', 'chutti', 'leave', 'holiday', 'saturday', 'sunday', 'overtime'],
    meaning: 'They want me to work on my weekend or leave.',
    idiom: 'Burning the candle at both ends',
    idiomMeaning: 'Working too hard for too long, without enough rest.',
    replies: {
      polite: 'I am away over the weekend, but I will pick this up first thing on Monday. Please let me know if anything needs to be prioritised.',
      british: 'I am afraid I am off over the weekend, recharging so I can give this my full attention first thing Monday morning.',
      firm: 'I am not available this weekend. I will prioritise this on Monday, and [colleague] can help if anything is truly critical.',
    },
    rageLevel: 3,
  },
  {
    keywords: ['samajh', 'understand', 'explain', 'kitni baar', 'again and again', 'bar bar'],
    meaning: 'I have explained this many times and they still do not get it.',
    idiom: 'Like talking to a brick wall',
    idiomMeaning: 'Explaining something to someone who is not taking it in.',
    replies: {
      polite: 'Let me put together a short written summary with an example, so we have one clear reference for everyone.',
      british: 'Perhaps a quick written summary might help, just so we all have it in black and white for future reference.',
      firm: 'As discussed on [date], the approach is [summary]. Let us treat this as the agreed reference going forward.',
    },
    rageLevel: 3,
  },
];

const DEFAULT_ENTRY: Entry = {
  keywords: [],
  meaning: 'Things are not going well with the client today.',
  idiom: 'Keep calm and carry on',
  idiomMeaning: 'Stay calm and keep going, even when things are difficult.',
  replies: {
    polite: 'Thanks for your message. Let me look into this and come back to you with a clear update shortly.',
    british: 'Thank you ever so much for this. Leave it with me and I will come back to you shortly.',
    firm: 'Noted. I will review this and share a clear plan and next steps by [time].',
  },
  rageLevel: 2,
};

const RAGE_LABELS = ['Mildly miffed', 'A bit put out', 'Rather cross', 'Absolutely livid', 'Kettle about to explode'];

export function offlineTranslate(text: string, tone: Tone): PoliteResult {
  const lower = text.toLowerCase();
  const scored = ENTRIES.map((entry) => ({
    entry,
    score: entry.keywords.filter((k) => lower.includes(k)).length,
  })).sort((a, b) => b.score - a.score);

  const entry = scored[0]?.score ? scored[0].entry : DEFAULT_ENTRY;
  // Exclamation marks and caps add a little extra rage, just for fun.
  const extra = (text.match(/!/g)?.length ?? 0) > 2 || text === text.toUpperCase() ? 1 : 0;
  const rageLevel = Math.min(5, entry.rageLevel + extra);

  return {
    meaning: entry.meaning,
    idiom: entry.idiom,
    idiomMeaning: entry.idiomMeaning,
    reply: entry.replies[tone],
    rageLevel,
    rageLabel: RAGE_LABELS[rageLevel - 1],
    provider: 'offline',
  };
}

/** Example rants for the "try one" chips. */
export const EXAMPLE_RANTS = [
  'Yaar ye client har din requirement badal deta hai, dimaag kharab kar diya',
  'Kal tak deliver karna hai bol raha hai, pagal hai kya',
  'Teen din se reply nahi kiya aur ab bol rahe hain hum late hain',
  'Kitni baar samjhaun same cheez, bar bar wahi sawaal',
];
