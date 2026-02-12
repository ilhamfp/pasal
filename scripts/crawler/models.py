"""Pydantic models for crawl pipeline."""
from datetime import datetime

from pydantic import BaseModel


class CrawlJob(BaseModel):
    """Represents a single crawl job in the pipeline."""

    id: int | None = None
    source_id: str
    url: str
    pdf_url: str | None = None
    regulation_type: str | None = None
    number: str | None = None
    year: int | None = None
    title: str | None = None
    status: str = "pending"
    error_message: str | None = None
    frbr_uri: str | None = None
    work_id: int | None = None
    last_crawled_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
