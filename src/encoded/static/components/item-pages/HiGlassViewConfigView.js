'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { Button, Collapse, MenuItem, DropdownButton } from 'react-bootstrap';
import Alerts from './../alerts';
import { JWT, console, object, ajax, layout, navigate } from './../util';
import { HiGlassPlainContainer, CollapsibleItemViewButtonToolbar } from './components';
import { LinkToSelector } from './../forms/components';
import DefaultItemView from './DefaultItemView';
import { ItemHeader } from './components';


export default class HiGlassViewConfigView extends DefaultItemView {

    itemHeader(){
        const itemActionsDescriptions = {
            'edit' : 'Edit the properties of this Item.',
        };

        return (
            <ItemHeader.Wrapper {..._.pick(this.props, 'context', 'href', 'schemas', 'windowWidth')}>
                <ItemHeader.TopRow typeInfo={this.typeInfo()} itemActionsDescriptions={itemActionsDescriptions} />
                <ItemHeader.MiddleRow />
                <ItemHeader.BottomRow />
            </ItemHeader.Wrapper>
        );
    }

    getTabViewContents(){

        var initTabs    = [],
            width       = this.getTabViewWidth();

        initTabs.push(HiGlassViewConfigTabView.getTabObject(this.props, width));

        return initTabs.concat(this.getCommonTabs());
    }

}



export class HiGlassViewConfigTabView extends React.PureComponent {

    static getTabObject(props, width){
        return {
            'tab' : <span><i className="icon icon-fw icon-television"/> HiGlass Browser</span>,
            'key' : 'higlass',
            'disabled' : false,
            'content' : <HiGlassViewConfigTabView {...props} width={width} />
        };
    }

    static defaultProps = {
        'isValidating' : false,
        'disabled' : false,
        'height' : 600
    };

    constructor(props){
        super(props);
        this.fullscreenButton = this.fullscreenButton.bind(this);
        this.saveButton = this.saveButton.bind(this);
        this.cloneButton = this.cloneButton.bind(this);
        this.getHiGlassComponent = this.getHiGlassComponent.bind(this);
        this.havePermissionToEdit = this.havePermissionToEdit.bind(this);
        this.handleSave = _.throttle(this.handleSave.bind(this), 3000);
        this.handleClone = _.throttle(this.handleClone.bind(this), 3000, { 'trailing' : false });
        this.handleStatusChangeToRelease = this.handleStatusChange.bind(this, 'released');
        this.handleStatusChange = this.handleStatusChange.bind(this);
        this.handleFullscreenToggle = this.handleFullscreenToggle.bind(this);
        this.addFileToHiglass = this.addFileToHiglass.bind(this);

        /**
         * @property {Object} viewConfig            The viewconf that is fed to HiGlassPlainContainer. (N.B.) HiGlassComponent may edit it in place during UI interactions.
         * @property {string} genome_assembly       Common genome assembly for all files/tracks of this viewconf.
         * @property {Object} originalViewConfig    Not currently used, but might eventually be used to compare against state.viewConfig to inform whether to enable save btn or not.
         * @property {boolean} saveLoading          True if AJAX request is en route to save Item.
         * @property {boolean} cloneLoading         True if AJAX request is en route to clone Item.
         * @property {boolean} releaseLoading       True if AJAX request is en route to change Item status.
         * @property {boolean} addFileLoading          True if AJAX request is en route to add file to `state.viewConfig`.
         */
        this.state = {
            'viewConfig'            : props.context && props.context.viewconfig,
            'genome_assembly'       : (props.context && props.context.genome_assembly) || null,
            'originalViewConfig'    : null, //object.deepClone(props.viewConfig)
            'saveLoading'           : false,
            'cloneLoading'          : false,
            'releaseLoading'        : false,
            'addFileLoading'        : false
        };

        this.higlassRef = React.createRef();
    }


