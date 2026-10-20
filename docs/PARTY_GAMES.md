# Two games for the room

Use the same QR lobby and phones. Both party games need at least four people. No typing, microphones or downloads are required. Speak Hindi, English, Hinglish or any shared language.

## Kaun Feku?

1. Hold your phone card to peek. Everyone sees one secret word except the bluffer, who only knows their role. Tap ready.
2. The projector gives everyone a turn to say one related word aloud. A specific clue builds trust but might teach the bluffer the answer. A vague clue can make you look suspicious.
3. Discuss, then vote privately on your phone. Votes lock once. You cannot vote for yourself.
4. A tied vote or accusing an informed player lets the bluffer escape: +3 to the bluffer.
5. If caught, the bluffer has one chance to pick the secret word from the eight-word board. A correct answer steals the round for +3. Otherwise each informed player earns +2.
6. The host advances after the vote receipts and answer are revealed. Everyone is the bluffer once; highest individual score wins. Nobody is eliminated.

Timers move stalled stages along; the host can advance clues and discussion early or pause. Silence is not a vote. No votes means the bluffer escapes. A skipped last guess fails.

There are 64 original word cards across eight familiar topics. Role order, clue order and word cards shuffle each game. Cards can recur across separate games; replay value also depends on the people and clues, not just the deck size.

Inspired by the hidden-information/clue dilemma of [The Chameleon](https://bigpotato.co.uk/products/the-chameleon-copy). Uses original content, presentation and implementation.

## Same Soch

1. Join complete pairs. One partner privately sees a target on a 0–100 spectrum, such as **Light snack → Full meal**.
2. They say an example aloud that they think belongs at that position. No numbers, percentages, coded signals or pointing at the scale. This is a spoken honour rule, not something the app can automatically police.
3. Their partner and every rival player slide and lock a guess on their own phones. The clue-giver cannot submit a guess. Individual guesses stay private until the reveal.
4. The clue-giver's pair uses their partner's estimate. Rival pairs use the rounded average of their submitted estimates. If only one rival partner submits, that estimate counts; no submission means no points.
5. Within 3 points of the target earns **5**, within 10 earns **3**, within 25 earns **1**. Further away earns zero. Score bands are inclusive.
6. Reveal target, individual guesses, pair estimates and points together. Both partners give a clue once. Highest pair total wins, with shared ranks for ties.

A missing clue earns no points for that round. In a real group the host controls when the reveal ends. Demo-only rooms advance automatically. There are 32 original scales, shuffled without repetition within a game.

Inspired by the interpretation/spectrum mechanic of [Wavelength](https://www.wavelength.zone/). The all-pairs guessing, averaging, scoring and content here are this prototype's implementation choices.

## Phone and sound decisions

Portrait controls use a hold-to-peek card, large named player/word choices, or a thumb-sized slider plus a commit button. The card closes on release, blur or pointer cancellation. Optional effects mark dealing, voting, a caught bluffer, escape, reveal and a bullseye. Haptics have equivalent visual feedback when unsupported.

[AirConsole's phone-controller guidance](https://documentation.airconsole.com/smartphones-as-controllers) informed avoiding virtual joysticks, keeping touch regions large and reserving private information for phones.

## What validation establishes

Automated checks cover secret visibility, role/turn restrictions, committed votes, ties, scoring boundaries, timeouts, stale requests, pauses, rematches, complete demo sessions and a four-phone HTTP round. They establish rule and connection behaviour. They do not establish that a group finds either game funny; that still needs an actual group playtest.
