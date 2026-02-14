"""Shared Supabase client for crawler modules."""
import os

from supabase import Client, create_client

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

_sb: Client | None = None


def get_sb() -> Client:
    """Return a lazily-initialized Supabase client singleton."""
    global _sb
    if _sb is None:
        _sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    return _sb
