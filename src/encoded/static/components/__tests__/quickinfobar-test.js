'use strict';

/* Written by Carl, used to test the experiment set browsers
Made for 1st round browse (without file selectors).*/

jest.autoMockOff();

// Fixes https://github.com/facebook/jest/issues/78
jest.dontMock('react');
jest.dontMock('underscore');


describe('Testing viz/QuickInfoBar.js', function() {
    var React, TestUtils, page, context, filters, _, Wrapper, QuickInfoBar, href;

    beforeEach(function() {
        React = require('react');
        var { Provider, connect } = require('react-redux');
        TestUtils = require('react-dom/lib/ReactTestUtils');
        _ = require('underscore');
        context = require('../testdata/browse/context');
        QuickInfoBar = require('./../viz/QuickInfoBar');
        href = "http://localhost:8000/browse/?type=ExperimentSetReplicate&experimentset_type=replicate&limit=25&from=0";

        page = TestUtils.renderIntoDocument(
            <QuickInfoBar href={href} expSetFilters={{
                "experiments_in_set.biosample.biosource.individual.organism.name" : new Set(["mouse"]),
                "experiments_in_set.biosample.biosource.biosource_type" : new Set(["immortalized cell line"])
             }} />
        );
    });

    it('Has elements for stats (file, exps, expsets)', function() {
        var statEls = TestUtils.scryRenderedDOMComponentsWithClass(page, 'stat');
        expect(statEls.length).toEqual(3);
    });

    it('Has elements for stats values (file, exps, expsets), starting at 0, which change re: updateCurrentStats function', function() {
        var statValEls = TestUtils.scryRenderedDOMComponentsWithClass(page, 'stat-value');
        expect(statValEls.length).toEqual(3);
        statValEls.forEach(function(el){ // Ensure all vals == 0
            expect(parseInt(el.innerHTML)).toBe(0);
        });
        // Change those vals
        page.updateCurrentAndTotalCounts({
            experiments: 10,
            experiment_sets : 10,
            files : 10
        },{
            experiments: 211,
            experiment_sets : 211,
            files : 211
        });

        // Ensure they're changed
        statValEls.forEach(function(el){
            expect(el.innerHTML.indexOf('10')).toBeGreaterThan(-1);
            expect(el.innerHTML.indexOf('211')).toBeGreaterThan(-1);
        });
    });


});