'use strict';

/** 
 * Written by Alex, based on Carl's homepage test, to test the 'About' page 
 * rendered by about.js, including navigation and other app components.
 * 
 * Unlike for other components, because the 'About' page is relatively simple,
 * the ENTIRE App is loaded and initialized to the /about/ page so that 
 * presence of nav bar and other global elements may be tested+covered as well.
 */

jest.autoMockOff();

// Fixes https://github.com/facebook/jest/issues/78
jest.dontMock('react');
jest.dontMock('underscore');

describe('Testing about.js', function() {
    
    // Setup required variables/dependencies before running tests.
    
    var React, About, testItem, TestUtils, page, data, _, banners, Wrapper, App;

    beforeAll(function() {
        React = require('react');
        TestUtils = require('react/lib/ReactTestUtils');
        _ = require('underscore');
        App = require('../app');
        page = TestUtils.renderIntoDocument(
            <App href="http://data.4dnucleome.org/about/" context={{}} />
        );
    });


    // Check that has functional navBar with links
    it('Has global navigation bar & links', function() {

        var navBanner = TestUtils.scryRenderedDOMComponentsWithClass(page, 'navbar navbar-main');
        var navBannerLinkWrapper = TestUtils.scryRenderedDOMComponentsWithClass(page, 'nav navbar-nav');
        expect(navBanner.length).toEqual(1);
        expect(navBannerLinkWrapper.length).toBeGreaterThan(0); // Doesn't matter if 1 or more links.

        /** 
         * Test mobile dropdown (full menu)
         */

        var menuToggleButton = navBanner[0].children[0].children[0]; // nav.navbar.navbar-main > div.navbar-header > a.navbar-toggle
        var menuCollapsibleSection = navBanner[0].children[1]; // nav.navbar.navbar-main > div.navbar-collapse.collapse
        expect(menuToggleButton.className.search('navbar-toggle')).toBeGreaterThan(-1);
        expect(menuToggleButton.getAttribute('aria-expanded')).toEqual('false');
        // Make sure 'in' is not in className, as it controls section visibility @ mobile sizes.
        expect(menuCollapsibleSection.className.search('in')).toBe(-1); 
        TestUtils.Simulate.click(menuToggleButton); // Open mobile menu
        expect(menuToggleButton.getAttribute('aria-expanded')).toEqual('true');
        expect(menuCollapsibleSection.className.search('in')).toBeGreaterThan(-1);
        TestUtils.Simulate.click(menuToggleButton); // Close mobile menu
        expect(menuToggleButton.getAttribute('aria-expanded')).toEqual('false');
        expect(menuCollapsibleSection.className.search('in')).toBe(-1);

        /**
         * Test navbar dropdown menu items & sub-menus
         */
        /*
        // Custom MouseEvent in lieu of TestUtils.Simulate.click as 
        // stopImmediatePropagation doesn't work w/ TestUtils events.
        
        function customClickEvent(){
            return new MouseEvent('click', {
                cancelable : true,
                bubbles : true,
                view: window
            });
        }

        // NVM - TestUtil's hidden SimulateNative works (but w/o enabling changes..).

        navBannerLinkWrapper.map(function(navList, idx, arr){
            for (var i = 0; i < navList.children.length; i++){ // .map() doesn't work for node.children
                if (navList.children[i].children[0].className.search('dropdown-toggle') > -1){
                    expect(navList.children[i].children[0].getAttribute('aria-expanded')).toEqual('false');
                    expect(navList.children[i].className.search('dropdown')).toBeGreaterThan(-1);
                    expect(navList.children[i].className.search('open')).toEqual(-1);
                    
                    TestUtils.SimulateNative.click(navList.children[i].children[0]); // Open dropdown item
                    //navList.children[i].children[0].dispatchEvent(customClickEvent());

                    expect(navList.children[i].children[0].getAttribute('aria-expanded')).toEqual('true');
                    expect(navList.children[i].className.search('open')).toBeGreaterThan(-1);
                    
                    TestUtils.SimulateNative.click(navList.children[i].children[0]); // Close dropdown item
                    //navList.children[i].children[0].dispatchEvent(customClickEvent());

                    expect(navList.children[i].children[0].getAttribute('aria-expanded')).toEqual('false');
                    expect(navList.children[i].className.search('open')).toEqual(-1);
                }
            }
        })
        */

        // ToDo: Issues above - changes in response to menu item dropdown clicks don't take effect in Jest. 

    });


    it("Has 'about' page elements -- '.static-page' wrapper, title, and content regions", function() {
        var staticContainer = TestUtils.findRenderedDOMComponentWithClass(page, "static-page");
        expect(staticContainer).toBeTruthy();
        
        var staticContainerContentSections = staticContainer.children[1].children; 
        // ^ == div.static-page > div.help-entry > *

        // Should at least have 1 child element (title, paragraphs) 
        expect(staticContainerContentSections.length).toBeGreaterThan(1); 

        // Finding by className incase title location in DOM changes in future.
        var staticContainerTitle = TestUtils.findRenderedDOMComponentWithClass(page, "page-title");
        expect(staticContainerTitle.innerHTML).toEqual('About');
        
    });

    // Example of something which would be present on About page.
    it("Has Burak and Nils' names", function() {
        var contentParagraphs = TestUtils.scryRenderedDOMComponentsWithClass(page, "fourDN-content");
        expect(contentParagraphs.length).toBeGreaterThan(1); // At least 1 paragraph.
        
        var fullContentParagraphsText = contentParagraphs.map(function(v){ return v.innerHTML; }).join('\n');
        expect(fullContentParagraphsText.search('Burak Alver')).toBeGreaterThan(-1); // .search returns index, or -1.
        expect(fullContentParagraphsText.search('Nils Gehlenborg')).toBeGreaterThan(-1);
        
    });

});