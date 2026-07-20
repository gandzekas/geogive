#!/bin/bash
# Polymarket Edge Scanner
# Scans Polymarket for potential edge opportunities using order-book imbalance, 
# recent volume spikes, and price deviation from VWAP.
# Designed to run as a Hermes cron job.
# Fixed VWAP calculation and absolute price deviation - 2026-07-04

# === CONFIGURATION ===
BLOCK_TRADE_THRESHOLD=1000
ORDER_BOOK_RATIO_THRESHOLD=2.0
VOLUME_SPIKE_THRESHOLD=2.0
PRICE_VWAP_DEVIATION=0.01  # absolute difference
LOOKBACK_MINUTES=5
MAX_MARKETS=20

# Helper function to fetch JSON and check for errors
fetch_json() {
    local url="$1"
    response=$(curl -s --max-time 10 --fail "$url") || {
        # curl failed (HTTP error or network issue)
        return 1
    }
    # Check if response looks like HTML (error page)
    if [[ "$response" == "<!DOCTYPE html"* ]] || [[ "$response" == *"<html"* ]]; then
        return 1
    fi
    echo "$response"
}

# === MAIN SCRIPT ===

# Get markets sorted by volume24hr (descending)
markets_response=$(fetch_json "https://gamma-api.polymarket.com/markets?limit=$MAX_MARKETS&order=volume24hr&ascending=false")
if [ $? -ne 0 ]; then
    echo "Error: Failed to fetch markets" >&2
    exit 1
fi

# Extract market IDs
market_ids=$(echo "$markets_response" | jq -r '.[].id')

# Array to collect alerts
alerts=()

