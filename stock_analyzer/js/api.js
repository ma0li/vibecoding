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
