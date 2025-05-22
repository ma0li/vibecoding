# Stock Pump Analyzer

## Description

The Stock Pump Analyzer is a web-based tool designed to identify stocks that have experienced significant price increases ("pumps") over a specified period (daily or weekly) and then analyze their subsequent performance trends. It fetches historical stock data from the [Financial Modeling Prep (FMP) API](https://site.financialmodelingprep.com/developer), processes this data to detect pumps based on user-defined criteria, and then evaluates how these stocks performed in the days, weeks, and months following the pump. The tool also provides chart visualizations for each detected pump, showing price and volume trends around the event.

The goal is to provide insights into short-term market dynamics and help users understand potential patterns associated with rapid price surges.

## How to Use

1.  **Open `index.html`:**
    Simply open the `stock_analyzer/index.html` file in your web browser.

2.  **Configure Analysis Parameters:**
    You will see an "Analysis Configuration" section with the following fields:
    *   **Financial Modeling Prep (FMP) API Key:**
        *   The tool requires a free API key from Financial Modeling Prep to fetch stock data.
        *   It is **highly recommended** to obtain your own free API key from [Financial Modeling Prep](https://site.financialmodelingprep.com/developer) for reliable and extensive use (their free plan typically offers a generous number of requests, e.g., 250 requests/day).
        *   Enter your personal FMP API key into this field.
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
        *   **Chart Visualizations:** Below the trend analysis table for each pump, a chart displays:
            *   The stock's closing price as a line.
            *   The daily trading volume as bars.
            *   The chart covers approximately 30 trading days before the pump and 60 trading days after.
            *   The specific day of the pump is highlighted on the price line for easy identification.

5.  **Error Messages:**
    *   If issues occur (e.g., invalid API key, network problems, API rate limits, invalid stock symbols), an error message will be displayed. Check the browser's console (usually by pressing F12) for more detailed technical error messages.

## Methodology

1.  **Data Fetching:**
    *   Uses the `/api/v3/historical-price-full/{symbol}` endpoint from the Financial Modeling Prep (FMP) API to get historical daily stock prices (date, open, high, low, close, adjusted close, volume).

2.  **Pump Detection:**
    *   **Daily:** For each day, calculates `(High Price - Open Price) / Open Price`. If this is `>=` the defined threshold, it's flagged as a pump.
    *   **Weekly:** Daily data is aggregated into weekly buckets (typically Monday to Friday). The pump is calculated from the opening price of the first trading day of the week to the highest high observed during that week.

3.  **Post-Pump Trend Analysis:**
    *   After a pump is identified on `PumpDay`, the analysis looks at the stock's performance starting from `PumpDay + 1 trading day`.
    *   It calculates the percentage change in the adjusted closing price from `PumpDay` to the end of the `Next Day`, `Next Week` (5 trading days after pump), and `Next Month` (21 trading days after pump).
    *   It also records the highest high and lowest low prices during these subsequent periods.

4.  **Chart Rendering:**
    *   For each detected pump, a chart is rendered using Chart.js.
    *   The chart displays daily closing prices (line) and daily volumes (bars) for a window of approximately 30 days before the pump and 60 days after.
    *   The pump day is highlighted on the price line.

## Technologies Used

*   **HTML:** For the basic structure of the web page.
*   **Tailwind CSS:** For modern UI styling and responsiveness.
*   **JavaScript (Vanilla):** For all application logic, including API interaction, data processing, and dynamic HTML generation.
*   **Financial Modeling Prep (FMP) API:** As the source for historical stock market data.
*   **Chart.js:** For rendering interactive stock charts.

## Limitations & Considerations

*   **API Rate Limits:** The Financial Modeling Prep (FMP) free tier typically offers a good number of requests (e.g., 250 requests/day), but heavy usage across many symbols might still hit limits. A personal API key is essential.
*   **Data Availability:** Data for some symbols may not be available, or historical data might be limited via FMP.
*   **Definition of "Pump":** The current definition (open to high) is one of many possible ways to define a pump.
*   **Market Conditions:** Past performance and trends do not guarantee future results. This tool is for informational and analytical purposes only.
*   **No Real-time Data:** Analysis is based on historical end-of-day data.

## Future Enhancements (Potential)

*   More sophisticated trend analysis metrics.
*   User accounts or local storage to save configurations.
*   Broader stock symbol discovery options.
*   Alternative data sources.
*   More interactive chart features (e.g., zoom, pan, more detailed tooltips).
