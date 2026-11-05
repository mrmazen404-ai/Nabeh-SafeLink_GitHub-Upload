import asyncio
import threading
import time

import app.ml.predictor as predictor


def test_predict_url_async_returns_normal_prediction(monkeypatch):
    expected = {
        "classification": "SAFE",
        "confidence": 0.99,
        "source": "ML_MODEL",
    }
    monkeypatch.setattr(predictor, "predict_url", lambda url: expected)

    result = asyncio.run(predictor.predict_url_async("https://example.com"))

    assert result == expected


def test_predict_url_async_timeout_returns_promptly_without_killing_worker(monkeypatch):
    started = threading.Event()
    release = threading.Event()
    worker_finished = threading.Event()

    def blocked_prediction(url):
        started.set()
        release.wait()
        worker_finished.set()
        return {"classification": "SAFE", "confidence": 0.99, "source": "ML_MODEL"}

    monkeypatch.setattr(predictor, "predict_url", blocked_prediction)

    async def exercise_timeout():
        task = asyncio.create_task(
            predictor.predict_url_async("https://example.com", timeout=0.05)
        )
        assert await asyncio.to_thread(started.wait, 1.0)
        began = time.monotonic()
        result = await task
        elapsed = time.monotonic() - began
        return result, elapsed

    try:
        result, elapsed = asyncio.run(exercise_timeout())
        assert result == {
            "classification": "UNKNOWN",
            "confidence": 0.5,
            "source": "MODEL_TIMEOUT",
        }
        assert elapsed < 0.5
        assert not worker_finished.is_set()
    finally:
        release.set()
    assert worker_finished.wait(1.0)


def test_predict_url_async_rejects_over_capacity_and_keeps_timed_out_slot(monkeypatch):
    capacity = predictor._MAX_INFLIGHT_PREDICTIONS
    assert capacity == 2
    release = threading.Event()
    all_started = threading.Event()
    all_finished = threading.Event()
    lock = threading.Lock()
    active = 0
    max_active = 0
    starts = 0
    finishes = 0

    def blocked_prediction(url):
        nonlocal active, max_active, starts, finishes
        with lock:
            active += 1
            starts += 1
            max_active = max(max_active, active)
            if starts >= capacity:
                all_started.set()
        release.wait()
        with lock:
            active -= 1
            finishes += 1
            if finishes >= capacity:
                all_finished.set()
        return {"classification": "SAFE", "confidence": 0.99, "source": "ML_MODEL"}

    monkeypatch.setattr(predictor, "predict_url", blocked_prediction)

    async def exercise_capacity():
        timed_out = asyncio.create_task(
            predictor.predict_url_async("https://one.example", timeout=0.05)
        )
        other = asyncio.create_task(
            predictor.predict_url_async("https://two.example", timeout=5.0)
        )
        assert await asyncio.to_thread(all_started.wait, 1.0)
        timeout_result = await timed_out
        busy_result = await predictor.predict_url_async(
            "https://three.example", timeout=1.0
        )
        release.set()
        other_result = await other
        assert await asyncio.to_thread(all_finished.wait, 1.0)
        return timeout_result, busy_result, other_result

    try:
        timeout_result, busy_result, other_result = asyncio.run(exercise_capacity())
    finally:
        release.set()

    assert timeout_result["source"] == "MODEL_TIMEOUT"
    assert busy_result == {
        "classification": "UNKNOWN",
        "confidence": 0.5,
        "source": "MODEL_BUSY",
    }
    assert other_result["source"] == "ML_MODEL"
    assert max_active <= capacity
    assert active == 0