# Process each market
while read -r market_id; do
    # Get market details
    market_info=$(fetch_json "https://gamma-api.polymarket.com/markets/${market_id}")
    if [ $? -ne 0 ]; then
        continue
    fi

    # Extract fields
    question=$(echo "$market_info" | jq -r '.question')
    volume24h=$(echo "$market_info" | jq -r '.volume24hr')
    clob_token_ids_json=$(echo "$market_info" | jq -r '.clobTokenIds')
    # Skip if no clobTokenIds
    if [ -z "$clob_token_ids_json" ] || [ "$clob_token_ids_json" = "null" ]; then
        continue
    fi

    # Convert JSON array to bash array
    IFS=$'\n' read -d '' -r -a token_ids_array <<<"$(echo "$clob_token_ids_json" | jq -r '.[]')"
    unset IFS

    # Expect exactly two tokens for binary market
    if [ "${#token_ids_array[@]}" -ne 2 ]; then
        continue
    fi

    token_a="${token_ids_array[0]}"
    token_b="${token_ids_array[1]}"

    # Fetch order book for both tokens
    ob_response=$(fetch_json "https://clob.polymarket.com/book?token_id=$token_a&token_id=$token_b")
    if [ $? -ne 0 ]; then
        continue
    fi

    # Extract best bid/ask and sizes
    best_bid=$(echo "$ob_response" | jq -r '.bids[0].price // empty')
    best_ask=$(echo "$ob_response" | jq -r '.asks[0].price // empty')
    bid_size=$(echo "$ob_response" | jq -r '.bids[0].size // empty')
    ask_size=$(echo "$ob_response" | jq -r '.asks[0].size // empty')

    if [ -z "$best_bid" ] || [ -z "$best_ask" ] || [ -z "$bid_size" ] || [ -z "$ask_size" ]; then
        continue
    fi

    # Remove commas for numeric operations
    bid_volume=$(echo "$bid_size" | tr -d ',')
    ask_volume=$(echo "$ask_size" | tr -d ',')

    # Calculate bid/ask and ask/bid ratios (handle division by zero)
    if [ "$(echo "$ask_volume > 0" | bc -l)" -eq 1 ]; then
        bid_ask_ratio=$(echo "scale=4; $bid_volume / $ask_volume" | bc -l)
    else
        bid_ask_ratio=0
    fi
    if [ "$(echo "$bid_volume > 0" | bc -l)" -eq 1 ]; then
        ask_bid_ratio=$(echo "scale=4; $ask_volume / $bid_volume" | bc -l)
    else
        ask_bid_ratio=0
    fi

    # Calculate start time for recent trades (LOOKBACK_MINUTES ago)
    start_time=$(date -u -d "-$LOOKBACK_MINUTES minutes" +%s)

    # Fetch recent trades for both tokens (combined)
    trades_response=$(fetch_json "https://data-api.polymarket.com/trades/$token_a,$token_b?start_time=$start_time&limit=100")
    if [ $? -ne 0 ]; then
        continue
    fi

    # Calculate total volume in lookback window
    total_volume=0
    while read -r size; do
        size_num=$(echo "$size" | tr -d ',')
        total_volume=$(echo "$total_volume + $size_num" | bc -l)
    done <<< "$(echo "$trades_response" | jq -r '.[].size')"

    # Calculate expected volume per 5 minutes (based on 24h volume)
    expected_volume_24h=$(echo "$volume24h" | tr -d ',')
    expected_volume_5m=$(echo "scale=6; $expected_volume_24h * $LOOKBACK_MINUTES / 1440" | bc -l)
    volume_spike_ratio=$(echo "scale=4; $total_volume / $expected_volume_5m" | bc -l)

    # Calculate VWAP from trades
    vwap_numerator=0
    vwap_denominator=0
    while read -r price size; do
        price_num=$(echo "$price" | tr -d ',')
        size_num=$(echo "$size" | tr -d ',')
        vwap_numerator=$(echo "$vwap_numerator + ($price_num * $size_num)" | bc -l)
        vwap_denominator=$(echo "$vwap_denominator + $size_num" | bc -l)
    done <<< "$(echo "$trades_response" | jq -r '.[].price, .[].size')"

    if [ "$vwap_denominator" -gt 0 ]; then
        vwap=$(echo "scale=6; $vwap_numerator / $vwap_denominator" | bc -l)
    else
        vwap=0
    fi

    # Mid price from order book
    mid_price=$(echo "scale=6; ($best_bid + $best_ask) / 2" | bc -l)

    # Absolute price deviation from VWAP
    price_deviation=$(echo "$mid_price - $vwap" | bc -l)  # can be negative
    price_deviation_abs=$(echo "$price_deviation" | tr -d '-')  # absolute value

    # Count block trades (size >= BLOCK_TRADE_THRESHOLD)
    block_trade_count=0
    while read -r size; do
        size_num=$(echo "$size" | tr -d ',')
        if [ "$(echo "$size_num >= $BLOCK_TRADE_THRESHOLD" | bc -l)" -eq 1 ]; then
            block_trade_count=$((block_trade_count + 1))
        fi
    done <<< "$(echo "$trades_response" | jq -r '.[].size')"

    # Determine if any trigger condition is met
    trigger=false

    # 1. Order book pressure
    if [ "$(echo "$bid_ask_ratio >= $ORDER_BOOK_RATIO_THRESHOLD" | bc -l)" -eq 1 ] || [ "$(echo "$ask_bid_ratio >= $ORDER_BOOK_RATIO_THRESHOLD" | bc -l)" -eq 1 ]; then
        trigger=true
    fi

    # 2. Volume spike
    if [ "$(echo "$volume_spike_ratio >= $VOLUME_SPIKE_THRESHOLD" | bc -l)" -eq 1 ]; then
        trigger=true
    fi

    # 3. Price-VWAP deviation (absolute)
    if [ "$(echo "$price_deviation_abs >= $PRICE_VWAP_DEVIATION" | bc -l)" -eq 1 ]; then
        trigger=true
    fi

    # 4. Block trade
    if [ "$block_trade_count" -gt 0 ]; then
        trigger=true
    fi

    # If triggered, create alert
    if [ "$trigger" = true ]; then
        # Build alert message
        url="https://polymarket.com/event/${market_id}"

        # Format numbers for display
        bid_volume_fmt=$(printf "%.2f" "$bid_volume")
        ask_volume_fmt=$(printf "%.2f" "$ask_volume")
        total_volume_fmt=$(printf "%.2f" "$total_volume")
        expected_volume_5m_fmt=$(printf "%.2f" "$expected_volume_5m")
        volume_spike_ratio_fmt=$(printf "%.2f" "$volume_spike_ratio")
        vwap_fmt=$(printf "%.6f" "$vwap")
        mid_price_fmt=$(printf "%.6f" "$mid_price")
        price_deviation_abs_fmt=$(printf "%.6f" "$price_deviation_abs")
        price_deviation_pct=$(echo "scale=6; $price_deviation_abs * 100 / $mid_price" | bc -l)
        price_deviation_pct_fmt=$(printf "%.2f" "$price_deviation_pct")

        # Determine order book pressure text
        ob_text=""
        if [ "$bid_volume" -eq 0 ] && [ "$ask_volume" -eq 0 ]; then
            ob_text="No liquidity (both bid and ask volume are zero)"
        elif [ "$(echo "$bid_volume >= $ask_volume" | bc -l)" -eq 1 ]; then
            # Bid volume >= ask volume, show bid/ask ratio
            bid_ask_ratio_display=$(echo "scale=2; $bid_volume / $ask_volume" | bc -l)
            ob_text="Strong bid pressure (bid/ask = $bid_ask_ratio_display)"
        else
            # Ask volume > bid volume, show ask/bid ratio
            ask_bid_ratio_display=$(echo "scale=2; $ask_volume / $bid_volume" | bc -l)
            ob_text="Strong ask pressure (ask/bid = $ask_bid_ratio_display)"
        fi

        # Volume spike text
        vs_text=""
        if [ "$(echo "$volume_spike_ratio >= $VOLUME_SPIKE_THRESHOLD" | bc -l)" -eq 1 ]; then
            vs_text="Volume spike: ${volume_spike_ratio_fmt}×"
        fi

        # Price-VWAP deviation text
        pv_text=""
        if [ "$(echo "$price_deviation_abs >= $PRICE_VWAP_DEVIATION" | bc -l)" -eq 1 ]; then
            direction="above"
            if [ "$(echo "$mid_price < $vwap" | bc -l)" -eq 1 ]; then
                direction="below"
            fi
            pv_text="Price-VWAP divergence: ${price_deviation_pct_fmt}% ${direction}"
        fi

        # Block trade text
        bt_text=""
        if [ "$block_trade_count" -gt 0 ]; then
            bt_text="Block trade detected: ${block_trade_count} trade(s) >= $BLOCK_TRADE_THRESHOLD"
        fi

        # Construct alert
        alert="🔍 POLYMARKET EDGE ALERT 🔍
Market: ${question}
${ob_text}
${vs_text}
${pv_text}
${bt_text}
  - Bid volume: \$$bid_volume_fmt
  - Ask volume: \$$ask_volume_fmt
  - Recent ${LOOKBACK_MINUTES}m volume: \$$total_volume_fmt (expected: \$$expected_volume_5m_fmt)
  - Price vs VWAP: ${price_deviation_pct_fmt}%
Polymarket URL: ${url}"

        alerts+=("$alert")
    fi
done <<< "$market_ids"

# Output results
if [ ${#alerts[@]} -eq 0 ]; then
    echo "[SILENT]"
else
    # Print all alerts
    for alert in "${alerts[@]}"; do
        echo "$alert"
        echo
    done
fi