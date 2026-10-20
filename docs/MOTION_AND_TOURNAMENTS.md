# Arcade games, optional motion input and Club Cup

## Duck Pop

2–8 players share one shooting gallery. Each has a labelled, coloured crosshair. Three 30-second heats; a five-second countdown starts each heat. On your phone, drag the pad to aim or choose **Use tilt**, hold the phone comfortably and gently tilt your wrist. Use **Re-centre** whenever needed. Tap **POP** to shoot. The server checks hits; the first accepted hit claims a duck. Normal ducks earn 10, golden ducks 20; each third consecutive hit adds 5. Misses break the streak. A 0.6-second recharge prevents rapid tapping from winning by itself. Highest total across three heats wins.

This is a tilt-controlled cursor, calibrated relative to the player's comfortable grip. It does not measure an absolute location on the projector wall. No camera or microphone is used. Different network delays can affect contested targets; score validation limits timestamp rewind to 200ms but is not a competitive anti-cheat system.

## Gully Grand Prix

2–8 players race three heats, each on the same seeded obstacle course. Each player has a visible road strip with three lanes, a live position and a progress meter. Cars accelerate automatically. Tilt left/right to change lane, returning to centre between movements, or use the large left/right buttons. Spend three boosts per heat. Collisions slow the car briefly. The finish line is 2200m away; a heat ends when everyone finishes or after 45 seconds. Finishers rank by time, unfinished racers by distance. Placings earn 10, 9, 8… race points; tied positions share points. Highest total wins.

It is a three-lane obstacle race, not a realistic steering/vehicle simulator. The projected course and vehicles are original SVG/CSS artwork. The phone controls remain usable without sensors.

## Motion support

- HTTPS is required. Some browsers, including supported Safari versions, require a motion permission request from a user gesture; **Use tilt** provides that gesture.
- The app checks availability, handles declined permission and missing readings, and retains touch controls.
- Initial calibration and re-centring use the current grip. Coordinate mapping accounts for screen rotation and angle wrap.
- Relative mapping is unit-tested. Real sensor delivery, sensitivity, comfort, network feel and iOS/Android haptics require physical-device playtesting. A desktop preview does not validate those.

References: [MDN: requesting orientation permission](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static), [MDN: detecting device orientation](https://developer.mozilla.org/en-US/docs/Web/API/Device_orientation_events/Detecting_device_orientation).

## Live connection

The same Node service now accepts authenticated WebSocket connections. Only a joined player can submit controls, and the projector token cannot shoot or steer. Origins are checked against the host/configured frontend origins. Private state is still generated per recipient. Aim updates are coalesced for the projector and stale reticles disappear. Race state is sampled at 10Hz and rendered between samples. Existing HTTP polling remains a reconnect fallback for room state; arcade controls require the live connection.

## Club Cup

In the lobby choose **Tournament**, select games, then run the playlist once, twice or three times. At least two matches are required. All tournament games use individual scoring, and the same people stay in the room. After each complete game, finishing place awards **10, 8, 6, 5, 4, 3, 2, 1** cup points. Ties share the same placing award. Raw shooting, racing and party scores are not added together. The host advances to the next match and finally shows the overall standings. A new tournament resets cup totals. Returning to the lobby ends the active tournament.

Rooms and tournaments remain in memory. A deployment, process restart or sleeping free host clears them. This does not add a database or a paid realtime provider.
