'use strict';

/** @ignore */
var React = require('react');
var _ = require('underscore');
var { expFxn, Filters, ajax, console, layout, isServerSide } = require('./../util');


/** 
 * This is a utility to manage charts' experiment data in one global place and distribute to charts throughout UI.
 * The mechanism for this is roughly diagrammed [here]{@link https://hms-dbmi.slack.com/files/alexkb/F4C8KQKMM/chartdatacontroller.png } .
 * 
 * @module {Object} viz/chart-data-controller
 */


/**
 * @private
 * @ignore
 */
var refs = {
    store       : null,
    requestURLBase : null,//'/browse/?type=ExperimentSetReplicate&experimentset_type=replicate&limit=all&from=0',
    updateStats : null, // Function to update stats @ top of page.
    fieldsToFetch : [ // What fields we need from /browse/... for this chart.
        'accession',
        'experiments_in_set.experiment_summary',
        'experiments_in_set.experiment_type',
        'experiments_in_set.accession',
        //'experiments_in_set.status',
        //'experiments_in_set.files.file_type',
        'experiments_in_set.files.accession',
        'experiments_in_set.filesets.files_in_set.accession',
        //'experiments_in_set.biosample.description',
        //'experiments_in_set.biosample.modifications_summary_short',
        'experiments_in_set.biosample.biosource_summary',
        //'experiments_in_set.biosample.accession',
        //'experiments_in_set.biosample.biosource.description',
        'experiments_in_set.biosample.biosource.biosource_name',
        'experiments_in_set.biosample.biosource.biosource_type',
        'experiments_in_set.biosample.biosource.individual.organism.name',
        'experiments_in_set.biosample.biosource.individual.organism.scientific_name',
        'experiments_in_set.digestion_enzyme.name'
    ],
    expSetFilters : null,
};

/**
 * Contains "state" of ChartDataController. Some of these are deprecated and will be removed.
 * The most important ones are experiments and filteredExperiments.
 * 
 * @type {Object}
 * @private
 * @ignore
 */
var state = {
    experiments         : null,
    filteredExperiments : null,
    fetching            : false,

    // the below field definitions will likely be moved out of here eventually
    /** @ignore */
    chartFieldsBarPlot  : [
        { title : "Biosample", field : "experiments_in_set.biosample.biosource_summary" },
        { title : "Experiment Type", field : 'experiments_in_set.experiment_type' },
        { title : "Digestion Enzyme", field : "experiments_in_set.digestion_enzyme.name" }
        //{ title : "Experiment Summary", field : "experiments_in_set.experiment_summary" }
    ],
    /** @ignore */
    chartFieldsHierarchy: [
        //{ 
        //    field : 'experiments_in_set.biosample.biosource.individual.organism.name',
        //    title : "Primary Organism",
        //    name : function(val, id, exps, filteredExps){
        //        return Filters.Term.toName('experiments_in_set.biosample.biosource.individual.organism.name', val);
        //    }
        //},
        //{ title : "Biosource Type", field : 'experiments_in_set.biosample.biosource.biosource_type' },
        //{ title : "Biosample", field : 'experiments_in_set.biosample.biosource_summary' },
        { title : "Experiment Type", field : 'experiments_in_set.experiment_type' },
        {
            title : "Digestion Enzyme",
            field : 'experiments_in_set.digestion_enzyme.name',
            /** @ignore */
            description : function(val, id, exps, filteredExps, exp){
                return 'Enzyme ' + val;
            }
        },
        {
            title : "Experiment Set",
            aggregatefield : "experiment_sets.accession",
            field : "accession",
            isFacet : false,
            size : 1
        },
        //{ title : "Experiment Summary", field : "experiments_in_set.experiment_summary" },
        //{
        //    title: "Experiment Accession",
        //    field : 'experiments_in_set.accession',
        //    //size : function(val, id, exps, filteredExps, exp, parentNode){
        //    //    return 1 / (_.findWhere(exp.experiment_sets, { 'accession' : parentNode.term }).experiments_in_set);
        //    //},
        //    color : "#eee",
        //    isFacet : false,
        //}
    ],
    /** @ignore */
    chartFieldsHierarchyRight : [
        { 
            field : 'experiments_in_set.biosample.biosource.individual.organism.name',
            title : "Primary Organism",
            /** @ignore */
            name : function(val, id, exps, filteredExps){
                return Filters.Term.toName('experiments_in_set.biosample.biosource.individual.organism.name', val);
            }
        },
        { title : "Biosource Type", field : 'experiments_in_set.biosample.biosource.biosource_type' },
        { title : "Biosample", field : 'experiments_in_set.biosample.biosource_summary' },
        //{ title : "Experiment Type", field : 'experiments_in_set.experiment_type' },
        //{
        //    title : "Digestion Enzyme",
        //    field : 'experiments_in_set.digestion_enzyme.name',
        //    description : function(val, id, exps, filteredExps, exp){
        //        return 'Enzyme ' + val;
        //    }
        //},
        {
            title : "Experiment Set",
            aggregatefield : "experiment_sets.accession",
            field : "accession",
            isFacet : false,
            size : 1
        },
        //{ title : "Experiment Summary", field : "experiments_in_set.experiment_summary" },
        //{
        //    title: "Experiment Accession",
        //    field : 'experiments_in_set.accession',
        //    //size : function(val, id, exps, filteredExps, exp, parentNode){
        //    //    return 1 / (_.findWhere(exp.experiment_sets, { 'accession' : parentNode.term }).experiments_in_set);
        //    //},
        //    color : "#eee",
        //    isFacet : false,
        //}
    ]
};

