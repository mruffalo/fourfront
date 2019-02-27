import pytest
pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema]


@pytest.fixture
def modifications(basic_modification, mod_w_genomic_change, mod_w_target,
                  mod_w_change_and_target):
    return {
        'basic_mod': basic_modification,
        'mod_w_gen_chg': mod_w_genomic_change,
        'mod_w_target': mod_w_target,
        'mod_w_both': mod_w_change_and_target
    }


def test_calculated_modification_name(testapp, modifications):
    for name in modifications:
        modname = modifications[name]['modification_name']
        short = modifications[name]['modification_name_short']
        # assert modifications[name]['modification_name_short'] == modname
        if name == 'basic_mod':
            assert modname == 'Crispr' and short == 'Crispr'
        elif name == 'mod_w_gen_chg':
            assert modname == 'Crispr deletion' and short == 'deletion'
        elif name == 'mod_w_target':
            assert modname == 'Crispr for Gene:eeny,meeny'
            assert short == 'eeny,meeny Crispr'
        elif name == 'mod_w_both':
            assert modname == 'Crispr deletion for Gene:eeny,meeny'
            assert short == 'eeny,meeny deletion'
