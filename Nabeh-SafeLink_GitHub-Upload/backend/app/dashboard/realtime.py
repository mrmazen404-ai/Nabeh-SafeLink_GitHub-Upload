"""In-process authenticated WebSocket manager for user-scoped dashboard events."""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class DashboardConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections[user_id].add(websocket)
        logger.info("dashboard_websocket_connected user_id=%s", user_id)

    async def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            connections = self._connections.get(user_id, set())
            connections.discard(websocket)
            if not connections:
                self._connections.pop(user_id, None)
        logger.info("dashboard_websocket_disconnected user_id=%s", user_id)

    async def broadcast(self, user_id: str, event: dict[str, Any]) -> None:
        async with self._lock:
            connections = list(self._connections.get(user_id, set()))
        if not connections:
            return
        stale: list[WebSocket] = []
        for websocket in connections:
            try:
                await websocket.send_json(event)
            except Exception:
                stale.append(websocket)
        for websocket in stale:
            await self.disconnect(user_id, websocket)


manager = DashboardConnectionManager()
