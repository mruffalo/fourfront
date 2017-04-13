'use strict';

var React = require('react');
var _ = require('underscore');
var url = require('url');
var querystring = require('querystring');
var { console, DateUtility, Filters } = require('./../../util');
var { FlexibleDescriptionBox } = require('./../../experiment-common');
import { getBaseItemType } from './../item';


var ItemHeader = module.exports = {

    /**** Helper Static Functions ****/

    /**
     * Returns the leaf type from the Item's types array.
     *
     * @public
     * @static
     * @throws {Error} Throws error if no types array ('@type') or it is empty.
     * @param {Object} context - JSON representation of current Item.
     * @returns {string} Most specific type's name.
     */
    itemType : function(context){
        if (!Array.isArray(context['@type']) || context['@type'].length < 1) throw new Error("No @type on Item object (context).");
        return context['@type'][0];
    },

    /**
     * Returns ItemHeader.itemType() only if it is different from the Item base type.
     *
     * @public
     * @static
     * @param {Object} context - JSON representation of current Item.
     * @returns {string} The more detailed type name.
     */
    moreDetailedItemType : function(context){
        var specificType = ItemHeader.itemType(context);
        var baseType = getBaseItemType(context);
        if (specificType !== baseType) return specificType;
        return null;
    },

    /**
     * Returns schema for the specific type of Item we're on.
     *
     * @public
     * @static
     * @param {string} itemType - The type for which to get schema.
     * @param {Object} [schemas] - Mapping of schemas, by type.
     * @returns {Object} Schema for itemType.
     */
    getSchemaForItemType : function(itemType, schemas = null){
        if (typeof itemType !== 'string') return null;
        if (!schemas){
            schemas = (Filters.getSchemas && Filters.getSchemas()) || null;
        }
        if (!schemas) return null;
        return schemas[itemType] || null;
    },



    /**************
     * Components *
     **************/


    /**
     * Use as first child within an ItemHeader component. Its props.children will be included in the top-right area.
     * Top right area also includes action buttions such as edit button or link, view json button, Item status, etc.
     *
     * @memberof module:item-pages/components.ItemHeader
     * @namespace
     * @type {Component}
     * @prop {Component|Element|string} children - Child React element or component, or string, to render in top-right area.
     * @prop {string} href - URL of current item for view JSON button.
     */
    TopRow : React.createClass({
        /**
         * Renders Item status and color indicator.
         *
         * @memberof module:item-pages/components.ItemHeader.TopRow
         * @private
         * @instance
         */
        parsedStatus : function(){
            if (!('status' in this.props.context)) return <div></div>;
            /*  Removed icon in lieu of color indicator for status
            var iconClass = null;
            switch (this.props.context.status){

                case 'in review by lab':
                case 'in review by project':
                    iconClass = 'icon ss-stopwatch';
                    break;

            }
            */

            // Status colors are set via CSS (layout.scss) dependent on data-status attribute
            return (
                <div
                    className="expset-indicator expset-status right"
                    data-status={ this.props.context.status.toLowerCase() }
                    data-tip="Current Status"
                >
                    { this.props.context.status }
                </div>
            );
        },
        /**
         * Renders view JSON button.
         *
         * @memberof module:item-pages/components.ItemHeader.TopRow
         * @private
         * @instance
         * @returns {Element|null} <span> element, or null if no props.href.
         */
        viewJSONButton : function(){
            if (!this.props.href) return null;

            var urlParts = url.parse(this.props.href, true);
            urlParts.search = '?' + querystring.stringify(_.extend(urlParts.query, { 'format' : 'json' }));
            var viewUrl = url.format(urlParts);
            return (
                <div className="expset-indicator right view-ajax-button">
                    <a href={viewUrl} target="_blank" onClick={(e)=>{
                        if (window && window.open){
                            e.preventDefault();
                            window.open(viewUrl, 'window', 'toolbar=no, menubar=no, resizable=yes, status=no, top=10, width=400');
                        }
                    }}>
                        View JSON
                    </a>
                </div>
            );
        },
        /**
         * Renders Item actions for admins and submitter.
         *
         * @memberof module:item-pages/components.ItemHeader.TopRow
         * @private
         * @instance
         */
        itemActions : function(){
            if (!Array.isArray(this.props.context.actions) || this.props.context.actions.length === 0) return null;
            return this.props.context.actions.map(function(action, i){
                var title = action.title;
                return (
                    <div className="expset-indicator right action-button" data-action={action.name || null} key={action.name || i}>
                        <a href={action.href}>{ title }</a>
                    </div>
                );
            });
        },

        /**
         * Wraps props.children in a <div> element.
         *
         * @memberof module:item-pages/components.ItemHeader.TopRow
         * @private
         * @instance
         */
        itemTypeInfo : function(){
            return ItemHeader.getSchemaForItemType(
                ItemHeader.moreDetailedItemType(this.props.context),
                this.props.schemas || null
            );
        },

        typeInfoLabel : function(typeInfo = null){
            if (!typeInfo) typeInfo = this.itemTypeInfo();
            if (!typeInfo || !typeInfo.title) return null;

            var tooltipIcon = null;
            if (typeInfo.description){
                tooltipIcon = <i className="icon icon-info-circle inline-block" data-tip={typeInfo.description}/>;
            }

            return (
                <span className="type-info inline-block">
                    { typeInfo.title } { tooltipIcon }
                </span>
            );
        },

        /**
         * Wraps props.children in a <div> element.
         *
         * @memberof module:item-pages/components.ItemHeader.TopRow
         * @private
         * @instance
         */
        wrapChildren : function(){
            if (!this.props.children) return null;
            return React.Children.map(this.props.children, (child,i) =>
                <div
                    className="expset-indicator expset-type right"
                    title={this.props.title || null}
                    key={i}
                >
                    { child }
                </div>
            );
        },
        /**
         * Render function.
         *
         * @memberof module:item-pages/components.ItemHeader.TopRow
         * @private
         * @instance
         * @returns {Element} Div element with .row Bootstrap class and items in top-right section.
         */
        render : function(){
            var typeInfo = ItemHeader.getSchemaForItemType(ItemHeader.itemType(this.props.context), this.props.schemas || null);
            var accessionTooltip = "Accession";
            if (typeInfo && typeInfo.properties.accession && typeInfo.properties.accession.description){
                accessionTooltip += ': ' + typeInfo.properties.accession.description;
            }

            //if (accessionTooltip){
            //    accessionTooltip = <i className="icon icon-info-circle inline-block" data-tip={accessionTooltip} />;
            //}
            return (
                <div className="row clearfix top-row">
                    <h5 className="col-sm-6 item-label-title">
                        { this.typeInfoLabel() }
                        { this.props.context.accession ?
                            <span className="accession inline-block" data-tip={accessionTooltip}>{ this.props.context.accession }</span>
                        : null }
                    </h5>
                    <h5 className="col-sm-6 text-right text-left-xs item-label-extra text-capitalize item-header-indicators clearfix">
                        { this.viewJSONButton() }
                        { this.itemActions() }
                        { this.wrapChildren() }
                        { this.parsedStatus() }
                    </h5>
                </div>
            );
        }
    }),

    /**
     * Renders a styled FlexibleDescriptionBox component containing props.context.description.
     *
     * @memberof module:item-pages/components.ItemHeader
     * @namespace
     * @type {Component}
     * @prop {Object} context - Same as the props.context passed to parent ItemHeader component.
     */
    MiddleRow : React.createClass({
        render : function(){
            var isTextShort = false;
            if (typeof this.props.context.description === 'string' && this.props.context.description.length <= 120){
                isTextShort = true;
            }
            return (
                <FlexibleDescriptionBox
                    description={ this.props.context.description || <em>No description provided.</em> }
                    className="item-page-heading experiment-heading"
                    textClassName={ isTextShort ? "text-larger" : "text-large" }
                    fitTo="grid"
                    dimensions={{
                        paddingWidth : 32,
                        paddingHeight : 22,
                        buttonWidth : 30,
                        initialHeight : 45
                    }}
                />
            );
        }
    }),

    /**
     * Renders props.context.date_created in bottom-right and props.children in bottom-left areas.
     *
     * @memberof module:item-pages/components.ItemHeader
     * @namespace
     * @type {Component}
     * @prop {Object} context - Same as the props.context passed to parent ItemHeader component.
     */
    BottomRow : React.createClass({
        parsedCreationDate: function(){
            if (!('date_created' in this.props.context)) return <span><i></i></span>;
            return (
                <span data-tip="Date Created" className="inline-block">
                    <i className="icon sbt-calendar"></i>&nbsp;&nbsp;
                    <DateUtility.LocalizedTime timestamp={this.props.context.date_created} formatType='date-time-md' dateTimeSeparator=" at " />
                </span>
            );
        },
        render : function(){
            return (
                <div className="row clearfix bottom-row">
                    <div className="col-sm-6 item-label-extra set-type-indicators">{ this.props.children }</div>
                    <h5 className="col-sm-6 text-right text-left-xs item-label-extra" title="Date Added - UTC/GMT">{ this.parsedCreationDate() }</h5>
                </div>
            );
        }
    }),

    /**
     * Use this to wrap ItemHeader.TopRow, .MiddleRow, and .BottomRow to create a complete ItemHeader.
     * Passes own props.context and props.href down to children.
     *
     * @memberof module:item-pages/components.ItemHeader
     * @namespace
     * @type {Component}
     * @prop {Object} context - Same as the props.context passed to parent ItemHeader component.
     * @prop {string} href - Location from Redux store or '@id' of current Item. Used for View JSON button.
     * @prop {Object} schemas - Pass from app.state. Used for tooltips and such.
     */
    Wrapper : React.createClass({
        adjustChildren : function(){
            if (!this.props.context) return this.props.children;
            return React.Children.map(this.props.children, (child)=>{
                if (typeof child.props.context !== 'undefined' && typeof child.props.href === 'string') return child;
                else {
                    return React.cloneElement(child, {
                        context : this.props.context,
                        href : this.props.href,
                        schemas : this.props.schemas || (Filters.getSchemas && Filters.getSchemas()) || null
                    }, child.props.children);
                }
            });
        },
        render : function(){
            return (
                <div className={"item-view-header " + (this.props.className || '')}>{ this.adjustChildren() }</div>
            );
        }
    }),

};
