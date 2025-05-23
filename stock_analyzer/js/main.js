// Placeholder for DOM elements (will be properly selected later)
const apiKeyInput = document.getElementById('apiKey');
const stockSymbolsInput = document.getElementById('stockSymbols');
const pumpThresholdInput = document.getElementById('pumpThreshold');
const timeWindowInput = document.getElementById('timeWindow');
const startAnalysisBtn = document.getElementById('startAnalysisBtn');
const resultsOutput = document.getElementById('resultsOutput');
const loadingIndicator = document.getElementById('loading-indicator');
const errorMessageDiv = document.getElementById('error-message');
const errorText = document.getElementById('errorText');

if (apiKeyInput) {
    apiKeyInput.value = 'lkEqy8gau18rNXqJ8sLhKIYw1mCMRNcw';
}

// FMP uses direct field names: date, open, high, low, close, adjClose, volume.

/**
 * Calculates the percentage change from an opening price to a high price.
 * @param {number} openPrice The opening price.
 * @param {number} highPrice The highest price.
 * @returns {number} The percentage change (e.g., 0.3 for 30%).
 */
function calculatePriceIncreasePercentage(openPrice, highPrice) {
    if (openPrice <= 0) return 0; // Avoid division by zero or negative open price issues
    return (highPrice - openPrice) / openPrice;
}

/**
 * Finds stocks that have pumped above a given threshold in a specified time window.
 * @param {string[]} stockSymbols An array of stock symbols.
 * @param {string} apiKey The FMP API key.
 * @param {number} threshold The pump threshold (e.g., 0.3 for 30%).
 * @param {string} timeWindow 'daily' or 'weekly'.
 * @returns {Promise<Array>} A promise that resolves to an array of pumped stock information.
 */