    /**
     * @todo
     * Think about different (non-componentWillReceiveProps) approaches to this - perhaps simply
     * componentDidUpdate (?) now that we don't swap out state.viewConfig with nextProps.viewConfig.
     * -- After cleanup.
     */
    UNSAFE_componentWillReceiveProps(nextProps){
        var nextState = {};

        /*  Below code:
            We will likely adjust/remove to no longer change viewConfig if receive new one from back-end because
            backend will always deliver new object reference. Even if same context['@id'] and context.date_modified.
        */

        if (nextProps.viewConfig !== this.props.viewConfig){
            _.extend(nextState, {
                'originalViewConfig' : null, //object.deepClone(nextProps.viewConfig) // Not currently used.
                'viewConfig'         : nextProps.viewConfig,
                'genome_assembly'    : (nextProps.context && nextProps.context.genome_assembly) || this.state.genome_assembly || null
            });
        }

        if (nextProps.href !== this.props.href && object.itemUtil.atId(nextProps.context) === object.itemUtil.atId(this.props.context)){
            // If component is still same instance, then is likely that we're changing
            // the URI hash as a consequence of changing tabs --or-- reloading current context due to change in session, etc.
            // Export & save viewConfig from HiGlassComponent internal state to our own to preserve contents.
            var hgc                 = this.getHiGlassComponent(),
                currentViewConfStr  = hgc && hgc.api.exportAsViewConfString(),
                currentViewConf     = currentViewConfStr && JSON.parse(currentViewConfStr);

            currentViewConf && _.extend(nextState, {
                'viewConfig' : currentViewConf
            });
        }

        if (_.keys(nextState).length > 0){
            this.setState(nextState);
        }
    }

    componentDidUpdate(pastProps, pastState){
        if (this.props.isFullscreen !== pastProps.isFullscreen){
            // TODO: Trigger re-draw of HiGlassComponent somehow
        }

        // The following is not yet needed; may be re-enabled when can compare originalViewConfig vs state.viewConfig
        //
        // if (this.state.originalViewConfig === null && pastState.originalViewConfig){
        //    var hgc = this.getHiGlassComponent();
        //    if (hgc){
        //        this.setState({
        //            'originalViewConfigString' : hgc.api.exportAsViewConfString()
        //        });
        //    }
        // }
    }

    // This is not yet needed; may be re-enabled when can compare originalViewConfig vs state.viewConfig
    // componentDidMount(){
    //     // Hacky... we need to wait for HGC to load up and resize itself and such...
    //     var initOriginalViewConfState = () => {
    //         var hgc = this.getHiGlassComponent();
    //         if (hgc){
    //             setTimeout(()=>{
    //                 this.setState({
    //                     'originalViewConfigString' : hgc.api.exportAsViewConfString()
    //                 });
    //             }, 2000);
    //         } else {
    //             setTimeout(initOriginalViewConfState, 200);
    //         }
    //     };
    //
    //     initOriginalViewConfState();
    // }

    havePermissionToEdit(){
        return !!(this.props.session && _.findWhere(this.props.context.actions || [], { 'name' : 'edit' }));
    }

    /**
     * Update the current higlass viewconfig for the user, based on the current data.
     * Note that this function is throttled in constructor() to prevent someone clicking it like, 100 times within 3 seconds.
     * @returns {void}
    */
    handleSave(evt){
        evt.preventDefault();

        var hgc                 = this.getHiGlassComponent(),
            currentViewConfStr  = hgc && hgc.api.exportAsViewConfString(),
            currentViewConf     = currentViewConfStr && JSON.parse(currentViewConfStr);

        if (!currentViewConf){
            throw new Error('Could not get current view configuration.');
        }

        if (!this.havePermissionToEdit()){
            // I guess would also get caught in ajax error callback.
            throw new Error('No edit permissions.');
        }

        // We're updating this object's view conf and the genome assembly.
        var payload = {
            'viewconfig' : currentViewConf
        };

        if (this.state.genome_assembly){
            // If we always include this and its null, then we get validation error because
            // is not of type string. It must be explictly excluded, not just set to null
            // or undefined.
            payload.genome_assembly = this.state.genome_assembly;
        }

        this.setState({ 'saveLoading' : true }, ()=>{
            ajax.load(
                this.props.href,
                (resp)=>{
                    // Success callback... maybe update state.originalViewConfigString or something...
                    // At this point we're saved maybe just notify user somehow if UI update re: state.saveLoading not enough.
                    Alerts.queue({
                        'title' : "Saved " + this.props.context.title,
                        'message' : "This HiGlass Display Item has been updated with the current viewport. This may take a few minutes to take effect.",
                        'style' : 'success'
                    });
                    this.setState({ 'saveLoading' : false });
                },
                'PATCH',
                ()=>{
                    // Error callback
                    Alerts.queue({
                        'title' : "Failed to save display.",
                        'message' : "Sorry, can you try to save again?",
                        'style' : 'danger'
                    });
                    this.setState({ 'saveLoading' : false });
                },
                JSON.stringify(payload)
            );
        });
    }

