'use strict';

import React from 'react';
import _ from 'underscore';
import { DropdownButton, Button, ButtonToolbar, ButtonGroup, MenuItem, Panel, Table} from 'react-bootstrap';
import { ajax, DateUtility } from './../util';

/**
 * @typedef {Object} Subscription
 * @property {string} url       Search request URI.
 * @property {string} title     Human-readable subscription title.
 *
 * @todo Move to util/typedef.js if will be re-used in other files.
 */
var Subscription;

/**
 * Container component for the submissions page. Fetches the user info and
 * coordinates individual subscriptions.
 */
export default class SubscriptionsView extends React.PureComponent {

    constructor(props){
        super(props);

        /**
         * @private
         * @type {Object}
         */
        this.state = {
            'subscriptions': null,
            'initialized': false
        };
    }

    /**
     * Triggers async call to get user subscriptions.
     * @private
     */
    componentDidMount(){
        this.getUserInfo();
    }

    /**
     * Makes async call to `/me` endpoint to get user subscriptions.
     *
     * @private
     * @returns {void}
     */
    getUserInfo = () => {
        ajax.promise('/me?frame=embedded').then(response => {
            if (!response.uuid || !response.subscriptions){
                this.setState({
                    'subscriptions': null,
                    'initialized': true
                });
            }else{
                this.setState({
                    'subscriptions': response.subscriptions,
                    'initialized': true
                });
            }
        });
    }

    /**
     * @private
     * @returns {JSX.Element} Div containing list of subscription views.
     */
    render(){
        var { subscriptions, initialized } = this.state,
            subscrip_list, main_message;

        if (Array.isArray(subscriptions) && subscriptions.length > 0){
            subscrip_list = _.map(subscriptions, function(scrip){
                return <SubscriptionEntry key={scrip.url} url={scrip.url} title={scrip.title} />;
            });
            main_message = "View your 4DN submissions and track those you're associated with.";
        } else if (initialized){
            main_message = "No submissions to track; you are not a submitter nor associated with any labs.";
        } else {
            main_message = <i className="icon icon-spin icon-circle-o-notch" style={{'opacity': '0.5' }}/>;
        }
        return (
            <div id="content" className="container">
                <div className="flexible-description-box item-page-heading mb-25 mt-1">
                    <p className="text-larger">{main_message}</p>
                </div>
                {subscrip_list}
            </div>
        );
    }
}

/**
 * Main submission/subscription component. One component per subscription.
 * Hold data from the search result from the subscription and organizes
 * it into a paginated table. Also allows filtering on item type.
 */
class SubscriptionEntry extends React.Component{

    constructor(props){
        super(props);
        this.changePage = _.throttle(this.changePage, 250);
        var is_open = false;
        // user submissions default to open
        if (this.props.title == 'My submissions'){
            is_open = true;
        }
        this.state = {
            'data': null,
            'types': null,
            'selected_type': 'Item',
            'open': is_open,
            'page': 1,
            'changing_page': false,
            'num_pages': null
        };
    }

    componentDidMount(){
        // make async call to get first subscription data
        // only call this if open to improve performance
        if(this.state.open){
            this.loadSubscriptionData(this.props.url, this.state.page, this.state.selected_type);
        }
    }

    toggleOpen = (e) => {
        e.preventDefault();
        // load data if it hasn't been already
        if(!this.state.data){
            this.loadSubscriptionData(this.props.url, this.state.page, this.state.selected_type);
        }
        this.setState(function({ open }){
            return {'open': !open };
        });
    }

    loadSubscriptionData = (url, page, type) => {
        // search sorts by date_created as default. Thus, @graph results will be sorted
        // use page number to implement pagination
        var no_type_in_url = url.indexOf("?type=") == -1 && url.indexOf("&type=") == -1;
        var fromInt = (page-1) * 25;
        var pagination = '&limit=25&from=' + fromInt.toString();
        var fetch_url = '/search/' + url + pagination;
        if(no_type_in_url){
            fetch_url = fetch_url + '&type=' + type;
        }

        ajax.promise(fetch_url).then(response => {
            if (!response['@graph'] || !response['facets']){
                this.setState({
                    'data': null,
                    'types': null,
                    'changing_page':false,
                    'num_pages': null,
                    'page': 1,
                    'type': 'Item'
                });
            }else{
                var types;
                // no specified item type, so set the types state
                // only want to run this once, with type=Item
                if(no_type_in_url && this.state.types === null){
                    this.findTypesFromFacets(response['facets']);
                }
                // use 25 items per page. Change when types change
                var num_pages = Math.ceil(response['total']/25);
                this.setState({
                    'data': response['@graph'],
                    'changing_page': false,
                    'num_pages': num_pages
                });
            }
        });
    }