async function findPumpedStocks(stockSymbols, apiKey, threshold, timeWindow) {
    const pumpedStocks = [];
    resultsOutput.innerHTML = '<p class="text-gray-500">Fetching data and analyzing...</p>'; 
    loadingIndicator.classList.remove('hidden');
    errorMessageDiv.classList.add('hidden');
    clearError(); 

    for (const symbol of stockSymbols) {
        if (!symbol.trim()) continue; 

        try {
            updateResultsStatus(`Fetching data for ${symbol.trim()}...`); 
            const rawFMPData = await fetchStockDataFMP(symbol.trim(), apiKey); 

            if (!rawFMPData || rawFMPData.length === 0) {
                console.warn(`No daily data found for ${symbol.trim()} from FMP.`);
                updateResultsStatus(`No daily data found for ${symbol.trim()}. Skipping.`); 
                continue; 
            }

            const historicalData = rawFMPData.reverse(); // Oldest first

            const dailyData = {}; // Object keyed by date
            historicalData.forEach(item => {
                dailyData[item.date] = {
                    'date': item.date,
                    'open': item.open,
                    'high': item.high,
                    'low': item.low,
                    'close': item.close,
                    'adjustedClose': item.adjClose !== undefined ? item.adjClose : item.close,
                    'volume': item.volume
                };
            });

            updateResultsStatus(`Analyzing ${symbol.trim()} for ${timeWindow} pumps...`); 

            if (timeWindow === 'daily') {
                for (const dateKey in dailyData) { 
                    const dayDataForDate = dailyData[dateKey];
                    const openPrice = parseFloat(dayDataForDate.open);
                    const highPrice = parseFloat(dayDataForDate.high);
                    
                    const pumpPercentage = calculatePriceIncreasePercentage(openPrice, highPrice);

                    if (pumpPercentage >= threshold) {
                        pumpedStocks.push({
                            symbol: symbol.trim(),
                            date: dateKey, 
                            open: openPrice,
                            high: highPrice,
                            pumpPercentage: pumpPercentage,
                            timeWindow: 'daily',
                            dailyData: dailyData, 
                            historicalDataArray: historicalData 
                        });
                    }
                }
            } else if (timeWindow === 'weekly') {
                const weeklyDataAggregated = {}; 
                const sortedDates = Object.keys(dailyData).sort((a, b) => new Date(a) - new Date(b));

                for (const dateStr of sortedDates) {
                    const dayObject = dailyData[dateStr]; 
                    const date = new Date(dateStr);
                    const dayOfWeek = date.getDay(); 
                    
                    const weekStartDate = new Date(date);
                    weekStartDate.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); 
                    const weekStartDateStr = weekStartDate.toISOString().split('T')[0];

                    if (!weeklyDataAggregated[weekStartDateStr]) {
                        weeklyDataAggregated[weekStartDateStr] = {
                            open: parseFloat(dayObject.open), 
                            high: parseFloat(dayObject.high),
                            low: parseFloat(dayObject.low),
                            close: parseFloat(dayObject.close), 
                            volume: 0, 
                            startDate: dateStr, 
                            endDate: dateStr 
                        };
                    }
                    
                    weeklyDataAggregated[weekStartDateStr].high = Math.max(weeklyDataAggregated[weekStartDateStr].high, parseFloat(dayObject.high));
                    weeklyDataAggregated[weekStartDateStr].low = Math.min(weeklyDataAggregated[weekStartDateStr].low, parseFloat(dayObject.low));
                    weeklyDataAggregated[weekStartDateStr].close = parseFloat(dayObject.close); 
                    weeklyDataAggregated[weekStartDateStr].endDate = dateStr; 
                    weeklyDataAggregated[weekStartDateStr].volume += parseFloat(dayObject.volume);
                }

                for (const weekStartDateStr in weeklyDataAggregated) {
                    const weekData = weeklyDataAggregated[weekStartDateStr];
                    const openPrice = weekData.open; 
                    const highPrice = weekData.high; 

                    const pumpPercentage = calculatePriceIncreasePercentage(openPrice, highPrice);

                    if (pumpPercentage >= threshold) {
                        pumpedStocks.push({
                            symbol: symbol.trim(),
                            date: weekStartDateStr, 
                            actualWeekTradingStartDate: weekData.startDate, 
                            actualWeekTradingEndDate: weekData.endDate,
                            open: openPrice,
                            high: highPrice,
                            pumpPercentage: pumpPercentage,
                            timeWindow: 'weekly',
                            dailyData: dailyData,
                            historicalDataArray: historicalData 
                        });
                    }
                }
            }
            updateResultsStatus(`Finished analyzing ${symbol.trim()}.`);

        } catch (error) {
            console.error(`Error processing ${symbol.trim()}:`, error);
            displayError(`Error processing ${symbol.trim()}: ${error.message}. Check console for more details.`);
        }
    }
    loadingIndicator.classList.add('hidden');
    if (pumpedStocks.length === 0 && !errorMessageDiv.classList.contains('hidden')) {
         updateResultsStatus('No stocks found matching the pump criteria.');
    } else if (pumpedStocks.length === 0 && errorMessageDiv.classList.contains('hidden')) {
         updateResultsStatus('No stocks found matching the pump criteria. Some symbols may have caused errors.');
    }
    return pumpedStocks;
}

// --- Technical Indicator Helper Functions ---

/**
 * Calculates the Simple Moving Average (SMA).
 * @param {number[]} dataArray Array of numbers (e.g., closing prices).
 * @param {number} period The SMA period (e.g., 20 for 20-day SMA).
 * @returns {Array<number|null>} Array of SMA values, padded with nulls at the start.
 */
function calculateMovingAverage(dataArray, period) {
    if (!dataArray || dataArray.length < period) {
        return new Array(dataArray ? dataArray.length : 0).fill(null);
    }
    const sma = [];
    for (let i = 0; i < dataArray.length - period + 1; i++) {
        const sum = dataArray.slice(i, i + period).reduce((acc, val) => acc + val, 0);
        sma.push(sum / period);
    }
    const padding = new Array(period - 1).fill(null);
    return padding.concat(sma);
}


/**
 * Calculates the standard deviation of a series of numbers.
 * @param {number[]} numbersArray Array of numbers.
 * @returns {number|null} The standard deviation, or null if not enough data.
 */
