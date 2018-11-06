"""Abstract collection for UserContent and sub-classes of StaticSection, HiglassViewConfig, etc."""

import os, requests
from snovault import (
    abstract_collection,
    calculated_property,
    collection,
    load_schema
)
from .base import (
    Item,
    ALLOW_CURRENT,
    DELETED,
    ALLOW_LAB_SUBMITTER_EDIT,
    ALLOW_VIEWING_GROUP_VIEW,
    ONLY_ADMIN_VIEW,
    ALLOW_ANY_USER_ADD
)



@abstract_collection(
    name='user-content',
    unique_key='user_content:name',
    properties={
        'title': "User Content Listing",
        'description': 'Listing of all types of content which may be created by people.',
    })
class UserContent(Item):

    base_types = ['UserContent'] + Item.base_types
    schema = load_schema('encoded:schemas/user_content.json')
    embedded_list = ["submitted_by.display_title"]

    STATUS_ACL = {
        'released': ALLOW_CURRENT,
        'archived': ALLOW_CURRENT,
        'deleted': DELETED,
        'draft': ONLY_ADMIN_VIEW,
        'released to project': ALLOW_VIEWING_GROUP_VIEW,
        'archived to project': ALLOW_VIEWING_GROUP_VIEW
    }

    def _update(self, properties, sheets=None):
        if properties.get('name') is None and self.uuid is not None:
            properties['name'] = str(self.uuid)
        super(UserContent, self)._update(properties, sheets)



@collection(
    name='static-sections',
    unique_key='user_content:name',
    properties={
        'title': 'Static Sections',
        'description': 'Static Sections for the Portal',
    })
class StaticSection(UserContent):
    """The Software class that contains the software... used."""
    item_type = 'static_section'
    schema = load_schema('encoded:schemas/static_section.json')

    @calculated_property(schema={
        "title": "Content",
        "description": "Content for the page",
        "type": "string"
    })
    def content(self, request, body=None, file=None):

        if isinstance(body, str) or isinstance(body, dict) or isinstance(body, list):
            # Don't need to load in anything. We don't currently support dict/json body (via schema) but could in future.
            return body

        if isinstance(file, str):
            if file[0:4] == 'http' and '://' in file[4:8]:  # Remote File
                return get_remote_file_contents(file)
            else:                                           # Local File
                file_path = os.path.abspath(os.path.dirname(os.path.realpath(__file__)) + "/../../.." + file)   # Go to top of repo, append file
                return get_local_file_contents(file_path)

        return None

    @calculated_property(schema={
        "title": "File Type",
        "description": "Type of file used for content",
        "type": "string"
    })
    def filetype(self, request, body=None, file=None, options=None):
        if options and options.get('filetype') is not None:
            return options['filetype']
        if isinstance(body, str):
            return 'txt'
        if isinstance(body, dict) or isinstance(body, list):
            return 'json'
        if isinstance(file, str):
            filename_parts = file.split('.')
            if len(filename_parts) > 1:
                return filename_parts[len(filename_parts) - 1]
            else:
                return 'txt' # Default if no file extension.
        return None




@collection(
    name='higlass-view-configs',
    properties={
        'title': 'HiGlass Displays',
        'description': 'Dsiplays and view configurations for HiGlass',
    })
class HiglassViewConfig(UserContent):
    """
    Item type which contains a `view_config` property and other metadata.
    """

    item_type = 'higlass_view_config'
    schema = load_schema('encoded:schemas/higlass_view_config.json')

    STATUS_ACL = dict(UserContent.STATUS_ACL, released=ALLOW_ANY_USER_ADD)

    #@calculated_property(schema={
    #    "title": "ViewConfig Files",
    #    "description": "List of files which are defined in ViewConfig",
    #    "type": "array",
    #    "linkTo" : "File"
    #})
    #def viewconfig_files(self, request):
    #    '''
    #    TODO: Calculate which files are defined in viewconfig, if any.
    #    '''
    #    return None


    #@calculated_property(schema={
    #    "title": "ViewConfig Tileset UIDs",
    #    "description": "List of UIDs which are defined in ViewConfig",
    #    "type": "array",
    #    "items" : {
    #        "type" : "string"
    #    }
    #})
    #def viewconfig_tileset_uids(self, request):
    #    '''
    #    TODO: Calculate which tilesetUids are defined in viewconfig, if any.
    #    '''
    #    return None

    class Collection(Item.Collection):
        def __init__(self, *args, **kw):
            super(HiglassViewConfig.Collection, self).__init__(*args, **kw)
            # Emulates base.py Item.Collection
            self.__acl__ = ALLOW_ANY_USER_ADD

def get_local_file_contents(filename, contentFilesLocation=None):
    if contentFilesLocation is None:
        full_file_path = filename
    else:
        full_file_path = contentFilesLocation + '/' + filename
    if not os.path.isfile(full_file_path):
        return None
    file = open(full_file_path, encoding="utf-8")
    output = file.read()
    file.close()
    return output


def get_remote_file_contents(uri):
    resp = requests.get(uri)
    return resp.text

""" Begin Chad's section
"""
@view_config(name='add_files', context=File, request_method='PATCH',
             permission='edit')
def add_files_to_higlass_viewconf(context, request):
    """ Add multiple files to the given Higlass view config.
    """
    # Get the base view conf.
    # Clone the base view conf so the original remains unchanged.
    # Get the file list.
    # Loop through, adding each file.
    # Generate a response containing the new view conf and any generated error messages.

    # If any of the new files failed, abandon progress and return failure.

    # If all of the files were added successfuly, save to the database and commit.

    # Return success.
    pass

def add_single_file_to_higlass_viewconf(viewconf, new_file):
    """ Add a single file to the view config.
    """
    # If the viewconf has 6 files, it's already at capacity. Return an error.

    # Get the viewconf's genome assembly, if it has one.
    # Get the new_file's genome assembly.
    # If both are mcool files, compare the genome assemblies. Return an error if they don't match.

    # Is the new_file 1-dimensional or 2-dimensional?
    # Does the view config have any 2-dimensional files?
    # Get the most recently added 2-dimensional file.

    # If the view config has all 1-D files, put the new file below all of them.

    # If the new file is 1-D, add the new file above the right most column.

    # If the new file is 2-D, try to pack it in so it fits into a 3 x 2 grid. The packing order is:
    # 1 2 5
    # 3 4 6

    # Success! Return the modified view conf.
    pass

""" End Chad's section
"""