    /**
    * Create a new higlass viewconfig for the user, based on the current data.
    * @returns {void}
    */
    handleClone(evt){
        evt.preventDefault();

        var { context }         = this.props,
            hgc                 = this.getHiGlassComponent(),
            currentViewConfStr  = hgc && hgc.api.exportAsViewConfString(),
            currentViewConf     = currentViewConfStr && JSON.parse(currentViewConfStr);

        if (!currentViewConf){
            throw new Error('Could not get current view configuration.');
        }

        // Generate a new title and description based on the current display.
        var userDetails     = JWT.getUserDetails(),
            userUUID        = (userDetails && userDetails.uuid) || null,
            userFirstName   = "Unknown";

        if (userDetails && typeof userDetails.first_name === 'string' && userDetails.first_name.length > 0) userFirstName = userDetails.first_name;

        var viewConfTitleAppendStr  = " - " + userFirstName + "'s copy",
            viewConfDesc            = context.description,
            viewConfTitle           = context.display_title + viewConfTitleAppendStr; // Default, used if title does not already have " - [this user]'s copy" substring.

        // Check if our title already has " - user's copy" substring and if so,
        // increment an appended counter instead of re-adding the substring.
        if (context.display_title.indexOf(viewConfTitleAppendStr) > -1){
            var regexCheck      = new RegExp('(' + viewConfTitleAppendStr + ')\\s\\(\\d+\\)'),
                regexMatches    = context.display_title.match(regexCheck);

            if (regexMatches && regexMatches.length === 2) {
                // regexMatches[0] ==> " - user's copy (int)"
                // regexMatches[1] ==> " - user's copy"
                var copyCount = parseInt(
                    regexMatches[0].replace(regexMatches[1], '')
                        .trim()
                        .replace('(', '')
                        .replace(')', '')
                );

                copyCount++;
                viewConfTitle = (
                    context.display_title.replace(regexMatches[0], '') // Remove old " - user's copy (int)" substr
                    + viewConfTitleAppendStr + ' (' + copyCount + ')'  // Add new count
                );
            } else {
                // Our title already has " - user's copy" substring, but not an " (int)"
                viewConfTitle = context.display_title + ' (2)';
            }
        }

        var fallbackCallback = (errResp, xhr) => {
            // Error callback
            Alerts.queue({
                'title' : "Failed to save display.",
                'message' : "Sorry, can you try to save again?",
                'style' : 'danger'
            });
            this.setState({ 'cloneLoading' : false });
        };

        var payload = {
            'title'          : viewConfTitle,
            'description'    : viewConfDesc,
            'viewconfig'     : currentViewConf,
            // We don't include other properties and let them come from schema default values.
            // For example, default status is 'draft', which will be used.
            // Lab and award do not carry over as current user might be from different lab.
        };

        if (this.state.genome_assembly){
            payload.genome_assembly = this.state.genome_assembly;
        }

        // Try to POST/PUT a new viewconf.
        this.setState(
            { 'cloneLoading' : true },
            () => {
                ajax.load(
                    '/higlass-view-configs/',
                    (resp) => { // We're likely to get a status code of 201 - Created.
                        this.setState({ 'cloneLoading' : false }, ()=>{
                            const newItemHref = object.itemUtil.atId(resp['@graph'][0]);

                            // Redirect the user to the new Higlass display.
                            navigate(newItemHref, {}, (resp)=>{
                                // Show alert on new Item page
                                Alerts.queue({
                                    'title'     : "Saved " + viewConfTitle,
                                    'message'   : "Saved new display.",
                                    'style'     : 'success'
                                });
                            });
                        });
                    },
                    'POST',
                    fallbackCallback,
                    JSON.stringify(payload)
                );
            }
        );

    }

