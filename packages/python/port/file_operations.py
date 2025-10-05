import zipfile


def get_zipfile(filename):
    try:
        return zipfile.ZipFile(filename)
    except zipfile.error:
        return None


def get_files(zipfile_ref):
    try:
        return zipfile_ref.namelist()
    except zipfile.error:
        return []


def extract_file(zipfile_ref, filename):
    try:
        return filename, zipfile_ref.read(filename)
    except zipfile.error:
        return None
