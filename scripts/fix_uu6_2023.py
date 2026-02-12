"""Fix UU 6/2023 (Cipta Kerja) data in Supabase.

Removes garbled OCR data and replaces with clean seed data for key
employment articles from BAB IV Ketenagakerjaan.
Source: LLG-BWI PDF (BAB IV Ketenagakerjaan extract).
"""
import json
import os
import sys

import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

API_BASE = "https://api.supabase.com/v1/projects/your-project-ref/database/query"
TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
if not TOKEN:
    print("ERROR: Set SUPABASE_ACCESS_TOKEN in root .env")
    sys.exit(1)
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}


def run_sql(query: str) -> list[dict]:
    """Execute SQL via Supabase Management API."""
    resp = httpx.post(API_BASE, headers=HEADERS, json={"query": query}, timeout=30.0)
    if resp.status_code != 201:
        print(f"ERROR ({resp.status_code}): {resp.text}")
        sys.exit(1)
    return resp.json()


def escape_sql(s: str) -> str:
    """Escape single quotes for SQL."""
    return s.replace("'", "''")


# Key employment articles from UU 6/2023 BAB IV Ketenagakerjaan
# These are the modified versions of UU 13/2003 articles via Pasal 81
PASALS = [
    {
        "number": "77",
        "heading": "Pasal 81 angka 23 — Waktu Kerja",
        "sort_order": 77,
        "content": (
            "(1) Setiap Pengusaha wajib melaksanakan ketentuan waktu kerja.\n"
            "(2) Waktu kerja sebagaimana dimaksud pada ayat (1) meliputi:\n"
            "a. 7 (tujuh) jam 1 (satu) hari dan 40 (empat puluh) jam 1 (satu) minggu untuk 6 (enam) hari kerja dalam 1 (satu) minggu; atau\n"
            "b. 8 (delapan) jam 1 (satu) hari dan 40 (empat puluh) jam 1 (satu) minggu untuk 5 (lima) hari kerja dalam 1 (satu) minggu.\n"
            "(3) Ketentuan waktu kerja sebagaimana dimaksud pada ayat (2) tidak berlaku bagi sektor usaha atau pekerjaan tertentu.\n"
            "(4) Pelaksanaan jam kerja bagi Pekerja/Buruh di Perusahaan diatur dalam Perjanjian Kerja, Peraturan Perusahaan, atau Perjanjian Kerja Bersama.\n"
            "(5) Ketentuan lebih lanjut mengenai waktu kerja pada sektor usaha atau pekerjaan tertentu sebagaimana dimaksud pada ayat (3) diatur dalam Peraturan Pemerintah."
        ),
    },
    {
        "number": "78",
        "heading": "Pasal 81 angka 24 — Kerja Lembur",
        "sort_order": 78,
        "content": (
            "(1) Pengusaha yang mempekerjakan Pekerja/Buruh melebihi waktu kerja sebagaimana dimaksud dalam Pasal 77 ayat (2) harus memenuhi syarat:\n"
            "a. ada persetujuan Pekerja/Buruh yang bersangkutan; dan\n"
            "b. waktu kerja lembur hanya dapat dilakukan paling lama 4 (empat) jam dalam 1 (satu) hari dan 18 (delapan belas) jam dalam 1 (satu) minggu.\n"
            "(2) Pengusaha yang mempekerjakan Pekerja/Buruh melebihi waktu kerja sebagaimana dimaksud pada ayat (1) wajib membayar Upah kerja lembur.\n"
            "(3) Ketentuan waktu kerja lembur sebagaimana dimaksud pada ayat (1) huruf b tidak berlaku bagi sektor usaha atau pekerjaan tertentu.\n"
            "(4) Ketentuan lebih lanjut mengenai waktu kerja lembur dan Upah kerja lembur diatur dalam Peraturan Pemerintah."
        ),
    },
    {
        "number": "79",
        "heading": "Pasal 81 angka 25 — Istirahat dan Cuti",
        "sort_order": 79,
        "content": (
            "(1) Pengusaha wajib memberi:\n"
            "a. waktu istirahat; dan\n"
            "b. cuti.\n"
            "(2) Waktu istirahat sebagaimana dimaksud pada ayat (1) huruf a wajib diberikan kepada Pekerja/Buruh paling sedikit meliputi:\n"
            "a. istirahat antara jam kerja, paling sedikit setengah jam setelah bekerja selama 4 (empat) jam terus-menerus, dan waktu istirahat tersebut tidak termasuk jam kerja; dan\n"
            "b. istirahat mingguan 1 (satu) hari untuk 6 (enam) hari kerja dalam 1 (satu) minggu.\n"
            "(3) Cuti sebagaimana dimaksud pada ayat (1) huruf b yang wajib diberikan kepada Pekerja/Buruh, yaitu cuti tahunan, paling sedikit 12 (dua belas) hari kerja setelah Pekerja/Buruh yang bersangkutan bekerja selama 12 (dua belas) bulan secara terus menerus.\n"
            "(4) Pelaksanaan cuti tahunan sebagaimana dimaksud pada ayat (3) diatur dalam Perjanjian Kerja, Peraturan Perusahaan, atau Perjanjian Kerja Bersama.\n"
            "(5) Selain waktu istirahat dan cuti sebagaimana dimaksud pada ayat (1), ayat (2), dan ayat (3), Perusahaan tertentu dapat memberikan istirahat panjang yang diatur dalam Perjanjian Kerja, Peraturan Perusahaan, atau Perjanjian Kerja Bersama.\n"
            "(6) Ketentuan lebih lanjut mengenai Perusahaan tertentu sebagaimana dimaksud pada ayat (5) diatur dengan Peraturan Pemerintah."
        ),
    },
    {
        "number": "88",
        "heading": "Pasal 81 angka 27 — Kebijakan Pengupahan",
        "sort_order": 88,
        "content": (
            "(1) Setiap Pekerja/Buruh berhak atas penghidupan yang layak bagi kemanusiaan.\n"
            "(2) Pemerintah Pusat menetapkan kebijakan pengupahan sebagai salah satu upaya mewujudkan hak Pekerja/Buruh atas penghidupan yang layak bagi kemanusiaan.\n"
            "(3) Kebijakan pengupahan sebagaimana dimaksud pada ayat (2) meliputi:\n"
            "a. Upah minimum;\n"
            "b. struktur dan skala Upah;\n"
            "c. Upah kerja lembur;\n"
            "d. Upah tidak masuk kerja dan/atau tidak melakukan pekerjaan karena alasan tertentu;\n"
            "e. bentuk dan cara pembayaran Upah;\n"
            "f. hal-hal yang dapat diperhitungkan dengan Upah; dan\n"
            "g. Upah sebagai dasar perhitungan atau pembayaran hak dan kewajiban lainnya.\n"
            "(4) Ketentuan lebih lanjut mengenai kebijakan pengupahan diatur dalam Peraturan Pemerintah."
        ),
    },
    {
        "number": "88A",
        "heading": "Pasal 81 angka 28 — Hak atas Upah",
        "sort_order": 881,
        "content": (
            "(1) Hak Pekerja/Buruh atas Upah timbul pada saat terjadi Hubungan Kerja antara Pekerja/Buruh dengan Pengusaha dan berakhir pada saat putusnya Hubungan Kerja.\n"
            "(2) Setiap Pekerja/Buruh berhak memperoleh Upah yang sama untuk pekerjaan yang sama nilainya.\n"
            "(3) Pengusaha wajib membayar Upah kepada Pekerja/Buruh sesuai dengan kesepakatan.\n"
            "(4) Pengaturan pengupahan yang ditetapkan atas kesepakatan antara Pengusaha dan Pekerja/Buruh atau Serikat Pekerja/Serikat Buruh tidak boleh lebih rendah dari ketentuan pengupahan yang ditetapkan dalam peraturan perundang-undangan.\n"
            "(5) Dalam hal kesepakatan sebagaimana dimaksud pada ayat (4) lebih rendah atau bertentangan dengan peraturan perundang-undangan, kesepakatan tersebut batal demi hukum dan pengaturan pengupahan dilaksanakan sesuai dengan ketentuan peraturan perundang-undangan.\n"
            "(6) Pengusaha yang karena kesengajaan atau kelalaiannya mengakibatkan keterlambatan pembayaran Upah, dikenakan denda sesuai dengan persentase tertentu dari Upah Pekerja/Buruh.\n"
            "(7) Pekerja/Buruh yang melakukan pelanggaran karena kesengajaan atau kelalaiannya dapat dikenakan denda.\n"
            "(8) Pemerintah mengatur pengenaan denda kepada Pengusaha dan/atau Pekerja/Buruh dalam pembayaran Upah."
        ),
    },
    {
        "number": "88C",
        "heading": "Pasal 81 angka 28 — Upah Minimum",
        "sort_order": 883,
        "content": (
            "(1) Gubernur wajib menetapkan Upah minimum provinsi.\n"
            "(2) Gubernur dapat menetapkan Upah minimum kabupaten/kota.\n"
            "(3) Penetapan Upah minimum kabupaten/kota sebagaimana dimaksud pada ayat (2) dilakukan dalam hal hasil penghitungan Upah minimum kabupaten/kota lebih tinggi dari Upah minimum provinsi.\n"
            "(4) Upah minimum sebagaimana dimaksud pada ayat (1) dan ayat (2) ditetapkan berdasarkan kondisi ekonomi dan Ketenagakerjaan.\n"
            "(5) Kondisi ekonomi dan Ketenagakerjaan sebagaimana dimaksud pada ayat (4) menggunakan data yang bersumber dari lembaga yang berwenang di bidang statistik.\n"
            "(6) Dalam hal kabupaten/kota belum memiliki Upah minimum dan akan menetapkan Upah minimum, penetapan Upah minimum harus memenuhi syarat tertentu.\n"
            "(7) Ketentuan lebih lanjut mengenai tata cara penetapan Upah minimum sebagaimana dimaksud pada ayat (4) dan syarat tertentu sebagaimana dimaksud pada ayat (6) diatur dalam Peraturan Pemerintah."
        ),
    },
    {
        "number": "88E",
        "heading": "Pasal 81 angka 28 — Larangan Upah di Bawah Minimum",
        "sort_order": 885,
        "content": (
            "(1) Upah minimum sebagaimana dimaksud dalam Pasal 88C ayat (1) dan ayat (2) berlaku bagi Pekerja/Buruh dengan masa kerja kurang dari 1 (satu) tahun pada Perusahaan yang bersangkutan.\n"
            "(2) Pengusaha dilarang membayar Upah lebih rendah dari Upah minimum."
        ),
    },
    {
        "number": "151",
        "heading": "Pasal 81 angka 40 — Prosedur PHK",
        "sort_order": 151,
        "content": (
            "(1) Pengusaha, Pekerja/Buruh, Serikat Pekerja/Serikat Buruh, dan Pemerintah harus mengupayakan agar tidak terjadi Pemutusan Hubungan Kerja.\n"
            "(2) Dalam hal Pemutusan Hubungan Kerja tidak dapat dihindari, maksud dan alasan Pemutusan Hubungan Kerja diberitahukan oleh Pengusaha kepada Pekerja/Buruh dan/atau Serikat Pekerja/Serikat Buruh.\n"
            "(3) Dalam hal Pekerja/Buruh telah diberitahu dan menolak Pemutusan Hubungan Kerja, penyelesaian Pemutusan Hubungan Kerja wajib dilakukan melalui perundingan bipartit antara Pengusaha dengan Pekerja/Buruh dan/atau Serikat Pekerja/Serikat Buruh.\n"
            "(4) Dalam hal perundingan bipartit sebagaimana dimaksud pada ayat (3) tidak mendapatkan kesepakatan, Pemutusan Hubungan Kerja dilakukan melalui tahap berikutnya sesuai dengan mekanisme penyelesaian Perselisihan Hubungan Industrial."
        ),
    },
    {
        "number": "153",
        "heading": "Pasal 81 angka 43 — Larangan PHK",
        "sort_order": 153,
        "content": (
            "(1) Pengusaha dilarang melakukan Pemutusan Hubungan Kerja kepada Pekerja/Buruh dengan alasan:\n"
            "a. berhalangan masuk kerja karena sakit menurut keterangan dokter selama waktu tidak melampaui 12 (dua belas) bulan secara terus-menerus;\n"
            "b. berhalangan menjalankan pekerjaannya karena memenuhi kewajiban terhadap negara sesuai dengan ketentuan peraturan perundang-undangan;\n"
            "c. menjalankan ibadah yang diperintahkan agamanya;\n"
            "d. menikah;\n"
            "e. hamil, melahirkan, gugur kandungan, atau menyusui bayinya;\n"
            "f. mempunyai pertalian darah dan/atau ikatan perkawinan dengan Pekerja/Buruh lainnya di dalam satu Perusahaan;\n"
            "g. mendirikan, menjadi anggota dan/atau pengurus Serikat Pekerja/Serikat Buruh, Pekerja/Buruh melakukan kegiatan Serikat Pekerja/Serikat Buruh di luar jam kerja, atau di dalam jam kerja atas kesepakatan Pengusaha, atau berdasarkan ketentuan yang diatur dalam Perjanjian Kerja, Peraturan Perusahaan, atau Perjanjian Kerja Bersama;\n"
            "h. mengadukan Pengusaha kepada pihak yang berwajib mengenai perbuatan Pengusaha yang melakukan tindak pidana kejahatan;\n"
            "i. berbeda paham, agama, aliran politik, suku, warna kulit, golongan, jenis kelamin, kondisi fisik, atau status perkawinan; dan\n"
            "j. dalam keadaan cacat tetap, sakit akibat kecelakaan kerja, atau sakit karena Hubungan Kerja yang menurut surat keterangan dokter yang jangka waktu penyembuhannya belum dapat dipastikan.\n"
            "(2) Pemutusan Hubungan Kerja yang dilakukan dengan alasan sebagaimana dimaksud pada ayat (1) batal demi hukum dan Pengusaha wajib mempekerjakan kembali Pekerja/Buruh yang bersangkutan."
        ),
    },
    {
        "number": "154A",
        "heading": "Pasal 81 angka 45 — Alasan PHK yang Sah",
        "sort_order": 1541,
        "content": (
            "(1) Pemutusan Hubungan Kerja dapat terjadi karena alasan:\n"
            "a. Perusahaan melakukan penggabungan, peleburan, pengambilalihan, atau pemisahan Perusahaan dan Pekerja/Buruh tidak bersedia melanjutkan Hubungan Kerja atau Pengusaha tidak bersedia menerima Pekerja/Buruh;\n"
            "b. Perusahaan melakukan efisiensi diikuti dengan Penutupan Perusahaan atau tidak diikuti dengan Penutupan Perusahaan yang disebabkan Perusahaan mengalami kerugian;\n"
            "c. Perusahaan tutup yang disebabkan karena Perusahaan mengalami kerugian secara terus menerus selama 2 (dua) tahun;\n"
            "d. Perusahaan tutup yang disebabkan keadaan memaksa (force majeur);\n"
            "e. Perusahaan dalam keadaan penundaan kewajiban pembayaran utang;\n"
            "f. Perusahaan pailit;\n"
            "g. adanya permohonan Pemutusan Hubungan Kerja yang diajukan oleh Pekerja/Buruh dengan alasan Pengusaha melakukan perbuatan sebagai berikut: 1. menganiaya, menghina secara kasar atau mengancam Pekerja/Buruh; 2. membujuk dan/atau menyuruh Pekerja/Buruh untuk melakukan perbuatan yang bertentangan dengan peraturan perundang-undangan; 3. tidak membayar Upah tepat pada waktu yang telah ditentukan selama 3 (tiga) bulan berturut-turut atau lebih; 4. tidak melakukan kewajiban yang telah dijanjikan kepada Pekerja/Buruh; 5. memerintahkan Pekerja/Buruh untuk melaksanakan pekerjaan di luar yang diperjanjikan; atau 6. memberikan pekerjaan yang membahayakan jiwa, keselamatan, kesehatan, dan kesusilaan Pekerja/Buruh;\n"
            "h. adanya putusan lembaga penyelesaian Perselisihan Hubungan Industrial yang menyatakan Pengusaha tidak melakukan perbuatan sebagaimana dimaksud pada huruf g;\n"
            "i. Pekerja/Buruh mengundurkan diri atas kemauan sendiri;\n"
            "j. Pekerja/Buruh mangkir selama 5 (lima) hari kerja atau lebih berturut-turut tanpa keterangan secara tertulis;\n"
            "k. Pekerja/Buruh melakukan pelanggaran ketentuan yang diatur dalam Perjanjian Kerja, Peraturan Perusahaan, atau Perjanjian Kerja Bersama dan sebelumnya telah diberikan surat peringatan pertama, kedua, dan ketiga secara berturut-turut;\n"
            "l. Pekerja/Buruh tidak dapat melakukan pekerjaan selama 6 (enam) bulan akibat ditahan pihak yang berwajib karena diduga melakukan tindak pidana;\n"
            "m. Pekerja/Buruh mengalami sakit berkepanjangan atau cacat akibat kecelakaan kerja dan tidak dapat melakukan pekerjaannya setelah melampaui batas 12 (dua belas) bulan;\n"
            "n. Pekerja/Buruh memasuki usia pensiun; atau\n"
            "o. Pekerja/Buruh meninggal dunia.\n"
            "(2) Selain alasan Pemutusan Hubungan Kerja sebagaimana dimaksud pada ayat (1), dapat ditetapkan alasan Pemutusan Hubungan Kerja lainnya dalam Perjanjian Kerja, Peraturan Perusahaan, atau Perjanjian Kerja Bersama.\n"
            "(3) Ketentuan lebih lanjut mengenai tata cara Pemutusan Hubungan Kerja diatur dalam Peraturan Pemerintah."
        ),
    },
    {
        "number": "156",
        "heading": "Pasal 81 angka 47 — Uang Pesangon",
        "sort_order": 156,
        "content": (
            "(1) Dalam hal terjadi Pemutusan Hubungan Kerja, Pengusaha wajib membayar uang pesangon dan/atau uang penghargaan masa kerja dan uang penggantian hak yang seharusnya diterima.\n"
            "(2) Uang pesangon sebagaimana dimaksud pada ayat (1) diberikan dengan ketentuan sebagai berikut:\n"
            "a. masa kerja kurang dari 1 (satu) tahun, 1 (satu) bulan Upah;\n"
            "b. masa kerja 1 (satu) tahun atau lebih tetapi kurang dari 2 (dua) tahun, 2 (dua) bulan Upah;\n"
            "c. masa kerja 2 (dua) tahun atau lebih tetapi kurang dari 3 (tiga) tahun, 3 (tiga) bulan Upah;\n"
            "d. masa kerja 3 (tiga) tahun atau lebih tetapi kurang dari 4 (empat) tahun, 4 (empat) bulan Upah;\n"
            "e. masa kerja 4 (empat) tahun atau lebih tetapi kurang dari 5 (lima) tahun, 5 (lima) bulan Upah;\n"
            "f. masa kerja 5 (lima) tahun atau lebih tetapi kurang dari 6 (enam) tahun, 6 (enam) bulan Upah;\n"
            "g. masa kerja 6 (enam) tahun atau lebih tetapi kurang dari 7 (tujuh) tahun, 7 (tujuh) bulan Upah;\n"
            "h. masa kerja 7 (tujuh) tahun atau lebih tetapi kurang dari 8 (delapan) tahun, 8 (delapan) bulan Upah;\n"
            "i. masa kerja 8 (delapan) tahun atau lebih, 9 (sembilan) bulan Upah.\n"
            "(3) Uang penghargaan masa kerja sebagaimana dimaksud pada ayat (1) diberikan dengan ketentuan sebagai berikut:\n"
            "a. masa kerja 3 (tiga) tahun atau lebih tetapi kurang dari 6 (enam) tahun, 2 (dua) bulan Upah;\n"
            "b. masa kerja 6 (enam) tahun atau lebih tetapi kurang dari 9 (sembilan) tahun, 3 (tiga) bulan Upah;\n"
            "c. masa kerja 9 (sembilan) tahun atau lebih tetapi kurang dari 12 (dua belas) tahun, 4 (empat) bulan Upah;\n"
            "d. masa kerja 12 (dua belas) tahun atau lebih tetapi kurang dari 15 (lima belas) tahun, 5 (lima) bulan Upah;\n"
            "e. masa kerja 15 (lima belas) tahun atau lebih tetapi kurang dari 18 (delapan belas) tahun, 6 (enam) bulan Upah;\n"
            "f. masa kerja 18 (delapan belas) tahun atau lebih tetapi kurang dari 21 (dua puluh satu) tahun, 7 (tujuh) bulan Upah;\n"
            "g. masa kerja 21 (dua puluh satu) tahun atau lebih tetapi kurang dari 24 (dua puluh empat) tahun, 8 (delapan) bulan Upah;\n"
            "h. masa kerja 24 (dua puluh empat) tahun atau lebih, 10 (sepuluh) bulan Upah.\n"
            "(4) Uang penggantian hak yang seharusnya diterima sebagaimana dimaksud pada ayat (1) meliputi:\n"
            "a. cuti tahunan yang belum diambil dan belum gugur;\n"
            "b. biaya atau ongkos pulang untuk Pekerja/Buruh dan keluarganya ke tempat Pekerja/Buruh diterima bekerja;\n"
            "c. hal-hal lain yang ditetapkan dalam Perjanjian Kerja, Peraturan Perusahaan, atau Perjanjian Kerja Bersama.\n"
            "(5) Ketentuan lebih lanjut mengenai pemberian uang pesangon, uang penghargaan masa kerja, dan uang penggantian hak sebagaimana dimaksud pada ayat (2), ayat (3), dan ayat (4) diatur dalam Peraturan Pemerintah."
        ),
    },
]


