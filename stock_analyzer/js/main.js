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
                            historicalDataArray: historicalData // Add FMP array (oldest first)
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
                            historicalDataArray: historicalData // Add FMP array (oldest first)
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

/**
 * Analyzes the stock's performance after a detected pump.
 * @param {Object} pumpInfo Information about the pump.
 * @returns {Object} Analysis of post-pump trends.
 */
function analyzePostPumpTrend(pumpInfo) {
    const { symbol, date: pumpDateStr, dailyData } = pumpInfo; // dailyData is the map
    const trends = {
        nextDay: { changePercent: null, high: null, low: null, details: "Data unavailable" },
        nextWeek: { changePercent: null, high: null, low: null, details: "Data unavailable" },
        nextMonth: { changePercent: null, high: null, low: null, details: "Data unavailable" }
    };

    if (!dailyData || Object.keys(dailyData).length === 0) {
        console.error(`No dailyData provided (map) for trend analysis of ${symbol} on ${pumpDateStr}`);
        return trends;
    }

    const sortedDates = Object.keys(dailyData).sort((a, b) => new Date(a) - new Date(b));
    const pumpDateIndex = sortedDates.indexOf(pumpDateStr);

    if (pumpDateIndex === -1) {
        console.error(`Pump date ${pumpDateStr} not found in sorted daily data keys for ${symbol}.`);
        return trends;
    }

    const pumpDayData = dailyData[pumpDateStr];
    if (!pumpDayData) {
        console.error(`Pump day data for ${pumpDateStr} is undefined for ${symbol}.`);
        return trends;
    }
    
    const pumpDayReferencePrice = parseFloat(pumpDayData.adjustedClose); 
    if (isNaN(pumpDayReferencePrice)) {
        console.error(`Invalid reference price (adjustedClose) for pump on ${pumpDateStr} for ${symbol}. Value: ${pumpDayData.adjustedClose}`);
        return trends;
    }

    function calculateTrendForPeriod(startIndex, numDays) {
        const periodDates = sortedDates.slice(startIndex, startIndex + numDays);
        if (periodDates.length === 0) return { changePercent: null, high: null, low: null, details: "Not enough subsequent data" };

        let periodHigh = -Infinity;
        let periodLow = Infinity;
        
        for (const dateKey of periodDates) {
            const dayEntry = dailyData[dateKey]; 
            if (!dayEntry) {
                console.warn(`Missing data for date ${dateKey} in calculateTrendForPeriod for ${symbol}. Skipping this day.`);
                continue;
            }
            periodHigh = Math.max(periodHigh, parseFloat(dayEntry.high));
            periodLow = Math.min(periodLow, parseFloat(dayEntry.low));
        }
        
        const lastDayOfPeriodData = dailyData[periodDates[periodDates.length - 1]];
        if (!lastDayOfPeriodData) {
             console.warn(`Missing data for last day of period ${periodDates[periodDates.length - 1]} in calculateTrendForPeriod for ${symbol}.`);
             return { changePercent: null, high: periodHigh, low: periodLow, details: "End price data missing for period end date" };
        }
        const endPrice = parseFloat(lastDayOfPeriodData.adjustedClose);

        if (isNaN(endPrice)) {
            return { changePercent: null, high: periodHigh, low: periodLow, details: `End price data (adjustedClose) missing or invalid for ${periodDates[periodDates.length - 1]}` };
        }
        const changePercent = ((endPrice - pumpDayReferencePrice) / pumpDayReferencePrice);
        return { 
            changePercent: changePercent, 
            high: periodHigh, 
            low: periodLow, 
            daysAvailable: periodDates.length,
            endDate: periodDates[periodDates.length - 1],
            details: `${periodDates.length} days of data found.`
        };
    }

    if (pumpDateIndex + 1 < sortedDates.length) {
        trends.nextDay = { ...calculateTrendForPeriod(pumpDateIndex + 1, 1), details: `Data for ${sortedDates[pumpDateIndex + 1]}. ${calculateTrendForPeriod(pumpDateIndex + 1, 1).details}` };
    }
    if (pumpDateIndex + 1 < sortedDates.length) {
        trends.nextWeek = calculateTrendForPeriod(pumpDateIndex + 1, 5);
    }
    if (pumpDateIndex + 1 < sortedDates.length) {
        trends.nextMonth = calculateTrendForPeriod(pumpDateIndex + 1, 21);
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

        let innerHTML = `
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 pb-2 border-b border-gray-200">
                <div><h3 class="text-2xl font-bold text-indigo-700">${result.symbol}</h3><p class="text-sm text-gray-500">Pump Detected on: ${pumpDateDisplay}</p></div>
                <div class="mt-2 md:mt-0 md:text-right"><p class="text-xl font-semibold ${result.pumpPercentage >= 0 ? 'text-green-600' : 'text-red-600'}">${(result.pumpPercentage * 100).toFixed(2)}% ${result.timeWindow === 'daily' ? 'Day' : 'Week'} Pump</p><p class="text-xs text-gray-500">Open: ${result.open.toFixed(2)}, High: ${result.high.toFixed(2)}</p></div>
            </div>
            <h4 class="text-lg font-semibold text-gray-700 mb-3">Post-Pump Trend Analysis:</h4>`;

        const trendsTable = document.createElement('table');
        trendsTable.className = 'min-w-full divide-y divide-gray-200 mb-4';
        trendsTable.innerHTML = `<thead class="bg-gray-50"><tr><th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th><th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Change</th><th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">High</th><th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Low</th><th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th></tr></thead><tbody class="bg-white divide-y divide-gray-200"></tbody>`;
        
        const periods = ['nextDay', 'nextWeek', 'nextMonth'];
        const periodNames = {'nextDay': 'Next Day', 'nextWeek': 'Next Week (5 Trading Days)', 'nextMonth': 'Next Month (21 Trading Days)'};
        periods.forEach(periodKey => {
            const trend = result.trends[periodKey];
            const changePercentText = trend.changePercent !== null ? `${(trend.changePercent * 100).toFixed(2)}%` : 'N/A';
            const highText = trend.high !== null && trend.high !== -Infinity ? trend.high.toFixed(2) : 'N/A';
            const lowText = trend.low !== null && trend.low !== Infinity ? trend.low.toFixed(2) : 'N/A';
            const detailsText = trend.details || 'N/A';
            const rowClass = trend.changePercent === null ? 'text-gray-400' : (trend.changePercent >= 0 ? 'text-green-700' : 'text-red-700');
            trendsTable.querySelector('tbody').innerHTML += `<tr class="${rowClass}"><td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">${periodNames[periodKey]}</td><td class="px-4 py-2 whitespace-nowrap text-sm">${changePercentText}</td><td class="px-4 py-2 whitespace-nowrap text-sm">${highText}</td><td class="px-4 py-2 whitespace-nowrap text-sm">${lowText}</td><td class="px-4 py-2 whitespace-nowrap text-xs">${detailsText} (End: ${trend.endDate || 'N/A'}, Days: ${trend.daysAvailable || 'N/A'})</td></tr>`;
        });
        stockCard.innerHTML += trendsTable.outerHTML;

        const chartCanvasId = `chart-${result.symbol.replace(/[^a-zA-Z0-9]/g, '')}-${result.date.replace(/[^a-zA-Z0-9]/g, '')}`;
        const chartDiv = document.createElement('div');
        chartDiv.className = 'mt-6'; 
        chartDiv.innerHTML = `<h4 class="text-md font-semibold text-gray-700 mb-2 text-center">Price and Volume Chart (Loading...)</h4><canvas id="${chartCanvasId}"></canvas>`;
        stockCard.appendChild(chartDiv);

        if (result.historicalDataArray && result.historicalDataArray.length > 0) {
            setTimeout(() => { // Ensure DOM is updated before rendering
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
