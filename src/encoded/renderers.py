from pkg_resources import resource_filename
from pyramid.events import (
    BeforeRender,
    subscriber,
)
from pyramid.httpexceptions import (
    HTTPMovedPermanently,
    HTTPPreconditionFailed,
    HTTPUnauthorized,
    HTTPForbidden,
    HTTPUnsupportedMediaType,
)
from pyramid.security import forget
from pyramid.settings import asbool
from pyramid.threadlocal import (
    manager,
)
from pyramid.traversal import (
    split_path_info,
    _join_path_tuple,
)

from snovault.validation import CSRFTokenError
from subprocess_middleware.tween import SubprocessTween
import logging
import os
import psutil
import time
import json


log = logging.getLogger(__name__)


def includeme(config):
    config.add_tween(
        '.renderers.fix_request_method_tween_factory',
        under='snovault.stats.stats_tween_factory')
    config.add_tween(
        '.renderers.normalize_cookie_tween_factory',
        under='.renderers.fix_request_method_tween_factory')

    renderer_tween = (
        '.renderers.debug_page_or_json'
        if config.registry.settings['pyramid.reload_templates']
        else '.renderers.page_or_json'
    )

    config.add_tween(
        renderer_tween,
        under='.renderers.normalize_cookie_tween_factory')

    # This runs after the JS rendering, which is important for
    # some things such as adding response headers to an HTTP Exception.
    config.add_tween(
        '.renderers.set_response_headers_tween_factory',
        under=renderer_tween,
    )

    config.add_tween('.renderers.security_tween_factory', under='pyramid_tm.tm_tween_factory')
    config.scan(__name__)


def fix_request_method_tween_factory(handler, registry):
    """ Fix Request method changed by mod_wsgi.

    See: https://github.com/GrahamDumpleton/mod_wsgi/issues/2

    Apache config:
        SetEnvIf Request_Method HEAD X_REQUEST_METHOD=HEAD
    """

    def fix_request_method_tween(request):
        environ = request.environ
        if 'X_REQUEST_METHOD' in environ:
            environ['REQUEST_METHOD'] = environ['X_REQUEST_METHOD']
        return handler(request)

    return fix_request_method_tween


def security_tween_factory(handler, registry):

    def security_tween(request):
        login = None
        expected_user = request.headers.get('X-If-Match-User')
        if expected_user is not None:
            login = request.authenticated_userid
            if login != 'mailto.' + expected_user:
                detail = 'X-If-Match-User does not match'
                raise HTTPPreconditionFailed(detail)

        # Older stuff (pre-Auth0)
        elif request.authorization is not None or asbool(request.headers.get('X-Auth-Challenge', False)):
            login = request.authenticated_userid
            if not login:
                # wget may only send credentials following a challenge response.
                raise HTTPForbidden(title="No Access")


        if request.method in ('GET', 'HEAD'):
            #try:
            return handler(request)
            #except Exception as e:
            #    import pdb; pdb.set_trace()
            #    print(e)

        if request.content_type != 'application/json':
            detail = "%s is not 'application/json'" % request.content_type
            raise HTTPUnsupportedMediaType(detail)

        #token = request.headers.get('X-CSRF-Token')
        #if token is not None:
        #    # Avoid dirtying the session and adding a Set-Cookie header
        #    # XXX Should consider if this is a good idea or not and timeouts
        #    if token == dict.get(request.session, '_csrft_', None):
        #        return handler(request)
        #    raise CSRFTokenError('Incorrect CSRF token')

        return handler(request)

        if login is not None:
            namespace, userid = login.split('.', 1)
            if namespace not in ('mailto', 'auth0'):
                return handler(request)
        raise CSRFTokenError('Missing CSRF token')

    return security_tween


def normalize_cookie_tween_factory(handler, registry):
    from webob.cookies import Cookie

    ignore = {
        '/favicon.ico',
    }

    def normalize_cookie_tween(request):
        if request.path in ignore or request.path.startswith('/static/'):
            return handler(request)

        session = request.session
        #if session or session._cookie_name not in request.cookies:
        #    return handler(request)

        response = handler(request)
        existing = response.headers.getall('Set-Cookie')
        if existing:
            cookies = Cookie()
            for header in existing:
                cookies.load(header)
            if session._cookie_name in cookies:
                return response

        response.delete_cookie(
            session._cookie_name,
            path=session._cookie_path,
            domain=session._cookie_domain,
        )

        return response

    return normalize_cookie_tween