    /**
    * Update the current Viewconf to add a new view with the file with the given uuid.
    * @returns {void}
    */
    addFileToHiglass(fileAtID) {
        var { context }         = this.props,
            hgc                 = this.getHiGlassComponent(),
            currentViewConfStr  = hgc && hgc.api.exportAsViewConfString(),
            currentViewConf     = currentViewConfStr && JSON.parse(currentViewConfStr);

        if (!currentViewConf){
            throw new Error('Could not get current view configuration.');
        }

        // Read the url of the higlass viewconfig and store the genome assembly.
        ajax.load(
            this.props.href,
            (resp)=>{
                if(resp.success) {
                    this.setState({ 'genome_assembly' : resp.genome_assembly });
                }
            },
            'GET'
        );

        // Get the x and y scales of the first view.
        let firstViewLocationAndZoom = [null, null, null];
        if (currentViewConf.views && currentViewConf.views.length > 0)
        {
            const firstViewUid = currentViewConf.views[0].uid;

            const xScale = hgc.xScales[firstViewUid];
            const yScale = hgc.yScales[firstViewUid];

            // Transform the first view's location and zoom levels.
            const xCenter = xScale.invert((xScale.range()[0] + xScale.range()[1]) / 2);
            const yCenter = yScale.invert((yScale.range()[0] + yScale.range()[1]) / 2);
            const k = xScale.invert(1) - xScale.invert(0);

            firstViewLocationAndZoom = [xCenter, yCenter, k];
        }

        var payload = {
            'higlass_viewconfig': currentViewConf,
            'genome_assembly': this.state.genome_assembly,
            'files' : [fileAtID],
            'firstViewLocationAndZoom': firstViewLocationAndZoom
        };

        // If it failed, show the error in the popup window.
        var fallbackCallback = (errResp, xhr) => {
            // Error callback
            Alerts.queue({
                'title' : "Failed to add file.",
                'message' : errResp.errors,
                'style' : 'danger'
            });
            this.setState({ 'addFileLoading' : false });
        };

        // Make an AJAX call to add the file.
        this.setState(
            { addFileLoading : true },
            () => {
                ajax.load(
                    "/add_files_to_higlass_viewconf/",
                    (resp) => {
                        let stateChange = { 'addFileLoading' : false };
                        if (resp.success) {
                            // Update the genome assembly and view config.
                            if (resp.new_genome_assembly) {
                                stateChange["genome_assembly"] = resp.new_genome_assembly;
                            }
                            stateChange["viewConfig"] = resp.new_viewconfig;
                        }

                        this.setState(stateChange, ()=>{
                            // If it failed, return an error message.
                            if (!resp.success) {
                                return fallbackCallback(resp);
                            }

                            // Show alert indicating success
                            Alerts.queue({
                                'title'     : "Added file",
                                'message'   : "Added new file to Higlass display.",
                                'style'     : 'success'
                            });
                        });
                    },
                    'POST',
                    fallbackCallback,
                    JSON.stringify(payload)
                );
            }
        );
    }

