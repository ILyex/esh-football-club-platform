"""Generate the offline, speech-free goal chime bundled by the Android app."""

import math
import struct
import wave
from pathlib import Path


RATE = 44_100
LENGTH_SECONDS = 1.55
OUTPUT = Path(__file__).parents[1] / "app/src/main/res/raw/sound_goal_winner.wav"
OLD_MP3 = OUTPUT.with_suffix(".mp3")
NOTES = ((0.00, 523.25), (0.17, 659.25), (0.34, 783.99), (0.51, 1046.50))


def main() -> None:
    samples = [0.0] * int(RATE * LENGTH_SECONDS)
    for start, frequency in NOTES:
        start_index = int(start * RATE)
        for index in range(start_index, len(samples)):
            elapsed = (index - start_index) / RATE
            if elapsed > 0.94:
                break
            attack = min(1.0, elapsed / 0.012)
            envelope = attack * math.exp(-3.7 * elapsed)
            # A soft bell-like major arpeggio made from pure tones; no voice or samples.
            tone = math.sin(2 * math.pi * frequency * elapsed)
            tone += 0.18 * math.sin(2 * math.pi * frequency * 2.01 * elapsed)
            tone += 0.045 * math.sin(2 * math.pi * frequency * 3.98 * elapsed)
            samples[index] += 0.16 * envelope * tone

    peak = max(abs(sample) for sample in samples) or 1.0
    scale = min(1.0, 0.42 / peak)
    with wave.open(str(OUTPUT), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(
            b"".join(
                struct.pack("<h", int(max(-1.0, min(1.0, sample * scale)) * 32767))
                for sample in samples
            )
        )
    OLD_MP3.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
