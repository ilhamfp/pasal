"""Registry of all Indonesian legal data sources."""

SOURCES = [
    {
        "id": "peraturan_go_id",
        "name": "Peraturan.go.id",
        "base_url": "https://peraturan.go.id",
        "content_type": "regulations",
        "est_documents": 61740,
        "needs_headless": False,
        "anti_scraping": "Minimal — standard HTTP works",
        "priority": 1,
        "reg_types": ["UU", "PP", "PERPRES", "PERMEN"],
        "notes": "Primary government regulation portal. Easy to scrape.",
    },
    {
        "id": "otf_corpus",
        "name": "OTF Peraturan Corpus (GitHub)",
        "base_url": "https://github.com/Open-Technology-Foundation/peraturan.go.id",
        "content_type": "pre-processed text",
        "est_documents": 5817,
        "needs_headless": False,
        "anti_scraping": "None — git clone",
        "priority": 1,
        "reg_types": ["UU", "PP", "PERPRES", "PERMEN", "PERDA"],
        "notes": "Pre-extracted text from peraturan.go.id. Fastest path to 1000+ laws.",
    },
    {
        "id": "peraturan_bpk",
        "name": "Peraturan BPK",
        "base_url": "https://peraturan.bpk.go.id",
        "content_type": "regulations",
        "est_documents": 100000,
        "needs_headless": True,
        "anti_scraping": "403 to non-browser requests",
        "priority": 2,
        "reg_types": ["UU", "PP", "PERPRES", "PERMEN", "PERDA"],
        "notes": "Largest collection. Needs headless browser or full browser headers.",
    },
    {
        "id": "jdih_setneg",
        "name": "JDIH Sekretariat Negara",
        "base_url": "https://jdih.setneg.go.id",
        "content_type": "regulations",
        "est_documents": 5000,
        "needs_headless": False,
        "anti_scraping": "Standard rate limiting",
        "priority": 2,
        "reg_types": ["UU", "PP", "PERPRES"],
        "notes": "State Secretariat — UU, PP, Perpres focus.",
    },
    {
        "id": "indo_law_dataset",
        "name": "Indo-Law Dataset (GitHub)",
        "base_url": "https://github.com/ir-nlp-csui/indo-law",
        "content_type": "pre-processed XML",
        "est_documents": 22630,
        "needs_headless": False,
        "anti_scraping": "None — git clone",
        "priority": 2,
        "reg_types": ["court_decisions"],
        "notes": "Court decisions dataset from UI NLP lab.",
    },
    {
        "id": "perpusnas_api",
        "name": "Perpusnas JDIH API",
        "base_url": "https://api-jdih.perpusnas.go.id",
        "content_type": "regulations",
        "est_documents": 0,
        "needs_headless": False,
        "anti_scraping": "Bearer token auth required",
        "priority": 2,
        "reg_types": ["UU", "PP", "PERPRES", "PERMEN"],
        "notes": "Only documented public REST API for Indonesian legal data.",
    },
    {
        "id": "jdih_kemenkeu",
        "name": "JDIH Kementerian Keuangan",
        "base_url": "https://jdih.kemenkeu.go.id",
        "content_type": "regulations",
        "est_documents": 10000,
        "needs_headless": False,
        "anti_scraping": "Standard rate limiting",
        "priority": 3,
        "reg_types": ["PMK", "KMK"],
        "notes": "Finance ministry — tax, customs, budget regulations.",
    },
    {
        "id": "jdih_kemendagri",
        "name": "JDIH Kementerian Dalam Negeri",
        "base_url": "https://jdih.kemendagri.go.id",
        "content_type": "regulations",
        "est_documents": 3000,
        "needs_headless": False,
        "anti_scraping": "Standard rate limiting",
        "priority": 3,
        "reg_types": ["PERMENDAGRI"],
        "notes": "Home Affairs — regional governance regulations.",
    },
    {
        "id": "jdih_kemnaker",
        "name": "JDIH Kementerian Ketenagakerjaan",
        "base_url": "https://jdih.kemnaker.go.id",
        "content_type": "regulations",
        "est_documents": 1000,
        "needs_headless": False,
        "anti_scraping": "Standard rate limiting",
        "priority": 3,
        "reg_types": ["PERMENAKER"],
        "notes": "Manpower ministry — labor regulations.",
    },
    {
        "id": "jdih_esdm",
        "name": "JDIH Kementerian ESDM",
        "base_url": "https://jdih.esdm.go.id",
        "content_type": "regulations",
        "est_documents": 2000,
        "needs_headless": True,
        "anti_scraping": "Bot protection — needs headless browser",
        "priority": 4,
        "reg_types": ["PERMEN_ESDM"],
        "notes": "Energy ministry — needs headless browser.",
    },
    {
        "id": "putusan_ma",
        "name": "Putusan Mahkamah Agung",
        "base_url": "https://putusan3.mahkamahagung.go.id",
        "content_type": "court_decisions",
        "est_documents": 10500000,
        "needs_headless": False,
        "anti_scraping": "Heavy rate limiting",
        "priority": 4,
        "reg_types": ["court_decisions"],
        "notes": "Supreme Court decisions. 10.5M docs. Scale challenge.",
    },
]


def get_sources_by_priority() -> list[dict]:
    """Return all sources sorted by priority (1=highest)."""
    return sorted(SOURCES, key=lambda s: s["priority"])


def get_source(source_id: str) -> dict | None:
    """Get a specific source by its ID."""
    for s in SOURCES:
        if s["id"] == source_id:
            return s
    return None


def get_simple_http_sources() -> list[dict]:
    """Return sources that don't need headless browser."""
    return [s for s in SOURCES if not s["needs_headless"]]
