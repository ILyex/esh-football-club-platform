# Sound effects

The Android app bundles short sound effects and keeps playback fully offline:

- `sound_success_chime.mp3` (`success-chime`, CC0): successful login.
- `sound_goal_winner.wav` (generated in-repo, no speech): a soft four-note major arpeggio for a successfully saved goal event.
- `sound_notification_pop.mp3` (`notification-pop`, CC0): new match and meeting push notifications.

The app sound toggle in the overflow menu controls all three. In-app cues use Android sonification audio attributes, a moderate volume, and are suppressed when the phone is muted or vibrating. Push notification audio follows the app toggle through separate Android sound and silent notification channels, and remains subject to the user's Android notification settings.

The goal chime is generated from sine-wave partials by `tools/generate_goal_chime.py`; it contains no sampled voice, crowd, or commentary.

Sources for the other cues: [Soundcn website](https://soundcn.xyz/), [Soundcn source and license](https://github.com/kapishdima/soundcn).
