// Function to fetch stock data from Alpha Vantage
async function fetchStockData(symbol, apiKey) {
    const functionName = 'TIME_SERIES_DAILY_ADJUSTED'; // Using daily adjusted prices
    const url = `https://www.alphavantage.co/query?function=${functionName}&symbol=${symbol}&apikey=${apiKey}&outputsize=full`; // outputsize=full to get more data

    try {
        const response = await fetch(url);
        if (!response.ok) {
            // Try to parse error message from Alpha Vantage if available
            const errorData = await response.json().catch(() => null);
            if (errorData && errorData['Error Message']) {
                throw new Error(`Alpha Vantage API error for ${symbol}: ${errorData['Error Message']}`);
            }
            if (errorData && errorData['Information']) { // Handle rate limit messages
                 throw new Error(`Alpha Vantage API information for ${symbol}: ${errorData['Information']}`);
            }
            throw new Error(`Network response was not ok for ${symbol}: ${response.statusText} (status: ${response.status})`);
        }
        const data = await response.json();

        if (data['Error Message']) {
            throw new Error(`Alpha Vantage API error for ${symbol}: ${data['Error Message']}`);
        }
        if (data['Information']) { // E.g., "Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute and 500 calls per day."
            // This is not strictly an error, but we should be aware of it.
            // For now, we'll treat it as a potential issue if it prevents data retrieval,
            // or log it. If data is still present, we might not throw an error.
            // Let's check if 'Time Series (Daily)' is missing
            if (!data['Time Series (Daily)']) {
                throw new Error(`Alpha Vantage API information for ${symbol}: ${data['Information']}. Data might be unavailable due to call frequency limits.`);
            }
        }
        if (!data['Time Series (Daily)']) {
            console.warn(`No 'Time Series (Daily)' data found for ${symbol}. Response:`, data);
            throw new Error(`No 'Time Series (Daily)' data found for ${symbol}. The symbol might be invalid or data unavailable.`);
        }

        return data;
    } catch (error) {
        console.error(`Failed to fetch stock data for ${symbol}:`, error);
        // Re-throw the error so it can be caught by the caller and displayed to the user
        throw error;
    }
}

async function fetchStockDataFMP(symbol, apiKey) {
    const cacheKey = `fmp_data_${symbol.toUpperCase()}`;
    const cacheExpiry = 120 * 60 * 60 * 1000; // 120 hours in milliseconds

    // 1. Try to retrieve from localStorage
    try {
        const cachedItem = localStorage.getItem(cacheKey);
        if (cachedItem) {
            const { timestamp, data: cachedData } = JSON.parse(cachedItem);
            if ((Date.now() - timestamp) < cacheExpiry) {
                console.log(`Using cached data for ${symbol}`);
                // Ensure the cached data is in the expected array format
                if (Array.isArray(cachedData)) {
                    return cachedData;
                } else {
                    // This might happen if a previous version stored data differently or if cache is corrupted.
                    console.warn(`Cached data for ${symbol} is not in expected array format. Refetching.`);
                    localStorage.removeItem(cacheKey); // Remove corrupted cache
                }
            } else {
                console.log(`Cached data for ${symbol} is stale. Refetching.`);
                localStorage.removeItem(cacheKey); // Remove stale cache
            }
        }
    } catch (error) {
        console.error(`Error reading from localStorage for ${symbol}:`, error);
        // Proceed to fetch if cache read fails
    }

    // 2. If no fresh cache, fetch from API
    const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol.toUpperCase()}?apikey=${apiKey}`;

    try {
        console.log(`Fetching fresh data from FMP API for ${symbol}`);
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            if (errorData && errorData['Error Message']) {
                throw new Error(`FMP API error for ${symbol}: ${errorData['Error Message']}`);
            }
            throw new Error(`Network response was not ok for FMP API for ${symbol}: ${response.statusText} (status: ${response.status})`);
        }
        const data = await response.json();

        if (data['Error Message']) {
            throw new Error(`FMP API error for ${symbol}: ${data['Error Message']}`);
        }
        
        // Check if data.historical is present and is an array
        // Note: The specific check `if (data.symbol && Object.keys(data).length === 1)` from the prompt
        // is a bit more specific than the previous implementation.
        // The previous implementation was `if (data.symbol && data.historical && Array.isArray(data.historical) && data.historical.length === 0)`
        // And then a separate `if (Object.keys(data).length === 0)`.
        // The prompt's condition `if (data.symbol && Object.keys(data).length === 1)` aims to catch cases like `{ "symbol" : "QQQQQ" }` (no historical array)
        // This is subtly different from `{ "symbol" : "QQQQQ", "historical" : [] }`
        if (!data.historical || !Array.isArray(data.historical)) {
            if (data.symbol && data.historical && Array.isArray(data.historical) && data.historical.length === 0) { // Handles {symbol: "SYM", historical: []}
                 throw new Error(`No historical data found for symbol ${symbol} from FMP (empty 'historical' array). It might be an invalid symbol or no data available.`);
            } else if (data.symbol && Object.keys(data).length === 1) { // Handles {symbol: "SYM"}
                 throw new Error(`No historical data found for symbol ${symbol} from FMP. It might be an invalid symbol or no data available (only symbol key returned).`);
            } else if (Object.keys(data).length === 0) { // Handles {}
                 throw new Error(`Empty response received for symbol ${symbol} from FMP. Invalid symbol or no data.`);
            }
            // General catch-all for other unexpected structures
            console.warn(`Unexpected data structure for ${symbol} from FMP: `, data);
            throw new Error(`Unexpected data structure received for ${symbol} from FMP (expected 'historical' array).`);
        }
        
        const fetchedDataArray = data.historical; // This is an array of daily data objects

        // 3. Store fetched data in localStorage
        try {
            const itemToCache = { timestamp: Date.now(), data: fetchedDataArray };
            localStorage.setItem(cacheKey, JSON.stringify(itemToCache));
            console.log(`Cached fresh data for ${symbol}`);
        } catch (error) {
            console.error(`Error writing to localStorage for ${symbol}:`, error);
            // Still return fetched data even if caching fails
        }

        return fetchedDataArray;

    } catch (error) {
        console.error(`Failed to fetch stock data from FMP for ${symbol}:`, error);
        throw error; 
    }
}
