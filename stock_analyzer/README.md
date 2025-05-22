# Stock Pump Analyzer

## Description

The Stock Pump Analyzer is a web-based tool designed to identify stocks that have experienced significant price increases ("pumps") over a specified period (daily or weekly) and then analyze their subsequent performance trends. It fetches historical stock data from the [Alpha Vantage API](https://www.alphavantage.co/), processes this data to detect pumps based on user-defined criteria, and then evaluates how these stocks performed in the days, weeks, and months following the pump.

The goal is to provide insights into short-term market dynamics and help users understand potential patterns associated with rapid price surges.

## How to Use

1.  **Open `index.html`:**
    Simply open the `stock_analyzer/index.html` file in your web browser.

2.  **Configure Analysis Parameters:**
    You will see an "Analysis Configuration" section with the following fields:
    *   **Alpha Vantage API Key:**
        *   The tool requires a free API key from Alpha Vantage to fetch stock data.
        *   A default key is provided for initial testing, but it is subject to public usage limits (e.g., 5 calls per minute, 100 calls per day). It is **highly recommended** to obtain your own free API key from [Alpha Vantage](https://www.alphavantage.co/support/#api-key) for more reliable and extensive use.
        *   Enter your personal API key into this field.
    *   **Stock Symbols (comma-separated):**
        *   Enter the stock ticker symbols you want to analyze.
        *   Separate multiple symbols with commas (e.g., `AAPL,MSFT,TSLA`).
    *   **Pump Threshold (%):**
        *   Define what constitutes a "pump." This is the minimum percentage increase from the period's opening price to its high price.
        *   For example, a value of `30` means you're looking for stocks that increased by at least 30%.
    *   **Time Window:**
        *   Select whether to analyze pumps on a `Daily` or `Weekly` basis.
            *   **Daily:** Identifies pumps that occur within a single trading day (open to high).
            *   **Weekly:** Aggregates daily data to identify pumps that occur from the week's opening price (first trading day's open) to the week's highest price.

3.  **Start Analysis:**
    *   Click the "Start Analysis" button.
    *   A loading indicator will appear while the tool fetches data and performs calculations. This may take some time, especially with many symbols or if the API rate limit is hit.

4.  **Interpret Results:**
    *   Once the analysis is complete, the "Analysis Results" section will display information for each stock and pump instance found:
        *   **Stock Symbol & Pump Date:** Identifies the stock and the date (or week start date) of the detected pump.
        *   **Pump Percentage:** Shows the actual percentage increase from open to high for the detected period.
        *   **Post-Pump Trend Analysis:** Provides a table detailing the stock's performance after the pump:
            *   **Next Day:** Percentage change, high, and low for the trading day immediately following the pump.
            *   **Next Week (5 Trading Days):** Performance over the 5 trading days after the pump.
            *   **Next Month (21 Trading Days):** Performance over the 21 trading days after the pump.
            *   Percentage change is calculated based on the adjusted closing price of the pump day relative to the adjusted closing price at the end of the subsequent period.
            *   High and Low show the highest and lowest prices reached during that subsequent period.
            *   "Details" includes information like the number of actual trading days available for the period and the end date of the period.

5.  **Error Messages:**
    *   If issues occur (e.g., invalid API key, network problems, API rate limits, invalid stock symbols), an error message will be displayed. Check the browser's console (usually by pressing F12) for more detailed technical error messages.

## Methodology

1.  **Data Fetching:**
    *   Uses the `TIME_SERIES_DAILY_ADJUSTED` endpoint from Alpha Vantage to get historical daily stock prices (open, high, low, close, adjusted close, volume).

2.  **Pump Detection:**
    *   **Daily:** For each day, calculates `(High Price - Open Price) / Open Price`. If this is `>=` the defined threshold, it's flagged as a pump.
    *   **Weekly:** Daily data is aggregated into weekly buckets (typically Monday to Friday). The pump is calculated from the opening price of the first trading day of the week to the highest high observed during that week.

3.  **Post-Pump Trend Analysis:**
    *   After a pump is identified on `PumpDay`, the analysis looks at the stock's performance starting from `PumpDay + 1 trading day`.
    *   It calculates the percentage change in the adjusted closing price from `PumpDay` to the end of the `Next Day`, `Next Week` (5 trading days after pump), and `Next Month` (21 trading days after pump).
    *   It also records the highest high and lowest low prices during these subsequent periods.

## Technologies Used

*   **HTML:** For the basic structure of the web page.
*   **Tailwind CSS:** For modern UI styling and responsiveness.
*   **JavaScript (Vanilla):** For all application logic, including API interaction, data processing, and dynamic HTML generation.
*   **Alpha Vantage API:** As the source for historical stock market data.

## Limitations & Considerations

*   **API Rate Limits:** The Alpha Vantage free tier has strict rate limits (e.g., 5 calls per minute, 100 per day with the new default key, potentially 25 requests per day with the legacy demo key). Extensive analysis or frequent use will require a personal API key or a premium Alpha Vantage plan. The tool attempts to handle rate limit messages from the API.
*   **Data Availability:** Data for some symbols may not be available, or historical data might be limited.
*   **Definition of "Pump":** The current definition (open to high) is one of many possible ways to define a pump.
*   **Market Conditions:** Past performance and trends do not guarantee future results. This tool is for informational and analytical purposes only.
*   **No Real-time Data:** Analysis is based on historical end-of-day data.

## Future Enhancements (Potential)

*   Chart visualizations of stock prices and pump events.
*   More sophisticated trend analysis metrics.
*   User accounts or local storage to save configurations.
*   Broader stock symbol discovery options.
*   Alternative data sources.
