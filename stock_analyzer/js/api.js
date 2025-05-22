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

// Example of how you might export if you were using modules (not strictly necessary for this setup yet)
// if (typeof module !== 'undefined' && module.exports) {
//     module.exports = { fetchStockData };
// }

async function fetchStockDataFMP(symbol, apiKey) {
    // FMP endpoint for full daily historical prices (includes open, high, low, close, volume)
    // The API docs suggest "historical-price-full" for daily data.
    // Example: https://financialmodelingprep.com/api/v3/historical-price-full/AAPL?apikey=YOUR_API_KEY
    const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol.toUpperCase()}?apikey=${apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            if (errorData && errorData['Error Message']) {
                throw new Error(`FMP API error for ${symbol}: ${errorData['Error Message']}`);
            }
            // FMP might also return errors in a different structure or just a status code
            throw new Error(`Network response was not ok for FMP API for ${symbol}: ${response.statusText} (status: ${response.status})`);
        }
        const data = await response.json();

        // FMP specific error checking (their error messages might be in a 'message' or 'Error Message' field)
        // Or sometimes, an empty array/object is returned for an invalid symbol with a 200 OK.
        if (data['Error Message']) {
            throw new Error(`FMP API error for ${symbol}: ${data['Error Message']}`);
        }
        
        // Check if data.historical is present and is an array
        if (!data.historical || !Array.isArray(data.historical)) {
            // FMP for an invalid symbol like "QQQQQ" often returns: { "symbol" : "QQQQQ", "historical" : [ ] }
            // So, check if historical is an empty array and symbol key exists
            if (data.symbol && data.historical && Array.isArray(data.historical) && data.historical.length === 0) {
                 throw new Error(`No historical data found for symbol ${symbol} from FMP (empty 'historical' array). It might be an invalid symbol or no data available.`);
            }
            // For some invalid symbols or issues, FMP might return an empty object
            if (Object.keys(data).length === 0) {
                 throw new Error(`Empty response received for symbol ${symbol} from FMP. Invalid symbol or no data.`);
            }
            // Log the unusual data structure if it's not an outright error but doesn't contain data.historical
            console.warn(`Unexpected data structure for ${symbol} from FMP: `, data);
            throw new Error(`Unexpected data structure received for ${symbol} from FMP (expected 'historical' array).`);
        }
        
        // The actual daily data is usually in `data.historical` array for this endpoint
        // FMP data is typically newest first.
        return data.historical; // This is an array of daily data objects, newest first.

    } catch (error) {
        console.error(`Failed to fetch stock data from FMP for ${symbol}:`, error);
        throw error; // Re-throw for the caller
    }
}