function calculateStandardDeviation(numbersArray) {
    if (!numbersArray || numbersArray.length < 2) { 
        return null; 
    }
    const n = numbersArray.length;
    const mean = numbersArray.reduce((acc, val) => acc + val, 0) / n;
    const variance = numbersArray.reduce((acc, val) => acc + (val - mean) ** 2, 0) / (n - 1); // Sample variance
    return Math.sqrt(variance);
}

/**
 * Calculates the Relative Strength Index (RSI).
 * @param {number[]} prices Array of closing prices.
 * @param {number} [period=14] The RSI period.
 * @returns {Array<number|null>} Array of RSI values, aligned with input prices (leading nulls).
 */
function calculateRSI(prices, period = 14) {
    if (!prices || prices.length < period + 1) { 
        return new Array(prices ? prices.length : 0).fill(null);
    }

    const rsiValues = new Array(prices.length).fill(null);
    let avgGain = 0;
    let avgLoss = 0;

    // Calculate initial average gain and loss
    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i-1];
        if (change > 0) {
            avgGain += change;
        } else {
            avgLoss -= change; // avgLoss is positive
        }
    }
    avgGain /= period;
    avgLoss /= period;

    // First RSI value
    if (avgLoss === 0) {
        rsiValues[period] = 100;
    } else {
        const rs = avgGain / avgLoss;
        rsiValues[period] = 100 - (100 / (1 + rs));
    }
    
    // Subsequent RSI values using Wilder's smoothing
    for (let i = period + 1; i < prices.length; i++) {
        const change = prices[i] - prices[i-1];
        let gain = 0;
        let loss = 0;
        if (change > 0) {
            gain = change;
        } else {
            loss = -change;
        }

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        if (avgLoss === 0) {
            rsiValues[i] = 100;
        } else {
            const rs = avgGain / avgLoss;
            rsiValues[i] = 100 - (100 / (1 + rs));
        }
    }
    return rsiValues; 
}

/**
 * Analyzes the stock's performance after a detected pump.
 * @param {Object} pumpInfo Information about the pump.
 * @returns {Object} Analysis of post-pump trends.
 */