    /**
    * Copies current URL to clipbard.
    * Sets the higlass display status to released if it isn't already.
    *
    * @returns {void}
    */
    handleStatusChange(statusToSet = 'released', evt){
        evt.preventDefault();

        var { context, href }   = this.props,
            hgc                 = this.getHiGlassComponent(),
            viewConfTitle       = context.title || context.display_title;

        // If the view config has already been released, just copy the URL to the clipboard and return.
        if (context.status === statusToSet) {
            return;
        }

        if (!this.havePermissionToEdit()){
            throw new Error('No edit permissions.');
        }

        // PATCH `status: released` to current href, then in a callback, copy the URL to the clipboard.
        this.setState(
            { 'releaseLoading' : true },
            ()=>{
                ajax.load(
                    href,
                    (resp)=>{
                        // Success! Generate an alert telling the user it's successful
                        this.setState({ 'releaseLoading' : false });
                        Alerts.queue({
                            'title'     : "Updated Status for " + viewConfTitle,
                            'message'   : (
                                <p className="mb-02">
                                    Changed Display status to <b>{ statusToSet }</b>.
                                    It may take some time for this edit to take effect.
                                </p>
                            ),
                            'style'     : 'info'
                        });
                    },
                    'PATCH',
                    (resp)=>{
                        // Error callback
                        this.setState({ 'releaseLoading' : false });
                        Alerts.queue({
                            'title'     : "Failed to release display.",
                            'message'   : "Sorry, can you try to share again?",
                            'style'     : 'danger'
                        });
                    },
                    JSON.stringify({
                        'status' : statusToSet
                    })
                );
            }
        );
    }

    getHiGlassComponent(){
        return (this.higlassRef && this.higlassRef.current && this.higlassRef.current.getHiGlassComponent()) || null;
    }

    statusChangeButton(){
        var { session, context } = this.props,
            { saveLoading, cloneLoading, releaseLoading } = this.state,
            editPermission = this.havePermissionToEdit();

        if (!session || !editPermission) return null; // TODO: Remove and implement for anon users. Eventually.

        var btnProps  = {
            'onSelect'      : this.handleStatusChange,
            //'onClick'       : context.status === 'released' ? null : this.handleStatusChangeToRelease,
            'bsStyle'       : context.status === 'released' ? 'default' : 'info',
            'disabled'      : releaseLoading,
            'key'           : 'statuschangebtn',
            'data-tip'      : "Change the visibility/permissions of this HiGlass Display",
            'title'         : (
                    <React.Fragment>
                        <i className={"icon icon-fw icon-" + (releaseLoading ? 'circle-o-notch icon-spin' : 'id-badge')}/>&nbsp; Manage
                    </React.Fragment>
                ),
            'pullRight'     : true
        };

        return (
            <DropdownButton {...btnProps}>
                <StatusMenuItem eventKey="released" context={context}>Visible by Everyone</StatusMenuItem>
                <StatusMenuItem eventKey="released to project" context={context}>Visible by Network</StatusMenuItem>
                <StatusMenuItem eventKey="released to lab" context={context}>Visible by Lab</StatusMenuItem>
                <StatusMenuItem eventKey="draft" context={context}>Private</StatusMenuItem>
                <MenuItem divider />
                {/* These statuses currently not available.
                <StatusMenuItem active={context.status === "archived to project"} eventKey="archived to project">Archive to Project</StatusMenuItem>
                <StatusMenuItem active={context.status === "archived"} eventKey="archived">Archive to Lab</StatusMenuItem>
                */}
                <StatusMenuItem eventKey="deleted" context={context}>Delete</StatusMenuItem>
            </DropdownButton>
        );
    }

    saveButton(){
        var { session, context } = this.props,
            { saveLoading } = this.state,
            tooltip = "Save the current view shown below to this display";

        var editPermission  = this.havePermissionToEdit();

        return (
            <Button onClick={this.handleSave} disabled={!editPermission || saveLoading} bsStyle="success" key="savebtn" data-tip={tooltip}>
                <i className={"icon icon-fw icon-" + (saveLoading ? 'circle-o-notch icon-spin' : 'save')}/>&nbsp; Save
            </Button>
        );
    }

    cloneButton(){
        var { session } = this.props,
            { cloneLoading } = this.state,
            tooltip = "Create your own new HiGlass Display based off of this one";

        return (
            <Button onClick={this.handleClone} disabled={!session || cloneLoading} bsStyle="success" key="clonebtn" data-tip={tooltip}>
                <i className={"icon icon-fw icon-" + (cloneLoading ? 'circle-o-notch icon-spin' : 'clone')}/>&nbsp; Clone
            </Button>
        );
    }

