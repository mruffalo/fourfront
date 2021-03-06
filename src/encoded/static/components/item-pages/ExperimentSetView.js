'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import memoize from 'memoize-one';
import { Collapse } from 'react-bootstrap';
import { console, object, isServerSide, expFxn, layout, Schemas, fileUtil, typedefs } from './../util';
import {
    HiGlassAjaxLoadContainer, HiGlassPlainContainer, isHiglassViewConfigItem,
    FlexibleDescriptionBox, AdjustableDividerRow, OverviewHeadingContainer
} from './components';
import { OverViewBodyItem } from './DefaultItemView';
import WorkflowRunTracingView, { FileViewGraphSection } from './WorkflowRunTracingView';
import { QCMetricFromSummary } from './FileView';
import {
    RawFilesStackedTableExtendedColumns, ProcessedFilesStackedTable, renderFileQCReportLinkButton,
    SelectedFilesController, SelectedFilesDownloadButton
} from './../browse/components';
import { EmbeddedHiglassActions } from './../static-pages/components';

// eslint-disable-next-line no-unused-vars
const { Item, File, ExperimentSet } = typedefs;

// import { SET } from './../testdata/experiment_set/replicate_4DNESXZ4FW4';
// import { SET } from './../testdata/experiment_set/replicate_with_bigwigs';




/**
 * ExperimentSet Item view/page.
 *
 * @prop {Object} schemas - state.schemas passed down from app Component.
 * @prop {ExperimentSet} context - JSON representation of current ExperimentSet item.
 */
export default class ExperimentSetView extends WorkflowRunTracingView {

    static anyOtherProcessedFilesExist = memoize(function(context){
        var otherProcessedFilesFromExpSetExist = (Array.isArray(context.other_processed_files) && context.other_processed_files.length > 0);

        if (otherProcessedFilesFromExpSetExist){ // Ensure have permissions
            otherProcessedFilesFromExpSetExist = OtherProcessedFilesStackedTableSection.checkOPFCollectionsPermissions(context.other_processed_files);
        }
        var expsInSetExist = (Array.isArray(context.experiments_in_set) && context.experiments_in_set.length > 0);
        if (!otherProcessedFilesFromExpSetExist && !expsInSetExist) return false;

        if (expsInSetExist){
            var expsOPFCollections = _.pluck(context.experiments_in_set, 'other_processed_files');
            var otherProcessedFilesFromExpsExist = _.any(expsOPFCollections || [], OtherProcessedFilesStackedTableSection.checkOPFCollectionsPermissions);
            if (!otherProcessedFilesFromExpSetExist && !otherProcessedFilesFromExpsExist) return false;
        }
        return true;
    });

    /** Preserve selected files if href changes (due to `#tab-id`), unlike the default setting for BrowseView. */
    static resetSelectedFilesCheck(nextProps, pastProps){
        if (nextProps.context !== pastProps.context) return true;
        return false;
    }

    static propTypes = {
        'schemas' : PropTypes.object,
        'context' : PropTypes.object.isRequired
    };

    constructor(props){
        super(props);
        _.bindAll(this, 'isWorkflowNodeCurrentContext', 'getTabViewContents', 'shouldGraphExist');
        this.allProcessedFilesFromExperimentSet = memoize(expFxn.allProcessedFilesFromExperimentSet);
        this.allFilesFromExperimentSet = memoize(expFxn.allFilesFromExperimentSet);

        /**
         * Explicit self-assignment to remind that we inherit the following properties from WorkfowRunTracingView:
         * `loadingGraphSteps`, `allRuns`, `steps`, & `mounted`
         */
        this.state = this.state;
    }

    shouldGraphExist(){
        const { context } = this.props;
        const processedFiles = this.allProcessedFilesFromExperimentSet(context);
        const processedFilesLen = (processedFiles && processedFiles.length) || 0;
        return processedFilesLen > 0;
    }

