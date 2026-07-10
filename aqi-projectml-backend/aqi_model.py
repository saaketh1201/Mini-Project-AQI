import pandas as pd
import numpy as np
from prophet import Prophet
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error


def _mape(y_true, y_pred):
    y_true, y_pred = np.array(y_true), np.array(y_pred)
    mask = y_true != 0
    if not mask.any():
        return 0.0
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)


def _metrics(y_true, y_pred):
    return {
        "MAE":  float(mean_absolute_error(y_true, y_pred)),
        "RMSE": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "MAPE": _mape(y_true, y_pred),
    }


def _prep_df(history_data):
    df = pd.DataFrame(history_data, columns=["ds", "y"])
    df["ds"] = pd.to_datetime(df["ds"], unit="s")
    df = df.sort_values("ds").reset_index(drop=True)
    df = df.dropna().loc[df["y"] >= 0]
    return df


def _infer_freq(df):
    df_idx = df.set_index("ds")
    freq = pd.infer_freq(df_idx.index)
    if freq is None:
        median_delta = df_idx.index.to_series().diff().dropna().median()
        if pd.isna(median_delta) or median_delta.total_seconds() <= 3600:
            return "h"
        return "D"
    return freq


def _run_prophet(train_df, test_df, forecast_periods, freq):
    model = Prophet(daily_seasonality=False, yearly_seasonality=False, weekly_seasonality=False)
    model.fit(train_df)
    future = model.make_future_dataframe(periods=forecast_periods, freq=freq)
    forecast_full = model.predict(future)
    forecast_tail = forecast_full[["ds", "yhat"]].tail(forecast_periods).copy()
    forecast_tail["ds"] = forecast_tail["ds"].astype(str)

    m = {"MAE": 0.0, "RMSE": 0.0, "MAPE": 0.0}
    if len(test_df) > 0:
        y_true = test_df["y"].values
        y_pred = forecast_full["yhat"].iloc[len(train_df): len(train_df) + len(test_df)].values
        min_len = min(len(y_true), len(y_pred))
        if min_len > 0:
            m = _metrics(y_true[:min_len], y_pred[:min_len])

    return forecast_tail.to_dict(orient="records"), m


def _run_linear(train_df, test_df, forecast_periods):
    X_train = np.arange(len(train_df)).reshape(-1, 1)
    y_train = train_df["y"].values
    model = LinearRegression()
    model.fit(X_train, y_train)

    m = {"MAE": 0.0, "RMSE": 0.0, "MAPE": 0.0}
    if len(test_df) > 0:
        X_test = np.arange(len(train_df), len(train_df) + len(test_df)).reshape(-1, 1)
        y_pred = model.predict(X_test)
        m = _metrics(test_df["y"].values, y_pred)

    total_len = len(train_df)
    future_X = np.arange(total_len, total_len + forecast_periods).reshape(-1, 1)
    preds = np.clip(model.predict(future_X), 0, None)

    last_ts = train_df["ds"].iloc[-1]
    try:
        freq = _infer_freq(train_df)
        future_dates = pd.date_range(start=last_ts, periods=forecast_periods + 1, freq=freq)[1:]
    except Exception:
        future_dates = pd.date_range(start=last_ts, periods=forecast_periods + 1, freq="h")[1:]

    forecast = [{"ds": str(d), "yhat": round(float(v), 2)} for d, v in zip(future_dates, preds)]
    return forecast, m


def _run_rf(train_df, test_df, forecast_periods):
    window = min(5, len(train_df) - 1)
    if window < 1:
        return [], {"MAE": 0.0, "RMSE": 0.0, "MAPE": 0.0}

    values = train_df["y"].values

    def make_features(arr, w):
        X, y = [], []
        for i in range(w, len(arr)):
            X.append(arr[i - w: i])
            y.append(arr[i])
        return np.array(X), np.array(y)

    X_train, y_train = make_features(values, window)
    if len(X_train) < 2:
        return [], {"MAE": 0.0, "RMSE": 0.0, "MAPE": 0.0}

    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    m = {"MAE": 0.0, "RMSE": 0.0, "MAPE": 0.0}
    if len(test_df) > 0:
        all_values = np.concatenate([values, test_df["y"].values])
        X_test, y_test_true = make_features(all_values[-(len(test_df) + window):], window)
        if len(X_test) > 0:
            y_pred = model.predict(X_test)
            m = _metrics(y_test_true[:len(y_pred)], y_pred)

    buf = list(values[-window:])
    preds = []
    for _ in range(forecast_periods):
        val = float(model.predict([buf[-window:]])[0])
        val = max(0.0, val)
        preds.append(val)
        buf.append(val)

    last_ts = train_df["ds"].iloc[-1]
    try:
        freq = _infer_freq(train_df)
        future_dates = pd.date_range(start=last_ts, periods=forecast_periods + 1, freq=freq)[1:]
    except Exception:
        future_dates = pd.date_range(start=last_ts, periods=forecast_periods + 1, freq="h")[1:]

    forecast = [{"ds": str(d), "yhat": round(v, 2)} for d, v in zip(future_dates, preds)]
    return forecast, m


def train_and_predict_pm25(history_data, forecast_periods=48):
    if not history_data or len(history_data) < 5:
        return [], {"MAE": 0, "RMSE": 0, "MAPE": 0, "model": "insufficient_data"}

    try:
        df = _prep_df(history_data)
        if len(df) < 5:
            return [], {"MAE": 0, "RMSE": 0, "MAPE": 0, "model": "insufficient_data"}

        freq = _infer_freq(df)
        df_resampled = df.set_index("ds").asfreq(freq).reset_index()
        df_resampled = df_resampled.ffill()

        train_size = max(5, int(len(df_resampled) * 0.8))
        train_df = df_resampled.iloc[:train_size].reset_index(drop=True)
        test_df  = df_resampled.iloc[train_size:].reset_index(drop=True)

        results = {}

        try:
            fc, m = _run_prophet(train_df, test_df, forecast_periods, freq)
            results["Prophet"] = {"forecast": fc, "metrics": m}
        except Exception as e:
            print(f"Prophet failed: {e}")

        try:
            fc, m = _run_linear(train_df, test_df, forecast_periods)
            results["LinearRegression"] = {"forecast": fc, "metrics": m}
        except Exception as e:
            print(f"LinearRegression failed: {e}")

        try:
            fc, m = _run_rf(train_df, test_df, forecast_periods)
            if fc:
                results["RandomForest"] = {"forecast": fc, "metrics": m}
        except Exception as e:
            print(f"RandomForest failed: {e}")

        if not results:
            return [], {"MAE": 0, "RMSE": 0, "MAPE": 0, "model": "failed"}

        best_name = min(results, key=lambda k: results[k]["metrics"]["RMSE"])
        best = results[best_name]

        all_metrics = {
            name: r["metrics"] for name, r in results.items()
        }

        return best["forecast"], {
            **best["metrics"],
            "model": best_name,
            "all_models": all_metrics,
        }

    except Exception as e:
        print(f"Forecast pipeline error: {e}")
        return [], {"MAE": 0, "RMSE": 0, "MAPE": 0, "model": "error"}
#