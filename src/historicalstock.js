var fs = require('fs');
var yahooFinance = require('yahoo-finance');
var sleep = require('deasync')
var DataGrabber = require('../src/datagrabber.js');

/* Creates a new 'HistoricalStock' with an array of symbols
 * Updates all known Raw and Technical data for all of stocks
 */
function HistoricalStock(symbols, data_dir)
{
	this.symbols = symbols;
	this.data_dir = data_dir;
}

HistoricalStock.prototype.writeData = function()
{
	console.log("[____|DATA_WRITE] WRITING RAW STOCK DATA FOR [" + this.symbols.length + "] STOCKS");
	for(var i = 0; i < this.symbols.length; i++)
	{
		console.log("_______________________________________________________");
		writeRawData(this.symbols[i], this.data_dir);
		updateAllTechnicalData(this.symbols[i], this.data_dir);
		console.log("_______________________________________________________");
	}
}

/* Updates all technical data that does not already exist */
function updateAllTechnicalData(symbol, data_dir)
{
	var grabber = new DataGrabber(symbol, data_dir);
	var dates = grabber.getAllDates();
	var closes = grabber.getAllCloses();
	var volumes = grabber.getAllVolumes();

	updateTechnicalDataFiles(symbol, dates, data_dir);
	updateSMAS(grabber, symbol, dates, closes, data_dir);
	updateEMAS(grabber, symbol, dates, closes, data_dir);
	updateRSIS(grabber, symbol, dates, closes, data_dir);
	updateOBVS(grabber, symbol, dates, closes, data_dir);
	updateMFIS(grabber, symbol, dates, closes, data_dir);
}

/* Writes a JSON file 'raw.json' for a stock symbol
 * File contains basic info of every date (close, volume, etc.)
 */
function writeRawData(symbol, data_dir)
{
	var done = false;
	var start = '1950-01-01';
	var end = getCurrentDate();
	var quotes = yahooFinance.historical({ symbol: symbol, from: start, to: end },
	function (err, quotes) 
	{
		if(!fs.existsSync(data_dir + symbol))
			fs.mkdirSync(data_dir + symbol);
		fs.writeFile(data_dir + symbol + '/raw.json', 
			JSON.stringify(convertRawFormat(quotes), null, 4), function(err) 
		{
	    	if(err)
	      		console.log(err);
	      	done = true;
    	});
	}); 
	while(!done) sleep.sleep(10);
}

/* Adds a file for every date where data is known
 * Uses 'template.json' for all dates as 'YYYY-MM-DD.json'
 */
function updateTechnicalDataFiles(symbol, dates, data_dir)
{
	var files = fs.readdirSync(data_dir + symbol);
	for(var i = files.length - 1; i < dates.length; i++)
		fs.writeFileSync(data_dir + symbol + "/" + dates[i] + ".json", getTemplateJson(data_dir));
	console.log("[" + symbol + "|DATA_WRITE] Updated [" + (dates.length - files.length + 1) + "] Technical Data Files.");
}

/* Writes OBVs TO Techincal Files */
function updateOBVS(grabber, symbol, dates, closes, data_dir)
{
	var prevOBV = 0;
	var currOBV = 0;

	for(var i = 1; i < dates.length; i++)
	{
		var completion = Math.round(i / dates.length * 100);
		process.stdout.write("[" + symbol + "|DATA_WRITE] UPDATING OBVs [" + completion + "%] COMPLETE\r");

		var prevClose = grabber.getCloseOnDate(dates[i - 1]);
		var currClose = grabber.getCloseOnDate(dates[i]);
		var volume = grabber.getVolumeOnDate(dates[i]);

		if(currClose > prevClose)
			currOBV = prevOBV + volume;
		else if(prevClose < currClose)
			currOBV = prevOBV - volume;
		else 
			currOBV = prevOBV;

		var json = getTechnicalRawJson(symbol, dates[i], data_dir);
		json.obv = currOBV;
		writeTechnicalRawJson(symbol, dates[i], json, data_dir);

		prevOBV = currOBV;
	}
	console.log();
}

