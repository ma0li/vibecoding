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

// --- Constants for Price Data Keys ---
const OPEN_KEY = '1. open';
const HIGH_KEY = '2. high';
const LOW_KEY = '3. low';
const CLOSE_KEY = '4. close';
const ADJUSTED_CLOSE_KEY = '5. adjusted close';
const VOLUME_KEY = '6. volume';
const DIVIDEND_AMOUNT_KEY = '7. dividend amount';
const SPLIT_COEFFICIENT_KEY = '8. split coefficient';


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
 * @param {string} apiKey The Alpha Vantage API key.
 * @param {number} threshold The pump threshold (e.g., 0.3 for 30%).
 * @param {string} timeWindow 'daily' or 'weekly'.
 * @returns {Promise<Array>} A promise that resolves to an array of pumped stock information.
 */
async function findPumpedStocks(stockSymbols, apiKey, threshold, timeWindow) {
    const pumpedStocks = [];
    // Ensure resultsOutput is cleared and shows a basic message at the start of new analysis
    resultsOutput.innerHTML = '<p class="text-gray-500">Fetching data and analyzing...</p>'; 
    loadingIndicator.classList.remove('hidden');
    errorMessageDiv.classList.add('hidden');
    clearError(); // Clear previous errors

    for (const symbol of stockSymbols) {
        if (!symbol.trim()) continue; // Skip empty symbols

        try {
            updateResultsStatus(`Fetching data for ${symbol.trim()}...`);
            const rawData = await fetchStockData(symbol.trim(), apiKey); // from api.js
            const timeSeriesKey = 'Time Series (Daily)'; // Alpha Vantage key for daily data
            const dailyData = rawData[timeSeriesKey];

            if (!dailyData) {
                console.warn(`No daily data found for ${symbol.trim()} in response:`, rawData);
                updateResultsStatus(`No daily data found for ${symbol.trim()}. Skipping.`);
                continue;
            }

            updateResultsStatus(`Analyzing ${symbol.trim()} for ${timeWindow} pumps...`);

            if (timeWindow === 'daily') {
                for (const date in dailyData) {
                    const dayData = dailyData[date];
                    const openPrice = parseFloat(dayData[OPEN_KEY]);
                    const highPrice = parseFloat(dayData[HIGH_KEY]);
                    
                    const pumpPercentage = calculatePriceIncreasePercentage(openPrice, highPrice);

                    if (pumpPercentage >= threshold) {
                        pumpedStocks.push({
                            symbol: symbol.trim(),
                            date: date,
                            open: openPrice,
                            high: highPrice,
                            pumpPercentage: pumpPercentage,
                            timeWindow: 'daily',
                            dailyData: dailyData // Pass along all daily data for this stock for trend analysis
                        });
                    }
                }
            } else if (timeWindow === 'weekly') {
                const weeklyDataAggregated = {}; 

                const sortedDates = Object.keys(dailyData).sort((a, b) => new Date(a) - new Date(b));

                for (const dateStr of sortedDates) {
                    const dayEntry = dailyData[dateStr];
                    const date = new Date(dateStr);
                    const dayOfWeek = date.getDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6
                    
                    const weekStartDate = new Date(date);
                    weekStartDate.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); 
                    const weekStartDateStr = weekStartDate.toISOString().split('T')[0];

                    if (!weeklyDataAggregated[weekStartDateStr]) {
                        weeklyDataAggregated[weekStartDateStr] = {
                            open: parseFloat(dayEntry[OPEN_KEY]), 
                            high: parseFloat(dayEntry[HIGH_KEY]),
                            low: parseFloat(dayEntry[LOW_KEY]),
                            close: parseFloat(dayEntry[CLOSE_KEY]), // Will be updated by the last day of the week
                            volume: 0, // Initialize volume
                            startDate: dateStr, // First actual trading day of this week entry
                            endDate: dateStr // Keep track of the last day processed for this week
                        };
                    }
                    
                    weeklyDataAggregated[weekStartDateStr].high = Math.max(weeklyDataAggregated[weekStartDateStr].high, parseFloat(dayEntry[HIGH_KEY]));
                    weeklyDataAggregated[weekStartDateStr].low = Math.min(weeklyDataAggregated[weekStartDateStr].low, parseFloat(dayEntry[LOW_KEY]));
                    weeklyDataAggregated[weekStartDateStr].close = parseFloat(dayEntry[CLOSE_KEY]); 
                    weeklyDataAggregated[weekStartDateStr].endDate = dateStr; 
                    // Sum volume if needed, though not directly used for pump % calc
                    weeklyDataAggregated[weekStartDateStr].volume += parseFloat(dayEntry[VOLUME_KEY]);
                }

                for (const weekStartDateStr in weeklyDataAggregated) {
                    const weekData = weeklyDataAggregated[weekStartDateStr];
                    // The open for the week is the open of its first trading day (already set)
                    const openPrice = weekData.open; 
                    const highPrice = weekData.high; // Week's highest high

                    const pumpPercentage = calculatePriceIncreasePercentage(openPrice, highPrice);

                    if (pumpPercentage >= threshold) {
                        pumpedStocks.push({
                            symbol: symbol.trim(),
                            // Use the start date of the week (Monday) for consistency
                            date: weekStartDateStr, 
                            // Store the actual start and end trading days of that week if needed for display
                            actualWeekTradingStartDate: weekData.startDate, 
                            actualWeekTradingEndDate: weekData.endDate,
                            open: openPrice,
                            high: highPrice,
                            pumpPercentage: pumpPercentage,
                            timeWindow: 'weekly',
                            dailyData: dailyData // Pass along all daily data for this stock for trend analysis
                        });
                    }
                }
            }
            updateResultsStatus(`Finished analyzing ${symbol.trim()}.`);

        } catch (error) {
            console.error(`Error processing ${symbol.trim()}:`, error);
            // Display the error in the UI
            displayError(`Error processing ${symbol.trim()}: ${error.message}. Check console for more details.`);
            // Continue to the next symbol
        }
    }
    loadingIndicator.classList.add('hidden');
    if (pumpedStocks.length === 0 && !errorMessageDiv.classList.contains('hidden')) {
        // If no errors were shown, and no stocks found, then show no results.
         updateResultsStatus('No stocks found matching the pump criteria.');
    } else if (pumpedStocks.length === 0 && errorMessageDiv.classList.contains('hidden')) {
         updateResultsStatus('No stocks found matching the pump criteria. Some symbols may have caused errors.');
    }
    return pumpedStocks;
}

