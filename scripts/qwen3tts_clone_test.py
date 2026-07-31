from pathlib import Path

import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel


PROJECT_ROOT = Path(__file__).resolve().parent.parent
REFERENCE_AUDIO = PROJECT_ROOT / "vbee-ngoc-huyen-reference.wav"
OUTPUT_AUDIO = PROJECT_ROOT / "data" / "qwen3tts" / "ngoc-huyen-clone-test.wav"
MODEL_CACHE = PROJECT_ROOT / "data" / "local-models" / "qwen3tts" / "huggingface"
MODEL_ID = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"

REFERENCE_TEXT = (
    "Sáng nay, Hà mở cửa sổ và thấy nắng vàng trải nhẹ trên con phố nhỏ. "
    "Cô pha một tách cà phê, kiểm tra lịch làm việc rồi gọi cho Minh: "
    "“Khoảng tám giờ rưỡi, chúng ta gặp nhau ở số hai mươi bảy Nguyễn Trãi nhé.” "
    "Ngoài trời hơi lạnh, nhưng không khí rất dễ chịu. Hà mỉm cười và nói: "
    "“Hôm nay chắc chắn sẽ là một ngày tuyệt vời!” Sau cuộc hẹn, cô ghé cửa hàng "
    "mua ba quả cam, một hộp sữa và chiếc bánh giá bốn mươi lăm nghìn đồng."
)

TEST_TEXT = (
    "Bạn đã bao giờ mua một món đồ rất nhỏ, nhưng lại thấy nó hữu ích hơn mong đợi chưa? "
    "Mình vừa thử sản phẩm này và kết quả khá bất ngờ."
)


def main() -> None:
    if not REFERENCE_AUDIO.exists():
        raise FileNotFoundError(f"Missing reference audio: {REFERENCE_AUDIO}")

    OUTPUT_AUDIO.parent.mkdir(parents=True, exist_ok=True)
    MODEL_CACHE.mkdir(parents=True, exist_ok=True)
    snapshot_root = MODEL_CACHE / "models--Qwen--Qwen3-TTS-12Hz-0.6B-Base" / "snapshots"
    snapshots = list(snapshot_root.glob("*"))
    model_source = str(snapshots[0]) if snapshots else MODEL_ID

    use_cuda = torch.cuda.is_available()
    model = Qwen3TTSModel.from_pretrained(
        model_source,
        cache_dir=str(MODEL_CACHE),
        device_map="cuda:0" if use_cuda else "cpu",
        dtype=torch.float16 if use_cuda else torch.float32,
    )
    prompt = model.create_voice_clone_prompt(
        ref_audio=str(REFERENCE_AUDIO),
        ref_text=REFERENCE_TEXT,
        x_vector_only_mode=False,
    )
    wavs, sample_rate = model.generate_voice_clone(
        text=TEST_TEXT,
        language="Auto",
        voice_clone_prompt=prompt,
        max_new_tokens=2048,
    )
    sf.write(OUTPUT_AUDIO, wavs[0], sample_rate)
    print(f"Created {OUTPUT_AUDIO} ({sample_rate} Hz)")


if __name__ == "__main__":
    main()