    isWorkflowNodeCurrentContext(node){
        var ctx = this.props.context;
        if (!ctx) return false;
        if (!node || !node.meta || !node.meta.run_data || !node.meta.run_data.file) return false;
        if (Array.isArray(node.meta.run_data.file)) return false;
        if (typeof node.meta.run_data.file.accession !== 'string') return false;
        if (!ctx.processed_files || !Array.isArray(ctx.processed_files) || ctx.processed_files.length === 0) return false;
        if (_.contains(_.pluck(ctx.processed_files, 'accession'), node.meta.run_data.file.accession)) return true;
        return false;
    }

    /**
     * Executed on width change, as well as this ItemView's prop change.
     */
    getTabViewContents(){
        const { context, schemas, windowWidth, windowHeight, href } = this.props;
        const { mounted } = this.state;

        //context = SET; // Use for testing along with _testing_data

        const processedFiles = this.allProcessedFilesFromExperimentSet(context);
        const processedFilesLen = (processedFiles && processedFiles.length) || 0;
        const rawFiles = this.allFilesFromExperimentSet(context, false);
        const rawFilesLen = (rawFiles && rawFiles.length) || 0;
        const width = this.getTabViewWidth();

        const commonProps = { width, context, schemas, windowWidth, href, mounted };
        const propsForTableSections = _.extend(SelectedFilesController.pick(this.props), commonProps);

        var tabs = [];

        // Processed Files Table Tab
        if (processedFilesLen > 0){
            tabs.push({
                tab : <span><i className="icon icon-microchip icon-fw"/>{ ' ' + processedFilesLen + " Processed File" + (processedFilesLen > 1 ? 's' : '') }</span>,
                key : 'processed-files',
                content : (
                    <SelectedFilesController resetSelectedFilesCheck={ExperimentSetView.resetSelectedFilesCheck} initiallySelectedFiles={processedFiles}>
                        <ProcessedFilesStackedTableSection {...propsForTableSections} files={processedFiles} />
                    </SelectedFilesController>
                )
            });
        }

        // Raw files tab, if have experiments with raw files
        if (rawFilesLen > 0){
            tabs.push({
                tab : <span><i className="icon icon-leaf icon-fw"/>{ ' ' + rawFilesLen + " Raw File" + (rawFilesLen > 1 ? 's' : '') }</span>,
                key : 'raw-files',
                content : (
                    <SelectedFilesController resetSelectedFilesCheck={ExperimentSetView.resetSelectedFilesCheck} initiallySelectedFiles={rawFiles}>
                        <RawFilesStackedTableSection {...propsForTableSections} files={rawFiles} />
                    </SelectedFilesController>
                )
            });
        }

        // Graph Section Tab
        if (this.shouldGraphExist()){
            tabs.push(FileViewGraphSection.getTabObject(
                _.extend({}, this.props, { 'isNodeCurrentContext' : this.isWorkflowNodeCurrentContext }),
                this.state,
                this.handleToggleAllRuns,
                width
            ));
        }

        // Other Files Tab
        if (ExperimentSetView.anyOtherProcessedFilesExist(context)){
            tabs.push({
                tab : <span><i className="icon icon-files-o icon-fw"/> Supplementary Files</span>,
                key : 'supplementary-files',
                content : <OtherProcessedFilesStackedTableSection {...propsForTableSections} {...this.state} />
            });
        }

        return _.map(tabs.concat(this.getCommonTabs()), function(tabObj){
            return _.extend(tabObj, {
                'style' : {
                    'minHeight' : Math.max(mounted && !isServerSide() && (windowHeight - 180), 100) || 800
                }
            });
        });
    }

    itemMidSection(){
        const { context, schemas } = this.props;
        return (
            <React.Fragment>
                { super.itemMidSection() }
                <OverviewHeading context={context} schemas={schemas} key="overview" className="with-background mb-2 mt-1"
                    title="Experiment Set Properties" prependTitleIcon prependTitleIconFxn={OverviewHeading.prependTitleIcon} />
            </React.Fragment>
        );
    }
}


class OverviewHeading extends React.PureComponent {

    static prependTitleIcon(open, props){
        return <i className="expand-icon icon icon-th-list" />;
    }