/**
 * Analyzes the stock's performance after a detected pump.
 * @param {Object} pumpInfo Information about the pump (symbol, date, dailyData).
 * @param {string} apiKey The Alpha Vantage API key (currently unused here as dailyData is passed).
 * @returns {Object} Analysis of post-pump trends (next day, week, month performance).
 */
function analyzePostPumpTrend(pumpInfo) {
    const { symbol, date: pumpDateStr, dailyData } = pumpInfo;
    const trends = {
        nextDay: { changePercent: null, high: null, low: null, details: "Data unavailable" },
        nextWeek: { changePercent: null, high: null, low: null, details: "Data unavailable" },
        nextMonth: { changePercent: null, high: null, low: null, details: "Data unavailable" }
    };

    if (!dailyData) {
        console.error(`No dailyData provided for trend analysis of ${symbol} on ${pumpDateStr}`);
        return trends; // Return default 'Data unavailable'
    }

    const sortedDates = Object.keys(dailyData).sort((a, b) => new Date(a) - new Date(b));
    const pumpDateIndex = sortedDates.indexOf(pumpDateStr);

    if (pumpDateIndex === -1) {
        console.error(`Pump date ${pumpDateStr} not found in sorted daily data for ${symbol}.`);
        return trends;
    }

    const pumpDayData = dailyData[pumpDateStr];
    // Use adjusted close of the pump day as the reference for future calculations
    // Or, alternatively, use the high price of the pump. Let's use adjusted close for now.
    const pumpDayReferencePrice = parseFloat(pumpDayData[ADJUSTED_CLOSE_KEY]); 
    if (isNaN(pumpDayReferencePrice)) {
        console.error(`Invalid reference price for pump on ${pumpDateStr} for ${symbol}.`);
        return trends;
    }

    // Helper to calculate trend
    function calculateTrendForPeriod(startIndex, numDays) {
        const periodData = sortedDates.slice(startIndex, startIndex + numDays);
        if (periodData.length === 0) return { changePercent: null, high: null, low: null, details: "Not enough subsequent data" };

        let periodHigh = -Infinity;
        let periodLow = Infinity;
        
        for (const date of periodData) {
            const dayEntry = dailyData[date];
            periodHigh = Math.max(periodHigh, parseFloat(dayEntry[HIGH_KEY]));
            periodLow = Math.min(periodLow, parseFloat(dayEntry[LOW_KEY]));
        }
        
        const endPrice = parseFloat(dailyData[periodData[periodData.length - 1]][ADJUSTED_CLOSE_KEY]);
        if (isNaN(endPrice)) return { changePercent: null, high: periodHigh, low: periodLow, details: "End price data missing" };

        const changePercent = ((endPrice - pumpDayReferencePrice) / pumpDayReferencePrice);
        return { 
            changePercent: changePercent, 
            high: periodHigh, 
            low: periodLow, 
            daysAvailable: periodData.length,
            endDate: periodData[periodData.length - 1],
            details: `${periodData.length} days of data found.`
        };
    }

    // Next Trading Day
    if (pumpDateIndex + 1 < sortedDates.length) {
        const nextDayTrend = calculateTrendForPeriod(pumpDateIndex + 1, 1);
        trends.nextDay = { ...nextDayTrend, details: `Data for ${sortedDates[pumpDateIndex + 1]}. ${nextDayTrend.details}` };
    }

    // Next Trading Week (approx 5 trading days)
    if (pumpDateIndex + 1 < sortedDates.length) {
        const nextWeekTrend = calculateTrendForPeriod(pumpDateIndex + 1, 5);
        trends.nextWeek = nextWeekTrend;
    }

    // Next Trading Month (approx 21 trading days)
    if (pumpDateIndex + 1 < sortedDates.length) {
        const nextMonthTrend = calculateTrendForPeriod(pumpDateIndex + 1, 21); // Approx. 21 trading days in a month
        trends.nextMonth = nextMonthTrend;
    }
    
    return trends;
}

