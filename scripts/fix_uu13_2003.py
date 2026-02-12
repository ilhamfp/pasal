"""Fix UU 13/2003 (Ketenagakerjaan / Labor Law) data in Supabase.

Removes wrong data (was Peraturan Bupati Sleman) and replaces with
correct seed data for the key demo articles.
"""
import json
import httpx
import sys

API_BASE = "https://api.supabase.com/v1/projects/jnnqvmfhkqwfdlzevfao/database/query"
TOKEN = "sbp_44963a961c9477e6e3973cb0f621d819ec0b633e"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}


def run_sql(query: str) -> list[dict]:
    """Execute SQL via Supabase Management API."""
    resp = httpx.post(
        API_BASE,
        headers=HEADERS,
        json={"query": query},
        timeout=30.0,
    )
    if resp.status_code != 201:
        print(f"ERROR ({resp.status_code}): {resp.text}")
        sys.exit(1)
    data = resp.json()
    return data


def escape_sql(s: str) -> str:
    """Escape single quotes for SQL."""
    return s.replace("'", "''")


def main():
    # =========================================================================
    # STEP 1: Get the existing work ID for UU 13/2003
    # =========================================================================
    print("STEP 1: Getting work ID for UU 13/2003...")
    result = run_sql("SELECT id FROM works WHERE number = '13' AND year = 2003;")
    print(f"  Result: {result}")

    # =========================================================================
    # STEP 2: Delete existing wrong data
    # =========================================================================
    print("\nSTEP 2: Deleting existing wrong data...")
    result = run_sql(
        "DELETE FROM legal_chunks WHERE work_id = "
        "(SELECT id FROM works WHERE number = '13' AND year = 2003);"
    )
    print(f"  Deleted legal_chunks: {result}")

    result = run_sql(
        "DELETE FROM document_nodes WHERE work_id = "
        "(SELECT id FROM works WHERE number = '13' AND year = 2003);"
    )
    print(f"  Deleted document_nodes: {result}")

    # =========================================================================
    # STEP 5 (before inserts): Update the works table
    # =========================================================================
    print("\nSTEP 5: Updating works table...")
    result = run_sql(
        "UPDATE works SET "
        "title_id = 'Undang-Undang Nomor 13 Tahun 2003 tentang Ketenagakerjaan', "
        "status = 'diubah' "
        "WHERE number = '13' AND year = 2003 "
        "RETURNING id;"
    )
    print(f"  Updated work: {result}")

    # Get the work_id for subsequent inserts
    work_id_result = run_sql("SELECT id FROM works WHERE number = '13' AND year = 2003;")
    print(f"  Work ID result: {work_id_result}")
    work_id = work_id_result[0]["id"]
    print(f"  Using work_id = {work_id}")

    # =========================================================================
    # STEP 3: Insert BAB (chapter) nodes and Pasal (article) nodes
    # =========================================================================
    print("\nSTEP 3: Inserting BAB and Pasal nodes...")

    # Define BABs
    babs = [
        {"number": "I", "heading": "KETENTUAN UMUM", "sort_order": 1},
        {"number": "X", "heading": "PERLINDUNGAN, PENGUPAHAN, DAN KESEJAHTERAAN", "sort_order": 10},
        {"number": "XII", "heading": "PEMUTUSAN HUBUNGAN KERJA", "sort_order": 12},
    ]

    # Insert BABs and track their IDs
    bab_ids = {}
    for bab in babs:
        path = f"bab_{bab['number']}"
        sql = (
            f"INSERT INTO document_nodes "
            f"(work_id, node_type, number, heading, content_text, parent_id, path, depth, sort_order) "
            f"VALUES ({work_id}, 'bab', '{bab['number']}', "
            f"'{escape_sql(bab['heading'])}', '', NULL, '{path}', 0, {bab['sort_order']}) "
            f"RETURNING id;"
        )
        result = run_sql(sql)
        bab_id = result[0]["id"]
        bab_ids[bab["number"]] = bab_id
        print(f"  Inserted BAB {bab['number']}: {bab['heading']} -> id={bab_id}")

    # Define Pasals with their content
    pasals = [
        {
            "number": "1",
            "bab": "I",
            "sort_order": 1,
            "content": (
                "Dalam Undang-undang ini yang dimaksud dengan:\n"
                "1. Ketenagakerjaan adalah segala hal yang berhubungan dengan tenaga kerja pada waktu sebelum, selama, dan sesudah masa kerja.\n"
                "2. Tenaga kerja adalah setiap orang yang mampu melakukan pekerjaan guna menghasilkan barang dan/atau jasa baik untuk memenuhi kebutuhan sendiri maupun untuk masyarakat.\n"
                "3. Pekerja/buruh adalah setiap orang yang bekerja dengan menerima upah atau imbalan dalam bentuk lain.\n"
                "4. Pemberi kerja adalah orang perseorangan, pengusaha, badan hukum, atau badan-badan lainnya yang mempekerjakan tenaga kerja dengan membayar upah atau imbalan dalam bentuk lain.\n"
                "5. Pengusaha adalah:\n"
                "a. orang perseorangan, persekutuan, atau badan hukum yang menjalankan suatu perusahaan milik sendiri;\n"
                "b. orang perseorangan, persekutuan, atau badan hukum yang secara berdiri sendiri menjalankan perusahaan bukan miliknya;\n"
                "c. orang perseorangan, persekutuan, atau badan hukum yang berada di Indonesia mewakili perusahaan sebagaimana dimaksud dalam huruf a dan b yang berkedudukan di luar wilayah Indonesia.\n"
                "6. Perusahaan adalah:\n"
                "a. setiap bentuk usaha yang berbadan hukum atau tidak, milik orang perseorangan, milik persekutuan, atau milik badan hukum, baik milik swasta maupun milik negara yang mempekerjakan pekerja/buruh dengan membayar upah atau imbalan dalam bentuk lain;\n"
                "b. usaha-usaha sosial dan usaha-usaha lain yang mempunyai pengurus dan mempekerjakan orang lain dengan membayar upah atau imbalan dalam bentuk lain.\n"
                "7. Perencanaan tenaga kerja adalah proses penyusunan rencana ketenagakerjaan secara sistematis yang dijadikan dasar dan acuan dalam penyusunan kebijakan, strategi, dan pelaksanaan program pembangunan ketenagakerjaan yang berkesinambungan.\n"
                "8. Informasi ketenagakerjaan adalah gabungan, rangkaian, dan analisis data yang berbentuk angka, tabel, peta, dan uraian tentang ketenagakerjaan.\n"
                "9. Pelatihan kerja adalah keseluruhan kegiatan untuk memberi, memperoleh, meningkatkan, serta mengembangkan kompetensi kerja, produktivitas, disiplin, sikap, dan etos kerja pada tingkat keterampilan dan keahlian tertentu sesuai dengan jenjang dan kualifikasi jabatan atau pekerjaan.\n"
                "10. Kompetensi kerja adalah kemampuan kerja setiap individu yang mencakup aspek pengetahuan, keterampilan, dan sikap kerja yang sesuai dengan standar yang ditetapkan."
            ),
        },
        {
            "number": "77",
            "bab": "X",
            "sort_order": 77,
            "content": (
                "(1) Setiap pengusaha wajib melaksanakan ketentuan waktu kerja.\n"
                "(2) Waktu kerja sebagaimana dimaksud dalam ayat (1) meliputi:\n"
                "a. 7 (tujuh) jam 1 (satu) hari dan 40 (empat puluh) jam 1 (satu) minggu untuk 6 (enam) hari kerja dalam 1 (satu) minggu; atau\n"
                "b. 8 (delapan) jam 1 (satu) hari dan 40 (empat puluh) jam 1 (satu) minggu untuk 5 (lima) hari kerja dalam 1 (satu) minggu.\n"
                "(3) Ketentuan waktu kerja sebagaimana dimaksud dalam ayat (2) tidak berlaku bagi sektor usaha atau pekerjaan tertentu.\n"
                "(4) Ketentuan mengenai waktu kerja pada sektor usaha atau pekerjaan tertentu sebagaimana dimaksud dalam ayat (3) diatur dengan Keputusan Menteri."
            ),
        },
        {
            "number": "78",
            "bab": "X",
            "sort_order": 78,
            "content": (
                "(1) Pengusaha yang mempekerjakan pekerja/buruh melebihi waktu kerja sebagaimana dimaksud dalam Pasal 77 ayat (2) harus memenuhi syarat:\n"
                "a. ada persetujuan pekerja/buruh yang bersangkutan; dan\n"
                "b. waktu kerja lembur hanya dapat dilakukan paling banyak 3 (tiga) jam dalam 1 (satu) hari dan 14 (empat belas) jam dalam 1 (satu) minggu.\n"
                "(2) Pengusaha yang mempekerjakan pekerja/buruh melebihi waktu kerja sebagaimana dimaksud dalam ayat (1) wajib membayar upah kerja lembur.\n"
                "(3) Ketentuan waktu kerja lembur sebagaimana dimaksud dalam ayat (1) huruf b tidak berlaku bagi sektor usaha atau pekerjaan tertentu.\n"
                "(4) Ketentuan mengenai waktu kerja lembur dan upah kerja lembur sebagaimana dimaksud dalam ayat (2) dan ayat (3) diatur dengan Keputusan Menteri."
            ),
        },
        {
            "number": "79",
            "bab": "X",
            "sort_order": 79,
            "content": (
                "(1) Pengusaha wajib memberi waktu istirahat dan cuti kepada pekerja/buruh.\n"
                "(2) Waktu istirahat dan cuti sebagaimana dimaksud dalam ayat (1) meliputi:\n"
                "a. istirahat antara jam kerja, sekurang-kurangnya setengah jam setelah bekerja selama 4 (empat) jam terus menerus dan waktu istirahat tersebut tidak termasuk jam kerja;\n"
                "b. istirahat mingguan 1 (satu) hari untuk 6 (enam) hari kerja dalam 1 (satu) minggu atau 2 (dua) hari untuk 5 (lima) hari kerja dalam 1 (satu) minggu;\n"
                "c. cuti tahunan, sekurang-kurangnya 12 (dua belas) hari kerja setelah pekerja/buruh yang bersangkutan bekerja selama 12 (dua belas) bulan secara terus menerus; dan\n"
                "d. istirahat panjang sekurang-kurangnya 2 (dua) bulan dan dilaksanakan pada tahun ketujuh dan kedelapan masing-masing 1 (satu) bulan bagi pekerja/buruh yang telah bekerja selama 6 (enam) tahun secara terus-menerus pada perusahaan yang sama dengan ketentuan pekerja/buruh tersebut tidak berhak lagi atas istirahat tahunannya dalam 2 (dua) tahun berjalan dan selanjutnya berlaku untuk setiap kelipatan masa kerja 6 (enam) tahun.\n"
                "(3) Pelaksanaan waktu istirahat tahunan sebagaimana dimaksud dalam ayat (2) huruf c diatur dalam perjanjian kerja, peraturan perusahaan, atau perjanjian kerja bersama.\n"
                "(4) Hak istirahat panjang sebagaimana dimaksud dalam ayat (2) huruf d hanya berlaku bagi pekerja/buruh yang bekerja pada perusahaan tertentu.\n"
                "(5) Perusahaan tertentu sebagaimana dimaksud dalam ayat (4) diatur dengan Keputusan Menteri."
            ),
        },
        {
            "number": "81",
            "bab": "X",
            "sort_order": 81,
            "content": (
                "(1) Pekerja/buruh perempuan yang dalam masa haid merasakan sakit dan memberitahukan kepada pengusaha, tidak wajib bekerja pada hari pertama dan kedua pada waktu haid."
            ),
        },
        {
            "number": "82",
            "bab": "X",
            "sort_order": 82,
            "content": (
                "(1) Pekerja/buruh perempuan berhak memperoleh istirahat selama 1,5 (satu setengah) bulan sebelum saatnya melahirkan anak dan 1,5 (satu setengah) bulan sesudah melahirkan menurut perhitungan dokter kandungan atau bidan.\n"
                "(2) Pekerja/buruh perempuan yang mengalami keguguran kandungan berhak memperoleh istirahat 1,5 (satu setengah) bulan atau sesuai dengan surat keterangan dokter kandungan atau bidan."
            ),
        },
        {
            "number": "88",
            "bab": "X",
            "sort_order": 88,
            "content": (
                "(1) Setiap pekerja/buruh berhak memperoleh penghasilan yang memenuhi penghidupan yang layak bagi kemanusiaan.\n"
                "(2) Untuk mewujudkan penghasilan yang memenuhi penghidupan yang layak bagi kemanusiaan sebagaimana dimaksud dalam ayat (1), pemerintah menetapkan kebijakan pengupahan yang melindungi pekerja/buruh.\n"
                "(3) Kebijakan pengupahan yang melindungi pekerja/buruh sebagaimana dimaksud dalam ayat (2) meliputi:\n"
                "a. upah minimum;\n"
                "b. upah kerja lembur;\n"
                "c. upah tidak masuk kerja karena berhalangan;\n"
                "d. upah tidak masuk kerja karena melakukan kegiatan lain di luar pekerjaannya;\n"
                "e. upah karena menjalankan hak waktu istirahat kerjanya;\n"
                "f. bentuk dan cara pembayaran upah;\n"
                "g. denda dan potongan upah;\n"
                "h. hal-hal yang dapat diperhitungkan dengan upah;\n"
                "i. struktur dan skala pengupahan yang proporsional;\n"
                "j. upah untuk pembayaran pesangon; dan\n"
                "k. upah untuk perhitungan pajak penghasilan.\n"
                "(4) Pemerintah menetapkan upah minimum sebagaimana dimaksud dalam ayat (3) huruf a berdasarkan kebutuhan hidup layak dan dengan memperhatikan produktivitas dan pertumbuhan ekonomi."
            ),
        },
        {
            "number": "89",
            "bab": "X",
            "sort_order": 89,
            "content": (
                "(1) Upah minimum sebagaimana dimaksud dalam Pasal 88 ayat (3) huruf a dapat terdiri atas:\n"
                "a. upah minimum berdasarkan wilayah provinsi atau kabupaten/kota;\n"
                "b. upah minimum berdasarkan sektor pada wilayah provinsi atau kabupaten/kota.\n"
                "(2) Upah minimum sebagaimana dimaksud dalam ayat (1) diarahkan kepada pencapaian kebutuhan hidup layak.\n"
                "(3) Upah minimum sebagaimana dimaksud dalam ayat (1) ditetapkan oleh Gubernur dengan memperhatikan rekomendasi dari Dewan Pengupahan Provinsi dan/atau Bupati/Walikota.\n"
                "(4) Komponen serta pelaksanaan tahapan pencapaian kebutuhan hidup layak sebagaimana dimaksud dalam ayat (2) diatur dengan Keputusan Menteri."
            ),
        },
        {
            "number": "90",
            "bab": "X",
            "sort_order": 90,
            "content": (
                "(1) Pengusaha dilarang membayar upah lebih rendah dari upah minimum sebagaimana dimaksud dalam Pasal 89.\n"
                "(2) Bagi pengusaha yang tidak mampu membayar upah minimum sebagaimana dimaksud dalam Pasal 89 dapat dilakukan penangguhan.\n"
                "(3) Tata cara penangguhan sebagaimana dimaksud dalam ayat (2) diatur dengan Keputusan Menteri."
            ),
        },
        {
            "number": "150",
            "bab": "XII",
            "sort_order": 150,
            "content": (
                "Ketentuan mengenai pemutusan hubungan kerja dalam undang-undang ini meliputi pemutusan hubungan kerja yang terjadi di badan usaha yang berbadan hukum atau tidak, milik orang perseorangan, milik persekutuan atau milik badan hukum, baik milik swasta maupun milik negara, maupun usaha-usaha sosial dan usaha-usaha lain yang mempunyai pengurus dan mempekerjakan orang lain dengan membayar upah atau imbalan dalam bentuk lain."
            ),
        },
        {
            "number": "151",
            "bab": "XII",
            "sort_order": 151,
            "content": (
                "(1) Pengusaha, pekerja/buruh, serikat pekerja/serikat buruh, dan pemerintah, dengan segala upaya harus mengusahakan agar jangan terjadi pemutusan hubungan kerja.\n"
                "(2) Dalam hal segala upaya telah dilakukan, tetapi pemutusan hubungan kerja tidak dapat dihindari, maka maksud pemutusan hubungan kerja wajib dirundingkan oleh pengusaha dan serikat pekerja/serikat buruh atau dengan pekerja/buruh apabila pekerja/buruh yang bersangkutan tidak menjadi anggota serikat pekerja/serikat buruh.\n"
                "(3) Dalam hal perundingan sebagaimana dimaksud dalam ayat (2) benar-benar tidak menghasilkan persetujuan, pengusaha hanya dapat memutuskan hubungan kerja dengan pekerja/buruh setelah memperoleh penetapan dari lembaga penyelesaian perselisihan hubungan industrial."
            ),
        },
        {
            "number": "153",
            "bab": "XII",
            "sort_order": 153,
            "content": (
                "(1) Pengusaha dilarang melakukan pemutusan hubungan kerja dengan alasan:\n"
                "a. pekerja/buruh berhalangan masuk kerja karena sakit menurut keterangan dokter selama waktu tidak melampaui 12 (dua belas) bulan secara terus-menerus;\n"
                "b. pekerja/buruh berhalangan menjalankan pekerjaannya karena memenuhi kewajiban terhadap negara sesuai dengan ketentuan peraturan perundang-undangan yang berlaku;\n"
                "c. pekerja/buruh menjalankan ibadah yang diperintahkan agamanya;\n"
                "d. pekerja/buruh menikah;\n"
                "e. pekerja/buruh perempuan hamil, melahirkan, gugur kandungan, atau menyusui bayinya;\n"
                "f. pekerja/buruh mempunyai pertalian darah dan/atau ikatan perkawinan dengan pekerja/buruh lainnya di dalam satu perusahaan, kecuali telah diatur dalam perjanjian kerja, peraturan perusahaan, atau perjanjian kerja bersama;\n"
                "g. pekerja/buruh mendirikan, menjadi anggota dan/atau pengurus serikat pekerja/serikat buruh, pekerja/buruh melakukan kegiatan serikat pekerja/serikat buruh di luar jam kerja, atau di dalam jam kerja atas kesepakatan pengusaha, atau berdasarkan ketentuan yang diatur dalam perjanjian kerja, peraturan perusahaan, atau perjanjian kerja bersama;\n"
                "h. pekerja/buruh yang mengadukan pengusaha kepada yang berwajib mengenai perbuatan pengusaha yang melakukan tindak pidana kejahatan;\n"
                "i. karena perbedaan paham, agama, aliran politik, suku, warna kulit, golongan, jenis kelamin, kondisi fisik, atau status perkawinan;\n"
                "j. pekerja/buruh dalam keadaan cacat tetap, sakit akibat kecelakaan kerja, atau sakit karena hubungan kerja yang menurut surat keterangan dokter yang jangka waktu penyembuhannya belum dapat dipastikan.\n"
                "(2) Pemutusan hubungan kerja yang dilakukan dengan alasan sebagaimana dimaksud dalam ayat (1) batal demi hukum dan pengusaha wajib mempekerjakan kembali pekerja/buruh yang bersangkutan."
            ),
        },
        {
            "number": "156",
            "bab": "XII",
            "sort_order": 156,
            "content": (
                "(1) Dalam hal terjadi pemutusan hubungan kerja, pengusaha diwajibkan membayar uang pesangon dan atau uang penghargaan masa kerja dan uang penggantian hak yang seharusnya diterima.\n"
                "(2) Perhitungan uang pesangon sebagaimana dimaksud dalam ayat (1) paling sedikit sebagai berikut:\n"
                "a. masa kerja kurang dari 1 (satu) tahun, 1 (satu) bulan upah;\n"
                "b. masa kerja 1 (satu) tahun atau lebih tetapi kurang dari 2 (dua) tahun, 2 (dua) bulan upah;\n"
                "c. masa kerja 2 (dua) tahun atau lebih tetapi kurang dari 3 (tiga) tahun, 3 (tiga) bulan upah;\n"
                "d. masa kerja 3 (tiga) tahun atau lebih tetapi kurang dari 4 (empat) tahun, 4 (empat) bulan upah;\n"
                "e. masa kerja 4 (empat) tahun atau lebih tetapi kurang dari 5 (lima) tahun, 5 (lima) bulan upah;\n"
                "f. masa kerja 5 (lima) tahun atau lebih tetapi kurang dari 6 (enam) tahun, 6 (enam) bulan upah;\n"
                "g. masa kerja 6 (enam) tahun atau lebih tetapi kurang dari 7 (tujuh) tahun, 7 (tujuh) bulan upah;\n"
                "h. masa kerja 7 (tujuh) tahun atau lebih tetapi kurang dari 8 (delapan) tahun, 8 (delapan) bulan upah;\n"
                "i. masa kerja 8 (delapan) tahun atau lebih, 9 (sembilan) bulan upah.\n"
                "(3) Perhitungan uang penghargaan masa kerja sebagaimana dimaksud dalam ayat (1) ditetapkan sebagai berikut:\n"
                "a. masa kerja 3 (tiga) tahun atau lebih tetapi kurang dari 6 (enam) tahun, 2 (dua) bulan upah;\n"
                "b. masa kerja 6 (enam) tahun atau lebih tetapi kurang dari 9 (sembilan) tahun, 3 (tiga) bulan upah;\n"
                "c. masa kerja 9 (sembilan) tahun atau lebih tetapi kurang dari 12 (dua belas) tahun, 4 (empat) bulan upah;\n"
                "d. masa kerja 12 (dua belas) tahun atau lebih tetapi kurang dari 15 (lima belas) tahun, 5 (lima) bulan upah;\n"
                "e. masa kerja 15 (lima belas) tahun atau lebih tetapi kurang dari 18 (delapan belas) tahun, 6 (enam) bulan upah;\n"
                "f. masa kerja 18 (delapan belas) tahun atau lebih tetapi kurang dari 21 (dua puluh satu) tahun, 7 (tujuh) bulan upah;\n"
                "g. masa kerja 21 (dua puluh satu) tahun atau lebih tetapi kurang dari 24 (dua puluh empat) tahun, 8 (delapan) bulan upah;\n"
                "h. masa kerja 24 (dua puluh empat) tahun atau lebih, 10 (sepuluh) bulan upah.\n"
                "(4) Uang penggantian hak yang seharusnya diterima sebagaimana dimaksud dalam ayat (1) meliputi:\n"
                "a. cuti tahunan yang belum diambil dan belum gugur;\n"
                "b. biaya atau ongkos pulang untuk pekerja/buruh dan keluarganya ketempat dimana pekerja/buruh diterima bekerja;\n"
                "c. penggantian perumahan serta pengobatan dan perawatan ditetapkan 15% (lima belas perseratus) dari uang pesangon dan/atau uang penghargaan masa kerja bagi yang memenuhi syarat;\n"
                "d. hal-hal lain yang ditetapkan dalam perjanjian kerja, peraturan perusahaan atau perjanjian kerja bersama."
            ),
        },
        {
            "number": "167",
            "bab": "XII",
            "sort_order": 167,
            "content": (
                "(1) Pengusaha dapat melakukan pemutusan hubungan kerja terhadap pekerja/buruh karena memasuki usia pensiun dan apabila pengusaha telah mengikutkan pekerja/buruh pada program pensiun yang iurannya dibayar penuh oleh pengusaha, maka pekerja/buruh tidak berhak mendapatkan uang pesangon sesuai ketentuan Pasal 156 ayat (2), uang penghargaan masa kerja sesuai ketentuan Pasal 156 ayat (3), tetapi tetap berhak atas uang penggantian hak sesuai ketentuan Pasal 156 ayat (4).\n"
                "(2) Dalam hal besarnya jaminan atau manfaat pensiun yang diterima sekaligus dalam program pensiun sebagaimana dimaksud dalam ayat (1) ternyata lebih kecil daripada jumlah uang pesangon 2 (dua) kali ketentuan Pasal 156 ayat (2) dan uang penghargaan masa kerja 1 (satu) kali ketentuan Pasal 156 ayat (3), dan uang penggantian hak sesuai ketentuan Pasal 156 ayat (4), maka selisihnya dibayar oleh pengusaha.\n"
                "(3) Dalam hal pengusaha telah mengikutsertakan pekerja/buruh dalam program pensiun yang iurannya/preminya dibayar oleh pengusaha dan pekerja/buruh, maka yang diperhitungkan dengan uang pesangon yaitu uang pensiun yang premi/iurannya dibayar oleh pengusaha.\n"
                "(4) Ketentuan sebagaimana dimaksud dalam ayat (1), ayat (2), dan ayat (3) dapat diatur lain dalam perjanjian kerja, peraturan perusahaan, atau perjanjian kerja bersama.\n"
                "(5) Dalam hal pengusaha tidak mengikutsertakan pekerja/buruh yang mengalami pemutusan hubungan kerja karena usia pensiun pada program pensiun maka pengusaha wajib memberikan kepada pekerja/buruh uang pesangon sebesar 2 (dua) kali ketentuan Pasal 156 ayat (2), uang penghargaan masa kerja 1 (satu) kali ketentuan Pasal 156 ayat (3) dan uang penggantian hak sesuai ketentuan Pasal 156 ayat (4).\n"
                "(6) Hak atas manfaat pensiun sebagaimana dimaksud dalam ayat (1), ayat (2), ayat (3), dan ayat (4) tidak menghilangkan hak pekerja/buruh atas jaminan hari tua yang bersifat wajib sesuai dengan peraturan perundang-undangan yang berlaku."
            ),
        },
    ]

    # Insert Pasals under their BABs
    pasal_ids = {}
    for pasal in pasals:
        bab_number = pasal["bab"]
        parent_id = bab_ids[bab_number]
        path = f"bab_{bab_number}.pasal_{pasal['number']}"
        content_escaped = escape_sql(pasal["content"])

        sql = (
            f"INSERT INTO document_nodes "
            f"(work_id, node_type, number, heading, content_text, parent_id, path, depth, sort_order) "
            f"VALUES ({work_id}, 'pasal', '{pasal['number']}', "
            f"'Pasal {pasal['number']}', "
            f"'{content_escaped}', "
            f"{parent_id}, '{path}', 1, {pasal['sort_order']}) "
            f"RETURNING id;"
        )
        result = run_sql(sql)
        pasal_id = result[0]["id"]
        pasal_ids[pasal["number"]] = pasal_id
        print(f"  Inserted Pasal {pasal['number']} -> id={pasal_id}")

    # =========================================================================
    # STEP 4: Create legal_chunks for each pasal
    # =========================================================================
    print("\nSTEP 4: Creating legal_chunks for search...")

    chunk_count = 0
    for pasal in pasals:
        pasal_id = pasal_ids[pasal["number"]]
        content_escaped = escape_sql(pasal["content"])
        chunk_content = f"Undang-Undang Nomor 13 Tahun 2003 tentang Ketenagakerjaan\\nPasal {pasal['number']}\\n\\n{content_escaped}"

        metadata = json.dumps({
            "type": "UU",
            "number": "13",
            "year": 2003,
            "pasal": pasal["number"],
        })

        sql = (
            f"INSERT INTO legal_chunks "
            f"(work_id, node_id, content, metadata) "
            f"VALUES ({work_id}, {pasal_id}, "
            f"'{chunk_content}', "
            f"'{metadata}'::jsonb) "
            f"RETURNING id;"
        )
        result = run_sql(sql)
        chunk_id = result[0]["id"]
        chunk_count += 1
        print(f"  Created chunk for Pasal {pasal['number']} -> id={chunk_id}")

    # =========================================================================
    # VERIFICATION
    # =========================================================================
    print("\n=== VERIFICATION ===")

    result = run_sql(
        f"SELECT COUNT(*) as cnt FROM document_nodes WHERE work_id = {work_id};"
    )
    print(f"  Document nodes count: {result[0]['cnt']}")

    result = run_sql(
        f"SELECT COUNT(*) as cnt FROM legal_chunks WHERE work_id = {work_id};"
    )
    print(f"  Legal chunks count: {result[0]['cnt']}")

    result = run_sql(
        f"SELECT node_type, COUNT(*) as cnt FROM document_nodes WHERE work_id = {work_id} GROUP BY node_type ORDER BY node_type;"
    )
    print(f"  Node types: {result}")

    result = run_sql(
        f"SELECT id, title_id, status FROM works WHERE id = {work_id};"
    )
    print(f"  Work record: {result}")

    # Test search
    result = run_sql(
        "SELECT id, content FROM legal_chunks WHERE fts @@ websearch_to_tsquery('indonesian', 'upah minimum') LIMIT 3;"
    )
    print(f"\n  Search test 'upah minimum': {len(result)} results found")
    for r in result:
        print(f"    chunk id={r['id']}: {r['content'][:80]}...")

    result = run_sql(
        "SELECT id, content FROM legal_chunks WHERE fts @@ websearch_to_tsquery('indonesian', 'pemutusan hubungan kerja') LIMIT 3;"
    )
    print(f"  Search test 'pemutusan hubungan kerja': {len(result)} results found")
    for r in result:
        print(f"    chunk id={r['id']}: {r['content'][:80]}...")

    print(f"\n=== DONE ===")
    print(f"BAB nodes inserted: {len(bab_ids)}")
    print(f"Pasal nodes inserted: {len(pasal_ids)}")
    print(f"Legal chunks inserted: {chunk_count}")


if __name__ == "__main__":
    main()