/** Private state & functions **/

/** 
 * @private
 * @ignore
 */
var providerCallbacks = {};

/** 
 * @private
 * @ignore
 */
var providerLoadStartCallbacks = {};

/**
 * After load & update, call registered Update callbacks.
 * @private
 * @ignore
 */
function notifyUpdateCallbacks(){
    console.log('Notifying update callbacks',_.keys(providerCallbacks));
    _.forEach(providerCallbacks, function(pcb){
        pcb(state);
    });
}

/**
 * Before load, call registered Load Start callbacks.
 * @private
 * @ignore
 */
function notifyLoadStartCallbacks(){
    console.log('Notifying load start callbacks', _.keys(providerLoadStartCallbacks));
    _.forEach(providerLoadStartCallbacks, function(plscb){
        plscb(state);
    });
}


/**
 * Holds unsubcribe callback to Redux store subscription.
 * @private
 * @ignore
 * @type {null|function}
 */
var reduxSubscription = null;

/**
 * @private
 * @ignore
 * @type {boolean}
 */
var isInitialized = false;

/**
 * @private
 * @ignore
 * @type {number}
 */
var lastTimeSyncCalled = 0;

/**
 * @private
 * @ignore
 * @type {null|string}
 */
var resyncInterval = null;

/**
 * @private
 * @ignore
 * @type {boolean}
 */
var isWindowActive = false;


/**
 * @type {Object}
 * @alias module:viz/chart-data-controller
 */