function analyzePostPumpTrend(pumpInfo) {
    const { symbol, date: pumpDateStr, dailyData, historicalDataArray } = pumpInfo; 
    
    const trends = {
        nextDay: { changePercent: null, high: null, low: null, details: "Data unavailable", volatility: null, rsi: null, maCrossover: { status: "N/A", shortMA: null, longMA: null } },
        nextWeek: { changePercent: null, high: null, low: null, details: "Data unavailable", volatility: null, rsi: null, maCrossover: { status: "N/A", shortMA: null, longMA: null } },
        nextMonth: { changePercent: null, high: null, low: null, details: "Data unavailable", volatility: null, rsi: null, maCrossover: { status: "N/A", shortMA: null, longMA: null } }
    };

    if (!historicalDataArray || historicalDataArray.length === 0) {
        console.error(`No historicalDataArray provided for trend analysis of ${symbol} on ${pumpDateStr}`);
        return trends;
    }

    const pumpDateIndexInArray = historicalDataArray.findIndex(item => item.date === pumpDateStr);

    if (pumpDateIndexInArray === -1) {
        console.error(`Pump date ${pumpDateStr} not found in historicalDataArray for ${symbol}.`);
        return trends;
    }

    const pumpDayObject = historicalDataArray[pumpDateIndexInArray];
    const pumpDayReferencePrice = parseFloat(pumpDayObject.adjClose !== undefined ? pumpDayObject.adjClose : pumpDayObject.close);
    if (isNaN(pumpDayReferencePrice)) {
        console.error(`Invalid reference price for pump on ${pumpDateStr} for ${symbol}.`);
        return trends;
    }

    function getClosingPricesForPeriod(startIndex, numDays) {
        const prices = [];
        for (let i = 0; i < numDays; i++) {
            const currentIndex = startIndex + i;
            if (currentIndex < historicalDataArray.length) {
                const day = historicalDataArray[currentIndex];
                prices.push(parseFloat(day.adjClose !== undefined ? day.adjClose : day.close));
            } else {
                break; 
            }
        }
        return prices;
    }
    
    function getDailyReturnsForPeriod(startIndex, numDaysInPeriod) {
        const returns = [];
        const prices = getClosingPricesForPeriod(Math.max(0, startIndex -1), numDaysInPeriod + 1);         
        if (prices.length < 2) return returns; 
        for (let i = 1; i < prices.length; i++) {
            if (prices[i-1] !== 0 && !isNaN(prices[i]) && !isNaN(prices[i-1])) {
                returns.push((prices[i] - prices[i-1]) / prices[i-1]);
            } else {
                returns.push(0); 
            }
        }
        return returns;
    }

    function analyzePeriod(periodName, postPumpStartIndexInArray, numDaysInAnalysisPeriod) {
        const periodTrend = { 
            changePercent: null, high: null, low: null, details: "Not enough subsequent data", 
            volatility: null, rsi: null, maCrossover: { status: "N/A", shortMA: null, longMA: null }, daysAvailable: 0, endDate: null 
        };

        const actualDataForPeriod = historicalDataArray.slice(postPumpStartIndexInArray, postPumpStartIndexInArray + numDaysInAnalysisPeriod);
        if (actualDataForPeriod.length === 0) return periodTrend;

        periodTrend.daysAvailable = actualDataForPeriod.length;
        periodTrend.endDate = actualDataForPeriod[actualDataForPeriod.length - 1].date;
        
        let periodHigh = -Infinity;
        let periodLow = Infinity;
        actualDataForPeriod.forEach(day => {
            periodHigh = Math.max(periodHigh, parseFloat(day.high));
            periodLow = Math.min(periodLow, parseFloat(day.low));
        });
        periodTrend.high = periodHigh;
        periodTrend.low = periodLow;

        const endPriceData = actualDataForPeriod[actualDataForPeriod.length - 1];
        const endPrice = parseFloat(endPriceData.adjClose !== undefined ? endPriceData.adjClose : endPriceData.close);

        if (!isNaN(endPrice)) {
            periodTrend.changePercent = (endPrice - pumpDayReferencePrice) / pumpDayReferencePrice;
            periodTrend.details = `${actualDataForPeriod.length} days of data found, ending ${periodTrend.endDate}.`;
        } else {
            periodTrend.details = "End price data missing for period.";
        }

        if (actualDataForPeriod.length >= 2) { 
            const dailyReturns = getDailyReturnsForPeriod(postPumpStartIndexInArray, actualDataForPeriod.length);
            if (dailyReturns.length >= 2) { 
                 periodTrend.volatility = calculateStandardDeviation(dailyReturns);
            } else {
                 periodTrend.volatility = null; 
            }
        } else {
            periodTrend.volatility = null; 
        }

        const rsiLookbackPeriod = 14;
        const rsiDataEndIndexInHistorical = postPumpStartIndexInArray + actualDataForPeriod.length - 1;
        const rsiCalculationStartDateIndex = Math.max(0, rsiDataEndIndexInHistorical - rsiLookbackPeriod - 20); 
        
        const pricesForRSICalculation = getClosingPricesForPeriod(
            rsiCalculationStartDateIndex, 
            (rsiDataEndIndexInHistorical - rsiCalculationStartDateIndex + 1)
        );

        if (pricesForRSICalculation.length >= rsiLookbackPeriod + 1) {
            const rsiValues = calculateRSI(pricesForRSICalculation, rsiLookbackPeriod);
            periodTrend.rsi = rsiValues[rsiValues.length - 1]; 
        } else {
            periodTrend.rsi = null;
        }
        
        // **Calculate MA Crossovers** 
        const shortMAPeriod = 10;
        const longMAPeriod = 20;
        const maDataNeededForLongest = longMAPeriod; 
        
        const currentPeriodEndIndexInHistorical = postPumpStartIndexInArray + actualDataForPeriod.length - 1;
        
        const pricesForMAEntireHistoryUpToPeriodEnd = getClosingPricesForPeriod(
            0, 
            currentPeriodEndIndexInHistorical + 1 
        );

        if (pricesForMAEntireHistoryUpToPeriodEnd.length >= maDataNeededForLongest) {
            const shortMAValues = calculateMovingAverage(pricesForMAEntireHistoryUpToPeriodEnd, shortMAPeriod);
            const longMAValues = calculateMovingAverage(pricesForMAEntireHistoryUpToPeriodEnd, longMAPeriod);
            
            const lastShortMA = shortMAValues[shortMAValues.length - 1];
            const lastLongMA = longMAValues[longMAValues.length - 1];

            if (lastShortMA !== null && lastLongMA !== null) {
                periodTrend.maCrossover = {
                    shortMA: lastShortMA,
                    longMA: lastLongMA,
                    status: lastShortMA > lastLongMA ? "Golden" : (lastShortMA < lastLongMA ? "Death" : "Neutral")
                };
            } else {
                 periodTrend.maCrossover = { status: "Data insufficient", shortMA: null, longMA: null };
            }
        } else {
            periodTrend.maCrossover = { status: "Data insufficient", shortMA: null, longMA: null };
        }
        
        return periodTrend;
    }

    const postPumpActualStartIndex = pumpDateIndexInArray + 1;

    if (postPumpActualStartIndex < historicalDataArray.length) {
        trends.nextDay = analyzePeriod('nextDay', postPumpActualStartIndex, 1);
        trends.nextWeek = analyzePeriod('nextWeek', postPumpActualStartIndex, 5); 
        trends.nextMonth = analyzePeriod('nextMonth', postPumpActualStartIndex, 21); 
    }
    
    return trends;
}


