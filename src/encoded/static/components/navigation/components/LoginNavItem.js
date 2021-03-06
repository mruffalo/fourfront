'use strict';

import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { NavItem, Modal } from 'react-bootstrap';
import Auth0Lock from 'auth0-lock';
import { JWT, ajax, navigate, isServerSide, analytics, object, layout } from './../../util';
import Alerts from './../../alerts';
import UserRegistrationForm, { decodeJWT } from './../../forms/UserRegistrationForm';



/** Component that contains auth0 functions */
export class LoginNavItem extends React.Component {

    static propTypes = {
        'updateUserInfo'      : PropTypes.func.isRequired,
        'session'             : PropTypes.bool.isRequired,
        'href'                : PropTypes.string.isRequired
    };

    constructor(props){
        super(props);
        this.showLock           = _.throttle(this.showLock.bind(this), 1000, { trailing: false });
        this.loginCallback      = this.loginCallback.bind(this);
        this.loginErrorCallback = this.loginErrorCallback.bind(this);
        this.onRegistrationComplete = this.onRegistrationComplete.bind(this);
        this.onRegistrationCancel = this.onRegistrationCancel.bind(this);
        this.state = {
            "showRegistrationModal" : false,
            "isLoading" : false // Whether are currently performing login/registration request.
        };
    }

    componentDidMount () {
        // Login / logout actions must be deferred until Auth0 is ready.
        // TODO: these should be read in from base and production.ini
        this.lock = new Auth0Lock(
            'DPxEwsZRnKDpk0VfVAxrStRKukN14ILB',
            'hms-dbmi.auth0.com', {
                auth: {
                    sso: false,
                    redirect: false,
                    responseType: 'token',
                    params: {
                        scope: 'openid email',
                        prompt: 'select_account'
                    }
                },
                socialButtonStyle: 'big',
                languageDictionary: { title: "Log in" },
                theme: {
                    logo: '/static/img/4dn_logo.svg',
                    icon: '/static/img/4dn_logo.svg',
                    primaryColor: '#009aad'
                },
                allowedConnections: ['github', 'google-oauth2']
            }
        );
        this.lock.on("authenticated", this.loginCallback);
    }

    showLock(evtKey, e){
        if (!this.lock || !this.lock.show) return; // Not yet mounted
        this.lock.show();
    }

