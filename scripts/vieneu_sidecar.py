"""Persistent VieNeu-TTS worker used by the Electron application."""

from __future__ import annotations

import importlib.metadata
import json
import os
from pathlib import Path
import sys
import time
import traceback
from typing import Any


sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")

_tts = None
_custom_voices_loaded: set[str] = set()

CUSTOM_VOICES = {
    "Ngoc-Huyen-Clone": {
        "label": "Ngọc Huyền (clone)",
        "description": "Nữ miền Bắc · Giọng clone được cấp phép",
        "reference": (
            Path(__file__).resolve().parent.parent
            / "data"
            / "voice-references"
            / "ngoc-huyen-vbee.wav"
        ),
        "style": "tu_nhien",
    }
}


def emit(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def load_tts():
    global _tts
    if _tts is None:
        from vieneu import Vieneu

        _tts = Vieneu(
            mode="v3turbo",
            device="cpu",
            backend="onnx",
            precision="int8",
            threads=min(max((os.cpu_count() or 8) // 2, 1), 8),
        )
    return _tts


def voice_options() -> list[dict[str, str]]:
    package_dir = Path(__file__).resolve().parent.parent / "data" / "local-models" / "vieneu"
    venv_voice_file = (
        package_dir
        / ".venv"
        / "Lib"
        / "site-packages"
        / "vieneu"
        / "assets"
        / "voices_v3_turbo.json"
    )
    if not venv_voice_file.exists():
        return []
    payload = json.loads(venv_voice_file.read_text(encoding="utf-8"))
    options = [
        {
            "id": voice_id,
            "label": voice_id,
            "description": str(voice.get("description", "")),
        }
        for voice_id, voice in payload.get("presets", {}).items()
    ]
    options.extend(
        {
            "id": voice_id,
            "label": config["label"],
            "description": config["description"],
        }
        for voice_id, config in CUSTOM_VOICES.items()
        if config["reference"].exists()
    )
    return options


def ensure_custom_voice(tts, voice: str) -> None:
    if voice in _custom_voices_loaded:
        return
    config = CUSTOM_VOICES.get(voice)
    if config is None:
        return
    reference = config["reference"]
    if not reference.exists():
        raise FileNotFoundError(f"Custom voice reference is missing: {reference}")
    tts.add_voice(
        voice,
        reference,
        denoise=False,
        use_ref_codes=True,
        description=config["description"],
        gender="female",
        style=config["style"],
        save=False,
    )
    _custom_voices_loaded.add(voice)


def handle(request: dict[str, Any]) -> dict[str, Any]:
    command = request.get("command")
    if command == "health":
        return {
            "ok": True,
            "installed": True,
            "loaded": _tts is not None,
            "version": importlib.metadata.version("vieneu"),
            "backend": "ONNX int8 / CPU",
            "voices": voice_options(),
        }

    if command == "synthesize":
        text = str(request.get("text", "")).strip()
        output_path = Path(str(request.get("outputPath", ""))).resolve()
        voice = str(request.get("voice", "")).strip()
        if not text:
            raise ValueError("Text is empty.")
        if not output_path.name:
            raise ValueError("Output path is missing.")

        started = time.perf_counter()
        tts = load_tts()
        ensure_custom_voice(tts, voice)
        available = {voice_id for _label, voice_id in tts.list_preset_voices()}
        if voice not in available:
            raise ValueError(f"Voice '{voice}' is unavailable.")
        voice_data = tts.get_preset_voice(voice)
        audio = tts.infer(
            text=text,
            voice=voice,
            style=voice_data.get("style", "tu_nhien"),
            temperature=0.8,
            max_chars=256,
            apply_watermark=True,
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)
        tts.save(audio, output_path)
        return {
            "ok": True,
            "outputPath": str(output_path),
            "sampleRate": 48000,
            "samples": len(audio),
            "elapsedSeconds": round(time.perf_counter() - started, 3),
        }

    if command == "shutdown":
        return {"ok": True, "shutdown": True}

    raise ValueError(f"Unknown command: {command}")


def main() -> None:
    emit({"event": "ready"})
    for line in sys.stdin:
        request_id = None
        try:
            request = json.loads(line)
            request_id = request.get("id")
            response = handle(request)
            emit({"id": request_id, **response})
            if response.get("shutdown"):
                return
        except Exception as error:
            emit(
                {
                    "id": request_id,
                    "ok": False,
                    "error": str(error),
                    "detail": traceback.format_exc(limit=3),
                }
            )


if __name__ == "__main__":
    main()