    // find all item types represented in this result by parsing @graph
    // can't use facets because they ignore pagination
    findTypesFromFacets = (facets) => {
        var types = [];
        for(var i=0; i<facets.length; i++){
            if(facets[i]['field'] == 'type'){
                for(var j=0; j<facets[i]['terms'].length; j++){
                    if(facets[i]['terms'][j]['doc_count'] > 0 && facets[i]['terms'][j]['key'] != 'Item'){
                        types.push(facets[i]['terms'][j]['key']);
                    }
                }
                break;
            }
        }
        types.sort();
        types.unshift('Item'); // add Item to front of the array
        this.setState({'types':types});
    }

    displayToggle = () => {
        if(this.state.open && !this.state.data){
            return(
                <i className="icon icon-spin icon-circle-o-notch" style={{'marginLeft': '5px','opacity': '0.5' }}></i>
            );
        }else{
            return(
                <Button bsSize="xsmall" className="icon-container submission-btn" onClick={this.toggleOpen}>
                    <i className={"icon " + (this.state.open ? "icon-minus" : "icon-plus")}></i>
                </Button>
            );
        }
    }

    generateEntry = (entry) => {
        if(!entry['@type'] || !entry.date_created || !entry.status || !entry.display_title || !entry['@id']){
            return;
        }
        var format_id = entry['@id'];
        return(
            <tr key={entry.date_created}>
                <td>
                    <a href={format_id}>{entry.display_title}</a>
                </td>
                <td>
                    {(entry.aliases && entry.aliases.length > 0) ?
                    <div style={{'wordWrap':'break-word','overflowWrap':'break-word'}}>
                        {entry.aliases.join(', ')}
                    </div>
                    :""}
                </td>
                <td>{entry['@type'][0]}</td>
                <td>{entry.status}</td>
                <td>
                    <DateUtility.LocalizedTime timestamp={entry.date_created} formatType='date-time-md' dateTimeSeparator=" at " />
                </td>
            </tr>
        );
    }

    generateButtonToolbar = () => {
        if(!this.state.open){
            return null;
        }
        return(
            <ButtonToolbar className="pull-right" style={{'marginTop':'-5px'}}>
                {this.state.types ?
                    <DropdownButton id="dropdown-size-extra-small" title={this.filterEnumTitle(this.state.selected_type)} >
                        {this.state.types.map((type) => this.buildEnumEntry(type))}
                    </DropdownButton>
                : null}
                <ButtonGroup>
                    <Button disabled={this.state.changing_page || !this.state.num_pages  || this.state.page === 1} onClick={this.state.changing_page === true ? null : (e)=>{
                        this.changePage(this.state.page - 1);
                    }}><i className="icon icon-angle-left icon-fw"></i></Button>

                    <Button disabled style={{'minWidth': 120 }}>
                        { this.state.changing_page === true || !this.state.num_pages ?
                            <i className="icon icon-spin icon-circle-o-notch" style={{'opacity': 0.5 }}></i>
                            : 'Page ' + this.state.page + ' of ' + this.state.num_pages
                        }
                    </Button>

                    <Button disabled={this.state.changing_page || !this.state.num_pages || this.state.page === this.state.num_pages} onClick={this.state.changing_page === true ? null : (e)=>{
                        this.changePage(this.state.page + 1);
                    }}><i className="icon icon-angle-right icon-fw"></i></Button>

                </ButtonGroup>
            </ButtonToolbar>
        );
    }

    buildEnumEntry = (val) => {
        return(
            <MenuItem key={val} title={this.filterEnumTitle(val) || ''} eventKey={val} onSelect={this.submitEnumVal}>
                {this.filterEnumTitle(val) || ''}
            </MenuItem>
        );
    }

    submitEnumVal = (eventKey) => {
        // reset page to 1 on a type change
        this.loadSubscriptionData(this.props.url, 1, eventKey);
        this.setState({'page':1, 'selected_type': eventKey});
    }

    // very simple. If title == Item, return 'All'
    filterEnumTitle = (title) => {
        if(title == 'Item'){
            return 'All';
        }else{
            return title;
        }
    }

    changePage = (page) => {
        if(page > this.state.num_pages || page < 1){
            return;
        }
        this.loadSubscriptionData(this.props.url, page, this.state.selected_type);
        this.setState({'page':page, 'changing_page':true});
    }

    render(){
        var submissions;
        if(this.state.data){
            submissions = this.state.data.map((entry) => this.generateEntry(entry));
        }
        return(
            <div className="mb-1">
                <div className='submission-page-heading'>
                    <h3 className='submission-subtitle'>{this.props.title}</h3>
                    <h3 className='submission-subtitle'>{this.displayToggle()}</h3>
                    {this.generateButtonToolbar()}
                </div>
                {this.state.open ?
                    <div className="sub-panel panel-body-with-header" style={{'maxHeight':'300px', 'overflowY':'auto'}}>
                        <Table striped fill>
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Aliases</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Date submitted</th>
                                </tr>
                            </thead>
                            <tbody>
                                {submissions}
                            </tbody>
                        </Table>
                    </div>
                : null}
            </div>
        );
    }
}