/* Writes MFIs To Technical Files (Size 14) */
function updateMFIS(grabber, symbol, dates, closes, data_dir)
{
	var posMoneyFlow = 0;
	var negMoneyFlow = 0;
	var prevPrice = 0;
	var currPrice = 0;
	var flags = [];	//Will Hold Values '1' for pos - '0' for neg.

	for(var i = 1; i < 15; i++)
	{
		prevPrice = grabber.getTypicalPriceOnDate(dates[i - 1]);
		currPrice = grabber.getTypicalPriceOnDate(dates[i]);
		
		if(currPrice >= prevPrice)
		{
			posMoneyFlow += grabber.getRawMoneyFlowOnDate(dates[i]);
			flags.push(1);
		}
		else
		{
			negMoneyFlow += grabber.getRawMoneyFlowOnDate(dates[i]);
			flags.push(0);
		}
	}

	var mfi = 100 - (100 / (1 + (posMoneyFlow / negMoneyFlow)));
	var json = getTechnicalRawJson(symbol, dates[14], data_dir);
	json.mfi = mfi.toFixed(2);	
	writeTechnicalRawJson(symbol, dates[14], json, data_dir);

	for(var i = 15; i < dates.length; i++)
	{
		var completion = Math.round(i / dates.length * 100);
		process.stdout.write("[" + symbol + "|DATA_WRITE] UPDATING MFIs [" + completion + "%] COMPLETE\r");

		prevPrice = grabber.getTypicalPriceOnDate(dates[i - 1]);
		currPrice = grabber.getTypicalPriceOnDate(dates[i]);

		if(currPrice >= prevPrice)
		{
			posMoneyFlow += grabber.getRawMoneyFlowOnDate(dates[i]);

			if(flags[0] == 1)
				posMoneyFlow -= grabber.getRawMoneyFlowOnDate(dates[i - 14]);
			else
				negMoneyFlow -= grabber.getRawMoneyFlowOnDate(dates[i - 14]);

			flags.shift();
			flags.push(1);
		}
		else
		{
			negMoneyFlow += grabber.getRawMoneyFlowOnDate(dates[i]);

			if(flags[0] == 1)
				posMoneyFlow -= grabber.getRawMoneyFlowOnDate(dates[i - 14]);
			else
				negMoneyFlow -= grabber.getRawMoneyFlowOnDate(dates[i - 14]);

			flags.shift();
			flags.push(0);
		}

		mfi = 100 - (100 / (1 + (posMoneyFlow / negMoneyFlow)));
		json = getTechnicalRawJson(symbol, dates[i], data_dir);
		json.mfi = mfi.toFixed(2);	
		writeTechnicalRawJson(symbol, dates[i], json, data_dir);		
	}
	console.log();
}

/* Writes RSIs To Techincal Files (Size 14) */
function updateRSIS(grabber, symbol, dates, closes, data_dir)
{
	var currAvgGain = 0;
	var currAvgLoss = 0;
	var firstGainSum = 0;
	var firstLossSum = 0;
	var prevClose = 0;
	var currClose = 0;

	for(var i = 1; i < 15; i++)	//GET FIRST AVG GAIN/LOSS
	{
		prevClose = grabber.getCloseOnDate(dates[i - 1]);
		currClose = grabber.getCloseOnDate(dates[i]);

		if(currClose > prevClose)
			firstGainSum += (currClose - prevClose);
		else
			firstLossSum += (prevClose - currClose);
	}
	var prevAvgGain = firstGainSum / 14;
	var prevAvgLoss = firstLossSum / 14;

	var rsi = 100 - (100 / (1 + (prevAvgGain / prevAvgLoss)));
	var json = getTechnicalRawJson(symbol, dates[14], data_dir);
	json.rsi = rsi.toFixed(2);	
	writeTechnicalRawJson(symbol, dates[14], json, data_dir);

	for(var i = 15; i < dates.length; i++)
	{
		var completion = Math.round(i / dates.length * 100);
		process.stdout.write("[" + symbol + "|DATA_WRITE] UPDATING RSIs [" + completion + "%] COMPLETE\r");

		prevClose = grabber.getCloseOnDate(dates[i - 1]);
		currClose = grabber.getCloseOnDate(dates[i]);

		if(currClose > prevClose)
		{
			currAvgGain = ((prevAvgGain * 13) + (currClose - prevClose)) / 14;
			currAvgLoss = prevAvgLoss * 13 / 14;
		}
		else
		{
			currAvgLoss = ((prevAvgLoss * 13) + (prevClose - currClose)) / 14;
			currAvgGain = prevAvgGain * 13 / 14;
		}

		rsi = 100 - (100 / (1 + (currAvgGain / currAvgLoss)));
		prevAvgGain = currAvgGain;
		prevAvgLoss = currAvgLoss;

		json = getTechnicalRawJson(symbol, dates[i], data_dir);
		json.rsi = rsi.toFixed(2);
		writeTechnicalRawJson(symbol, dates[i], json, data_dir);
	}
	console.log();
}