    copyURLButton(){
        var gridState   = layout.responsiveGridState(this.props.windowWidth),
            isMobile    = gridState !== 'lg',
            valToCopy   = this.props.href;
        return (
            <object.CopyWrapper data-tip="Copy view URL to clipboard to share with others." includeIcon={false} wrapperElement={Button} value={valToCopy}>
                <i className="icon icon-fw icon-copy"/>{ isMobile ?
                    <React.Fragment>
                        &nbsp;&nbsp; Copy URL
                    </React.Fragment>
                : null }
            </object.CopyWrapper>
        );
    }

    /**
     * Is used to call {function} `props.toggleFullScreen` which is passed down from app.js BodyElement.
     * Calls it in a setTimeout because HiGlassComponent may hang JS/UI thread as it refits/calculates itself
     * in response to new `width` and `height` props passed to it.
     */
    handleFullscreenToggle(){
        var { isFullscreen, toggleFullScreen } = this.props;
        setTimeout(toggleFullScreen, 0, !isFullscreen);
    }

    fullscreenButton(){
        var { isFullscreen, toggleFullScreen } = this.props;
        if(typeof isFullscreen === 'boolean' && typeof toggleFullScreen === 'function'){
            return (
                <Button onClick={this.handleFullscreenToggle} data-tip={!isFullscreen ? 'Expand to full screen' : null}>
                    <i className={"icon icon-fw icon-" + (!isFullscreen ? 'expand' : 'compress')}/>
                </Button>
            );
        }
        return null;
    }

    extNonFullscreen(){
        // TODO: temp add file text input box to go here
        // we can use temp text input box which take @id and then iterate on it later
        // in any case, we'll need logic to AJAX in the file, check its file_type, genome_assembly, higlass_uid, and craftfully extend hgc.api.exportAsViewConfString() with it.
        // Would use/add to HiGlassConfigurator functions.


        return (
            <div className="bottom-panel">

            </div>
        );
    }

    render(){
        var { isFullscreen, windowWidth, windowHeight, width, session } = this.props,
            { addFileLoading, genome_assembly } = this.state;

        const hiGlassComponentWidth = isFullscreen ? windowWidth : width + 20;

        // Setting the height of the HiGlass Component follows one of these rules:
        // - If it's Fullscreen it should almost take up the entire window.
        // - Set to a fixed height.
        var hiGlassComponentHeight;
        if (isFullscreen) {
            hiGlassComponentHeight = windowHeight -120;
        }
        else {
            hiGlassComponentHeight = 600;
        }

        // If the user isn't logged in, add a tooltip reminding them to log in.
        var tooltip = null;
        if (!session) {
            tooltip = "Log in to be able to clone, save, and share HiGlass Displays";
        }

        return (
            <div className={"overflow-hidden tabview-container-fullscreen-capable" + (isFullscreen ? ' full-screen-view' : '')}>
                <h3 className="tab-section-title">
                    <AddFileButton onClick={this.addFileToHiglass} loading={addFileLoading} genome_assembly={genome_assembly}
                        className="mt-17" style={{ 'paddingLeft' : 30, 'paddingRight' : 30 }} />
                    <CollapsibleItemViewButtonToolbar tooltip={tooltip} windowWidth={windowWidth} constantButtons={this.fullscreenButton()} collapseButtonTitle={function(isOpen){
                        return (
                            <span>
                                <i className={"icon icon-fw icon-" + (isOpen ? 'angle-up' : 'navicon')}/>&nbsp; Menu
                            </span>
                        );
                    }}>
                        {/* <AddFileButton onClick={this.addFileToHiglass} loading={addFileLoading} genome_assembly={genome_assembly}/> */}
                        { this.saveButton() }
                        { this.cloneButton() }
                        { this.statusChangeButton() }
                    </CollapsibleItemViewButtonToolbar>
                </h3>
                <hr className="tab-section-title-horiz-divider"/>
                <div className="higlass-tab-view-contents">
                    <div className="higlass-container-container" style={isFullscreen ? { 'paddingLeft' : 10, 'paddingRight' : 10 } : null }>
                        <HiGlassPlainContainer {..._.omit(this.props, 'context', 'viewConfig')}
                            width={hiGlassComponentWidth} height={hiGlassComponentHeight} viewConfig={this.state.viewConfig}
                            ref={this.higlassRef} />
                    </div>
                    { !isFullscreen ? this.extNonFullscreen() : null }
                </div>
            </div>
        );
    }
}

