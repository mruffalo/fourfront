'use strict';

var _ = require('underscore');
var { isServerSide } = require('./misc');

/** 
 * Most of these functions should not be run from a component until it has mounted as they do not work
 * on serverside (depend on window, document, DOM, etc.)
 */
var layout = module.exports = {

    /** Get distance from top of browser viewport to an element's top. */
    getElementTop : function(el){
        if (!(typeof window !== 'undefined' && window && document && document.body)) return null;
        if (!el || typeof el.getBoundingClientRect !== 'function') return null;
        var bodyRect = document.body.getBoundingClientRect();
        var boundingRect = el.getBoundingClientRect();
        return boundingRect.top - bodyRect.top;
    },

    getElementOffset : function(el){
        if (!(typeof window !== 'undefined' && window && document && document.body)) return null;
        if (!el || typeof el.getBoundingClientRect !== 'function') return null;
        var bodyRect = document.body.getBoundingClientRect();
        var boundingRect = el.getBoundingClientRect();
        return {
            'top' : boundingRect.top - bodyRect.top,
            'left' : boundingRect.left - bodyRect.left
        };
    },

    getElementOffsetFine : function(el) {
        var x = 0;
        var y = 0;

        while (el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
            // FF & IE don't support body's scrollTop - use window instead
            x += el.offsetLeft - (el.tagName === 'BODY' ? window.pageXOffset : el.scrollLeft);
            y += el.offsetTop - (el.tagName === 'BODY' ? window.pageYOffset : el.scrollTop);
            el = el.offsetParent;
        }

        return { left: x, top: y };
    },

    /** 
     * Shorten a string to a maximum character length, splitting on word break (or other supplied character).
     * Optionally append an ellipsis.
     * 
     * @param {string}  originalText
     * @param {number}  maxChars
     * @param {boolean} [addEllipsis=true]
     * @param {string}  [splitOn=' ']
     */
    shortenString : function(originalText, maxChars = 28, addEllipsis = true, splitOn = ' '){
        var textArr         = originalText.split(splitOn),
            nextLength,
            returnArr       = [],
            returnStrLen    = 0;

        while (typeof textArr[0] === 'string'){
            nextLength = textArr[0].length + splitOn.length;
            if (returnStrLen + nextLength <= maxChars){
                returnArr.push(textArr.shift());
                returnStrLen += nextLength;
                
            } else break;
        }
        if (textArr.length === 0) return originalText;
        return returnArr.join(splitOn) + (addEllipsis ? '...' : '');
    },

    /**
     * Get current grid size, if need to sidestep CSS.
     * Keep widths in sync with stylesheet, e.g. $screen-sm-min, $screen-md-min, & $screen-lg-min
     * in src/encoded/static/scss/bootstrap/_variables.scss.
     *
     * @return {string} - Abbreviation for column/grid Bootstrap size, e.g. 'lg', 'md', 'sm', or 'xs'.
     */
    responsiveGridState : function(){
        if (isServerSide()) return 'lg';
        if (window.innerWidth >= 1200) return 'lg';
        if (window.innerWidth >= 992) return 'md';
        if (window.innerWidth >= 768) return 'sm';
        return 'xs';
    },


    /**
     * Get the width of what a 12-column bootstrap section would be in current viewport size.
     * Keep widths in sync with stylesheet, e.g.
     * $container-tablet - $grid-gutter-width,
     * $container-desktop - $grid-gutter-width, and
     * $container-large-desktop - $grid-gutter-width
     * in src/encoded/static/scss/bootstrap/_variables.scss.
     *
     * @return {integer}
     */
    gridContainerWidth : function(){
        // Subtract 20 for padding/margins.
        switch(layout.responsiveGridState()){
            case 'lg': return 1140;
            case 'md': return 940;
            case 'sm': return 720;
            case 'xs':
                if (isServerSide()) return 400;
                return window.innerWidth - 20;
        }

    },


    /**
     * Check width of text if it were to fit on one line.
     * @param {string} textContent - Either text or text-like content, e.g. with span elements.
     * @param {string} [font] - Font to use/measure. Include font-size. Defaults to "1rem 'Work Sans'".
     * @param {boolean} [roundToPixel] - Whether to round result up.
     * @return {integer} - Width of text if whitespace style set to nowrap, or object containing 'containerHeight' & 'textWidth' if widthForHeightCheck is set.
     */
    textWidth : function(
        textContent,
        font = "1rem 'Work Sans'",
        roundToPixel = false
    ){
        if (isServerSide()) return null;
        var canvas, context, width;

        try {
            // Attempt to use HTML5 canvas for sub-pixel accuracy, no DOM update, etc.
            canvas = layout.textWidth.canvas || (layout.textWidth.canvas = document.createElement("canvas"));
            context = canvas.getContext("2d");
            context.font = font;
            var metrics = context.measureText(textContent);
            width = metrics.width;
        } catch (e){
            // Fallback to older DOM-based check.
            console.warn("Failed to get text width with HTML5 canvas method, falling back to DOM method.");
            width = layout.textContentWidth(
                textContent,
                'div',
                null,
                null,
                { 'font' : font }
            );
        }
        if (roundToPixel){
            return Math.floor(width) + 1;
        } else {
            return width;
        }
    },

    textHeight : function(
        textContent = "Some String",
        width = 200,
        containerClassName = null,
        style = null,
        containerElement = null
    ){
        if (isServerSide()) return null;
        
        var height;
        var contElem;
        if (containerElement && typeof containerElement.cloneNode === 'function'){
            contElem = containerElement.cloneNode(false);
        } else {
            contElem = document.createElement('div');
        }
        contElem.className = "off-screen " + (containerClassName || '');
        contElem.innerHTML = textContent;
        if (style){
            _.extend(contElem.style, style);
        }
        contElem.style.display = "block";
        contElem.style.width = width + "px";
        if (containerElement && containerElement.parentElement){
            containerElement.parentElement.appendChild(contElem);
            height = contElem.clientHeight;
            containerElement.parentElement.removeChild(contElem);    
        } else {
            document.body.appendChild(contElem);
            height = contElem.clientHeight;
            document.body.removeChild(contElem);
        }
        return height;
    },

    /**
     * Check width of text or text-like content if it were to fit on one line.
     * @param {string} textContent - Either text or text-like content, e.g. with span elements.
     * @param {string} [containerElementType] - Type of element to fit into, e.g. 'div' or 'p'.
     * @param {string} [containerClassName] - ClassName of containing element, e.g. with 'text-large' to use larger text size.
     * @param {integer} [widthForHeightCheck] - If provided, will return an object which will return height of text content when constrained to width.
     * @return {integer|Object} - Width of text if whitespace style set to nowrap, or object containing 'containerHeight' & 'textWidth' if widthForHeightCheck is set.
     */
    textContentWidth : function(
        textContent,
        containerElementType = 'div',
        containerClassName = null,
        widthForHeightCheck = null,
        style = null
    ){
        if (isServerSide()){
            return null;
        }
        var contElem = document.createElement(containerElementType);
        contElem.className = "off-screen " + (containerClassName || '');
        contElem.innerHTML = textContent;
        if (style) contElem.style = style;
        contElem.style.whiteSpace = "nowrap";
        document.body.appendChild(contElem);
        var textLineWidth = contElem.clientWidth;
        var fullContainerHeight;
        if (widthForHeightCheck){
            contElem.style.whiteSpace = "";
            contElem.style.display = "block";
            contElem.style.width = widthForHeightCheck + "px";
            fullContainerHeight = contElem.clientHeight;
        }
        document.body.removeChild(contElem);
        if (fullContainerHeight) {
            return { containerHeight : fullContainerHeight, textWidth : textLineWidth };
        }
        return textLineWidth;
    },



}; 