// --- UI Update Functions ---

function displayFullResults(analysisResults) {
    resultsOutput.innerHTML = ''; // Clear previous results or "loading" messages

    if (!analysisResults || analysisResults.length === 0) {
        resultsOutput.innerHTML = '<p class="text-gray-600 p-4">No pump instances found matching your criteria, or data was insufficient for analysis.</p>';
        return;
    }

    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'space-y-6'; // Add some spacing between stock cards

    analysisResults.forEach(result => {
        const stockCard = document.createElement('div');
        stockCard.className = 'bg-white p-6 rounded-lg shadow-lg border border-gray-200';

        let pumpDateDisplay = result.date;
        if (result.timeWindow === 'weekly' && result.actualWeekTradingStartDate && result.actualWeekTradingEndDate) {
            pumpDateDisplay = `${result.date} (Week: ${result.actualWeekTradingStartDate} to ${result.actualWeekTradingEndDate})`;
        }


        let innerHTML = `
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 pb-2 border-b border-gray-200">
                <div>
                    <h3 class="text-2xl font-bold text-indigo-700">${result.symbol}</h3>
                    <p class="text-sm text-gray-500">Pump Detected on: ${pumpDateDisplay}</p>
                </div>
                <div class="mt-2 md:mt-0 md:text-right">
                    <p class="text-xl font-semibold ${result.pumpPercentage >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${(result.pumpPercentage * 100).toFixed(2)}% ${result.timeWindow === 'daily' ? 'Day' : 'Week'} Pump
                    </p>
                    <p class="text-xs text-gray-500">Open: ${result.open.toFixed(2)}, High: ${result.high.toFixed(2)}</p>
                </div>
            </div>
            <h4 class="text-lg font-semibold text-gray-700 mb-3">Post-Pump Trend Analysis:</h4>
        `;

        const trendsTable = document.createElement('table');
        trendsTable.className = 'min-w-full divide-y divide-gray-200 mb-4';
        trendsTable.innerHTML = `
            <thead class="bg-gray-50">
                <tr>
                    <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                    <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Change</th>
                    <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">High</th>
                    <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Low</th>
                    <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
        `;

        const periods = ['nextDay', 'nextWeek', 'nextMonth'];
        const periodNames = {'nextDay': 'Next Day', 'nextWeek': 'Next Week (5 Trading Days)', 'nextMonth': 'Next Month (21 Trading Days)'};

        periods.forEach(periodKey => {
            const trend = result.trends[periodKey];
            const changePercentText = trend.changePercent !== null ? `${(trend.changePercent * 100).toFixed(2)}%` : 'N/A';
            const highText = trend.high !== null && trend.high !== -Infinity ? trend.high.toFixed(2) : 'N/A';
            const lowText = trend.low !== null && trend.low !== Infinity ? trend.low.toFixed(2) : 'N/A';
            const detailsText = trend.details || 'N/A';
            const rowClass = trend.changePercent === null ? 'text-gray-400' : (trend.changePercent >= 0 ? 'text-green-700' : 'text-red-700');

            const trendRow = `
                <tr class="${rowClass}">
                    <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">${periodNames[periodKey]}</td>
                    <td class="px-4 py-2 whitespace-nowrap text-sm">${changePercentText}</td>
                    <td class="px-4 py-2 whitespace-nowrap text-sm">${highText}</td>
                    <td class="px-4 py-2 whitespace-nowrap text-sm">${lowText}</td>
                    <td class="px-4 py-2 whitespace-nowrap text-xs">${detailsText} (End: ${trend.endDate || 'N/A'}, Days: ${trend.daysAvailable || 'N/A'})</td>
                </tr>
            `;
            trendsTable.querySelector('tbody').innerHTML += trendRow;
        });
        
        stockCard.innerHTML += trendsTable.outerHTML;

        // Display raw daily data for context if needed (optional, can be large)
        // const rawDataToggle = document.createElement('details');
        // rawDataToggle.className = 'mt-2 text-sm';
        // rawDataToggle.innerHTML = `
        //     <summary class="cursor-pointer text-indigo-600 hover:text-indigo-800">View Raw Daily Data Used for Pump</summary>
        //     <pre class="mt-1 p-2 bg-gray-50 max-h-40 overflow-auto text-xs">${JSON.stringify(result.dailyData[result.date], null, 2)}</pre>
        // `;
        // stockCard.appendChild(rawDataToggle);

        resultsContainer.appendChild(stockCard);
    });
    resultsOutput.appendChild(resultsContainer);
}