// --- UI Update Functions ---

function displayFullResults(analysisResults) {
    resultsOutput.innerHTML = ''; 
    if (!analysisResults || analysisResults.length === 0) {
        resultsOutput.innerHTML = '<p class="text-gray-600 p-4">No pump instances found matching your criteria, or data was insufficient for analysis.</p>';
        return;
    }

    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'space-y-6'; 

    analysisResults.forEach(result => {
        const stockCard = document.createElement('div');
        stockCard.className = 'bg-white p-6 rounded-lg shadow-lg border border-gray-200';

        let pumpDateDisplay = result.date;
        if (result.timeWindow === 'weekly' && result.actualWeekTradingStartDate && result.actualWeekTradingEndDate) {
            pumpDateDisplay = `${result.date} (Week: ${result.actualWeekTradingStartDate} to ${result.actualWeekTradingEndDate})`;
        }

        let initialHTML = `
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 pb-2 border-b border-gray-200">
                <div><h3 class="text-2xl font-bold text-indigo-700">${result.symbol}</h3><p class="text-sm text-gray-500">Pump Detected on: ${pumpDateDisplay}</p></div>
                <div class="mt-2 md:mt-0 md:text-right"><p class="text-xl font-semibold ${result.pumpPercentage >= 0 ? 'text-green-600' : 'text-red-600'}">${(result.pumpPercentage * 100).toFixed(2)}% ${result.timeWindow === 'daily' ? 'Day' : 'Week'} Pump</p><p class="text-xs text-gray-500">Open: ${result.open.toFixed(2)}, High: ${result.high.toFixed(2)}</p></div>
            </div>
            <h4 class="text-lg font-semibold text-gray-700 mb-3">Post-Pump Trend Analysis:</h4>`;
        stockCard.innerHTML = initialHTML;

        // Table for Price/High/Low/Details
        const trendsTable = document.createElement('table');
        trendsTable.className = 'min-w-full divide-y divide-gray-200 mb-4';
        let trendsTableBodyHTML = `<tbody class="bg-white divide-y divide-gray-200">`; 
        
        const periods = ['nextDay', 'nextWeek', 'nextMonth'];
        const periodNames = {'nextDay': 'Next Day', 'nextWeek': 'Next Week', 'nextMonth': 'Next Month'};
        
        periods.forEach(periodKey => {
            const trend = result.trends[periodKey];
            const changePercentText = trend.changePercent !== null ? `${(trend.changePercent * 100).toFixed(2)}%` : 'N/A';
            const highText = trend.high !== null && trend.high !== -Infinity ? trend.high.toFixed(2) : 'N/A';
            const lowText = trend.low !== null && trend.low !== Infinity ? trend.low.toFixed(2) : 'N/A';
            const detailsText = trend.details || 'N/A';
            const rowClass = trend.changePercent === null ? 'text-gray-400' : (trend.changePercent >= 0 ? 'text-green-700' : 'text-red-700');
            
            trendsTableBodyHTML += `
                <tr class="${rowClass}">
                    <td class="px-3 py-2 whitespace-nowrap text-sm font-medium ${rowClass === 'text-gray-400' ? 'text-gray-400' :'text-gray-900'}">${periodNames[periodKey]} (${trend.daysAvailable}d)</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm">${changePercentText}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm">${highText}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm">${lowText}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-xs">${detailsText}</td>
                </tr>`;
        });
        trendsTableBodyHTML += `</tbody>`;
        trendsTable.innerHTML = `<thead class="bg-gray-50"><tr>
                                <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                                <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Change</th>
                                <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">High</th>
                                <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Low</th>
                                <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                             </tr></thead>` + trendsTableBodyHTML;
        stockCard.appendChild(trendsTable);

        // Title for Technical Indicators Table
        const indicatorsTitle = document.createElement('h4');
        indicatorsTitle.className = "text-lg font-semibold text-gray-700 mt-4 mb-2";
        indicatorsTitle.textContent = "Technical Indicators at Period End:";
        stockCard.appendChild(indicatorsTitle);

        // Table for Technical Indicators
        const indicatorsTable = document.createElement('table');
        indicatorsTable.className = 'min-w-full divide-y divide-gray-200 mb-4';
        let indicatorsTableBodyHTML = `<tbody class="bg-white divide-y divide-gray-200">`;

        periods.forEach(periodKey => {
            const trend = result.trends[periodKey];
            const volatilityText = trend.volatility !== null && !isNaN(trend.volatility) ? `${(trend.volatility * 100).toFixed(2)}%` : 'N/A';
            const rsiText = trend.rsi !== null && !isNaN(trend.rsi) ? trend.rsi.toFixed(2) : 'N/A';
            let maText = 'N/A';
            if (trend.maCrossover) {
                if (trend.maCrossover.status === "Golden" || trend.maCrossover.status === "Death" || trend.maCrossover.status === "Neutral") {
                     maText = `${trend.maCrossover.status} (S:${trend.maCrossover.shortMA !== null ? trend.maCrossover.shortMA.toFixed(2) : 'N/A'}, L:${trend.maCrossover.longMA !== null ? trend.maCrossover.longMA.toFixed(2) : 'N/A'})`;
                } else {
                    maText = trend.maCrossover.status; 
                }
            }

            indicatorsTableBodyHTML += `<tr>
                                     <td class="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">${periodNames[periodKey]} (${trend.daysAvailable}d)</td>
                                     <td class="px-3 py-2 whitespace-nowrap text-sm">${volatilityText}</td>
                                     <td class="px-3 py-2 whitespace-nowrap text-sm">${rsiText}</td>
                                     <td class="px-3 py-2 whitespace-nowrap text-sm">${maText}</td>
                                   </tr>`;
        });
        indicatorsTableBodyHTML += `</tbody>`;
        indicatorsTable.innerHTML = `<thead class="bg-gray-50"><tr>
                                     <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                                     <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volatility</th>
                                     <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RSI (14)</th>
                                     <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MA (10/20)</th>
                                   </tr></thead>` + indicatorsTableBodyHTML;
        stockCard.appendChild(indicatorsTable);


        const chartCanvasId = `chart-${result.symbol.replace(/[^a-zA-Z0-9]/g, '')}-${result.date.replace(/[^a-zA-Z0-9]/g, '')}`;
        const chartDiv = document.createElement('div');
        chartDiv.className = 'mt-6'; 
        chartDiv.innerHTML = `<h4 class="text-md font-semibold text-gray-700 mb-2 text-center">Price and Volume Chart (Loading...)</h4><canvas id="${chartCanvasId}"></canvas>`;
        stockCard.appendChild(chartDiv);

        if (result.historicalDataArray && result.historicalDataArray.length > 0) {
            setTimeout(() => { 
                renderStockChart(chartCanvasId, result.historicalDataArray, result.date, result.symbol);
            }, 0);
        } else {
            console.warn(`Chart data (historicalDataArray) not available for ${result.symbol} on ${result.date}.`);
            const chartCanvasElement = document.getElementById(chartCanvasId);
            if (chartCanvasElement && chartCanvasElement.parentElement) {
                chartCanvasElement.parentElement.innerHTML = '<p class="text-xs text-red-500 text-center py-4">Chart data was not properly passed for this entry.</p>';
            }
        }
        resultsContainer.appendChild(stockCard);
    });
    resultsOutput.appendChild(resultsContainer);
}