var ChartDataController = module.exports = {

    /**
     * Use this React component to wrap individual charts and provide them with source of experiments data via
     * props.experiments and props.filteredExperiments. Also provides expSetFilters from redux store.
     * 
     * @namespace
     * @type {Component}
     * @memberof module:viz/chart-data-controller
     */
    Provider : React.createClass({

        /**
         * @memberof module:viz/chart-data-controller.Provider
         * @prop {string} id - Unique ID.
         * @prop {Object} children - Must be a Chart or Chart controller component.
         */
        propTypes : {
            'id' : React.PropTypes.string.isRequired,
            'children' : React.PropTypes.object.isRequired
        },

        /**
         * @memberof module:viz/chart-data-controller.Provider
         * @ignore
         */
        componentWillMount : function(){
            ChartDataController.registerUpdateCallback(()=>{
                this.forceUpdate();
            }, this.props.id);
        },

        /**
         * @memberof module:viz/chart-data-controller.Provider
         * @ignore
         */
        componentWillUnmount : function(){
            ChartDataController.unregisterUpdateCallback(this.props.id);
        },

        /**
         * Sets 'experiments' and 'filteredExperiments' props on props.children.
         * 
         * @returns {React.Component} Cloned & adjusted props.children.
         * @memberof module:viz/chart-data-controller.Provider
         */
        render : function(){
            var childChartProps = _.extend({}, this.props.children.props);
            childChartProps.experiments = state.experiments;
            childChartProps.filteredExperiments = state.filteredExperiments;
            childChartProps.expSetFilters = refs.expSetFilters;
            

            return React.cloneElement(this.props.children, childChartProps);
        }

    }),

    /** 
     * This function must be called before this component is used anywhere else.
     * 
     * @param {string} requestURLBase - Where to request 'all experiments' from.
     * @param {function} [updateStats] - Callback for updating QuickInfoBar, for example, with current experiments, experiment_sets, and files counts.
     * @param {function} [callback] - Optional callback for after initializing.
     * @param {number|boolean} [resync=false] - How often to resync data, in ms, if window is active, for e.g. if submitters submitted new data while user is browsing.
     * @returns {undefined}
     */
    initialize : function(
        requestURLBase = null,
        updateStats = null,
        callback = null,
        resync = false
    ){
        if (!refs.store) {
            refs.store = require('./../../store');
        }
        if (typeof requestURLBase === 'string'){
            refs.requestURLBase = requestURLBase;
        }
        if (typeof updateStats === 'function'){
            refs.updateStats = updateStats;
        }

        if (reduxSubscription !== null) {
            reduxSubscription(); // Unsubscribe current listener.
        }

        // Subscribe to Redux store updates to listen for changed expSetFilters.
        reduxSubscription = refs.store.subscribe(function(){
            var prevExpSetFilters = refs.expSetFilters;
            var reduxStoreState = refs.store.getState();
            refs.expSetFilters = reduxStoreState.expSetFilters;

            if (prevExpSetFilters !== refs.expSetFilters || !_.isEqual(refs.expSetFilters, prevExpSetFilters)){
                ChartDataController.handleUpdatedFilters(refs.expSetFilters, notifyUpdateCallbacks);
            }
        });

        isInitialized = true;

        ChartDataController.sync(function(){
            callback(state);
        });

        // Resync periodically if resync interval supplied.
        if (typeof resync === 'number' && !isServerSide()){

            resync = Math.max(resync, 20000); // 20sec minimum

            window.addEventListener('focus', function(){
                if (lastTimeSyncCalled + resync < Date.now()){
                    ChartDataController.sync(function(){
                        isWindowActive = true;
                    });
                } else {
                    isWindowActive = true;
                }
            });

            window.addEventListener('blur', function(){
                isWindowActive = false;
            });

            resyncInterval = setInterval(function(){
                if (!isWindowActive) return;
                console.info('Resyncing experiments & filteredExperiments for ChartDataController.');
                ChartDataController.sync();
            }, resync);

            isWindowActive = true;

        }

    },

    /**
     * Whether component has been initialized and may be used.
     * @returns {boolean} True if initialized.
     */
    isInitialized : function(){
        return isInitialized;
    },

    /** 
     * For React components to register an "update me" function, i.e. forceUpdate,
     * to be called when new experiments/filteredExperiments has finished loading from back-end.
     * 
     * @param {function} callback - Function to be called upon loading 'experiments' or 'all experiments'. If registering from a React component, should include this.forceUpdate() or this.setState(..).
     * @param {string}   uniqueID - A unique identifier for the registered callback, to be used for removal or overwrites.
     * @returns {function}   A function which may be called to unregister the callback, in lieu of ChartDataController.unregisterUpdateCallback.
     */
    registerUpdateCallback : function(callback, uniqueID = 'global', overwrite=false){
        if (typeof callback !== 'function') throw Error("callback must be a function.");
        if (typeof uniqueID !== 'string') throw Error("uniqueID must be a string.");
        if (!overwrite && typeof providerCallbacks[uniqueID] !== 'undefined') throw new Error(uniqueID + " already set.");
        providerCallbacks[uniqueID] = callback;
        return function(){
            return ChartDataController.unregisterUpdateCallback(uniqueID);
        };
    },

    /**
     * The opposite of registerUpdateCallback.
     * @param {string} uniqueID - ID given alongside initially-registered callback.
     * @returns {undefined}
     */
    unregisterUpdateCallback : function(uniqueID){
        if (typeof uniqueID !== 'string') throw Error("uniqueID must be a string.");
        delete providerCallbacks[uniqueID];
    },

    /**
     * Same as registerUpdateCallback but for when starting AJAX fetch of data.
     *
     * @param {function} callback - Function to be called upon starting AJAX load.
     * @param {string} uniqueID - @see ChartDataController.registerUpdateCallback().
     * @returns {function} Function for unregistering callback which may be used in lieu of @see ChartDataController.unregisterUpdateCallback().
     */
    registerLoadStartCallback : function(callback, uniqueID = 'global'){
        if (typeof callback !== 'function') throw Error("callback must be a function.");
        if (typeof uniqueID !== 'string') throw Error("uniqueID must be a string.");
        providerLoadStartCallbacks[uniqueID] = callback;
        return function(){
            return ChartDataController.unregisterUpdateCallback(uniqueID);
        };
    },

    /**
     * The opposite of registerLoadStartCallback.
     * @param {string} uniqueID - ID given alongside initially-registered callback.
     * @returns {undefined}
     */
    unregisterLoadStartCallback : function(uniqueID){
        if (typeof uniqueID !== 'string') throw Error("uniqueID must be a string.");
        delete providerLoadStartCallbacks[uniqueID];
    },

    /** 
     * Get current state. Similar to Redux's store.getState().
     * @returns {Object}
     */
    getState : function(){ return state; },

    /**
     * Analogous to a component's setState. Updates the private state of
     * ChartDataController and notifies update callbacks if experiments or filtered
     * experiments have changed.
     * 
     * @param {Object} updatedState - New or updated state object to save.
     * @param {function} [callback] - Optional callback function.
     * @returns {*} Result of callback, or undefined.
     * @private
     */
    setState : function(updatedState = {}, callback = null){
        
        var expsChanged = (
            updatedState.experiments !== state.experiments || updatedState.filteredExperiments !== state.filteredExperiments ||
            !_.isEqual(updatedState.experiments, state.experiments) || !_.isEqual(updatedState.filteredExperiments, state.filteredExperiments)
        );

        _.extend(state, updatedState);

        if (expsChanged){
            ChartDataController.updateStats();
            notifyUpdateCallbacks();
        }
        if (typeof callback === 'function' && callback !== notifyUpdateCallbacks){
            return callback(state);
        }
    },

    /**
     * Fetch new data from back-end regardless of expSetFilters state, e.g. for when session has changed (@see App.prototype.componentDidUpdate()).
     * 
     * @param {function} [callback] - Function to be called after sync complete.
     * @returns {undefined}
     */
    sync : function(callback){
        if (!isInitialized) throw Error("Not initialized.");
        lastTimeSyncCalled = Date.now();
        ChartDataController.fetchUnfilteredAndFilteredExperiments(null, callback);
    },

    /**
     * @ignore
     * @memberof module:viz/chart-data-controller
     */
    handleUpdatedFilters : function(expSetFilters, callback){
        if (_.keys(expSetFilters).length === 0 && Array.isArray(state.experiments)){
            ChartDataController.setState({ filteredExperiments : null }, callback);
        } else {
            ChartDataController.fetchAndSetFilteredExperiments(callback);
        }
    },

    /**
     * Update stats in top left corner of page, if updateState param was passed in during initialization.
     * @returns {undefined}
     */
    updateStats : function(){
        if (typeof refs.updateStats !== 'function'){
            throw Error("Not initialized with updateStats callback.");
        }

        var current, total;

        function getCounts(exps){
            var expSets = _.reduce(exps, function(m,exp){
                if (exp.experiment_sets) return new Set([...m, ..._.pluck(exp.experiment_sets, 'accession')]);
                return m;
            }, new Set());
            return {
                'experiment_sets' : expSets.size,
                'experiments' : exps.length,
                'files' : expFxn.fileCountFromExperiments(exps)
            };
        }

        if (state.filteredExperiments !== null){
            current = getCounts(state.filteredExperiments);
        } else {
            current = {
                'experiment_sets' : null,
                'experiments' : null,
                'files' : null
            };
        }

        total = getCounts(state.experiments);

        refs.updateStats(current, total);
    },


    /**
     * @memberof module:viz/chart-data-controller
     * @ignore
     */
    fetchUnfilteredAndFilteredExperiments : function(reduxStoreState = null, callback = null){
        if (!reduxStoreState || !reduxStoreState.expSetFilters || !reduxStoreState.href){
            reduxStoreState = refs.store.getState();
        }

        // Set refs.expSetFilters if is null (e.g. if called from initialize() and not triggered Redux store filter change).
        if (refs.expSetFilters === null){
            refs.expSetFilters = reduxStoreState.expSetFilters;
        }

        var filtersSet = _.keys(reduxStoreState.expSetFilters).length > 0;
        var experiments = null, filteredExperiments = null;

        var cb = _.after(filtersSet ? 2 : 1, function(){
            ChartDataController.setState({
                'experiments' : experiments,
                'filteredExperiments' : filteredExperiments
            }, callback);

        });

        notifyLoadStartCallbacks();

        ajax.load(
            refs.requestURLBase + ChartDataController.getFieldsRequiredURLQueryPart(),
            function(allExpsContext){
                experiments = expFxn.listAllExperimentsFromExperimentSets(allExpsContext['@graph']);
                cb();
            }
        );

        if (filtersSet){
            ajax.load(
                ChartDataController.getFilteredContextHref(
                    reduxStoreState.expSetFilters, reduxStoreState.href
                ) + ChartDataController.getFieldsRequiredURLQueryPart(),
                function(filteredContext){
                    filteredExperiments = expFxn.listAllExperimentsFromExperimentSets(filteredContext['@graph']);
                    cb();
                }
            );
        }

    },

    /** @ignore */
    fetchAndSetUnfilteredExperiments : function(callback = null){
        notifyLoadStartCallbacks();
        ajax.load(
            refs.requestURLBase + ChartDataController.getFieldsRequiredURLQueryPart(),
            function(allExpsContext){
                ChartDataController.setState({
                    'experiments' : expFxn.listAllExperimentsFromExperimentSets(allExpsContext['@graph'])
                }, callback);
            }
        );
    },

    /** @ignore */
    fetchAndSetFilteredExperiments : function(callback = null){
        notifyLoadStartCallbacks();
        ajax.load(
            ChartDataController.getFilteredContextHref() + ChartDataController.getFieldsRequiredURLQueryPart(),
            function(filteredContext){
                ChartDataController.setState({
                    'filteredExperiments' : expFxn.listAllExperimentsFromExperimentSets(filteredContext['@graph'])
                }, callback);
            },
            'GET',
            function(){
                // Fallback (no results or lost connection)
                if (typeof callback === 'function') callback();
            }
        );
    },

    /**
     * @ignore
     */
    getFieldsRequiredURLQueryPart : function(fields = refs.fieldsToFetch){
        return fields.map(function(fieldToIncludeInResult){
            return '&field=' + fieldToIncludeInResult;
        }).join('');
    },

    /**
     * @ignore
     */
    getFilteredContextHref : function(expSetFilters, href){
        if (!expSetFilters || !href){
            var storeState = refs.store.getState();
            if (!expSetFilters) expSetFilters = storeState.expSetFilters;
            if (!href)          href = storeState.href;
        }
        return Filters.filtersToHref(expSetFilters, href, 0, 'all', '/browse/');
    },

};