    static expCategorizerTitle(field, val, allowJX = true, includeDescriptionTips = true, index = null, wrapperElementType = 'li', fullObject = null){
        var expCatObj = _.uniq(object.getNestedProperty(fullObject, 'experiments_in_set.experiment_categorizer'), false, 'combined');
        expCatObj = (Array.isArray(expCatObj) && expCatObj.length === 1 && expCatObj[0]) || expCatObj;
        if (expCatObj && expCatObj.combined && expCatObj.field && typeof expCatObj.value !== 'undefined'){
            return <span><span className="text-500">{ expCatObj.field }:</span> { expCatObj.value }</span>;
        }
        return OverViewBodyItem.titleRenderPresets.default(...arguments);
    }

    render(){
        const { context, schemas } = this.props;
        const tips = object.tipsFromSchema(schemas || Schemas.get(), context);
        const commonProps = { 'result' : context, 'tips' : tips, 'wrapInColumn' : 'col-sm-6 col-md-3' };
        return (
            <OverviewHeadingContainer {...this.props}>
                {/* <OverViewBodyItem result={expSet} tips={tips} property='award.project' fallbackTitle="Project" wrapInColumn={col} /> */}
                <OverViewBodyItem {...commonProps} property="experimentset_type" fallbackTitle="Set Type" />
                <OverViewBodyItem {...commonProps} property="experiments_in_set.biosample.biosource.individual.organism" fallbackTitle="Organism" />
                <OverViewBodyItem {...commonProps} property="experiments_in_set.biosample.biosource.biosource_type" fallbackTitle="Biosource Type" />
                <OverViewBodyItem {...commonProps} property="experiments_in_set.biosample.biosource_summary" fallbackTitle="Biosource" />

                <OverViewBodyItem {...commonProps} property="experiments_in_set.experiment_type" fallbackTitle="Experiment Type(s)" />
                <OverViewBodyItem {...commonProps} property="experiments_in_set.experiment_categorizer.combined" fallbackTitle="Assay Details"
                    titleRenderFxn={OverviewHeading.expCategorizerTitle} />
                <OverViewBodyItem {...commonProps} property="experiments_in_set.biosample.modifications.modification_type" fallbackTitle="Modification Type" />
                <OverViewBodyItem {...commonProps} property="experiments_in_set.biosample.treatments.treatment_type" fallbackTitle="Treatment Type" />
            </OverviewHeadingContainer>
        );
    }
}


export class RawFilesStackedTableSection extends React.PureComponent {

    renderHeader(){
        const { context, files, selectedFilesUniqueCount, selectedFiles } = this.props;
        const fileCount = files.length;
        const filenamePrefix = (context.accession || context.display_title) + "_raw_files_";

        return (
            <h3 className="tab-section-title">
                <span className="text-400">{ fileCount }</span>{ ' Raw File' + (fileCount > 1 ? 's' : '')}
                { selectedFiles ? // Make sure data structure is present (even if empty)
                    <div className="download-button-container pull-right" style={{ marginTop : -10 }}>
                        <SelectedFilesDownloadButton {...{ selectedFilesUniqueCount, selectedFiles, filenamePrefix }} id="expset-raw-files-download-files-btn">
                            <i className="icon icon-download icon-fw shift-down-1 mr-07"/>
                            <span className="hidden-xs hidden-sm">Download </span>
                            <span className="count-to-download-integer">{ selectedFilesUniqueCount }</span>
                            <span className="hidden-xs hidden-sm text-400"> Raw Files</span>
                        </SelectedFilesDownloadButton>
                    </div>
                    : null }
            </h3>
        );
    }

    render(){
        const { context, files } = this.props;
        const anyFilesWithMetrics = !!(fileUtil.filterFilesWithEmbeddedMetricItem(files, true));
        return (
            <div className="overflow-hidden">
                { this.renderHeader() }
                <div className="exp-table-container">
                    <RawFilesStackedTableExtendedColumns {..._.extend(_.pick(this.props, 'width', 'windowWidth', 'href'), SelectedFilesController.pick(this.props))}
                        experimentSet={context} showMetricColumns={anyFilesWithMetrics} collapseLongLists={true} collapseLimit={10} collapseShow={7} />
                </div>
            </div>
        );
    }
}

/**
 * TODO: Move to HiGlassTabView.js ?
 */