/**
 * This Component has a button and a text input and a button.
 * You will type a file uuid into the field and click the button to accept.
 */
class AddFileButton extends React.PureComponent {

    static propTypes = {
        'onClick' : PropTypes.func.isRequired,
        'loading' : PropTypes.bool.isRequired
    };

    constructor(props){
        super(props);
        this.receiveFile            = this.receiveFile.bind(this);
        this.setIsSelecting         = _.throttle(this.toggleIsSelecting.bind(this, true), 3000, { 'trailing' : false });
        this.unsetIsSelecting       = this.toggleIsSelecting.bind(this, false);
        this.toggleIsSelecting      = this.toggleIsSelecting.bind(this);
        this.state = {
            'isSelecting' : false
        };
    }

    toggleIsSelecting(isSelecting){
        this.setState(function(currState){
            if (typeof isSelecting !== 'boolean') isSelecting = !currState.isSelecting;
            if (isSelecting === currState.isSelecting) return null;
            return { isSelecting };
        });
    }

    receiveFile(fileAtID, fileContext) {

        // Is it blank? Do nothing.
        if (!fileAtID) {
            return;
        }

        this.setState({ 'isSelecting' : false }, ()=>{
            // Invoke the object callback function, using the text input.
            this.props.onClick(fileAtID);
        });
    }

    render(){
        var { loading, genome_assembly } = this.props,
            { isSelecting } = this.state,
            tooltip         = "Search for a file and add it to the display.",
            dropMessage     = "Drop a File here.",
            searchURL       = (
                '/search/?currentAction=selection&type=File&track_and_facet_info.track_title!=No+value&higlass_uid!=No+value'
                + (genome_assembly? '&genome_assembly=' + encodeURIComponent(genome_assembly) : '' )
            );

        return (
            <React.Fragment>
                <Button onClick={this.setIsSelecting} disabled={loading} bsStyle="success" key="addfilebtn" data-tip={tooltip}
                    {..._.pick(this.props, 'className', 'style')}>
                    <i className={"icon icon-fw icon-" + (loading ? 'circle-o-notch icon-spin' : 'plus')}/>&nbsp; Add Data
                </Button>
                <LinkToSelector isSelecting={isSelecting} onSelect={this.receiveFile} onCloseChildWindow={this.unsetIsSelecting} dropMessage={dropMessage} searchURL={searchURL} />
            </React.Fragment>
        );
    }
}

class StatusMenuItem extends React.PureComponent {
    render(){
        var { eventKey, context, children } = this.props,
            active = context.status === eventKey;

        children = (
            <span className={active ? "text-500" : null}>
                <i className="item-status-indicator-dot" data-status={eventKey} />&nbsp;  { children }
            </span>
        );

        return <MenuItem {..._.omit(this.props, 'context')} active={active} children={children} />;
    }
}


/**
 * Dont use. Was testing stuff. Not fun UX. Details tab is nicer.
 *
 * @deprecated
 * @class CollapsibleViewConfOutput
 * @extends {React.PureComponent}
 */
class CollapsibleViewConfOutput extends React.PureComponent {

    constructor(props){
        super(props);
        this.toggle = this.toggle.bind(this);
        this.state = {
            'open' : false
        };
    }

    toggle(e){
        e.preventDefault();
        this.setState(function(currState){
            return { 'open' : !currState.open };
        });
    }

    render(){
        var { viewConfig } = this.props,
            { open } = this.state;

        return (
            <div className="viewconfig-panel">
                <hr/>
                <h4 className="clickable inline-block text-400" onClick={this.toggle}>
                    <i className={"icon icon-fw icon-" + (open ? 'minus' : 'plus' )} />&nbsp;&nbsp;
                    { open ? 'Close' : 'View' } Configuration
                </h4>
                <Collapse in={open}>
                    <pre>{ viewConfig }</pre>
                </Collapse>
            </div>
        );
    }
}
