"""Crawler configuration."""
import logging
import os
import ssl

logger = logging.getLogger(__name__)

DELAY_BETWEEN_REQUESTS = 0.5  # seconds
DELAY_BETWEEN_PAGES = 1.0
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
}
PDF_STORAGE_DIR = "data/pdfs/"
PARSED_DIR = "data/parsed/"

# Set ALLOW_INSECURE_SSL=true only for known-broken government TLS endpoints
ALLOW_INSECURE_SSL = os.environ.get("ALLOW_INSECURE_SSL", "false").lower() == "true"


def create_ssl_context() -> ssl.SSLContext:
    """Create an SSL context. Uses verified SSL by default.

    Set ALLOW_INSECURE_SSL=true env var to skip certificate verification
    (only for peraturan.go.id which has intermittent TLS issues).
    """
    if ALLOW_INSECURE_SSL:
        logger.warning("SSL verification disabled via ALLOW_INSECURE_SSL — use only for trusted government endpoints")
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    return ssl.create_default_context()
