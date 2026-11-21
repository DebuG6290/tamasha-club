# Two quick games for one big screen

Both games use the usual QR lobby and room code. They support 2–8 players, require no motion sensors, and count as individual games in the Club Cup. Lock choices on your phone; the shared screen handles the race clock and reveals.

## Bazaar Khoj

Find a stall that has **both** objects named on the big screen. A single clue matches several stalls; the two together identify one. Use the A1–D4 grid on your phone to lock one stall. The phone also has a board reference for players who cannot see the shared screen clearly.

There are six rounds. After a three-second ready screen you have 24 seconds to choose. The reveal shows the stall and who found it. Every correct player gets one point, regardless of arrival order. Wrong answers and timeouts score zero. The next round starts after the reveal. Highest total wins; ties share rank.

High-level inspiration: [Crowd Search](https://www.bored.com/arcade/crowd-search/). The 16-stall market, two-object clues, original visuals and multiplayer rules are specific to Tamasha Club.

## Bas, Ab Nahi!

The meter offers 2, 4, 7, 11, 16 and up to 22 points in four short rounds. During each six-second decision window, choose **Bank** to keep the displayed offer or **Push** to try the next step. A missed input defaults to Bank. Everyone's choice is private while the clock runs. Banked players watch the rest of the round and rejoin on the next.

The server privately picks a burst step of 2, 3, 4, 5 or 6, or no burst, with equal probability each round. The first offer is safe. If the meter bursts, only players still pushing lose their unbanked round points. Reaching the cap banks 22 automatically. The reveal shows results and the hidden threshold. Highest total wins; ties share rank. There is no money or stake.

High-level inspiration: the one-sentence restraint premise of [Do not flip](https://www.bored.com/arcade/do-not-flip/). The simultaneous bank/push mechanic, scoring, art and code are original.

## Validation

Run `npm test` and `npm run build`. Coverage includes eight controller sessions, equal-time scoring, private lock and threshold handling, paused clocks, expired and stale actions, tournaments, and final standings. Local browser checks are not a substitute for an actual group session on a projector.