function updateResultsStatus(message) {
    console.log(message);
    // This will be improved when actual results display is implemented
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

// --- Event Listener ---
// Will be fully set up in a later step when UI interaction is finalized.
// For now, ensure the startAnalysisBtn exists before adding listener.
if (startAnalysisBtn) {
    startAnalysisBtn.addEventListener('click', async () => {
        clearError();
        resultsOutput.innerHTML = ''; // Clear previous results

        const apiKey = apiKeyInput.value.trim();
        const symbolsText = stockSymbolsInput.value.trim();
        const thresholdPercent = parseFloat(pumpThresholdInput.value);
        const selectedTimeWindow = timeWindowInput.value;

        if (!apiKey) {
            displayError("API key is required.");
            return;
        }
        if (!symbolsText) {
            displayError("Stock symbols are required.");
            return;
        }
        if (isNaN(thresholdPercent) || thresholdPercent <= 0) {
            displayError("Pump threshold must be a positive number.");
            return;
        }

        const stockSymbols = symbolsText.split(',').map(s => s.trim()).filter(s => s);
        const threshold = thresholdPercent / 100; // Convert percentage to decimal

        // Call findPumpedStocks (defined above)
        // const foundPumps = await findPumpedStocks(stockSymbols, apiKey, threshold, selectedTimeWindow);
        
        // The actual display of foundPumps and subsequent trend analysis will be handled
        // in later steps (Implement Post-Pump Trend Analysis & Develop User Interface).
        // For now, the findPumpedStocks function itself updates the status.
        // Later, we will call analyzePostPumpTrend for each item in foundPumps here.
        console.log("Analysis started via button click..."); // Placeholder
        // For now, just calling findPumpedStocks and letting its internal updates run.
        // The results display will be enhanced in Step 6.
        const pumpedStocks = await findPumpedStocks(stockSymbols, apiKey, threshold, selectedTimeWindow);
        
        if (pumpedStocks.length > 0) {
            updateResultsStatus(`Found ${pumpedStocks.length} pump instance(s). Analyzing post-pump trends...`);
            const analysisResults = [];
            for (const pump of pumpedStocks) {
                // The 'dailyData' for the stock is already attached to the 'pump' object 
                // by the findPumpedStocks function.
                const trendAnalysis = analyzePostPumpTrend(pump); 
                analysisResults.push({
                    ...pump, // Contains symbol, date, pumpPercentage, etc.
                    trends: trendAnalysis
                });
            }
            console.log("Full Analysis Results:", analysisResults);
            if (analysisResults.length > 0) {
                displayFullResults(analysisResults); // Actually call the display function
                // updateResultsStatus can be removed here if displayFullResults handles all UI updates for results
            } else if (pumpedStocks.length > 0 && analysisResults.length === 0) {
                // This means pumps were found, but trend analysis resulted in nothing (should be rare)
                resultsOutput.innerHTML = '<p class="text-gray-600 p-4">Pumps were detected, but trend analysis could not be completed or yielded no data.</p>';
            }
            // The 'else if (!errorMessageDiv.classList.contains('hidden'))' and 'else' cases for
            // no pumps found (from findPumpedStocks) should remain as they are to handle
            // scenarios before trend analysis is even attempted for any pumps.
            // The findPumpedStocks function already updates the UI if no pumps are found initially.
            // If displayFullResults is called with an empty array, it also handles it.

        } else if (!errorMessageDiv.classList.contains('hidden')) {
            // Error messages were displayed by findPumpedStocks
            // resultsOutput.innerHTML is already handled by findPumpedStocks or displayError
            // We might want to ensure loadingIndicator is hidden and resultsOutput is clear if an error specific to this stage occurs.
            // updateResultsStatus("Analysis complete. Some errors occurred. No pumps found or processed.");
            // No specific update needed here if findPumpedStocks or displayError already cleared resultsOutput
        } else {
            // No pumps found and no errors displayed.
            // findPumpedStocks already calls updateResultsStatus('No stocks found matching the pump criteria.');
            // So, no specific action here unless displayFullResults needs to clear a generic message.
            // displayFullResults([]) will handle the 'no results' message.
            displayFullResults([]);
        }
    });
} else {
    console.error("startAnalysisBtn not found. Ensure IDs in HTML and JS match.");
}

// Ensure the script runs after the DOM is fully loaded
// document.addEventListener('DOMContentLoaded', () => {
//     // Re-assign DOM elements here if not done globally or if script is in <head>
//     // and then attach event listeners
// });