/* Writes EMAs TO Techincal Files (Sizes 2, 4, 6.... 200) */
function updateEMAS(grabber, symbol, dates, closes, data_dir)
{
	var prevEMA = 0;
	var currEMA = 0;
	var sum = 0;

	for(var i = 2; i <= 200; i++)
	{
		process.stdout.write("[" + symbol + "|DATA_WRITE] UPDATING EMAs [" + (i / 2) + "%] COMPLETE\r");

		for(var j = 0; j < i; j++)	//GET FIRST EMA AND WRITE IT TO FILE
			sum += grabber.getCloseOnDate(dates[j]);

		prevEMA = sum / i;	//CALCULATE FIRST EMA
		var json = getTechnicalRawJson(symbol, dates[i - 1], data_dir);	//WRITE FIRST SMA
		json.emas[(i / 2) - 1] = prevEMA.toFixed(2);			//TO FILE
		var multiplier = 2 / (i + 1);

		for(var j = i; j < dates.length; j++)
		{
			var close = grabber.getCloseOnDate(dates[j]);
			currEMA = (close - prevEMA) * multiplier + prevEMA;

			var json = getTechnicalRawJson(symbol, dates[j], data_dir);
			json.emas[(i / 2) - 1] = currEMA.toFixed(2);
			writeTechnicalRawJson(symbol, dates[j], json, data_dir);
			prevEMA = currEMA;
		}

		sum = prevEMA = currEMA = 0;	//RESET VALUES FOR NEXT LOOP
		i++;	//INCREMENTS EACH LOOP BY ONE (2,4,6...200)
	}
	console.log();
}

/* Writes SMAs TO Techincal Files (Sizes 2, 4, 6.... 200) */
function updateSMAS(grabber, symbol, dates, closes, data_dir)
{
	var prevSMA = 0;
	var currSMA = 0;
	var sum = 0;

	for(var i = 2; i <= 200; i++)
	{
		process.stdout.write("[" + symbol + "|DATA_WRITE] UPDATING SMAs [" + (i / 2) + "%] COMPLETE\r");

		for(var j = 0; j < i; j++)	//GET FIRST SMA AND WRITE IT TO FILE
			sum += grabber.getCloseOnDate(dates[j]);

		prevSMA = sum / i;	//CALCULATE FIRST SMA
		var json = getTechnicalRawJson(symbol, dates[i - 1], data_dir);	//WRITE FIRST SMA
		json.smas[(i / 2) - 1] = prevSMA.toFixed(2);			//TO FILE

		for(var j = i; j < dates.length; j++)
		{
			var newDay = grabber.getCloseOnDate(dates[j]) / i;
			var oldDay = grabber.getCloseOnDate(dates[j - i]) / i;
			currSMA = prevSMA + newDay - oldDay;

			var json = getTechnicalRawJson(symbol, dates[j], data_dir);
			json.smas[(i / 2) - 1] = currSMA.toFixed(2);
			writeTechnicalRawJson(symbol, dates[j], json, data_dir);
			prevSMA = currSMA;
		}

		sum = prevSMA = currSMA = 0;	//RESET VALUES FOR NEXT LOOP
		i++;	//INCREMENTS EACH LOOP BY ONE (2,4,6...200)
	}
	console.log();
}

/* Converts obtained JSON from 'Yahoo Finance' to native format */
function convertRawFormat(input)
{
	var output = JSON.parse('{}');
	for(var i = 0; i < input.length; i++)
	{
		var date = JSON.stringify(input[i].date);
		date = date.substring(1, date.indexOf("T"));
		output[date] = JSON.parse('{}');
		output[date].open = JSON.stringify(input[i].open);
		output[date].high = JSON.stringify(input[i].high);
		output[date].low = JSON.stringify(input[i].low);
		output[date].close = JSON.stringify(input[i].close);
		output[date].volume = JSON.stringify(input[i].volume);
		output[date].adjClose = JSON.stringify(input[i].adjClose);
	}
	return output;
}

/* Writes to a Technical JSON file of a stock symbol on a date
 * 'symbol' - stock symbol | 'date' - formatted date string
 * 'json' - json object to write
 */
function writeTechnicalRawJson(symbol, date, json, data_dir)
{
	fs.writeFileSync(data_dir + symbol + '/' + date + ".json", JSON.stringify(json, null, 4));
}

/* Reads a Technical JSON file of a stock symbol on a date
 * 'symbol' - stock symbol | 'date' - formatted date string
 * 'return' - json object
 */
function getTechnicalRawJson(symbol, date, data_dir)
{
	var path = data_dir + symbol + '/' + date + '.json';
	return JSON.parse(fs.readFileSync(path, 'utf8'));
}

/* Returns the defined template file for technical data */
function getTemplateJson(data_dir)
{
	var path = data_dir + 'template.json';
	return JSON.stringify(JSON.parse(fs.readFileSync(path, 'utf8')), null, 4);
}

/* Returns the current date in format 'YYYY-MM-DD' */
function getCurrentDate()
{
	var result = new Date().toISOString();
	result = result.substring(0, result.indexOf("T"));
	return result;
}

module.exports = HistoricalStock;