export class HiGlassAdjustableWidthRow extends React.PureComponent {

    static propTypes = {
        'width' : PropTypes.number.isRequired,
        'mounted' : PropTypes.bool.isRequired,
        'renderRightPanel' : PropTypes.func,
        'windowWidth' : PropTypes.number.isRequired,
        'higlassItem' : PropTypes.object,
        'minOpenHeight' : PropTypes.number,
        'maxOpenHeight' : PropTypes.number,
        'renderLeftPanelPlaceholder' : PropTypes.func,
        'leftPanelCollapseHeight' : PropTypes.number,
        'leftPanelCollapseWidth' : PropTypes.number,
        'leftPanelDefaultCollapsed' : PropTypes.bool
    };

    static defaultProps = {
        'minOpenHeight' : 300,
        'maxOpenHeight' : 800
    };

    constructor(props){
        super(props);
        _.bindAll(this, 'correctHiGlassTrackDimensions', 'renderLeftPanel');
        this.correctHiGlassTrackDimensions = _.debounce(this.correctHiGlassTrackDimensions, 100);
        this.higlassContainerRef = React.createRef();
    }

    componentDidUpdate(pastProps){
        const { width } = this.props;
        if (pastProps.width !== width){
            this.correctHiGlassTrackDimensions();
        }
    }

    /**
     * This is required because HiGlass doesn't always update all of own tracks' widths (always updates header, tho)
     */
    correctHiGlassTrackDimensions(){
        var internalHiGlassComponent = this.higlassContainerRef.current && this.higlassContainerRef.current.getHiGlassComponent();
        if (!internalHiGlassComponent) {
            console.warn('Internal HiGlass Component not accessible.');
            return;
        }
        setTimeout(HiGlassPlainContainer.correctTrackDimensions, 10, internalHiGlassComponent);
    }

    renderLeftPanel(leftPanelWidth, resetXOffset, collapsed, rightPanelHeight){
        const { renderLeftPanelPlaceholder, leftPanelCollapseHeight, higlassItem, minOpenHeight, maxOpenHeight } = this.props;
        if (collapsed){
            var useHeight = leftPanelCollapseHeight || rightPanelHeight || minOpenHeight;
            if (typeof renderLeftPanelPlaceholder === 'function'){
                return renderLeftPanelPlaceholder(leftPanelWidth, resetXOffset, collapsed, useHeight);
            } else {
                return (
                    <h5 className="placeholder-for-higlass text-center clickable mb-0 mt-0" style={{ 'lineHeight': useHeight + 'px', 'height': useHeight }} onClick={resetXOffset}
                        data-html data-place="right" data-tip="Open HiGlass Visualization for file(s)">
                        <i className="icon icon-fw icon-television"/>
                    </h5>
                );
            }
        } else {
            return (
                <React.Fragment>
                    <EmbeddedHiglassActions context={higlassItem} showDescription={false} />
                    <HiGlassAjaxLoadContainer higlassItem={higlassItem} className={collapsed ? 'disabled' : null} height={Math.min(Math.max(rightPanelHeight - 16, minOpenHeight - 16), maxOpenHeight)} ref={this.higlassContainerRef} />
                </React.Fragment>
            );
        }
    }

    render(){
        const { mounted, width, renderRightPanel, minOpenHeight, leftPanelCollapseWidth, higlassItem } = this.props;

        // Don't render the HiGlass view if it isn't mounted yet or there is nothing to display.
        if (!mounted || !higlassItem || !object.itemUtil.atId(higlassItem)) {
            return (renderRightPanel && renderRightPanel(width, null));
        }

        // Pass (almost) all props down so that re-renders are triggered of AdjustableDividerRow PureComponent
        const passProps = _.omit(this.props, 'higlassItem', 'minOpenHeight', 'maxOpenHeight', 'leftPanelCollapseWidth');

        return (
            <AdjustableDividerRow {...passProps} height={minOpenHeight} leftPanelClassName="expset-higlass-panel"
                leftPanelCollapseWidth={leftPanelCollapseWidth || 240} // TODO: Change to 240 after updating to HiGlass version w/ resize viewheader stuff fixed.
                renderLeftPanel={this.renderLeftPanel} rightPanelClassName="exp-table-container" onDrag={this.correctHiGlassTrackDimensions} />
        );
    }
}


