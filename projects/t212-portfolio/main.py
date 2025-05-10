import requests
import os
import time as tm
import pandas as pd
import json
from dotenv import load_dotenv
from datetime import date, datetime

load_dotenv()  # will search for .env file in local folder and load variables

API_KEY = os.getenv("API_KEY")


def post_export_csv(dateFrom, dateTo):
    url = "https://live.trading212.com/api/v0/history/exports"
    payload = {
        "dataIncluded": {
            "includeDividends": True,
            "includeInterest": True,
            "includeOrders": True,
            "includeTransactions": True,
        },
        "timeFrom": dateFrom,
        "timeTo": dateTo,
    }
    headers = {"Content-Type": "application/json", "Authorization": API_KEY}
    response = requests.post(url, json=payload, headers=headers)
    data = response.json()
    print(data)
    tm.sleep(30)


def get_exports_list():
    url = "https://live.trading212.com/api/v0/history/exports"
    headers = {"Authorization": API_KEY}
    response = requests.get(url, headers=headers)
    data = response.json()
    print(data)
    tm.sleep(60)


def main():
    # post_export_csv("2024-01-01T00:00:00Z", "2025-01-01T00:00:00Z")
    # get_exports_list()
    pd.options.display.max_rows = 9999
    df1 = pd.read_csv(
        "exports/from_2023-01-01_to_2024-01-01_MTcyOTI4MzIxODczMQ.csv",
    )
    df2 = pd.read_csv(
        "exports/from_2024-01-01_to_2025-01-01_MTcyOTI4MzI1NTIyMA.csv",
    )
    df = pd.concat([df1, df2], axis=0, ignore_index=True)

    time_series = []

    for index, row in df.iterrows():
        action = row["Action"]
        time = row["Time"]
        ticker = row["Ticker"]
        name = row["Name"]
        no_of_shares = row["No. of shares"]
        price_per_share = row["Price / share"]
        currency_price_per_share = row["Currency (Price / share)"]
        result = row["Result"]
        total = row["Total"]

        prev_data = time_series[index - 1] if index > 0 else {}
        prev_total_deposit = (
            prev_data["total_deposit"] if bool(prev_data) is True else 0
        )
        prev_total_value = prev_data["total_value"] if bool(prev_data) is True else 0
        prev_total_realised_p_l = (
            prev_data["total_realised_p_l"] if bool(prev_data) is True else 0
        )
        prev_total_dividend = (
            prev_data["total_dividend"] if bool(prev_data) is True else 0
        )
        prev_total_interest = (
            prev_data["total_interest"] if bool(prev_data) is True else 0
        )
        prev_total_gain = prev_data["total_gain"] if bool(prev_data) is True else 0
        prev_positions = prev_data["positions"] if bool(prev_data) is True else []
        new_total_deposit = prev_total_deposit
        new_total_value = prev_total_value
        new_total_realised_p_l = prev_total_realised_p_l
        new_total_dividend = prev_total_dividend
        new_total_interest = prev_total_interest
        new_total_gain = prev_total_gain
        new_positions = prev_positions[:]
        position = next((x for x in new_positions if x["ticker"] == ticker), None)

        if action == "Deposit" or action == "Withdrawal":
            new_total_deposit = new_total_deposit + total
            new_total_value = new_total_value + total
        elif action == "Market buy" or action == "Limit buy":
            if position is None:
                new_positions.append(
                    {
                        "ticker": ticker,
                        "name": name,
                        "no_of_shares": no_of_shares,
                        "average_price_per_share": price_per_share,
                        "currency_average_price_per_share": currency_price_per_share,
                        "total_realised_p_l": 0,
                        "total_dividend": 0,
                        "total_inflow": total,
                        "overall_gain": 0,
                    }
                )
            else:
                position["average_price_per_share"] = round(
                    (
                        position["no_of_shares"] * position["average_price_per_share"]
                        + no_of_shares * price_per_share
                    )
                    / (position["no_of_shares"] + no_of_shares),
                    2,
                )
                position["no_of_shares"] = round(
                    position["no_of_shares"] + no_of_shares, 10
                )
                position["total_inflow"] = round(position["total_inflow"] + total, 2)
        elif action == "Market sell" or action == "Limit sell":
            if position is None:
                print("Cant find position for market sell " + ticker)
            else:
                position["no_of_shares"] = round(
                    position["no_of_shares"] - no_of_shares, 10
                )
                position["total_realised_p_l"] = round(
                    position["total_realised_p_l"] + result, 2
                )
                new_total_realised_p_l += result
                new_total_gain += result
                new_total_value += result
        elif (
            action == "Dividend (Ordinary)"
            or action == "Dividend (Dividends paid by us corporations)"
            or action == "Dividend (Dividends paid by foreign corporations)"
            or action == "Dividend (Dividend)"
        ):
            if position is None:
                print("Cant find position for dividend " + ticker)
            else:
                position["total_dividend"] = round(
                    position["total_dividend"] + total, 2
                )
                new_total_dividend += total
                new_total_gain += total
                new_total_value += total
        elif action == "Interest on cash":
            new_total_interest += total
            new_total_gain += total
            new_total_value += total
        else:
            print(action)
            break

        if position is not None:
            position["overall_gain"] = (
                position["total_realised_p_l"] + position["total_dividend"]
            ) / position["total_inflow"]

        time_series.append(
            {
                "time": time,
                "total_deposit": round(new_total_deposit, 2),
                "total_value": round(new_total_value, 2),
                "total_realised_p_l": round(new_total_realised_p_l, 2),
                "total_dividend": round(new_total_dividend, 2),
                "total_interest": round(new_total_interest, 2),
                "total_gain": round(new_total_gain, 2),
                "positions": new_positions,
            }
        )

    url = "https://live.trading212.com/api/v0/equity/portfolio"
    headers = {"Authorization": API_KEY}
    response = requests.get(url, headers=headers)
    data = response.json()
    tm.sleep(5)

    position = next((x for x in new_positions if x["ticker"] == ticker), None)

    last_line = time_series[-1]
    final_positions = []

    for position in last_line["positions"]:
        unrealised_p_l = 0
        if position["no_of_shares"] > 0:
            current_ticker_data = next(
                (
                    x
                    for x in data
                    if x["quantity"] == position["no_of_shares"]
                    and abs(x["averagePrice"] - position["average_price_per_share"]) < 1
                ),
                None,
            )
            if current_ticker_data is None:
                print("None for " + position["ticker"])
            else:
                unrealised_p_l = current_ticker_data["ppl"]
        final_positions.append(
            {
                "ticker": position["ticker"],
                "name": position["name"],
                "no_of_shares": position["no_of_shares"],
                "average_price_per_share": position["average_price_per_share"],
                "currency_average_price_per_share": position[
                    "currency_average_price_per_share"
                ],
                "total_realised_p_l": position["total_realised_p_l"],
                "total_dividend": position["total_dividend"],
                "unrealised_p_l": unrealised_p_l,
                "total_inflow": position["total_inflow"],
                "overall_gain": (
                    position["total_realised_p_l"]
                    + position["total_dividend"]
                    + unrealised_p_l
                )
                / position["total_inflow"],
            }
        )

    url = "https://live.trading212.com/api/v0/equity/account/cash"
    headers = {"Authorization": API_KEY}
    response = requests.get(url, headers=headers)
    account_data = response.json()

    total_unrealised_p_l = account_data["ppl"]
    total_overall_gain = (last_line["total_gain"] + account_data["ppl"]) / last_line[
        "total_deposit"
    ]

    from_date = pd.to_datetime(df.iloc[0]["Time"])
    years = (datetime.now().date() - from_date.date()).days / 365.25
    cagr = pow(1 + total_overall_gain, 1 / years) - 1

    summary = {
        "time": last_line["time"],
        "total_deposit": last_line["total_deposit"],
        "total_value": last_line["total_value"],
        "total_realised_p_l": last_line["total_realised_p_l"],
        "total_dividend": last_line["total_dividend"],
        "total_interest": last_line["total_interest"],
        "total_gain": last_line["total_gain"],
        "total_unrealised_p_l": total_unrealised_p_l,
        "total_overall_gain": round(total_overall_gain * 100, 2),
        "cagr": round(cagr * 100, 2),
        "positions": sorted(
            final_positions, key=lambda x: x["total_inflow"], reverse=True
        ),
    }

    with open("data.json", "w") as f:
        json.dump(summary, f, indent=4)


main()
