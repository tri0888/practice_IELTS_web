"""
Seed Telegram voice-message file_ids for flashcard pronunciation.

Run this ONCE PER BOT (dev / prod) on your local machine. It:
  1. Reads the vocabulary list (MongoDB, or config/Vocabulary.json fallback).
  2. For each word not yet cached for this bot: Edge-TTS -> MP3 -> ffmpeg (OGG/Opus)
     -> bot.send_voice(SEED_CHAT_ID) -> stores the returned file_id in MongoDB
     (collection `flashcard_audio`, keyed by bot_id + vocab + voice).

Runtime (the bot handler) then only reads the cached file_id and re-sends it,
so production needs neither Edge-TTS nor ffmpeg.

Requirements (local only): pip install -r backend/requirements-seed.txt
Env (backend/.env):
    TELEGRAM_BOT_TOKEN   -> the bot you are seeding for (switch it to seed the other bot)
    SEED_CHAT_ID         -> your telegram numeric id (you must have /start-ed this bot)
    FLASHCARD_TTS_VOICE  -> optional, default en-GB-SoniaNeural

Usage (from backend/):
    python -m scripts.seed_flashcard_tts
    python -m scripts.seed_flashcard_tts --limit 5   # test with a few words first
"""
import os
import sys
import asyncio
import argparse
import subprocess
from pathlib import Path

# scripts/ lives directly under backend/
scripts_dir = Path(__file__).resolve().parent
backend_dir = scripts_dir.parent
sys.path.append(str(backend_dir))

from dotenv import load_dotenv
load_dotenv(dotenv_path=backend_dir / ".env")

import edge_tts
import imageio_ffmpeg
from telegram import Bot
from telegram.request import HTTPXRequest

from app.models import database as db
from app.modules.vocabulary import services as vocab_services
from app.modules.telegram import services as tg_services


async def synth_mp3(text: str, voice: str) -> bytes:
    """Generate MP3 audio bytes from text using Edge-TTS."""
    communicate = edge_tts.Communicate(text, voice)
    buf = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.extend(chunk["data"])
    return bytes(buf)


def mp3_to_ogg_opus(mp3_bytes: bytes) -> bytes:
    """Convert MP3 bytes to OGG/Opus (mono, 48kHz) required by Telegram sendVoice."""
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    proc = subprocess.run(
        [
            ffmpeg_exe, "-hide_banner", "-loglevel", "error",
            "-i", "pipe:0",
            "-c:a", "libopus", "-b:a", "32k", "-ac", "1", "-ar", "48000",
            "-f", "ogg", "pipe:1",
        ],
        input=mp3_bytes,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError(
            f"ffmpeg conversion failed (code {proc.returncode}): "
            f"{proc.stderr.decode('utf-8', 'ignore')[:400]}"
        )
    return proc.stdout


async def main():
    parser = argparse.ArgumentParser(description="Seed flashcard TTS file_ids.")
    parser.add_argument("--limit", type=int, default=0, help="Only seed the first N missing words (0 = all).")
    parser.add_argument("--delay", type=float, default=1.0, help="Seconds to sleep between sends (rate-limit safety).")
    args = parser.parse_args()

    token = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
    if not token:
        print("ERROR: TELEGRAM_BOT_TOKEN is not set in backend/.env")
        sys.exit(1)

    chat_id_raw = (os.getenv("SEED_CHAT_ID") or "").strip()
    if not chat_id_raw:
        print("ERROR: SEED_CHAT_ID is not set in backend/.env (your telegram numeric id).")
        sys.exit(1)
    chat_id = int(chat_id_raw)

    voice = tg_services.FLASHCARD_TTS_VOICE
    bot_id = int(token.split(":")[0])

    if not db.is_available():
        print("ERROR: MongoDB is not available; cannot store file_ids.")
        sys.exit(1)

    coll = db.flashcard_audio_collection()
    if coll is None:
        print("ERROR: flashcard_audio collection is not available.")
        sys.exit(1)

    # Ensure the unique key so re-runs upsert cleanly.
    coll.create_index([("bot_id", 1), ("vocab", 1), ("voice", 1)], unique=True)

    # Load vocabulary
    vocab_services.ensure_vocab_loaded()
    words = [item.get("vocab", "").strip() for item in vocab_services.vocab_list]
    words = [w for w in words if w]

    # Skip words already cached for this bot + voice (resumable).
    already = set(
        d["vocab"] for d in coll.find({"bot_id": bot_id, "voice": voice}, {"vocab": 1})
    )
    todo = [w for w in words if w.lower() not in already]
    if args.limit > 0:
        todo = todo[: args.limit]

    print(f"Bot id       : {bot_id}")
    print(f"Voice        : {voice}")
    print(f"Seed chat_id : {chat_id}")
    print(f"Total words  : {len(words)} | already cached: {len(already)} | to seed: {len(todo)}")
    if not todo:
        print("Nothing to seed. Done.")
        return

    request = HTTPXRequest(connect_timeout=30.0, read_timeout=30.0)
    ok, failed = 0, 0

    async with Bot(token, request=request) as bot:
        me = await bot.get_me()
        print(f"Authenticated as @{me.username} (id={me.id})\n")

        for i, word in enumerate(todo, 1):
            try:
                mp3 = await synth_mp3(word, voice)
                ogg = mp3_to_ogg_opus(mp3)
                msg = await bot.send_voice(chat_id=chat_id, voice=ogg)
                file_id = msg.voice.file_id
                tg_services.save_flashcard_file_id(bot_id, word, voice, file_id)
                ok += 1
                print(f"[{i}/{len(todo)}] OK  {word}  -> {file_id[:24]}...")
            except Exception as e:
                failed += 1
                print(f"[{i}/{len(todo)}] ERR {word}: {e}")
            await asyncio.sleep(args.delay)

    print(f"\nDone. Seeded: {ok}, failed: {failed}.")


if __name__ == "__main__":
    asyncio.run(main())