export class ProcessedFilesStackedTableSection extends React.PureComponent {

    /**
     * Searches the context for HiGlass static_content, and returns the HiGlassItem (except the viewconfig).
     *
     * @param {object} context - Object that has static_content.
     * @return {object} Returns the HiGlassItem in the context (or null if it doesn't)
     */
    static getHiglassItemFromProcessedFiles = memoize(function(context){
        if (!Array.isArray(context.static_content)){
            return null;
        }

        // Return the first appearance of a HiglassViewConfig Item located at "tab:processed-files"
        const higlassTab = _.find(context.static_content, function(section){
            return section.location === "tab:processed-files" && isHiglassViewConfigItem(section.content);
        });

        return (higlassTab ? higlassTab.content : null);
    });

    static tableProps(sectionProps){
        return _.extend(
            _.pick(sectionProps, 'files', 'windowWidth', 'href'),
            { 'collapseLimit' : 10, 'collapseShow' : 7 },
            SelectedFilesController.pick(sectionProps)
        );
    }

    constructor(props){
        super(props);
        _.bindAll(this, 'renderTopRow', 'renderQCMetricsTablesRow', 'renderHeader', 'renderProcessedFilesTableAsRightPanel');
    }

    renderProcessedFilesTableAsRightPanel(rightPanelWidth, resetDivider, leftPanelCollapsed){
        return <ProcessedFilesStackedTable {...ProcessedFilesStackedTableSection.tableProps(this.props)} width={Math.max(rightPanelWidth, 320)} />;
    }

    renderTopRow(){
        const { mounted, width, context, windowWidth, selectedFiles } = this.props;

        const higlassItem = ProcessedFilesStackedTableSection.getHiglassItemFromProcessedFiles(context);

        if (higlassItem && object.itemUtil.atId(higlassItem)){
            // selectedFiles passed in to re-render panel if changes.
            return <HiGlassAdjustableWidthRow {...{ width, mounted, windowWidth, higlassItem, selectedFiles }} renderRightPanel={this.renderProcessedFilesTableAsRightPanel} />;
        } else {
            return <ProcessedFilesStackedTable {...ProcessedFilesStackedTableSection.tableProps(this.props)} width={width}/>;
        }
    }

    renderQCMetricsTablesRow(){
        const { width, files, windowWidth, href } = this.props;
        const filesWithMetrics = fileUtil.filterFilesWithQCSummary(files);
        const filesWithMetricsLen = filesWithMetrics.length;

        if (!filesWithMetrics || filesWithMetricsLen === 0) return null;

        const filesByTitles = fileUtil.groupFilesByQCSummaryTitles(filesWithMetrics);

        return (
            <div className="row">
                <div className="exp-table-container col-xs-12">
                    <h3 className="tab-section-title mt-12" key="tab-section-title-metrics">
                        <span>Quality Metrics</span>
                    </h3>
                    { _.map(filesByTitles, function(fileGroup, i){
                        const columnHeaders = [ // Static / present-for-each-table headers
                            { columnClass: 'experiment',  title: 'Experiment',  initialWidth: 145,  className: 'text-left' },
                            { columnClass: 'file',        title: 'For File',    initialWidth: 100 }
                        ].concat(_.map(fileGroup[0].quality_metric_summary, function(sampleQMSItem, qmsIndex){ // Dynamic Headers
                            function renderColValue(file, field, colIndex, fileEntryBlockProps){
                                const qmsItem = file.quality_metric_summary[qmsIndex];
                                const { value, tooltip } = QCMetricFromSummary.formatByNumberType(qmsItem);
                                return <span className="inline-block" data-tip={tooltip}>{ value }</span>;
                            }
                            return { columnClass : 'file-detail', title : sampleQMSItem.title, initialWidth : 80, render : renderColValue };
                        }));

                        // Add 'Link to Report' column, if any files w/ one. Else include blank one so columns align with any other stacked ones.
                        const anyFilesWithMetricURL = _.any(fileGroup, function(f){
                            return f && f.quality_metric && f.quality_metric.url;
                        });

                        if (anyFilesWithMetricURL){
                            columnHeaders.push({ columnClass: 'file-detail', title: 'Report', initialWidth: 50, render : renderFileQCReportLinkButton });
                        } else {
                            columnHeaders.push({ columnClass: 'file-detail', title: ' ', initialWidth: 50, render : function(){ return ''; } });
                        }

                        return (
                            <ProcessedFilesStackedTable {...{ width, windowWidth, href, columnHeaders }} key={i}
                                files={fileGroup} collapseLimit={10} collapseShow={7} collapseLongLists={true} titleForFiles="Processed File Metrics" />
                        );
                    }) }
                </div>
            </div>
        );
    }

