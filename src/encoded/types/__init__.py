"""init.py lists all the collections that do not have a dedicated types file."""

from snovault.attachment import ItemWithAttachment
from snovault import (
    calculated_property,
    collection,
    load_schema,
)
# from pyramid.traversal import find_root
from .base import (
    Item
    # paths_filtered_by_status,
)


def includeme(config):
    """include me method."""
    config.scan()


@collection(
    name='labs',
    unique_key='lab:name',
    properties={
        'title': 'Labs',
        'description': 'Listing of 4D Nucleome labs',
    })
class Lab(Item):
    """Lab class."""

    item_type = 'lab'
    schema = load_schema('encoded:schemas/lab.json')
    name_key = 'name'
    embedded = ['awards']


@collection(
    name='awards',
    unique_key='award:name',
    properties={
        'title': 'Awards (Grants)',
        'description': 'Listing of awards (aka grants)',
    })
class Award(Item):
    """Award class."""

    item_type = 'award'
    schema = load_schema('encoded:schemas/award.json')
    name_key = 'name'
    embedded = ['pi']


@collection(
    name='organisms',
    unique_key='organism:name',
    properties={
        'title': 'Organisms',
        'description': 'Listing of all registered organisms',
    })
class Organism(Item):
    """Organism class."""

    item_type = 'organism'
    schema = load_schema('encoded:schemas/organism.json')
    name_key = 'name'


@collection(
    name='publications',
    unique_key='publication:identifier',
    properties={
        'title': 'Publications',
        'description': 'Publication pages',
    })
class Publication(Item):
    """Publication class."""

    item_type = 'publication'
    schema = load_schema('encoded:schemas/publication.json')
    # embedded = ['datasets']

    def unique_keys(self, properties):
        """unique keys."""
        keys = super(Publication, self).unique_keys(properties)
        if properties.get('identifiers'):
            keys.setdefault('alias', []).extend(properties['identifiers'])
        return keys

    @calculated_property(condition='date_published', schema={
        "title": "Publication year",
        "type": "string",
    })
    def publication_year(self, date_published):
        """publication year."""
        return date_published.partition(' ')[0]


@collection(
    name='documents',
    properties={
        'title': 'Documents',
        'description': 'Listing of Documents',
    })
class Document(ItemWithAttachment, Item):
    """Document class."""

    item_type = 'document'
    schema = load_schema('encoded:schemas/document.json')
    embedded = ['lab', 'award', 'submitted_by']


@collection(
    name='enzymes',
    unique_key='enzyme:name',
    properties={
        'title': 'Enzymes',
        'description': 'Listing of enzymes',
    })
class Enzyme(Item):
    """Enzyme class."""

    item_type = 'enzyme'
    schema = load_schema('encoded:schemas/enzyme.json')
    name_key = 'name'
    embedded = ['enzyme_source']


@collection(
    name='biosources',
    unique_key='accession',
    properties={
        'title': 'Biosources',
        'description': 'Cell lines and tissues used for biosamples',
    })
class Biosource(Item):
    """Biosource class."""

    item_type = 'biosource'
    name_key = 'accession'
    schema = load_schema('encoded:schemas/biosource.json')
    embedded = ["individual", "individual.organism"]

    @calculated_property(schema={
        "title": "Biosource name",
        "description": "Specific name of the biosource.",
        "type": "string",
    })
    def biosource_name(self, request, biosource_type, individual=None,  cell_line=None, tissue=None):
        if biosource_type == "tissue":
            if tissue:
                return tissue
        elif biosource_type == "immortalized cell line":
            if cell_line:
                return cell_line
        elif biosource_type == "whole organisms":
            if individual:
                individual_props = request.embed(individual, '@@object')
                organism = individual_props['organism']
                organism_props = request.embed(organism, '@@object')
                organism_name = organism_props['name']
                return "Whole " + organism_name
        return biosource_type


@collection(
    name='constructs',
    properties={
        'title': 'Constructs',
        'description': 'Listing of Constructs',
    })
class Construct(Item):
    """Construct class."""

    item_type = 'construct'
    schema = load_schema('encoded:schemas/construct.json')


@collection(
    name='modifications',
    properties={
        'title': 'Modifications',
        'description': 'Listing of Stable Genomic Modifications',
    })
class Modification(Item):
    """Modification class."""

    item_type = 'modification'
    schema = load_schema('encoded:schemas/modification.json')
    embedded = ['constructs']

    @calculated_property(schema={
        "title": "Modification name",
        "description": "Modification name including type and target.",
        "type": "string",
    })
    def modification_name(self, request, modification_type=None, constructs=None):
        if modification_type == "Crispr":
            if constructs:
                #TODO: add case for multiple constructs
                construct_props = request.embed(constructs[0], '@@object')
                target = construct_props['designed_to_target']
                return modification_type + " for " + target
        elif modification_type:
            return modification_type
        return "None"


@collection(
    name='quality_metric_flags',
    properties={
        'title': 'Quality Metric Flags'
    })
class QualityMetricFlag(Item):
    """Quality Metrics Flag class."""

    item_type = 'quality_metric_flag'
    schema = load_schema('encoded:schemas/quality_metric_flag.json')
    embedded = ['quality_metrics']


@collection(
    name='analysis_steps',
    properties={
        'title': 'AnalysisSteps',
        'description': 'Listing of analysis steps for 4DN analyses',
    })
class AnalysisStep(Item):
    """The AnalysisStep class that descrbes a step in a workflow."""

    item_type = 'analysis_step'
    schema = load_schema('encoded:schemas/analysis_step.json')
    embedded = ['software_used', 'qa_stats_generated']


@collection(
    name='tasks',
    properties={
        'title': 'Tasks',
        'description': 'Listing of runs of analysis steps for 4DN analyses',
    })
class Task(Item):
    """The Task class that descrbes a run of an analysis step."""

    item_type = 'task'
    schema = load_schema('encoded:schemas/task.json')
    embedded = ['analysis_step']


@collection(
    name='workflows',
    properties={
        'title': 'Workflows',
        'description': 'Listing of 4DN analysis workflows',
    })
class Workflow(Item):
    """The Workflow class that describes a workflow and steps in it."""

    item_type = 'workflow'
    schema = load_schema('encoded:schemas/workflow.json')


@collection(
    name='workflow_runs',
    properties={
        'title': 'Workflow Runs',
        'description': 'Listing of executions of 4DN analysis workflows',
    })
class WorkflowRun(Item):
    """The WorkflowRun class that describes execution of a workflow and tasks in it."""

    item_type = 'workflow_run'
    schema = load_schema('encoded:schemas/workflow_run.json')
    embedded = ['workflow', 'tasks']
