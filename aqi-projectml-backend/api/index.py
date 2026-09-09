from app import app

# Vercel Python serverless entrypoint
# The Flask app is imported from the project root app.py file.
# The platform invokes this module and routes HTTP requests through the Flask app.

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