/**
 * Renders a stock chart with price, volume, and pump highlight.
 * @param {string} canvasId The ID of the canvas element.
 * @param {Array} historicalData The array of daily data objects (oldest first, from FMP).
 * @param {string} pumpDateStr The date of the pump (YYYY-MM-DD).
 * @param {string} symbol The stock symbol.
 */
function renderStockChart(canvasId, historicalData, pumpDateStr, symbol) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas element with ID ${canvasId} not found.`);
        return;
    }
    const ctx = canvas.getContext('2d');

    const pumpDateIndex = historicalData.findIndex(item => item.date === pumpDateStr);
    if (pumpDateIndex === -1) {
        console.error(`Pump date ${pumpDateStr} not found in historical data for ${symbol} chart.`);
        canvas.parentElement.innerHTML = '<p class="text-xs text-red-500 text-center py-4">Could not find pump date in data for chart.</p>';
        return;
    }

    const daysBefore = 30; 
    const daysAfter = 60;  

    const chartDataStart = Math.max(0, pumpDateIndex - daysBefore);
    const chartDataEnd = Math.min(historicalData.length, pumpDateIndex + daysAfter + 1);
    const chartDisplayData = historicalData.slice(chartDataStart, chartDataEnd);

    if (chartDisplayData.length === 0) {
        console.error(`No data available for chart for symbol ${symbol} around pump date ${pumpDateStr}.`);
        canvas.parentElement.innerHTML = '<p class="text-xs text-red-500 text-center py-4">Not enough data to display chart.</p>';
        return;
    }
    
    const labels = chartDisplayData.map(item => item.date);
    const closePrices = chartDisplayData.map(item => item.close);
    const volumes = chartDisplayData.map(item => item.volume);

    const pumpDateChartIndex = chartDisplayData.findIndex(item => item.date === pumpDateStr);
    
    const pointBackgroundColors = [];
    if (pumpDateChartIndex !== -1) {
        for (let i = 0; i < chartDisplayData.length; i++) {
            if (i === pumpDateChartIndex) {
                pointBackgroundColors.push('rgba(255, 99, 132, 1)'); 
            } else {
                pointBackgroundColors.push('rgba(75, 192, 192, 0.5)'); 
            }
        }
    }

    if (canvas.chartInstance) {
        canvas.chartInstance.destroy();
    }

    canvas.chartInstance = new Chart(ctx, {
        type: 'bar', 
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: `${symbol} Close Price`,
                    data: closePrices,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    yAxisID: 'yPrice',
                    tension: 0.1,
                    pointRadius: 3,
                    pointBackgroundColor: pointBackgroundColors, 
                    pointBorderColor: pointBackgroundColors,
                },
                {
                    type: 'bar',
                    label: `${symbol} Volume`,
                    data: volumes,
                    backgroundColor: 'rgba(153, 102, 255, 0.6)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    yAxisID: 'yVolume',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true, 
            interaction: {
                mode: 'index',
                intersect: false,
            },
            stacked: false, 
            scales: {
                x: { title: { display: true, text: 'Date' } },
                yPrice: { 
                    type: 'linear', display: true, position: 'left',
                    title: { display: true, text: 'Price (USD)' }
                },
                yVolume: { 
                    type: 'linear', display: true, position: 'right',
                    title: { display: true, text: 'Volume' },
                    grid: { drawOnChartArea: false, },
                    ticks: {
                         callback: function(value) {
                             if (value >= 1000000) return (value / 1000000) + 'M';
                             if (value >= 1000) return (value / 1000) + 'K';
                             return value;
                         }
                     }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) { label += ': '; }
                            if (context.parsed.y !== null) {
                                if (context.dataset.yAxisID === 'yVolume') {
                                    let vol = context.parsed.y;
                                    if (vol >= 1000000) label += (vol / 1000000).toFixed(2) + 'M';
                                    else if (vol >= 1000) label += (vol / 1000).toFixed(2) + 'K';
                                    else label += vol;
                                } else {
                                    label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                                }
                            }
                            return label;
                        }
                    }
                },
                legend: { position: 'top', },
                title: { 
                     display: true, text: `Stock Performance for ${symbol} (Around Pump on ${pumpDateStr})`,
                     padding: { top: 10, bottom:10 }, font: { size: 16 }
                }
            }
        }
    });
    
    const chartHeading = canvas.parentElement.querySelector('h4');
    if(chartHeading) chartHeading.textContent = `Price and Volume Chart for ${symbol}`;
}

function updateResultsStatus(message) {
    console.log(message);
    resultsOutput.innerHTML = `<p class="text-gray-600 p-4">${message}</p>`; 
}

function displayError(message) {
    errorText.textContent = message;
    errorMessageDiv.classList.remove('hidden');
}

function clearError() {
    errorMessageDiv.classList.add('hidden');
    errorText.textContent = '';
}

if (startAnalysisBtn) {
    startAnalysisBtn.addEventListener('click', async () => {
        clearError();
        resultsOutput.innerHTML = ''; 

        const apiKey = apiKeyInput.value.trim();
        const symbolsText = stockSymbolsInput.value.trim();
        const thresholdPercent = parseFloat(pumpThresholdInput.value);
        const selectedTimeWindow = timeWindowInput.value;

        if (!apiKey) { displayError("API key is required."); return; }
        if (!symbolsText) { displayError("Stock symbols are required."); return; }
        if (isNaN(thresholdPercent) || thresholdPercent <= 0) { displayError("Pump threshold must be a positive number."); return; }

        const stockSymbols = symbolsText.split(',').map(s => s.trim()).filter(s => s);
        const threshold = thresholdPercent / 100; 

        console.log("Analysis started via button click..."); 
        const pumpedStocks = await findPumpedStocks(stockSymbols, apiKey, threshold, selectedTimeWindow);
        
        if (pumpedStocks.length > 0) {
            updateResultsStatus(`Found ${pumpedStocks.length} pump instance(s). Analyzing post-pump trends...`);
            const analysisResults = [];
            for (const pump of pumpedStocks) {
                const trendAnalysis = analyzePostPumpTrend(pump); 
                analysisResults.push({ ...pump, trends: trendAnalysis });
            }
            console.log("Full Analysis Results:", analysisResults);
            if (analysisResults.length > 0) {
                displayFullResults(analysisResults); 
            } else if (pumpedStocks.length > 0 && analysisResults.length === 0) {
                resultsOutput.innerHTML = '<p class="text-gray-600 p-4">Pumps were detected, but trend analysis could not be completed or yielded no data.</p>';
            }
        } else if (!errorMessageDiv.classList.contains('hidden')) {
            // Errors handled by displayError or findPumpedStocks's updateResultsStatus
        } else {
            displayFullResults([]); // Handles "No pump instances found..."
        }
    });
} else {
    console.error("startAnalysisBtn not found. Ensure IDs in HTML and JS match.");
}