    loginCallback(authResult, successCallback, errorCallback){
        var { href, updateUserInfo } = this.props;

        // First stage: we just have gotten JWT from the Auth0 widget but have not auth'd it against it our own system
        // to see if this is a valid user account or some random person who just logged into their Google account.
        var idToken = authResult.idToken; //JWT
        if (!idToken) return;

        JWT.save(idToken); // We just got token from Auth0 so probably isn't outdated.

        this.setState({ "isLoading" : true }, ()=>{

            this.lock.hide();

            // Second stage: get this valid OAuth account (Google or w/e) auth'd from our end.
            Promise.race([
                ajax.fetch('/login', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer '+idToken },
                    body: JSON.stringify({id_token: idToken})
                }),
                new Promise(function(resolve, reject){
                    setTimeout(function(){ reject({ 'description' : 'timed out', 'type' : 'timed-out' }); }, 90000); /* 90 seconds */
                })
            ]).then(response => {
                // Add'l Error Check (will throw to be caught)
                if (response.code || response.status) throw response;
                return response;
            })
            .then((r) => {
                JWT.saveUserInfoLocalStorage(r);
                updateUserInfo();
                Alerts.deQueue(Alerts.LoggedOut);
                console.info('Login completed');

                // Fetch user profile and use their primary lab as the eventLabel.
                const profileURL = (_.findWhere(r.user_actions || [], { 'id' : 'profile' }) || {}).href;
                const isAdmin = r.details && Array.isArray(r.details.groups) && r.details.groups.indexOf('admin') > -1;

                if (profileURL){
                    this.setState({ "isLoading" : false });

                    // Register an analytics event for UI login.
                    // This is used to segment public vs internal audience in Analytics dashboards.
                    ajax.load(profileURL, (profile)=>{
                        if (!isAdmin){ // Exclude admins from analytics tracking
                            analytics.event('Authentication', 'UILogin', {
                                'eventLabel' : (profile.lab && object.itemUtil.atId(profile.lab)) || 'No Lab'
                            });
                        }
                        if (typeof successCallback === 'function'){
                            successCallback(profile);
                        }
                        // Refresh the content/context of our page now that we have a JWT stored as a cookie!
                        // It will return same page but with any auth'd page actions.
                        navigate('', {'inPlace':true});
                    });
                } else {
                    throw new Error('No profile URL found in user_actions.');
                }
            }).catch((error)=>{
                // Handle Errors
                console.error("Error during login: ", error.description);
                console.log(error);

                this.setState({ "isLoading" : false });
                Alerts.deQueue(Alerts.LoggedOut);

                // If is programatically called with error CB, let error CB handle everything.
                var errorCallbackFxn = typeof errorCallback === 'function' ? errorCallback : this.loginErrorCallback;
                errorCallbackFxn(error);
            });

        });

    }

    loginErrorCallback(error){
        if (!error.code && error.type === 'timed-out'){
            // Server or network error of some sort most likely.
            Alerts.queue(Alerts.LoginFailed);
        } else if (error.code === 403) {
            // Present a registration form
            //navigate('/error/login-failed');
            this.setState({ 'showRegistrationModal' : true });
        } else {
            Alerts.queue(Alerts.LoginFailed);
        }
    }

    onRegistrationComplete(){
        // TODO: perform login by calling `this.loginCallback({ idToken : JWT.get() })`
        //this.setState({ 'showRegistrationModal' : false });
        var token = JWT.get(),
            decodedToken = decodeJWT(token);

        this.loginCallback(
            { 'idToken' : token },
            // Success callback -- shows "Success" Alert msg.
            (userProfile) => {
                var userDetails = JWT.getUserDetails(), // We should have this after /login
                    userProfileURL = userProfile && object.itemUtil.atId(userProfile),
                    userFullName = (
                        userDetails.first_name && userDetails.last_name &&
                        (userDetails.first_name + ' ' + userDetails.last_name)
                    ) || null,
                    msg = (
                        <ul className="mb-0">
                            <li>You are now logged in as <span className="text-500">{ userFullName }{ userFullName ? ' (' + decodedToken.email + ')' : decodedToken.email }</span>.</li>
                            <li>Please visit <b><a href={userProfileURL}>your profile</a></b> to edit your account settings or information.</li>
                        </ul>
                    );
                this.setState({ 'showRegistrationModal' : false }, function(){
                    Alerts.queue({
                        "title"     : "Registered & Logged In",
                        "message"   : msg,
                        "style"     : 'success',
                        'navigateDisappearThreshold' : 2
                    });
                });
            },
            (err) => {
                this.setState({ 'showRegistrationModal' : false });
                JWT.remove(); // Cleanup any remaining JWT, just in case.
                Alerts.queue(Alerts.LoginFailed);
            }
        );
    }

    onRegistrationCancel(){
        // TODO:
        this.setState({ 'showRegistrationModal' : false });
    }

    renderRegistrationModal(){
        const { showRegistrationModal, isLoading } = this.state;
        const schemas = this.props.schemas;

        if (!showRegistrationModal) return null;

        const token = JWT.get();
        // N.B. Signature is not verified here. Signature only gets verified by authentication endpoint.
        const decodedToken = token && decodeJWT(token);
        const unverifiedEmail = decodedToken && decodedToken.email;
        const onExitLinkClick = (e) => {
            e.preventDefault();
            this.setState({ 'showRegistrationModal' : false }, this.showLock);
        };

        if (!unverifiedEmail){
            // Error (maybe if user manually cleared cookies or localStorage... idk)
            return (
                <Modal show onHide={this.onRegistrationCancel}>
                    <Modal.Header closeButton>
                        <Modal.Title>Missing Email</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <p>An error has occurred. Please try to login/register again.</p>
                    </Modal.Body>
                </Modal>
            );
        }

        const isEmailAGmail = unverifiedEmail.slice(-10) === "@gmail.com";
        const onGoogleLinkClick = (e) => {
            e.preventDefault();
            analytics.event('Authentication', 'CreateGoogleAccountLinkClick', { eventLabel : "None" });
            window.open(e.target.href);
        };
        const formHeading = (
            <div className="mb-3">
                <h4 className="text-400 mb-2 mt-05">
                    You have never logged in as <span className="text-600">{ unverifiedEmail }</span> before.
                </h4>
                <ul>
                    <li>
                        Please <span className="text-500">register below</span> or <a href="#" className="text-500" onClick={onExitLinkClick}>
                            use a different email address
                        </a> if you have an existing account.
                    </li>
                    { isEmailAGmail?
                        <li>
                            If you prefer, you can use your institutional email address as your account ID by creating a new google account
                            at <a href="https://accounts.google.com/signup/v2" target="_blank" rel="noopener noreferrer" onClick={onGoogleLinkClick}>
                                https://accounts.google.com/signup/v2
                            </a> and
                            selecting &quot;Use my current email address instead&quot;.
                        </li>
                    : null }
                </ul>
            </div>
        );

        return (
            <Modal show bsSize="large" onHide={this.onRegistrationCancel}>
                <Modal.Header closeButton>
                    <Modal.Title>Registration</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <UserRegistrationForm heading={formHeading} schemas={schemas} jwtToken={token}
                        onComplete={this.onRegistrationComplete} onCancel={this.onRegistrationCancel} />
                </Modal.Body>
            </Modal>
        );
    }

    render() {
        var { windowWidth, id } = this.props,
            { showRegistrationModal, isLoading } = this.state,
            gridState = layout.responsiveGridState(windowWidth);

        return (
            <React.Fragment>
                <NavItem key="login-reg-btn" active={showRegistrationModal} onClick={this.showLock} className="user-account-item" id={id}>
                    { isLoading ? (
                        <span className="pull-right"><i className="account-icon icon icon-spin icon-circle-o-notch" style={{ verticalAlign : 'middle' }}/></span>
                    ) : (
                        <React.Fragment>
                            <i className="account-icon icon icon-user-o" />
                            { gridState === 'lg' ? "Log In / Register" : "Log In" }
                        </React.Fragment>
                    )}
                </NavItem>
                { this.renderRegistrationModal() }
            </React.Fragment>
        );
    }

}
