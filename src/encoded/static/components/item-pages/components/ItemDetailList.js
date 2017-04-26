'use strict';

var React = require('react');
var _ = require('underscore');
import { Collapse, Button } from 'react-bootstrap';
var ReactTooltip = require('react-tooltip');
var { console, object, Filters } = require('./../../util');
var globals = require('./../../globals');
import PartialList from './PartialList';
var FilesInSetTable = require('./FilesInSetTable');
import { getTitleStringFromContext } from './../item';
import JSONTree from 'react-json-tree';

/**
 * @memberof module:item-pages/components.ItemDetailList
 * @namespace
 */
var Detail = module.exports.Detail = React.createClass({

    statics: {

        /**
         * Formats the correct display for each metadata field.
         *
         * @memberof module:item-pages/components.ItemDetailList.Detail
         * @static
         * @param {Object} tips - Mapping of field property names (1 level deep) to schema properties.
         * @param {Object} key - Key to use to get 'description' for tooltip from the 'tips' param.
         * @returns {Element} <div> element with a tooltip and info-circle icon.
         */
        formKey : function(tips, key){
            var tooltip = null;
            var title = null;
            if (tips[key]){
                var info = tips[key];
                if (info.description){
                    tooltip = info.description;
                }
                if (info.title){
                    title = info.title;
                }
            }


            return (
                <div className="tooltip-info-container">
                    <span>{ title || key } { tooltip !== null ?
                        <i data-tip={tooltip} className="icon icon-info-circle"/>
                    : null }</span>
                </div>
            );

        },

        /**
         * Recursively render keys/values included in a provided item.
         * Wraps URLs/paths in link elements. Sub-panels for objects.
         *
         * @memberof module:item-pages/components.ItemDetailList.Detail
         * @static
         * @param {Object} schemas - Object containing schemas for server's JSONized object output.
         * @param {Object|Array|string} item - Item(s) to render recursively.
         */
        formValue : function (schemas, item, popLink=false, keyPrefix = '', atType = 'ExperimentSet', depth = 0) {
            if (item === null){
                return <span>No Value</span>;
            } else if (Array.isArray(item)) {

                if (keyPrefix === 'files_in_set'){
                    return (
                        <FilesInSetTable.Small files={item}/>
                    );
                }

                return (
                    <ul>
                        {   item.length === 0 ? <li><em>None</em></li>
                            :   item.map(function(it, i){
                                    return <li key={i}>{ Detail.formValue(schemas, it, popLink, keyPrefix, atType, depth + 1) }</li>;
                                })
                        }
                    </ul>
                );
            } else if (typeof item === 'object' && item !== null) {
                var title = getTitleStringFromContext(item);

                // if the following is true, we have an embedded object
                if (item.display_title && typeof item.link_id === 'string'){
                    var format_id = item.link_id.replace(/~/g, "/")
                    if(popLink){
                        return (
                            <a href={format_id} target="_blank">
                                {title}
                            </a>
                        );
                    }else{
                        return (
                            <a href={format_id}>
                                { title }
                            </a>
                        );
                    }
                } else { // it must be an embedded sub-object (not Item)
                    return (
                        <Detail.SubIPanel
                            schemas={schemas}
                            content={item}
                            key={title}
                            title={title}
                            popLink={popLink}
                        />
                    );
                }
            } else if (typeof item === 'string'){
                if(item.indexOf('@@download') > -1 || item.charAt(0) === '/'){
                    // this is a download link. Format appropriately
                    var split_item = item.split('/');
                    var attach_title = decodeURIComponent(split_item[split_item.length-1]);
                    return (
                        <a key={item} href={item} target="_blank" download>
                            {attach_title}
                        </a>
                    );
                } else if (item.charAt(0) === '/') {
                    return (
                        <a key={item} href={item}>
                            {item}
                        </a>
                    );
                } else if (item.slice(0,4) === 'http') {
                    // Is a URL. Check if we should render it as a link/uri.
                    var schemaProperty = Filters.Field.getSchemaProperty(keyPrefix, schemas, atType);
                    if (
                        schemaProperty &&
                        typeof schemaProperty.format === 'string' &&
                        ['uri','url'].indexOf(schemaProperty.format.toLowerCase()) > -1
                    ){
                        return (
                            <a key={item} href={item} target="_blank">
                                {item}
                            </a>
                        );
                    }
                }
            }
            return(<span>{ item }</span>); // Fallback
        },

        /**
         * @memberof module:item-pages/components.ItemDetailList.Detail
         * @namespace
         * @type {Component}
         */
        SubIPanel : React.createClass({
            /**
             * @memberof module:item-pages/item-view.SubIPanel
             * @private
             * @instance
             * @returns {Object} 'isOpen' : false
             */
            getInitialState: function() {
                return {isOpen: false};
            },

            /**
             * Handler for rendered title element. Toggles visiblity of Detail.Subview.
             *
             * @memberof module:item-pages/item-view.SubIPanel
             * @private
             * @instance
             * @param {MouseEvent} e - Mouse click event. Its preventDefault() method is called.
             * @returns {Object} 'isOpen' : false
             */
            handleToggle: function (e) {
                e.preventDefault();
                this.setState({
                    isOpen: !this.state.isOpen,
                });
            },

            /**
             * Renders title for the Detail.Subview.
             *
             * @memberof module:item-pages/item-view.SubIPanel
             * @private
             * @instance
             * @param {string} title - Title of panel, e.g. display_title of object for which SubIPanel is being used.
             * @param {boolean} isOpen - Whether state.isOpen is true or not. Used for if plus or minus icon.
             * @returns {Element} <span> element.
             */
            toggleLink : function(title = this.props.title, isOpen = this.state.isOpen){
                var iconType = isOpen ? 'icon-minus' : 'icon-plus';
                if (typeof title !== 'string' || title.toLowerCase() === 'no title found'){
                    title = isOpen ? "Collapse" : "Expand";
                }
                return (
                    <span className="subitem-toggle">
                        <a href="#" className="link" onClick={this.handleToggle}>
                            <i style={{'color':'black', 'paddingRight':'10px'}} className={"icon " + iconType}/>
                            { title }
                        </a>
                    </span>
                );
            },

            /** @ignore */
            render: function() {
                var schemas = this.props.schemas;
                var item = this.props.content;
                var title = this.props.title;
                var popLink = this.props.popLink;
                return (
                    <span>
                        { this.toggleLink(title, this.state.isOpen) }
                        { this.state.isOpen ?
                            <Detail.Subview schemas={schemas} content={item} title={title} popLink={popLink}/>
                        : null }
                    </span>
                );
            }
        }),

        /**
         * Renders a panel <div> element containing a list.
         *
         * @memberof module:item-pages/components.ItemDetailList.Detail
         * @namespace
         * @type {Component}
         */
        Subview : React.createClass({
            /** @ignore */
            render: function(){
                var schemas = this.props.schemas;
                var item = this.props.content;
                var title = this.props.title;
                var popLink = this.props.popLink;
                var tips = object.tipsFromSchema(schemas, item);
                var sortKeys = Object.keys(item).sort();
                return (
                    <div className="sub-panel data-display panel-body-with-header">
                        <div className="key-value sub-descriptions">
                            {sortKeys.map(function(key, idx){
                                return (
                                    <PartialList.Row key={key} label={Detail.formKey(tips,key)}>
                                        { Detail.formValue(schemas, item[key], popLink, key) }
                                    </PartialList.Row>
                                );
                            })}
                        </div>
                    </div>
                );
            }
        }),

    },

    propTypes : {
        schemas : React.PropTypes.object.isRequired,
        context : React.PropTypes.object.isRequired,
    },

    /** @ignore */
    getDefaultProps : function(){
        return {
            'excludedKeys' : [
                '@context', 'actions', 'audit' /* audit currently not embedded (empty obj) */,
                // Visible elsewhere on page
                'lab', 'award', 'description',
                '@id', 'link_id', 'display_title'
            ],
            'stickyKeys' : [
                // Experiment Set
                'experimentset_type', 'date_released',
                // Experiment
                'experiment_type', 'experiment_summary', 'experiment_sets', 'files', 'filesets',
                'protocol', 'biosample', 'digestion_enzyme', 'digestion_temperature',
                'digestion_time', 'ligation_temperature', 'ligation_time', 'ligation_volume',
                'tagging_method',
                // Biosample
                'biosource','biosource_summary','biosample_protocols','modifications_summary',
                'treatments_summary',
                // File
                'file_type', 'file_format', 'filename', 'href', 'notes', 'flowcell_details',
                // Lab
                'awards', 'address1', 'address2', 'city', 'country', 'institute_name', 'state',
                // Award
                'end_date', 'project', 'uri',
                // Document
                'attachment',
                // Things to go at bottom consistently
                'aliases',
            ],
            'alwaysCollapsibleKeys' : [
                '@type', 'accession', 'schema_version', 'uuid', 'replicate_exps', 'dbxrefs', 'status', 'external_references', 'date_created'
            ],
            'open' : null
        };
    },

    /** @ignore */
    render : function(){
        var context = this.props.context;
        var sortKeys = _.difference(_.keys(context).sort(), this.props.excludedKeys.sort());
        var tips = object.tipsFromSchema(this.props.schemas, context);

        // Sort applicable persistent keys by original persistent keys sort order.
        var stickyKeysObj = _.object(
            _.intersection(sortKeys, this.props.stickyKeys.slice(0).sort()).map(function(key){
                return [key, true];
            })
        );
        var orderedStickyKeys = [];
        this.props.stickyKeys.forEach(function (key) {
            if (stickyKeysObj[key] === true) orderedStickyKeys.push(key);
        });

        var extraKeys = _.difference(sortKeys, this.props.stickyKeys.slice(0).sort());
        var collapsibleKeys = _.intersection(extraKeys.sort(), this.props.alwaysCollapsibleKeys.slice(0).sort());
        extraKeys = _.difference(extraKeys, collapsibleKeys);
        var popLink = this.props.popLink || false; // determines whether links should be opened in a new tab
        return (
            <PartialList
                persistent={ orderedStickyKeys.concat(extraKeys).map((key,i) =>
                    <PartialList.Row key={key} label={Detail.formKey(tips,key)}>
                        { Detail.formValue(this.props.schemas,context[key], popLink, key, context['@type'] && context['@type'][0]) }
                    </PartialList.Row>
                )}
                collapsible={ collapsibleKeys.map((key,i) =>
                    <PartialList.Row key={key} label={Detail.formKey(tips,key)}>
                        { Detail.formValue(this.props.schemas,context[key], popLink, key, context['@type'] && context['@type'][0]) }
                    </PartialList.Row>
                )}
                open={this.props.open}
            />
        );
    }
});

