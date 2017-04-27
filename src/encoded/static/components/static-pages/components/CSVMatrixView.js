'use strict';

var React = require('react');
var _ = require('underscore');
import MatrixView from './../../viz/MatrixView';
var d3 = require('d3');
var { console } = require('./../../util');


export const CSVParsingUtilities = {

    /**
     * @static
     * @function
     * @param {string} csvString - String representation of a CSV document.
     * @param {Object} options - Options for parsing CSV.
     * @returns {Object} A container object containing X Axis Labels, Y Axis Labels, and a 2D data object array.
     * @see CSVParsingUtilities.defaultCSVParseOptions().
     */
    CSVStringTo2DArraySet : function(csvString, options = {}){
        if (typeof csvString  !== 'string') throw new Error("csvString must be a string.");
        options = _.extend(CSVParsingUtilities.defaultCSVParseOptions(), options);
        var data = d3.csvParseRows(csvString);

        // Grab title from CSV, if set.
        var title = null;
		if (Array.isArray(options.titleCell)){
            title = data[options.titleCell[1] - 1][options.titleCell[0] - 1];
        }
        var xAxisLabels = CSVParsingUtilities.xAxisLabelsFrom2DArray(data, options),
            yAxisLabels = CSVParsingUtilities.yAxisLabelsFrom2DArray(data, options),
            grid = CSVParsingUtilities.stringValuesToObjectsGrid(
                CSVParsingUtilities.filter2DArrayDownToRange(data, options),
                xAxisLabels,
                yAxisLabels,
                options
            );

        return {
            'title' : title,
            'xAxisLabels' : xAxisLabels,
            'yAxisLabels' : yAxisLabels,
            'grid' : grid
        };
    },

    /**
     * @static
     * @memberof CSVParsingUtilities
     * @param {string[][]} stringGrid - 2D array of string values.
     */
    stringValuesToObjectsGrid : function(stringGrid, xAxisLabels, yAxisLabels, options){
        return stringGrid.map(function(row, rowIndex){
            return row.map(function(cellValue, columnIndex){
                var numVal;
                if (typeof cellValue === 'number'){
                    numVal = cellValue;
                } else if (typeof cellValue === 'string'){
                    if (cellValue.length === 0) numVal = 0;
                    else {
                        numVal = parseFloat(cellValue);
                        if (isNaN(numVal)) numVal = 1;
                    }
                }
                
                return {
                    'originalValue' : cellValue,
                    'value'         : numVal,
                    'row'           : rowIndex,
                    'column'        : columnIndex,
                    'columnLabel'   : xAxisLabels[columnIndex],
                    'rowLabel'      : yAxisLabels[rowIndex],
                    'tooltip'       : CSVParsingUtilities.generateCellTooltipContent(cellValue, yAxisLabels, xAxisLabels, rowIndex, columnIndex, options)
                }

            });
        })
    },

    generateCellTooltipContent : function(cellValue, yAxisLabels, xAxisLabels, rowIndex, columnIndex, options){
        var displayCellValue = cellValue;
        if (displayCellValue.charAt(0).toLowerCase() === 'x'){
            displayCellValue = displayCellValue.slice(1).trim();
        }
        if (displayCellValue.length === 0) displayCellValue = null;
        var tooltipContent = (
            '<div><small style="opacity: 0.5">' +(options.yaxisTitle || 'X') +' :</small> ' +
            yAxisLabels[rowIndex].join(' - ') +
            '</div><div><small style="opacity: 0.5">' +
            (options.xaxisTitle || 'Y') + ' :</small> ' + xAxisLabels[columnIndex].join(' - ') +
            '</div>'
        );
        if (displayCellValue){
            tooltipContent += '<hr style="margin: 4px 0; opacity: 0.33;"/><div>' + displayCellValue + '</div>';
        }
        return tooltipContent;
    },

    defaultCSVParseOptions: function(){
        return {
            "titleCell" : [1,1],
            "yaxisCols" : [1,2],
            "xaxisRows" : [3],
            "skipRows"  : [22,23,24],
            "startCell" : [3,5],
            "endCell"   : [8,32]
        };
    },

    xAxisLabelsFrom2DArray : function(data, options){
       return _.zip.apply(_.zip, options.xaxisRows.map(function(xRow){ 
            return data[xRow - 1].filter(function(colLabel, colIdx){
	            if (colIdx < options.startCell[0] - 1) return false;
                if (colIdx > options.endCell[0] - 1) return false;
            	return true;
            });
        })).map(function(setOfXLabels){
            return setOfXLabels.map(function(xLabelPart){
                return xLabelPart.trim();
            });//.join(', ');
        });
    },

    yAxisLabelsFrom2DArray : function(data, options){
        return _.zip.apply(_.zip, options.yaxisCols.map(function(yCol){ 
            return _.pluck(data, yCol - 1).filter(function(rowLabel, rowIdx){
	            if (rowIdx < options.startCell[1] - 1) return false;
                if (rowIdx > options.endCell[1] - 1) return false;
                    if (options.skipRows.indexOf(rowIdx + 1) > -1){
                    return false;
                }
            	return true;
            });
        })).map(function(setOfYLabels){
            return setOfYLabels.map(function(yLabelPart){
                return yLabelPart.trim();
            });//.join(', ');
        });
    },

    filter2DArrayDownToRange : function(data, options){
        return data.filter(function(row, rowIndex){
			if (rowIndex < options.startCell[1] - 1) return false;
			if (rowIndex > options.endCell[1] - 1) return false;
            if (options.skipRows.indexOf(rowIndex + 1) > -1){
                return false;
            }
			return true;
		}).map(function(row, adjustedRowIndex){
            return row.filter(function(cell, colIndex){
                if (colIndex < options.startCell[0] - 1) return false;
                if (colIndex > options.endCell[0] - 1) return false;
                return true;
            });
        });
    }

};



/**
 * Extends MatrixView Component to accept a 'csv' {string} prop which can be parsed into Matrix data.
 * 
 * @export
 * @class CSVMatrixView
 * @extends {MatrixView}
 * @prop {string} csv - String representation of a CSV file.
 * @prop {Object} options - Options for parsing CSV. TODO: typedef
 */
export default class CSVMatrixView extends MatrixView {

    constructor(props){
		super(props);
        this.render = this.render.bind(this);
    }

    render(){
        var options = this.props.options || {};

        if (typeof this.props.csv !== 'string') {
            throw new Error("No valid CSV prop defined.");
        }

        var { grid, title, xAxisLabels, yAxisLabels } = CSVParsingUtilities.CSVStringTo2DArraySet(this.props.csv, options);

        return MatrixView.prototype.render.call(this, 
            grid,
            xAxisLabels,
            yAxisLabels,
            options.xaxisTitle,
            options.yaxisTitle,
            title
        );

    }

}