    renderHeader(){
        const { files, selectedFilesUniqueCount, selectedFiles, context } = this.props;
        const filenamePrefix = (context.accession || context.display_title) + "_processed_files_";
        return (
            <h3 className="tab-section-title">
                <span>
                    <span className="text-400">{ files.length }</span> Processed Files
                </span>
                { selectedFiles ? // Make sure data structure is present (even if empty)
                    <div className="download-button-container pull-right" style={{ marginTop : -10 }}>
                        <SelectedFilesDownloadButton {...{ selectedFilesUniqueCount, selectedFiles, filenamePrefix }} id="expset-processed-files-download-files-btn">
                            <i className="icon icon-download icon-fw shift-down-1 mr-07"/>
                            <span className="hidden-xs hidden-sm">Download </span>
                            <span className="count-to-download-integer">{ selectedFilesUniqueCount }</span>
                            <span className="hidden-xs hidden-sm text-400"> Processed Files</span>
                        </SelectedFilesDownloadButton>
                    </div>
                    : null }
            </h3>
        );
    }



    render(){
        return (
            <div className="processed-files-table-section exp-table-section">
                { this.renderHeader() }
                { this.renderTopRow() }
                { this.renderQCMetricsTablesRow() }
            </div>
        );
    }
}


export class OtherProcessedFilesStackedTableSectionPart extends React.PureComponent {

    static defaultProps = {
        'defaultOpen' : false
    };

    constructor(props){
        super(props);
        this.toggleOpen = this.toggleOpen.bind(this);
        this.renderFilesTable = this.renderFilesTable.bind(this);

        this.state = {
            'open' : props.defaultOpen
        };
    }

    toggleOpen(e){
        this.setState(function(oldState){
            return { 'open' : !oldState.open };
        });
    }

    renderFilesTable(width, resetDividerFxn, leftPanelCollapsed){
        const { collection, href } = this.props;
        const passProps = _.extend({ width, href }, SelectedFilesController.pick(this.props));
        return (
            <ProcessedFilesStackedTable {...passProps} files={collection.files} collapseLongLists />
        );
    }

    render(){
        const { collection, index, context, width, mounted, defaultOpen, windowWidth } = this.props;
        const { files, higlass_view_config } = collection;
        const { open } = this.state;
        return (
            <div data-open={open} className="supplementary-files-section-part" key={collection.title || 'collection-' + index}>
                <h4>
                    <span className="inline-block clickable" onClick={this.toggleOpen}>
                        <i className={"text-normal icon icon-fw icon-" + (open ? 'minus' : 'plus')} />
                        { collection.title || "Collection " + index } <span className="text-normal text-300">({ files.length } file{files.length === 1 ? '' : 's'})</span>
                    </span>
                </h4>
                { collection.description ?
                    <FlexibleDescriptionBox description={collection.description} className="description"
                        fitTo="grid" expanded={open} windowWidth={windowWidth} />
                    :
                    <div className="mb-15"/>
                }
                <Collapse in={open} mountOnEnter>
                    <div className="table-for-collection">
                        { higlass_view_config ?
                            <HiGlassAdjustableWidthRow higlassItem={higlass_view_config} windowWidth={windowWidth} mounted={mounted} width={width - 21}
                                renderRightPanel={this.renderFilesTable} leftPanelDefaultCollapsed={defaultOpen === false} />
                            : this.renderFilesTable(width - 21) }
                    </div>
                </Collapse>
            </div>
        );
    }
}

