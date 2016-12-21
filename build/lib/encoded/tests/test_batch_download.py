# Use workbook fixture from BDD tests (including elasticsearch)
from .features.conftest import app_settings, app, workbook
import pytest

@pytest.mark.skip(reason="update data when we have a working experiment")
def test_report_download(testapp, workbook):
    res = testapp.get('/report.tsv?type=Experiment&sort=accession')
    assert res.headers['content-type'] == 'text/tsv; charset=UTF-8'
    disposition = res.headers['content-disposition']
    assert disposition == 'attachment;filename="report.tsv"'
    lines = res.body.splitlines()
    assert lines[0].split(b'\t') == [
        b'ID', b'Accession', b'Assay Type', b'Assay Nickname', b'Target',
        b'Biosample', b'Description', b'Lab', b'Project', b'Status',
        b'Linked Antibody', b'Species', b'Life stage', b'Age', b'Age Units',
        b'Treatment', b'Term ID', b'Concentration', b'Concentration units',
        b'Duration', b'Duration units', b'Synchronization',
        b'Post-synchronization time', b'Post-synchronization time units',
        b'Replicates', b'Files', b'Dbxrefs'
    ]
    assert lines[1].split(b'\t') == [
        b'/experiments/ENCSR000AAL/', b'ENCSR000AAL', b'RNA-seq', b'RNA-seq',
        b'', b'K562', b'RNA Evaluation K562 Small Total RNA-seq from Gingeras',
        b'Thomas Gingeras, CSHL', b'ENCODE', b'released', b'',
        b'', b'', b'', b'', b'', b'', b'', b'', b'',
        b'', b'', b'', b'', b'', b'', b''
    ]
    assert len(lines) == 44
