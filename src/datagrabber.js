var fs = require('fs');

/** 
 * 		*DataGrabber*
 *
 * Parses data from a stock *symbol
 **/
function DataGrabber(symbol, data_dir)
{
	this.symbol = symbol;
	this.data_dir = data_dir;
	this.json = this.getRawJson(symbol);
}

DataGrabber.prototype.getMFIOnDate = function(date)
{
	return this.getTechnicalJson(this.symbol, date).mfi;
}

DataGrabber.prototype.getOBVOnDate = function(date)
{
	return this.getTechnicalJson(this.symbol, date).obv;
}

DataGrabber.prototype.getRSIOnDate = function(date)
{
	return this.getTechnicalJson(this.symbol, date).rsi;
}

DataGrabber.prototype.getEMAOnDate = function(date, size)
{
	var emas = this.getTechnicalJson(this.symbol, date).emas;
	return emas[Math.round((size / 2) - 1)];
}

DataGrabber.prototype.getSMAOnDate = function(date, size)
{
	var smas = this.getTechnicalJson(this.symbol, date).smas;
	return smas[Math.round((size / 2) - 1)];
}

DataGrabber.prototype.getCloseOnDate = function(date)
{
	var data = this.getRawDataOnDate(date);
	if(data != undefined)
		return parseFloat(data.close);
	return -1;
}

DataGrabber.prototype.isGreenDay = function(pDate, cDate)
{
	return (this.getCloseOnDate(cDate) >= this.getCloseOnDate(pDate));
}

DataGrabber.prototype.getVolumeOnDate = function(date)
{
	var data = this.getRawDataOnDate(date);
	if(data != undefined)
		return parseInt(data.volume);
	return -1;
}

DataGrabber.prototype.getHighOnDate = function(date)
{
	var data = this.getRawDataOnDate(date);
	if(data != undefined)
		return parseFloat(data.high);
	return -1;
}

DataGrabber.prototype.getLowOnDate = function(date)
{
	var data = this.getRawDataOnDate(date);
	if(data != undefined)
		return parseFloat(data.low);
	return -1;
}

DataGrabber.prototype.getOpenOnDate = function(date)
{
	var data = this.getRawDataOnDate(date);
	if(data != undefined)
		return parseFloat(data.open);
	return -1;
}

DataGrabber.prototype.getTypicalPriceOnDate = function(date)
{
	var close = this.getCloseOnDate(date);
	var high = this.getHighOnDate(date);
	var low = this.getLowOnDate(date);
	return ((high + low + close) / 3).toFixed(2);
}

DataGrabber.prototype.getRawMoneyFlowOnDate = function(date)
{
	return Math.round(this.getTypicalPriceOnDate(date) * this.getVolumeOnDate(date));
}

DataGrabber.prototype.getRawDataOnDate = function(date)
{
	var data = this.json[date];
	if(data != undefined)
		return data;
	console.error("ERROR ----- (" + date + ") IS NOT A TRADING DAY");
}

DataGrabber.prototype.getAllDates = function()
{
	return Object.keys(this.json);
}

DataGrabber.prototype.getAllDatesFrom = function(date)
{
	var dates = Object.keys(this.json);
	var startIndex = dates.indexOf(date);
	if(startIndex != -1)
		return dates.slice(startIndex);
	else
	{
		System.out.println("DATE [" + date + "] NOT A TRADING A DAY");
		process.exit();
	}
}

DataGrabber.prototype.getAllDatesInRange = function(date1, date2)
{
	var dates = Object.keys(this.json);
	var startIndex = dates.indexOf(date1);
	var endIndex = dates.indexOf(date2);
	if(startIndex != -1 && startIndex != -1)
		return dates.slice(startIndex, endIndex + 1);
	else if(startIndex == -1)
	{
		System.out.println("DATE [" + date1 + "] NOT A TRADING A DAY");
		process.exit();
	}
	else if(endIndex == -1)
	{
		System.out.println("DATE [" + date2 + "] NOT A TRADING A DAY");
		process.exit();
	}
}

DataGrabber.prototype.getAllCloses = function()
{
	var dates = this.getAllDates();
	var closes = [];
	for(var i = 0; i < dates.length; i++)
	{
		closes.push(this.json[dates[i]].close);
	}
	return closes;
}

DataGrabber.prototype.getAllVolumes = function()
{
	var dates = this.getAllDates();
	var volumes = [];
	for(var i = 0; i < dates.length; i++)
	{
		volumes.push(this.json[dates[i]].volume);
	}
	return volumes;
}

DataGrabber.prototype.getTechnicalJson = function(symbol, date)
{
	var path = this.data_dir + symbol + '/' + date + '.json';
	return JSON.parse(fs.readFileSync(path, 'utf8'));
}

DataGrabber.prototype.getRawJson = function(symbol)
{
	var path = this.data_dir + symbol + '/raw.json';
	return JSON.parse(fs.readFileSync(path, 'utf8'));
}

module.exports = DataGrabber;