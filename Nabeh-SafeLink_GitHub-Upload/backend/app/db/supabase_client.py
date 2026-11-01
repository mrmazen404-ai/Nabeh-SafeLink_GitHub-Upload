"""Supabase client with safe terminal tracing for every table operation."""

from __future__ import annotations

import logging
import time
from typing import Any

from supabase import Client, create_client

from app.config import settings
from app.observability import elapsed_ms, log_event, safe_error

logger = logging.getLogger(__name__)


class _LoggedQuery:
    def __init__(self, query: Any, operation: str):
        self._query = query
        self._operation = operation

    def __getattr__(self, name: str):
        attribute = getattr(self._query, name)
        if not callable(attribute):
            return attribute

        def call(*args, **kwargs):
            if name == "execute":
                started = time.perf_counter()
                log_event(logger, logging.INFO, "supabase_operation_started", operation=self._operation)
                try:
                    result = attribute(*args, **kwargs)
                    rows = len(getattr(result, "data", None) or [])
                    log_event(
                        logger,
                        logging.INFO,
                        "supabase_operation_succeeded",
                        operation=self._operation,
                        rows=rows,
                        duration_ms=elapsed_ms(started),
                    )
                    return result
                except Exception as error:
                    log_event(
                        logger,
                        logging.ERROR,
                        "supabase_operation_failed",
                        operation=self._operation,
                        error_type=safe_error(error),
                        duration_ms=elapsed_ms(started),
                    )
                    raise

            result = attribute(*args, **kwargs)
            return _LoggedQuery(result, f"{self._operation}.{name}")

        return call


class LoggedSupabaseClient:
    def __init__(self, client: Client):
        self._client = client

    def table(self, table_name: str) -> _LoggedQuery:
        log_event(logger, logging.DEBUG, "supabase_table_selected", table=table_name)
        return _LoggedQuery(self._client.table(table_name), f"table:{table_name}")

    def __getattr__(self, name: str):
        return getattr(self._client, name)


if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
    log_event(logger, logging.WARNING, "supabase_configuration_incomplete")

_raw_supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SECRET_KEY)
supabase = LoggedSupabaseClient(_raw_supabase)
log_event(logger, logging.INFO, "supabase_client_initialized", configured=bool(settings.SUPABASE_URL and settings.SUPABASE_SECRET_KEY))
