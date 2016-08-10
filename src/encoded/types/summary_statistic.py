"""The type file for the collection Summary statistics."""
from snovault import (
    # calculated_property,
    collection,
    load_schema,
)
# from pyramid.security import Authenticated
from .base import (
    Item
    # paths_filtered_by_status
)


@collection(
    name='summary_statistics',
    properties={
        'title': 'Summary Statistics',
        'description': 'Listing of summary statistics',
    })
class SummaryStatistic(Item):
    """Summary statistics class."""

    base_types = ['SummaryStatistic'] + Item.base_types
    item_type = 'summary_statistic'
    schema = load_schema('encoded:schemas/summary_statistic.json')


@collection(
    name='summary-statistics-hic',
    properties={
        'title': 'Hi-C Summary Statistics',
        'description': 'Listing of Hi-C summary statistics',
    })
class SummaryStatisticHic(SummaryStatistic):
    """the sub class of summary statistics for Hi-C experiments."""

    item_type = 'summary-statistic-hic'
    schema = load_schema('encoded:schemas/summary_statistic_hic.json')
    embedded = SummaryStatistic.embedded