def set_response_headers_tween_factory(handler, registry):

    def set_response_headers_tween(request):
        response = handler(request)
        response.headers['X-Request-URL'] = request.url

        # Check if user logged in via Auth0 and set headers accordingly to inform React 
        # server-side/client-side render & App.prototype.navigate() request response handling
        if hasattr(request, 'auth0_expired'):

            if not request.auth0_expired:
                login = request.authenticated_userid
                if login:
                    authtype, email = login.split('.', 1)
                    if (authtype == 'auth0' and request.content_type != 'application/json'):
                        print()
                        # If successfully authenticated by Auth0, add JWT token and basic user details to response headers for server-side React to consume.
                        # Do not add if returning JSON, as will bypass server-side React which will be unable to unset/delete them before sending response.
                        #response = handler(request)
                        response.headers['X-Request-JWT'] = request.cookies.get('jwtToken','')
                        response.headers['X-User-Info'] = json.dumps(request.user_info)
                    elif authtype != 'auth0' and request.content_type != 'application/json':
                        #response = handler(request)
                        response.headers['X-Request-JWT'] = "null"

            elif request.auth0_expired:
                # Inform libs/react-middleware.js of expired token to set logout state in front-end in response to
                # either doc request or xhr request & set appropriate alerts
                if request.is_xhr or request.content_type == 'application/json':
                    # Do not change HTTPForbidden error detail ("Bad or expired token.") below unless want bad things to happen on the front-end 
                    # (or find/replace in /src/encoded/static accordingly, incl browser.js & components/app.js).
                    # Could also remove this raise HTTPForbidden when all browsers consistently support XMLHttpRequest.getResponseHeaders() (a living standard)
                    # to ID an expired token using X-Request-JWT header set below.
                    raise HTTPForbidden("Bad or expired token.")
                #response = handler(request)
                response.headers['X-Request-JWT'] = "expired"
                # Especially for initial document requests by browser, unset jwtToken cookie so initial client-side
                # React render has App(instance).state.session = false (synced w/ server-side)
                response.set_cookie(name='jwtToken', value=None, max_age=0,path='/')
                response.status_code = 403

        return response

    return set_response_headers_tween


@subscriber(BeforeRender)
def canonical_redirect(event):
    request = event['request']

    # Ignore subrequests
    if len(manager.stack) > 1:
        return

    if request.method not in ('GET', 'HEAD'):
        return
    if request.response.status_int != 200:
        return
    if not request.environ.get('encoded.canonical_redirect', True):
        return
    if request.path_info == '/':
        return

    if not isinstance(event.rendering_val, dict):
        return

    canonical = event.rendering_val.get('@id', None)
    if canonical is None:
        return
    canonical_path, _, canonical_qs = canonical.partition('?')

    request_path = _join_path_tuple(('',) + split_path_info(request.path_info))
    if (request_path == canonical_path.rstrip('/') and
            request.path_info.endswith('/') == canonical_path.endswith('/') and
            (canonical_qs in ('', request.query_string))):
        return

    if '/@@' in request.path_info:
        return

    qs = canonical_qs or request.query_string
    location = canonical_path + ('?' if qs else '') + qs
    raise HTTPMovedPermanently(location=location)


def should_transform(request, response):
    if request.method not in ('GET', 'HEAD'):
        return False

    if response.content_type != 'application/json':
        return False

    format = request.params.get('format')
    if format is None:
        original_vary = response.vary or ()
        response.vary = original_vary + ('Accept', 'Authorization')
        if request.authorization is not None:
            format = 'json'
        else:
            mime_type = request.accept.best_match(
                [
                    'text/html',
                    'application/ld+json',
                    'application/json',
                ],
                'text/html')
            format = mime_type.split('/', 1)[1]
            if format == 'ld+json':
                format = 'json'
    else:
        format = format.lower()
        if format not in ('html', 'json'):
            format = 'html'

    if format == 'json':
        return False

    request._transform_start = time.time()
    return True


def after_transform(request, response):
    end = time.time()
    duration = int((end - request._transform_start) * 1e6)
    stats = request._stats
    stats['render_count'] = stats.get('render_count', 0) + 1
    stats['render_time'] = stats.get('render_time', 0) + duration
    request._stats_html_attribute = True


# Rendering huge pages can make the node process memory usage explode.
# Ideally we would let the OS handle this with `ulimit` or by calling
# `resource.setrlimit()` from  a `subprocess.Popen(preexec_fn=...)`.
# Unfortunately Linux does not enforce RLIMIT_RSS.
# An alternative would be to use cgroups, but that makes per-process limits
# tricky to enforce (we would need to create one cgroup per process.)
# So we just manually check the resource usage after each transform.

rss_limit = 256 * (1024 ** 2)  # MB


def reload_process(process):
    return psutil.Process(process.pid).memory_info().rss > rss_limit

node_env = os.environ.copy()
node_env['NODE_PATH'] = ''

page_or_json = SubprocessTween(
    should_transform=should_transform,
    after_transform=after_transform,
    reload_process=reload_process,
    args=['node', resource_filename(__name__, 'static/build/renderer.js')],
    env=node_env,
)


debug_page_or_json = SubprocessTween(
    should_transform=should_transform,
    after_transform=after_transform,
    reload_process=reload_process,
    args=['node', resource_filename(__name__, 'static/build/renderer.js')],
    env=node_env,
)
