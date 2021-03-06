
describe('Browse Views - Basic Tests', function () {

    context('Navigation and Redirection', function(){

        it('If start from home page, clicking on Browse nav menu item gets us to Browse page.', function(){

            cy.visit('/');

            cy.get('#browse-menu-item').click().then(()=>{
                cy.get('#page-title-container .page-title span.title').should('have.text', 'Data Browser');
            });

        });

        it('Only shows award.project=4DN results & "Include External Data" is off', function(){

            cy.location('search').should('include', 'award.project=4DN');
            cy.get('#stats .browse-base-state-toggle-container input[type="checkbox"]').should('not.be.checked');

        });


        it('If point browser to /browse/ page (no URL params), we also get redirected to award.project=4DN correctly.', function(){

            cy.visit('/');
            cy.visit('/browse/', { "failOnStatusCode" : false });

            // Wait for redirects: we should be taken from /browse/ to /browse/?award.project=4DN&experimentset_type=replicate&type=ExperimentSetReplicate
            cy.location('search').should('include', 'award.project=4DN');

        });

        it('There is at least 100 ExpSets in default browse view.', function(){
            cy.getQuickInfoBarCounts().its('experiment_sets').should('be.greaterThan', 99);
        });

        it('"/browse/?public_release.to=2017-10-31" redirects to correct URL, includes 35 < x < 50 results.', function(){
            cy.visit('/browse/?public_release.to=2017-10-31').end()
                .location('search').should('include', 'award.project=4DN').should('include', 'public_release.to=2017-10-31').end()
                .get('.bar-plot-chart .chart-bar').should('have.length.above', 0).end()
                .getQuickInfoBarCounts().its('experiment_sets').should('be.greaterThan', 35).should('be.lessThan', 50);
        });

        it('There is at least one Replaced item under the Status facet', function(){
            cy.get('.facet.row.closed[data-field="status"] > h5').scrollToCenterElement().click({ force: true }).end()
                .get('.facet.row[data-field="status"]').should('have.class', 'open').contains('Replaced');
        });

    });


});