def main() -> None:
    # Step 1: Get work_id for UU 6/2023
    print("STEP 1: Getting work_id for UU 6/2023...")
    result = run_sql("SELECT id FROM works WHERE number = '6' AND year = 2023;")
    if not result:
        print("ERROR: UU 6/2023 not found in works table")
        sys.exit(1)
    work_id = result[0]["id"]
    print(f"  work_id = {work_id}")

    # Step 2: Delete existing bad data
    print("\nSTEP 2: Deleting existing garbled data...")
    run_sql(f"DELETE FROM legal_chunks WHERE work_id = {work_id};")
    run_sql(f"DELETE FROM document_nodes WHERE work_id = {work_id};")
    print("  Deleted old nodes and chunks")

    # Step 3: Update work metadata
    print("\nSTEP 3: Updating work metadata...")
    run_sql(
        f"UPDATE works SET "
        f"title_id = 'Undang-Undang Nomor 6 Tahun 2023 tentang Penetapan Perppu Cipta Kerja menjadi Undang-Undang', "
        f"status = 'berlaku' "
        f"WHERE id = {work_id} RETURNING id;"
    )

    # Step 4: Insert BAB IV node
    print("\nSTEP 4: Inserting BAB IV node...")
    result = run_sql(
        f"INSERT INTO document_nodes "
        f"(work_id, node_type, number, heading, content_text, parent_id, path, depth, sort_order) "
        f"VALUES ({work_id}, 'bab', 'IV', 'KETENAGAKERJAAN', '', NULL, 'bab_IV', 0, 4) "
        f"RETURNING id;"
    )
    bab_id = result[0]["id"]
    print(f"  BAB IV id = {bab_id}")

    # Step 5: Insert Pasal nodes and legal_chunks
    print("\nSTEP 5: Inserting Pasals and chunks...")
    for pasal in PASALS:
        # Insert document_node
        content_escaped = escape_sql(pasal["content"])
        heading_escaped = escape_sql(pasal["heading"])
        path = f"bab_IV.pasal_{pasal['number']}"

        sql = (
            f"INSERT INTO document_nodes "
            f"(work_id, node_type, number, heading, content_text, parent_id, path, depth, sort_order) "
            f"VALUES ({work_id}, 'pasal', '{pasal['number']}', "
            f"'{heading_escaped}', "
            f"'{content_escaped}', "
            f"{bab_id}, '{path}', 1, {pasal['sort_order']}) "
            f"RETURNING id;"
        )
        node_result = run_sql(sql)
        node_id = node_result[0]["id"]

        # Insert legal_chunk
        chunk_content = escape_sql(
            f"Undang-Undang Nomor 6 Tahun 2023 tentang Cipta Kerja\n"
            f"BAB IV Ketenagakerjaan — {pasal['heading']}\n"
            f"Pasal {pasal['number']}\n\n"
            f"{pasal['content']}"
        )
        metadata = json.dumps({
            "type": "UU",
            "number": "6",
            "year": 2023,
            "pasal": pasal["number"],
        })

        run_sql(
            f"INSERT INTO legal_chunks (work_id, node_id, content, metadata) "
            f"VALUES ({work_id}, {node_id}, '{chunk_content}', '{metadata}'::jsonb);"
        )
        print(f"  Pasal {pasal['number']}: {pasal['heading']}")

    # Verification
    print("\n=== VERIFICATION ===")
    result = run_sql(f"SELECT COUNT(*) as cnt FROM document_nodes WHERE work_id = {work_id};")
    print(f"  Document nodes: {result[0]['cnt']}")
    result = run_sql(f"SELECT COUNT(*) as cnt FROM legal_chunks WHERE work_id = {work_id};")
    print(f"  Legal chunks: {result[0]['cnt']}")

    # Test search
    result = run_sql(
        "SELECT id, LEFT(content, 80) as preview FROM legal_chunks "
        "WHERE fts @@ websearch_to_tsquery('indonesian', 'upah minimum') "
        f"AND work_id = {work_id} LIMIT 3;"
    )
    print(f"  Search 'upah minimum' in UU 6/2023: {len(result)} results")

    result = run_sql(
        "SELECT id, LEFT(content, 80) as preview FROM legal_chunks "
        "WHERE fts @@ websearch_to_tsquery('indonesian', 'pemutusan hubungan kerja') "
        f"AND work_id = {work_id} LIMIT 3;"
    )
    print(f"  Search 'pemutusan hubungan kerja' in UU 6/2023: {len(result)} results")

    print(f"\n=== DONE === ({len(PASALS)} articles seeded)")


if __name__ == "__main__":
    main()
