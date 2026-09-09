# AQI Monitoring & Analytics Project

A full-stack air quality monitoring dashboard that combines a React frontend with a Flask backend to compare cities, rank neighborhoods, inspect pollutant trends, and generate AQI-based insights.

## Features

- Live AQI dashboard for a selected city
- Nearby air quality ranking and comparison views
- City-to-city AQI comparisons
- Environmental risk and dominant pollutant analysis
- Forecast and trend summaries
- Downloadable comparison reports
- Heatmap and map-based AQI visualization

## Tech Stack

- Frontend: React, JavaScript, Tailwind CSS
- Backend: Python, Flask
- Data & analytics: AQI calculations, risk scoring, summary generation
- Visualization: Chart.js, Leaflet

## Project Structure

- `aqi-app/` — React frontend application
- `aqi-projectml-backend/` — Flask API and analytics backend
- `run_backend.bat` — backend start script
- `run_frontend.bat` — frontend start script

## Prerequisites

- Node.js and npm
- Python 3.10+
- pip

## Frontend Setup

```bash
cd aqi-app
npm install
npm start
```

The frontend reads the API base URL from the `REACT_APP_API_BASE_URL` environment variable. If not set, it falls back to the local backend default.

## Backend Setup

```bash
cd aqi-projectml-backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The backend runs on the local Flask server and serves AQI endpoints used by the frontend.

## Run Scripts

On Windows, you can also use:

```bash
run_backend.bat
run_frontend.bat
```

## Notes

- The app includes normalized pollutant severity logic so the dominant pollutant is determined by relative threshold impact rather than raw pollutant magnitude.
- The project includes backend tests for AQI endpoint behavior and nearby/heatmap logic.

## License

This project is for educational/demo purposes.
