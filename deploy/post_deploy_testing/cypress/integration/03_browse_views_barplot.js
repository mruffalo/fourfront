import _ from 'underscore';
import { compareQuickInfoCountsVsBarPlotCounts } from './../support/macros';


describe('Browse Views - Redirection & Visualization', function () {

    context('Test /browse/ page redirection', function(){

        it('If start from home page, clicking on Browse nav menu item gets us to Browse page.', function(){

            cy.visit('/');

            cy.get('#sBrowse').click().then(()=>{
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

            cy.location('search').should('include', 'award.project=4DN');

        });

        it('There is at least 100 ExpSets in default browse view.', function(){
            cy.getQuickInfoBarCounts().its('experiment_sets').should('be.greaterThan', 99);
        });

        it('"/browse/?q=public_release:[* TO 2017-10-31]" redirects to correct URL, includes 40 < x < 50 results.', function(){
            cy.visit('/browse/?q=public_release:[* TO 2017-10-31]').end()
                .location('search').should('include', 'award.project=4DN').should('include', 'q=public_release').should('include', '2017-10-31').end()
                .get('input[name="q"]').should('have.value', 'public_release:[* TO 2017-10-31]')
                .get('.bar-plot-chart .chart-bar').should('have.length.above', 0).end()
                .getQuickInfoBarCounts().its('experiment_sets').should('be.greaterThan', 40).should('be.lessThan', 50);
        });

    });

    context('BarPlotChart & QuickInfoBar', function(){

        before(()=>{
            cy.visit('/browse/', { "failOnStatusCode" : false }) // Wait for redirects
                .wait(300).get('#slow-load-container').should('not.have.class', 'visible').end();
        });

        it('In default award.project=4DN view; BarPlot counts == QuickInfoBar counts', function(){

            cy.get('.bar-plot-chart .chart-bar').should('have.length.above', 0)
                .end().window().scrollTo(0, 200)
                .wait(300).get('#slow-load-container').should('not.have.class', 'visible').wait(1000).end()
                .screenshot().end()
                .then(()=>{
                    compareQuickInfoCountsVsBarPlotCounts();
                });

        });

        context('Filtering using visualization elements', function(){

            it('Hover over & click "ATAC-seq, mouse" bar part + popover button--> matching filtered /browse/ results', function(){

                // A likely-to-be-here Bar Section - ATAC-seq x mouse
                cy.window().then((w)=>{ w.scrollTo(0,0); }).end().get('#select-barplot-field-1').should('contain', 'Organism').end()
                    .get('#select-barplot-field-0').should('contain', 'Experiment Type').end()
                    .get('.bar-plot-chart .chart-bar[data-term="ATAC-seq"] .bar-part[data-term="mouse"]').scrollToCenterElement().then(($barPart)=>{
                        const expectedFilteredResults = parseInt($barPart.attr('data-count'));
                        expect(expectedFilteredResults).to.be.greaterThan(3);
                        expect(expectedFilteredResults).to.be.lessThan(25);
                        return cy.wrap($barPart).scrollToCenterElement().hoverIn().wait(10).end()
                            .get('.cursor-component-root .details-title').should('contain', 'mouse').end()
                            .get('.cursor-component-root .detail-crumbs .crumb').should('contain', 'ATAC-seq').end()
                            .get('.cursor-component-root .details-title .primary-count').should('contain', expectedFilteredResults).end().getQuickInfoBarCounts().then((origCount)=>{
                                return cy.wrap($barPart).scrollToCenterElement().wait(200).trigger('mouseover').trigger('mousemove').click({ force : true }).wait(100).end()
                                    .get('.cursor-component-root .actions.buttons-container .btn-primary').should('contain', "Explore").click().end()
                                    .location('search').should('include', 'experiments_in_set.experiment_type=ATAC-seq').should('include', 'experiments_in_set.biosample.biosource.individual.organism.name=mouse').wait(300).end()
                                    .get('#slow-load-container').should('not.have.class', 'visible').end()
                                    .get('.search-results-container .search-result-row').should('have.length', expectedFilteredResults).end()
                                    .getQuickInfoBarCounts({ 'shouldNotEqual' : '' + origCount.experiment_sets }).its('experiment_sets').should('not.equal', origCount.experiment_sets).should('equal', expectedFilteredResults).end()
                                    .get('.bar-plot-chart .chart-bar .bar-part').should('have.length', 1).end().screenshot();
                            });
                    });
            });

            it("Can unselect currently-selected filters via QuickInfoBar filter panel", function(){
                cy.getQuickInfoBarCounts().then((origCounts)=>{
                    cy.get('#stats .any-filters.glance-label').hoverIn().wait(100).end()
                        .get('#stats .bottom-side .chart-breadcrumbs .chart-crumb').should('have.length', 2).end()
                        .get('#stats .bottom-side .chart-breadcrumbs .chart-crumb[data-term="mouse"] i.icon-times').should('have.length', 1).click().wait(10).end()
                        .get('#stats .bottom-side .chart-breadcrumbs .chart-crumb[data-term="mouse"] i.icon-times').should('have.length', 0).end()
                        .get('#stats .bottom-side .chart-breadcrumbs .chart-crumb').should('have.length', 1).end()
                        .get('.bar-plot-chart .chart-bar .bar-part').should('have.length.greaterThan', 1).then(($allBarParts)=>{
                            const unfilteredOnceBarPartCount = $allBarParts.length;
                            cy.getQuickInfoBarCounts().its('experiment_sets').should('be.greaterThan', origCounts.experiment_sets).then((unfilteredOnceExpSetCount)=>{
                                cy.get('#stats .bottom-side .chart-breadcrumbs .chart-crumb[data-term="ATAC-seq"] i.icon-times').should('have.length', 1).click().wait(10).end()
                                    .get('#stats .bottom-side .chart-breadcrumbs .chart-crumb[data-term="ATAC-seq"] i.icon-times').should('have.length', 0).end()
                                    .get('.bar-plot-chart .chart-bar .bar-part').should('have.length.greaterThan', unfilteredOnceBarPartCount)
                                    .getQuickInfoBarCounts().its('experiment_sets').should('be.greaterThan', unfilteredOnceExpSetCount).end()
                                    .location('search').should('include', 'award.project=4DN')
                                    .should('not.include', 'experiments_in_set.experiment_type=ATAC-seq').should('not.include', 'experiments_in_set.biosample.biosource.individual.organism.name=mouse');
                            });
                        });
                });

            });

        });

        context('Counts stay same or change expectedly upon re-requests of BarPlot data', function(){

            it('Toggling "Show External Data" ==> higher, matching counts', function(){

                cy.getQuickInfoBarCounts().then((initialCounts)=>{

                    cy.get('.browse-base-state-toggle-container label.onoffswitch-label').click().then(()=>{
                        cy.wait(1000) // Wait for 'slow-load-container' to become visible if needed, and wait for it to load
                            .get('#slow-load-container').should('not.have.class', 'visible').end()
                            .wait(250) // Wait for JS to init re-load of barplot data, then for it to have loaded.
                            .get('#select-barplot-field-1').should('not.have.attr', 'disabled').end()
                            .get('#stats-stat-expsets.stat-value:not(.loading)').should('have.length.greaterThan', 0).end()
                            .getQuickInfoBarCounts().its('experiment_sets').should('be.greaterThan', initialCounts.experiment_sets).wait(1000).end().screenshot().end().then(()=>{
                                compareQuickInfoCountsVsBarPlotCounts();
                            });
                    });

                });

            });

            it('Counts persist on setting groupBy --> "Project"', function(){
                cy.getQuickInfoBarCounts().then((initialCounts)=>{
                    cy.get('#select-barplot-field-1').click().wait(100).end()
                        .get('#select-barplot-field-1 + ul.dropdown-menu').within(($ul)=>{
                            return cy.contains('Project').click().wait(100);
                        }).end()
                        .getQuickInfoBarCounts().then((nextCounts)=>{
                            expect(nextCounts.experiment_sets).to.equal(initialCounts.experiment_sets);
                            expect(nextCounts.experiments).to.equal(initialCounts.experiments);
                            expect(nextCounts.files).to.equal(initialCounts.files);
                            compareQuickInfoCountsVsBarPlotCounts();
                        }).end();
                });
            });


            it('Counts persist on setting groupBy --> "Biosource"', function(){
                cy.getQuickInfoBarCounts().then((initialCounts)=>{
                    cy.get('#select-barplot-field-1').click().wait(100).end()
                        .get('#select-barplot-field-1 + ul.dropdown-menu').within(($ul)=>{
                            return cy.contains('Biosource').click().wait(100);
                        }).end()
                        .getQuickInfoBarCounts().then((nextCounts)=>{
                            expect(nextCounts.experiment_sets).to.equal(initialCounts.experiment_sets);
                            expect(nextCounts.experiments).to.equal(initialCounts.experiments);
                            expect(nextCounts.files).to.equal(initialCounts.files);
                            cy.screenshot();
                            compareQuickInfoCountsVsBarPlotCounts();
                        }).end();
                });
            });


            it('Counts persist on setting xAxis --> "Biosource Type"', function(){
                cy.getQuickInfoBarCounts().then((initialCounts)=>{
                    cy.get('#select-barplot-field-0').click().wait(100).end()
                        .get('#select-barplot-field-0 + ul.dropdown-menu').within(($ul)=>{
                            return cy.contains('Biosource Type').click().wait(100);
                        }).end()
                        .getQuickInfoBarCounts().then((nextCounts)=>{
                            expect(nextCounts.experiment_sets).to.equal(initialCounts.experiment_sets);
                            expect(nextCounts.experiments).to.equal(initialCounts.experiments);
                            expect(nextCounts.files).to.equal(initialCounts.files);
                            return cy.wait(100).end().get('.bar-plot-chart .chart-bar.transitioning').should('have.length', 0).wait(100).end().then(()=>{ // Wait until bars have transitioned.
                                cy.screenshot();
                                compareQuickInfoCountsVsBarPlotCounts();
                            });
                        }).end();
                });
            });


            it('Counts persist on setting groupBy --> "None"', function(){
                cy.getQuickInfoBarCounts().then((initialCounts)=>{
                    cy.get('#select-barplot-field-1').click().wait(100).end()
                        .get('#select-barplot-field-1 + ul.dropdown-menu').within(($ul)=>{
                            return cy.contains('None').click().wait(100);
                        }).end()
                        .getQuickInfoBarCounts().then((nextCounts)=>{
                            expect(nextCounts.experiment_sets).to.equal(initialCounts.experiment_sets);
                            expect(nextCounts.experiments).to.equal(initialCounts.experiments);
                            expect(nextCounts.files).to.equal(initialCounts.files);
                            compareQuickInfoCountsVsBarPlotCounts({ 'skipLegend' : true }); // No legend when no groupBy
                        }).end();
                });
            });


            it('Counts persist on setting groupBy --> "Lab"', function(){
                cy.getQuickInfoBarCounts().then((initialCounts)=>{
                    cy.get('#select-barplot-field-1').click().wait(100).end()
                        .get('#select-barplot-field-1 + ul.dropdown-menu').within(($ul)=>{
                            return cy.contains('Lab').click().wait(100);
                        }).end()
                        .getQuickInfoBarCounts().then((nextCounts)=>{
                            expect(nextCounts.experiment_sets).to.equal(initialCounts.experiment_sets);
                            expect(nextCounts.experiments).to.equal(initialCounts.experiments);
                            expect(nextCounts.files).to.equal(initialCounts.files);
                            compareQuickInfoCountsVsBarPlotCounts();
                        }).end();
                });
            });


            it('Login & ensure QuickInfoBar counts have changed; BarPlot counts match', function(){

                cy.getQuickInfoBarCounts().then((counts)=>{

                    const loggedOutCounts = _.clone(counts);

                    cy.login4DN().wait(200)
                        .get('#stats-stat-expsets').should('have.text', '').end()
                        .getQuickInfoBarCounts().its('experiment_sets').should('be.greaterThan', loggedOutCounts.experiment_sets).end().then(()=>{
                            return compareQuickInfoCountsVsBarPlotCounts();
                        })
                        .logout4DN();

                });

            });

        });


    });


});