/** This object renders the "Supplementary Files" section. */
export class OtherProcessedFilesStackedTableSection extends React.PureComponent {

    static checkOPFCollectionPermission(opfCollection){
        return _.any(opfCollection.files || [], function(opf){
            return opf && object.itemUtil.atId(opf) && !opf.error;
        });
    }

    static checkOPFCollectionsPermissions(opfCollections){
        return _.any(opfCollections || [], OtherProcessedFilesStackedTableSection.checkOPFCollectionPermission);
    }

    static extendCollectionsWithExperimentFiles = memoize(function(context){
        // Clone -- so we don't modify props.context in place
        var collectionsFromExpSet = _.map(
            context.other_processed_files,
            function(opfCollection){
                return _.extend({}, opfCollection, {
                    'files' : _.map(opfCollection.files || [], function(opf){
                        return _.extend({ 'from_experiment_set' : context, 'from_experiment' : { 'from_experiment_set' : context, 'accession' : 'NONE' } }, opf);
                    })
                });
            }
        );
        var collectionsFromExpSetTitles = _.pluck(collectionsFromExpSet, 'title');
        var collectionsByTitle = _.object(_.zip(collectionsFromExpSetTitles, collectionsFromExpSet)); // TODO what if 2 titles are identical? Validate/prevent on back-end.

        // Add 'from_experiment' info to each collection file so it gets put into right 'experiment' row in StackedTable.
        // Also required for SelectedFilesController
        var collectionsFromExps = _.reduce(context.experiments_in_set || [], function(m, exp){
            if (Array.isArray(exp.other_processed_files) && exp.other_processed_files.length > 0){
                return m.concat(
                    _.map(exp.other_processed_files, function(opfCollection){
                        return _.extend({}, opfCollection, {
                            'files' : _.map(opfCollection.files || [], function(opf){
                                return _.extend({ 'from_experiment' : _.extend({ 'from_experiment_set' : context }, exp), 'from_experiment_set' : context }, opf);
                            })
                        });
                    })
                );
            }
            return m;
        }, []);

        var collectionsFromExpsUnBubbled = [];
        _.forEach(collectionsFromExps, function(collection){
            if (collectionsByTitle[collection.title]){
                _.forEach(collection.files, function(f){
                    var duplicateExistingFile = _.find(collectionsByTitle[collection.title].files, function(existFile){ return (object.itemUtil.atId(existFile) || 'a') === (object.itemUtil.atId(f) || 'b'); });
                    if (duplicateExistingFile){
                        console.error('Found existing/duplicate file in ExperimentSet other_processed_files of Experiment File ' + f['@id']);
                    } else {
                        collectionsByTitle[collection.title].files.push(f);
                    }
                });
            } else {
                collectionsByTitle[collection.title] = collection;
            }
        });

        return _.filter(_.values(collectionsByTitle), OtherProcessedFilesStackedTableSection.checkOPFCollectionPermission);
    });

    render(){
        const { context, width, mounted, windowWidth } = this.props;
        const gridState = mounted && layout.responsiveGridState(windowWidth);
        const otherProcessedFileSetsCombined = OtherProcessedFilesStackedTableSection.extendCollectionsWithExperimentFiles(context);

        const commonProps = { context, width, mounted, windowWidth };
        //const commonProps = _.extend({ context, width, mounted, windowWidth }, SelectedFilesController.pick(this.props));

        return (
            <div className="processed-files-table-section">
                <h3 className="tab-section-title">
                    <span className="text-400">{ otherProcessedFileSetsCombined.length }</span> Collections of Supplementary Files
                </h3>
                <hr className="tab-section-title-horiz-divider"/>
                { _.map(otherProcessedFileSetsCombined, function(collection, index, all){
                    const defaultOpen = (gridState === 'sm' || gridState === 'xs' || !gridState) ? false : ((all.length < 4) || (index < 2));
                    return <OtherProcessedFilesStackedTableSectionPart {..._.extend({ collection, index, defaultOpen }, commonProps)} key={index} />;
                }) }
            </div>
        );
    }
}