var ItemDetailList = module.exports.ItemDetailList = React.createClass({

    statics : {
        Detail : Detail
    },

    getInitialState : function(){
        return {
            'collapsed' : true,
            'showingJSON' : false
        };
    },

    seeMoreButton : function(){
        if (typeof this.props.collapsed === 'boolean') return null;
        return (
            <button className="item-page-detail-toggle-button btn btn-default btn-block" onClick={()=>{
                this.setState({ collapsed : !this.state.collapsed });
            }}>{ this.state.collapsed ? "See advanced information" : "Hide" }</button>
        );
    },

    componentDidMount : function(){
        ReactTooltip.rebuild();
    },

    componentDidUpdate : function(pastProps, pastState){
        if (this.state.showingJSON === false && pastState.showingJSON === true){
            ReactTooltip.rebuild();
        }
    },

    toggleJSONButton : function(){
        return (
            <button type="button" className="btn btn-block btn-default" onClick={()=>{
                this.setState({ 'showingJSON' : !this.state.showingJSON });
            }}>
                { this.state.showingJSON ?
                    <span><i className="icon icon-fw icon-list"/> View as List</span>
                    :
                    <span><i className="icon icon-fw icon-code"/> View as JSON</span>
                }
            </button>
        );
    },

    render : function(){
        var collapsed;
        if (typeof this.props.collapsed === 'boolean') collapsed = this.props.collapsed;
        else collapsed = this.state.collapsed;
        return (
            <div className="item-page-detail">
                { !this.state.showingJSON ?
                    <div className="overflow-hidden">
                        <Detail
                            context={this.props.context}
                            schemas={this.props.schemas}
                            open={!collapsed}
                        />
                        <div className="row">
                            <div className="col-xs-6">{ this.seeMoreButton() }</div>
                            <div className="col-xs-6">{ this.toggleJSONButton() }</div>
                        </div>
                    </div>
                    :
                    <div className="overflow-hidden">
                        <div className="json-tree-wrapper">
                            <JSONTree data={this.props.context} />
                        </div>
                        <br/>
                        <div className="row">
                            <div className="col-xs-12 col-sm-6 pull-right">{ this.toggleJSONButton() }</div>
                        </div>
                    </div>
                }

            </div>
        );
    }

});
